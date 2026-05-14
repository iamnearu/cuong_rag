"""
Docling Document Parser — Optimized
=====================================

Uses the Docling library (IBM) to convert PDF/DOCX/PPTX/images to markdown.
Optimized pipeline configuration based on OCR-SERVICE best practices:

- OCR enabled (RapidOCR preferred, fallback to EasyOCR/Tesseract)
- Table structure recognition with cell matching
- GPU acceleration when CUDA is available
- High-quality image extraction (images_scale=2.0)
- Markdown export with referenced images
- Post-processing: clean markdown, normalize paths, fix LaTeX

Returns DoclingParseResult containing per-page data (DoclingOCRPage list)
and all figure/picture regions detected by Docling (ExtractedPicture list).
"""
from __future__ import annotations

import logging
import os
import re
import shutil
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class DoclingOCRPage:
    """One page of a Docling-parsed document."""
    page_no: int
    markdown: str
    image_path: str  # path to full-page image (rendered from PDF)


@dataclass
class ExtractedPicture:
    """A picture/figure region cropped and recognized by Docling (NOT a full page)."""
    page_no: int
    image_path: str   # full path to the saved cropped image file
    local_ref: str    # local ref used in markdown, e.g. "images/docling_0.jpg"


@dataclass
class DoclingParseResult:
    """Full result from DoclingParserService.parse_document()."""
    pages: list[DoclingOCRPage]           # per-page data with full-page renders
    pictures: list[ExtractedPicture]      # figure/picture regions extracted by Docling


# ═══════════════════════════════════════════════════════════════════
# MARKDOWN CLEANING (ported from OCR-SERVICE postprocess_md.py)
# ═══════════════════════════════════════════════════════════════════

def clean_markdown(text: str) -> str:
    """
    Clean markdown output from Docling:
    - Normalize spacing and newlines
    - Fix LaTeX symbols
    - Normalize image paths
    - Remove special tokens
    """
    if not text:
        return ""

    # 1. Remove special tokens (from various OCR engines)
    text = text.replace("<｜end▁of▁sentence｜>", "")
    text = text.replace("<|endoftext|>", "")

    # 2. Fix LaTeX symbols
    text = text.replace("\\coloneqq", ":=")
    text = text.replace("\\eqqcolon", "=:")

    # 3. Normalize newlines (max 2 consecutive)
    text = re.sub(r'\n{3,}', '\n\n', text)

    # 4. Normalize spaces (max 1 consecutive, preserve table alignment)
    lines = text.split('\n')
    cleaned_lines = []
    for line in lines:
        # Don't collapse spaces in table rows
        if line.strip().startswith('|'):
            cleaned_lines.append(line.rstrip())
        else:
            cleaned_lines.append(re.sub(r'[ \t]{2,}', ' ', line).rstrip())
    text = '\n'.join(cleaned_lines)

    # 5. Clean up heading spacing
    text = re.sub(r'\n(#+)', r'\n\n\1', text)
    text = re.sub(r'(#+[^\n]+)\n([^#\n])', r'\1\n\n\2', text)

    # 6. Normalize image paths
    def normalize_img_path(match):
        alt = match.group(1)
        path = match.group(2)
        filename = os.path.basename(path)
        if not path.startswith('images/'):
            return f'![{alt}](images/{filename})'
        return match.group(0)

    text = re.sub(r'!\[([^\]]*)\]\(([^)]+)\)', normalize_img_path, text)

    return text.strip()


