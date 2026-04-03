"""
Deep Document Parser
====================

Parses documents with DeepSeek OCR (PDF/image-first) to extract markdown,
tables, and images with structural metadata.

Supported formats: PDF + images (DeepSeek OCR)
Fallback: TXT, MD (via legacy loader)
"""
from __future__ import annotations

import logging
import re
import shutil
import time
import uuid
from pathlib import Path
from typing import Optional

from app.core.config import settings
from app.services.models.parsed_document import (
    ExtractedImage,
    ExtractedTable,
    EnrichedChunk,
    ParsedDocument,
)

logger = logging.getLogger(__name__)

# File extensions handled by OCR / legacy
_OCR_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff"}
_LEGACY_EXTENSIONS = {".txt", ".md"}


class DeepDocumentParser:
    """
    Parses documents using DeepSeek OCR for rich structural extraction.

    - Converts PDF/images via DeepSeek OCR (OCR-first pipeline)
    - Chunks OCR markdown for retrieval
    - Extracts tables and enriches markdown with optional captions
    - Optionally applies ProtonX Vietnamese correction on OCR markdown
    - Falls back to legacy text extraction for TXT/MD
    """

    def __init__(self, workspace_id: int, output_dir: Optional[Path] = None):
        self.workspace_id = workspace_id
        self.output_dir = output_dir or (
            settings.BASE_DIR / "data" / "docling" / f"kb_{workspace_id}"
        )

    @staticmethod
    def is_deepseek_supported(file_path: str | Path) -> bool:
        """Check if the file format is supported by DeepSeek OCR."""
        return Path(file_path).suffix.lower() in _OCR_EXTENSIONS

    def parse(
        self,
        file_path: str | Path,
        document_id: int,
        original_filename: str,
    ) -> ParsedDocument:
        """
        Parse a document and return structured result.

        Args:
            file_path: Path to the document file
            document_id: Database document ID
            original_filename: Original filename for citations

        Returns:
            ParsedDocument with markdown, chunks, and images
        """
        path = Path(file_path)
        suffix = path.suffix.lower()
        start_time = time.time()

        if suffix in _OCR_EXTENSIONS:
            result = self._parse_with_deepseek(path, document_id, original_filename)
        elif suffix in _LEGACY_EXTENSIONS:
            result = self._parse_legacy(path, document_id, original_filename)
        else:
            raise ValueError(
                f"Unsupported file type: {suffix}. "
                f"Supported: {_OCR_EXTENSIONS | _LEGACY_EXTENSIONS}"
            )

        elapsed_ms = int((time.time() - start_time) * 1000)
        logger.info(
            f"Parsed document {document_id} ({original_filename}) in {elapsed_ms}ms: "
            f"{result.page_count} pages, {len(result.chunks)} chunks, "
            f"{len(result.images)} images, {result.tables_count} tables"
        )
        return result

    def _parse_with_deepseek(
        self,
        file_path: Path,
        document_id: int,
        original_filename: str,
    ) -> ParsedDocument:
        """Parse PDF/image with DeepSeek OCR and convert to internal ParsedDocument."""
        from app.services.ocr import get_deepseek_ocr_service

        temp_output = self.output_dir / "_deepseek_temp" / str(document_id)
        if temp_output.exists():
            shutil.rmtree(temp_output, ignore_errors=True)
        temp_output.mkdir(parents=True, exist_ok=True)

        logger.info("DeepSeek OCR converting: %s", file_path)

        ocr = get_deepseek_ocr_service()
        suffix = file_path.suffix.lower()
        if suffix == ".pdf":
            pages = ocr.ocr_pdf(file_path, temp_output)
        else:
            pages = ocr.ocr_image(file_path, temp_output)

        if not pages:
            raise RuntimeError("DeepSeek OCR returned empty pages")

        # Persist page images into static image store
        images_dir = self.output_dir / "images"
        images_dir.mkdir(parents=True, exist_ok=True)

        images: list[ExtractedImage] = []
        markdown_pages: list[str] = []

        try:
            from PIL import Image
        except Exception:
            Image = None

        for page in pages:
            image_id = str(uuid.uuid4())
            dst = images_dir / f"{image_id}.png"
            src = Path(page.image_path)
            width = 0
            height = 0

            try:
                if Image is not None:
                    with Image.open(src) as im:
                        if im.mode in {"RGBA", "LA", "P"}:
                            im = im.convert("RGB")
                        width, height = im.size
                        im.save(dst, format="PNG")
                else:
                    shutil.copy2(src, dst)
            except Exception as e:
                logger.warning("Failed to copy DeepSeek page image %s: %s", src, e)
                continue

            images.append(
                ExtractedImage(
                    image_id=image_id,
                    document_id=document_id,
                    page_no=page.page_no,
                    file_path=str(dst),
                    caption=f"OCR page {page.page_no}",
                    width=width,
                    height=height,
                    mime_type="image/png",
                )
            )

            img_url = f"/static/doc-images/kb_{self.workspace_id}/images/{image_id}.png"
            page_md = (page.markdown or "").strip()
            if page_md:
                markdown_pages.append(f"{page_md}\n\n![OCR Page {page.page_no}]({img_url})")
            else:
                markdown_pages.append(f"![OCR Page {page.page_no}]({img_url})")

        markdown = "\n\n---\n\n".join(markdown_pages).strip()
        if not markdown:
            raise RuntimeError("DeepSeek OCR markdown is empty")

        if settings.CUONGRAG_ENABLE_PROTONX_CORRECTION:
            markdown = self._apply_protonx_correction(markdown)

        tables = self._extract_tables_from_markdown(markdown, document_id)
        if settings.CUONGRAG_ENABLE_TABLE_CAPTIONING and tables:
            self._caption_tables(tables)
        markdown = self._inject_table_captions(markdown, tables)

        page_count = len(pages)
        chunks = self._chunk_mineru_markdown(
            markdown=markdown,
            document_id=document_id,
            original_filename=original_filename,
            images=images,
            tables=tables,
        )

        shutil.rmtree(temp_output, ignore_errors=True)

        return ParsedDocument(
            document_id=document_id,
            original_filename=original_filename,
            markdown=markdown,
            page_count=page_count,
            chunks=chunks,
            images=images,
            tables=tables,
            tables_count=len(tables),
        )

    def _chunk_mineru_markdown(
        self,
        markdown: str,
        document_id: int,
        original_filename: str,
        images: list[ExtractedImage],
        tables: list[ExtractedTable],
    ) -> list[EnrichedChunk]:
        from app.services.chunker import DocumentChunker

        chunker = DocumentChunker(
            chunk_size=max(1000, settings.CUONGRAG_CHUNK_MAX_TOKENS * 4),
            chunk_overlap=120,
        )
        text_chunks = chunker.split_text(markdown, source=original_filename)

        page_break_positions = [m.start() for m in re.finditer(r"\n\s*---\s*\n", markdown)]
        img_url_to_id = {
            f"/static/doc-images/kb_{self.workspace_id}/images/{img.image_id}.png": img.image_id
            for img in images
        }

        chunks: list[EnrichedChunk] = []
        for tc in text_chunks:
            page_no = 1 + sum(1 for p in page_break_positions if p < tc.char_start)

            image_refs: list[str] = []
            for url, img_id in img_url_to_id.items():
                if url in tc.content:
                    image_refs.append(img_id)

            chunks.append(EnrichedChunk(
                content=tc.content,
                chunk_index=tc.chunk_index,
                source_file=original_filename,
                document_id=document_id,
                page_no=page_no,
                heading_path=[],
                image_refs=image_refs,
                table_refs=[],
                has_table=("|" in tc.content and "---" in tc.content),
                has_code=("```" in tc.content),
                contextualized=tc.content[:120],
            ))

        if tables:
            logger.info("MinerU markdown chunking: %s chunks, %s tables", len(chunks), len(tables))
        return chunks

    def _extract_tables_from_markdown(
        self,
        markdown: str,
        document_id: int,
    ) -> list[ExtractedTable]:
        tables: list[ExtractedTable] = []

        # HTML tables
        for m in re.finditer(r"<table.*?>.*?</table>", markdown, re.IGNORECASE | re.DOTALL):
            table_md = m.group(0).strip()
            rows = table_md.lower().count("<tr")
            cols = 0
            first_row = re.search(r"<tr.*?>(.*?)</tr>", table_md, re.IGNORECASE | re.DOTALL)
            if first_row:
                cols = len(re.findall(r"<t[dh].*?>", first_row.group(1), re.IGNORECASE))
            page_no = 1 + len(re.findall(r"\n\s*---\s*\n", markdown[:m.start()]))
            tables.append(ExtractedTable(
                table_id=str(uuid.uuid4()),
                document_id=document_id,
                page_no=page_no,
                content_markdown=table_md,
                num_rows=rows,
                num_cols=cols,
            ))

        # Markdown tables (block-level)
        lines = markdown.splitlines()
        i = 0
        line_offset = 0
        while i < len(lines):
            line = lines[i]
            if line.strip().startswith("|"):
                block = [line]
                j = i + 1
                while j < len(lines) and lines[j].strip().startswith("|"):
                    block.append(lines[j])
                    j += 1

                has_separator = any("---" in b for b in block)
                if has_separator and len(block) >= 2:
                    table_md = "\n".join(block)
                    page_no = 1 + len(re.findall(r"\n\s*---\s*\n", markdown[:line_offset]))
                    row_count = max(0, len(block) - 2)
                    col_count = len([c for c in block[0].split("|") if c.strip()])
                    tables.append(ExtractedTable(
                        table_id=str(uuid.uuid4()),
                        document_id=document_id,
                        page_no=page_no,
                        content_markdown=table_md,
                        num_rows=row_count,
                        num_cols=col_count,
                    ))

                i = j
                line_offset += sum(len(x) + 1 for x in block)
                continue

            line_offset += len(line) + 1
            i += 1

        return tables

    def _apply_protonx_correction(self, markdown: str) -> str:
        """Best-effort Vietnamese diacritics correction with ProtonX model."""
        if not markdown.strip():
            return markdown

        # Preferred path: shared ProtonX utilities (ported from OCR service)
        try:
            from app.utils.vn_spell_corrector import correct_vietnamese_diacritics
            from app.utils.vn_model_corrector import correct_with_model

            corrected = correct_vietnamese_diacritics(markdown)
            corrected = correct_with_model(
                corrected,
                model_name=settings.CUONGRAG_PROTONX_MODEL_NAME,
            )
            return corrected
        except Exception as e:
            logger.warning("ProtonX utility correction fallback to legacy path: %s", e)

        try:
            import torch
            from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
        except Exception as e:
            logger.warning("ProtonX correction skipped (missing deps): %s", e)
            return markdown

        model_name = settings.CUONGRAG_PROTONX_MODEL_NAME
        batch_size = max(1, settings.CUONGRAG_PROTONX_BATCH_SIZE)
        max_new_tokens = max(16, settings.CUONGRAG_PROTONX_MAX_NEW_TOKENS)

        lines = markdown.splitlines()
        idxs: list[int] = []
        payload: list[str] = []
        for i, line in enumerate(lines):
            text = line.strip()
            if self._skip_protonx_line(text):
                continue
            idxs.append(i)
            payload.append(text)

        if not payload:
            return markdown

        device = "cuda" if torch.cuda.is_available() else "cpu"
        try:
            tokenizer = AutoTokenizer.from_pretrained(model_name)
            model = AutoModelForSeq2SeqLM.from_pretrained(model_name)
            model.to(device)
            model.eval()
        except Exception as e:
            logger.warning("ProtonX model load failed (%s): %s", model_name, e)
            return markdown

        try:
            for start in range(0, len(payload), batch_size):
                batch = payload[start:start + batch_size]
                encoded = tokenizer(
                    batch,
                    return_tensors="pt",
                    padding=True,
                    truncation=True,
                    max_length=512,
                ).to(device)

                with torch.no_grad():
                    generated = model.generate(
                        **encoded,
                        max_new_tokens=max_new_tokens,
                        num_beams=2,
                        early_stopping=True,
                    )

                decoded = tokenizer.batch_decode(generated, skip_special_tokens=True)
                for off, text in enumerate(decoded):
                    line_idx = idxs[start + off]
                    normalized = " ".join((text or "").split())
                    if normalized:
                        lines[line_idx] = normalized
        except Exception as e:
            logger.warning("ProtonX inference failed: %s", e)
        finally:
            try:
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
            except Exception:
                pass

        return "\n".join(lines)

    @staticmethod
    def _skip_protonx_line(text: str) -> bool:
        if not text or len(text) < 20:
            return True
        if text.startswith("#"):
            return True
        if text.startswith("|"):
            return True
        if text.startswith("!"):
            return True
        if text.startswith("<table") or text.startswith("</table"):
            return True
        if text.startswith("```"):
            return True
        return False

    _TABLE_CAPTION_PROMPT = (
        "You are a document analysis assistant. Given a markdown table, "
        "write a concise description that covers:\n"
        "- The purpose/topic of the table\n"
        "- Key column names and what they represent\n"
        "- Notable values, trends, or outliers\n\n"
        "RULES:\n"
        "- Write 2-4 sentences, max 500 characters.\n"
        "- Be factual — describe only what is in the table.\n"
        "- Write in the SAME LANGUAGE as the table content. "
        "If the table is in Vietnamese, write in Vietnamese. "
        "If in English, write in English.\n\n"
        "Table:\n"
    )

    def _caption_tables(self, tables: list[ExtractedTable]) -> None:
        """Caption tables using LLM (text-only, no vision needed)."""
        from app.services.llm import get_llm_provider
        from app.services.llm.types import LLMMessage

        provider = get_llm_provider()

        for tbl in tables:
            if tbl.caption:
                continue
            try:
                table_md = tbl.content_markdown
                # Truncate large tables
                if len(table_md) > settings.CUONGRAG_MAX_TABLE_MARKDOWN_CHARS:
                    table_md = table_md[:settings.CUONGRAG_MAX_TABLE_MARKDOWN_CHARS] + "\n... (truncated)"

                message = LLMMessage(
                    role="user",
                    content=self._TABLE_CAPTION_PROMPT + table_md,
                    images=[],
                )
                result = provider.complete([message])
                if result:
                    tbl.caption = " ".join(result.strip().split())[:500]
            except Exception as e:
                logger.debug(f"Failed to caption table {tbl.table_id}: {e}")

    @staticmethod
    def _inject_table_captions(
        markdown: str, tables: list[ExtractedTable]
    ) -> str:
        """Inject table captions as blockquotes after matching table blocks in markdown."""
        if not tables:
            return markdown

        # Only process tables that have captions
        captioned = [t for t in tables if t.caption]
        if not captioned:
            return markdown

        lines = markdown.split("\n")
        result_lines: list[str] = []
        matched_count = 0

        # Build a lookup: first data row content → table caption
        # (skip the header row and separator row, use the first data row)
        table_lookup: dict[str, ExtractedTable] = {}
        for tbl in captioned:
            tbl_lines = tbl.content_markdown.strip().split("\n")
            # Find first data row (skip header + separator)
            for tl in tbl_lines:
                tl_stripped = tl.strip()
                if tl_stripped.startswith("|") and "---" not in tl_stripped:
                    # Use cell content as key (strip pipes and whitespace)
                    cells = [c.strip() for c in tl_stripped.split("|") if c.strip()]
                    if cells:
                        key = "|".join(cells[:3])  # Use first 3 cells as key
                        table_lookup[key] = tbl
                        break

        i = 0
        while i < len(lines):
            line = lines[i]
            result_lines.append(line)

            # Detect start of a table block (line starts with |)
            if line.strip().startswith("|"):
                # Collect all consecutive table lines
                table_block_start = i
                while i + 1 < len(lines) and lines[i + 1].strip().startswith("|"):
                    i += 1
                    result_lines.append(lines[i])

                # Try to match this table block to a captioned table
                block_lines = lines[table_block_start:i + 1]
                for bl in block_lines:
                    bl_stripped = bl.strip()
                    if bl_stripped.startswith("|") and "---" not in bl_stripped:
                        cells = [c.strip() for c in bl_stripped.split("|") if c.strip()]
                        if cells:
                            key = "|".join(cells[:3])
                            if key in table_lookup:
                                tbl = table_lookup.pop(key)
                                result_lines.append(f"\n> **Table:** {tbl.caption}")
                                matched_count += 1
                                break

            i += 1

        logger.info(
            f"Injected {matched_count}/{len(captioned)} table captions into markdown"
        )
        return "\n".join(result_lines)

    def _caption_images(self, images: list[ExtractedImage]) -> None:
        """Caption images using the configured LLM provider (sync, best-effort).

        Generates detailed descriptions so that image content is
        semantically searchable when embedded alongside text chunks.
        """
        from app.services.llm import get_llm_provider
        from app.services.llm.types import LLMImagePart, LLMMessage

        provider = get_llm_provider()
        if not provider.supports_vision():
            logger.warning("LLM provider does not support vision — skipping image captioning")
            return

        _CAPTION_PROMPT = (
            "Describe ONLY what you can directly see in this image. "
            "Do NOT infer, assume, or add any information not visible.\n\n"
            "Include:\n"
            "- Type of visual (chart, table, diagram, photo, screenshot, etc.)\n"
            "- ALL specific numbers, percentages, and labels that are VISIBLE in the image\n"
            "- Axis labels, legend text, and category names exactly as shown\n"
            "- Trends or comparisons that are visually obvious\n\n"
            "RULES:\n"
            "- Write 2-4 concise sentences, max 400 characters.\n"
            "- Do NOT start with 'This image shows' or 'Here is'.\n"
            "- Do NOT add any data, context, or interpretation beyond what is visible.\n"
            "- If text in the image is not clearly readable, say so.\n"
            "- Write in the SAME LANGUAGE as any text visible in the image. "
            "If the text is in Vietnamese, write in Vietnamese. "
            "If in English, write in English."
        )

        for img in images:
            if img.caption:  # already has caption from document
                continue
            try:
                image_path = Path(img.file_path)
                if not image_path.exists():
                    continue

                with open(image_path, "rb") as f:
                    image_bytes = f.read()

                message = LLMMessage(
                    role="user",
                    content=_CAPTION_PROMPT,
                    images=[LLMImagePart(data=image_bytes, mime_type=img.mime_type)],
                )
                result = provider.complete([message])
                if result:
                    # Collapse to single line — prevents breaking ![alt](url) markdown
                    img.caption = " ".join(result.strip().split())[:500]

            except Exception as e:
                logger.debug(f"Failed to caption image {img.image_id}: {e}")

    def _parse_legacy(
        self,
        file_path: Path,
        document_id: int,
        original_filename: str,
    ) -> ParsedDocument:
        """Fallback: parse TXT/MD with legacy loader + RecursiveCharacterTextSplitter."""
        from app.services.document_loader import load_document
        from app.services.chunker import DocumentChunker

        loaded = load_document(str(file_path))
        chunker = DocumentChunker(chunk_size=500, chunk_overlap=50)
        text_chunks = chunker.split_text(
            text=loaded.content,
            source=original_filename,
            extra_metadata={"document_id": document_id, "file_type": loaded.file_type},
        )

        # Wrap legacy chunks as EnrichedChunks
        chunks = [
            EnrichedChunk(
                content=tc.content,
                chunk_index=tc.chunk_index,
                source_file=original_filename,
                document_id=document_id,
                page_no=0,
            )
            for tc in text_chunks
        ]

        return ParsedDocument(
            document_id=document_id,
            original_filename=original_filename,
            markdown=loaded.content,
            page_count=loaded.page_count,
            chunks=chunks,
            images=[],
            tables_count=0,
        )