class DoclingParserService:
    """
    Wraps the Docling DocumentConverter with optimized pipeline configuration.

    Key optimizations (from OCR-SERVICE):
    - OCR enabled with RapidOCR (fast + accurate for Vietnamese)
    - Table structure recognition with cell matching
    - GPU acceleration (CUDA) when available
    - High-quality image extraction (images_scale=2.0)
    - Proper markdown export with referenced images
    """

    def __init__(self):
        self._converter = None

    def _get_converter(self):
        """Lazy-load the Docling DocumentConverter with optimized pipeline."""
        if self._converter is not None:
            return self._converter

        from docling.document_converter import DocumentConverter, PdfFormatOption
        from docling.datamodel.pipeline_options import (
            PdfPipelineOptions,
            AcceleratorOptions,
            AcceleratorDevice,
        )
        from docling.datamodel.base_models import InputFormat

        # ═══════════════════════════════════════════════════════════
        # PIPELINE CONFIGURATION (from OCR-SERVICE docling_worker.py)
        # ═══════════════════════════════════════════════════════════
        pipeline_options = PdfPipelineOptions()

        # --- OCR ---
        pipeline_options.do_ocr = getattr(
            settings, "CUONGRAG_DOCLING_OCR_ENABLED", True
        )

        # --- Table Structure ---
        pipeline_options.do_table_structure = getattr(
            settings, "CUONGRAG_DOCLING_TABLE_STRUCTURE", True
        )
        pipeline_options.table_structure_options.do_cell_matching = True

        # --- Image Quality ---
        pipeline_options.images_scale = getattr(
            settings, "CUONGRAG_DOCLING_IMAGES_SCALE", 2.0
        )
        pipeline_options.generate_picture_images = True
        pipeline_options.generate_page_images = False

        # --- GPU Acceleration ---
        device = AcceleratorDevice.CPU
        try:
            import torch
            if torch.cuda.is_available():
                device = AcceleratorDevice.CUDA
                logger.info(
                    "Docling GPU: %s", torch.cuda.get_device_name(0)
                )
        except ImportError:
            pass

        num_threads = getattr(settings, "CUONGRAG_DOCLING_NUM_THREADS", 4)
        pipeline_options.accelerator_options = AcceleratorOptions(
            num_threads=num_threads, device=device
        )

        # --- OCR Engine: prefer RapidOCR (fast + accurate) ---
        use_rapidocr = getattr(
            settings, "CUONGRAG_DOCLING_USE_RAPIDOCR", True
        )
        if use_rapidocr:
            try:
                from docling.datamodel.pipeline_options import RapidOcrOptions
                pipeline_options.ocr_options = RapidOcrOptions()
                logger.info("Docling OCR engine: RapidOCR (fast)")
            except ImportError:
                logger.warning(
                    "RapidOCR not available, using default OCR engine. "
                    "Install: pip install rapidocr-onnxruntime"
                )

        # --- Build Converter ---
        self._converter = DocumentConverter(
            format_options={
                InputFormat.PDF: PdfFormatOption(
                    pipeline_options=pipeline_options
                )
            }
        )
        logger.info(
            "Docling DocumentConverter initialized "
            "(OCR=%s, tables=%s, device=%s, scale=%.1f)",
            pipeline_options.do_ocr,
            pipeline_options.do_table_structure,
            device.name,
            pipeline_options.images_scale,
        )
        return self._converter

    def _get_picture_page_numbers(self, doc) -> dict[int, int]:
        """
        Build a mapping of sequential picture index → page number by iterating
        PictureItem elements in document order via doc.iterate_items().
        Returns an empty dict if the API is unavailable.
        """
        try:
            from docling_core.types.doc import PictureItem
        except ImportError:
            try:
                from docling.datamodel.document import PictureItem
            except ImportError:
                logger.warning(
                    "Cannot import PictureItem — picture page numbers unavailable"
                )
                return {}

        page_map: dict[int, int] = {}
        idx = 0
        try:
            for item, _level in doc.iterate_items():
                if isinstance(item, PictureItem):
                    page_no = 1
                    if hasattr(item, "prov") and item.prov:
                        page_no = item.prov[0].page_no
                    page_map[idx] = page_no
                    idx += 1
        except Exception as exc:
            logger.warning("Failed to iterate doc items for picture page map: %s", exc)
        return page_map

    def parse_document(
        self,
        file_path: Path | str,
        output_dir: Path | str,
    ) -> DoclingParseResult:
        """
        Parse a document (PDF, DOCX, PPTX, image) and return per-page results
        plus all figure/picture regions recognized by Docling.

        Args:
            file_path: Path to the input document.
            output_dir: Directory to save page images and artifacts.

        Returns:
            DoclingParseResult containing:
              - pages: per-page markdown + full-page render path
              - pictures: each figure/image region Docling recognized, with page_no
        """
        file_path = Path(file_path)
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        converter = self._get_converter()

        logger.info("Docling converting: %s", file_path)
        result = converter.convert(str(file_path))

        if not result or not result.document:
            raise RuntimeError("Docling returned empty result")

        doc = result.document

        # Build picture→page mapping BEFORE any cleanup so we can tag each
        # extracted figure with the correct page number.
        picture_page_map = self._get_picture_page_numbers(doc)
        logger.debug(
            "Docling picture page map: %d pictures found", len(picture_page_map)
        )

        # ═══════════════════════════════════════════════════════════
        # EXPORT MARKDOWN WITH IMAGES (from OCR-SERVICE pattern)
        # ═══════════════════════════════════════════════════════════
        temp_artifacts = output_dir / "_docling_artifacts"
        temp_artifacts.mkdir(exist_ok=True)

        # Use save_as_markdown with REFERENCED mode to get images separately
        temp_md_path = output_dir / "_docling_temp.md"
        try:
            from docling_core.types.doc.base import ImageRefMode
            doc.save_as_markdown(
                filename=str(temp_md_path),
                artifacts_dir=temp_artifacts,
                image_mode=ImageRefMode.REFERENCED,
            )
        except (ImportError, TypeError, AttributeError) as e:
            # Fallback: use export_to_markdown if save_as_markdown is unavailable
            logger.warning(
                "save_as_markdown failed (%s), fallback to export_to_markdown",
                e,
            )
            raw_md = doc.export_to_markdown()
            temp_md_path.write_text(raw_md, encoding="utf-8")

        # Read exported markdown
        raw_markdown = temp_md_path.read_text(encoding="utf-8")
        temp_md_path.unlink(missing_ok=True)

        # ═══════════════════════════════════════════════════════════
        # PROCESS IMAGES (from OCR-SERVICE pattern)
        # ═══════════════════════════════════════════════════════════
        images_dir = output_dir / "images"
        images_dir.mkdir(exist_ok=True)

        image_mapping: dict[str, str] = {}  # old_name -> new_name
        valid_exts = {'.jpg', '.jpeg', '.png', '.webp'}
        found_images = sorted([
            p for p in temp_artifacts.glob("*")
            if p.is_file() and p.suffix.lower() in valid_exts
        ])

        try:
            from PIL import Image
        except ImportError:
            Image = None

        extracted_pictures: list[ExtractedPicture] = []

        for idx, img_path in enumerate(found_images):
            new_name = f"docling_{idx}.jpg"
            dest_path = images_dir / new_name

            try:
                if Image is not None:
                    with Image.open(img_path) as img:
                        if img.mode in ('RGBA', 'P', 'LA'):
                            img = img.convert('RGB')
                        img.save(dest_path, quality=95)
                else:
                    shutil.copy2(img_path, dest_path)
                image_mapping[img_path.name] = new_name

                # Track picture with its page number (default 1 if no map entry)
                page_no = picture_page_map.get(idx, 1)
                extracted_pictures.append(ExtractedPicture(
                    page_no=page_no,
                    image_path=str(dest_path),
                    local_ref=f"images/{new_name}",
                ))
            except Exception as e:
                logger.warning("Failed to convert image %s: %s", img_path.name, e)

        # Cleanup temp artifacts
        shutil.rmtree(temp_artifacts, ignore_errors=True)

        # ═══════════════════════════════════════════════════════════
        # UPDATE IMAGE PATHS IN MARKDOWN
        # ═══════════════════════════════════════════════════════════
        def replace_img_path(match):
            alt = match.group(1)
            path = match.group(2)
            fname = Path(path).name
            if fname in image_mapping:
                return f"![{alt}](images/{image_mapping[fname]})"
            return match.group(0)

        markdown = re.sub(r'!\[(.*?)\]\((.*?)\)', replace_img_path, raw_markdown)

        # ═══════════════════════════════════════════════════════════
        # CLEAN MARKDOWN (from OCR-SERVICE postprocess_md.py)
        # ═══════════════════════════════════════════════════════════
        markdown = clean_markdown(markdown)

        if not markdown.strip():
            raise RuntimeError("Docling markdown is empty after processing")

        # ═══════════════════════════════════════════════════════════
        # BUILD PER-PAGE RESULTS
        # ═══════════════════════════════════════════════════════════
        suffix = file_path.suffix.lower()
        if suffix == ".pdf":
            pages = self._parse_pdf_pages(file_path, markdown, output_dir)
        else:
            # Non-PDF: single page
            img_path = output_dir / f"{uuid.uuid4()}.png"
            self._create_placeholder_image(img_path, file_path.name)
            pages = [DoclingOCRPage(
                page_no=1,
                markdown=markdown,
                image_path=str(img_path),
            )]

        if not pages:
            img_path = output_dir / f"{uuid.uuid4()}.png"
            self._create_placeholder_image(img_path, file_path.name)
            pages = [DoclingOCRPage(
                page_no=1,
                markdown=markdown,
                image_path=str(img_path),
            )]

        logger.info(
            "Docling parsed %s: %d pages, %d chars markdown, %d pictures",
            file_path.name, len(pages), len(markdown), len(extracted_pictures),
        )
        return DoclingParseResult(pages=pages, pictures=extracted_pictures)

    def _parse_pdf_pages(
        self,
        pdf_path: Path,
        full_markdown: str,
        output_dir: Path,
    ) -> list[DoclingOCRPage]:
        """
        For PDF files: render each page as an image using poppler (pdftoppm)
        and split the markdown content by page breaks.
        """
        pages: list[DoclingOCRPage] = []

        # Render PDF pages as images
        page_images = self._render_pdf_pages(pdf_path, output_dir)

        if not page_images:
            img_path = output_dir / f"{uuid.uuid4()}.png"
            self._create_placeholder_image(img_path, pdf_path.name)
            return [DoclingOCRPage(
                page_no=1,
                markdown=full_markdown,
                image_path=str(img_path),
            )]

        # Split markdown by page break markers
        page_markdowns = re.split(r'\n\s*---\s*\n', full_markdown)

        # If we can't split evenly, distribute content across pages
        if len(page_markdowns) == 1 and len(page_images) > 1:
            paragraphs = full_markdown.split('\n\n')
            chunk_size = max(1, len(paragraphs) // len(page_images))
            page_markdowns = []
            for i in range(0, len(paragraphs), chunk_size):
                page_markdowns.append('\n\n'.join(paragraphs[i:i + chunk_size]))

        for i, img_path in enumerate(page_images):
            md = page_markdowns[i] if i < len(page_markdowns) else ""
            if i == len(page_images) - 1 and i < len(page_markdowns) - 1:
                remaining = page_markdowns[i:]
                md = "\n\n---\n\n".join(remaining)
            pages.append(DoclingOCRPage(
                page_no=i + 1,
                markdown=md.strip(),
                image_path=str(img_path),
            ))

        return pages

    def _render_pdf_pages(self, pdf_path: Path, output_dir: Path) -> list[Path]:
        """Render PDF pages as PNG images using poppler's pdftoppm."""
        import subprocess

        images_dir = output_dir / "page_images"
        images_dir.mkdir(parents=True, exist_ok=True)

        prefix = str(images_dir / "page")
        dpi = max(72, int(settings.CUONGRAG_DOCLING_PDF_DPI))
        timeout = max(10, int(settings.CUONGRAG_DOCLING_PDF_TIMEOUT_SECONDS))
        try:
            subprocess.run(
                ["pdftoppm", "-png", "-r", str(dpi), str(pdf_path), prefix],
                check=True,
                capture_output=True,
                timeout=timeout,
            )
        except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired) as e:
            logger.warning("pdftoppm failed, trying Pillow fallback: %s", e)
            return self._render_pdf_pages_pillow(pdf_path, images_dir)

        image_files = sorted(images_dir.glob("page-*.png"))
        return image_files

    def _render_pdf_pages_pillow(self, pdf_path: Path, output_dir: Path) -> list[Path]:
        """Fallback: render PDF pages using pdf2image (Pillow-based)."""
        try:
            from pdf2image import convert_from_path
            images = convert_from_path(str(pdf_path), dpi=150)
            paths = []
            for i, img in enumerate(images):
                out = output_dir / f"page-{i + 1:03d}.png"
                img.save(out, "PNG")
                paths.append(out)
            return paths
        except Exception as e:
            logger.warning("pdf2image fallback also failed: %s", e)
            return []

    @staticmethod
    def _create_placeholder_image(path: Path, filename: str):
        """Create a simple placeholder image when no page image is available."""
        try:
            from PIL import Image, ImageDraw
            img = Image.new("RGB", (800, 100), color=(240, 240, 240))
            draw = ImageDraw.Draw(img)
            draw.text((20, 40), f"Document: {filename}", fill=(100, 100, 100))
            img.save(path, "PNG")
        except Exception:
            # Create a minimal 1x1 white PNG if PIL fails
            path.write_bytes(
                b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01'
                b'\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00'
                b'\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00'
                b'\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82'
            )


# Singleton
_service: Optional[DoclingParserService] = None


def get_docling_parser_service() -> DoclingParserService:
    global _service
    if _service is None:
        _service = DoclingParserService()
    return _service
