"""
MinerU Document Parser
======================

Wraps a MinerU CLI invocation to produce markdown for GPU OCR pipelines.
This service is intentionally generic and driven by env config so it can
work with different MinerU builds or wrappers.
"""
from __future__ import annotations

import logging
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class MinerUOCRPage:
    """One page of a MinerU-parsed document."""
    page_no: int
    markdown: str
    image_path: str


class MinerUParserService:
    """Run MinerU via CLI and map results to per-page markdown + images."""

    def __init__(self) -> None:
        self.cmd_template = (settings.CUONGRAG_MINERU_CMD or "").strip()
        self.cmd_timeout = max(30, int(settings.CUONGRAG_MINERU_CMD_TIMEOUT_SECONDS))
        self.md_path = (settings.CUONGRAG_MINERU_MARKDOWN_PATH or "").strip()
        self.pdf_dpi = max(72, int(settings.CUONGRAG_MINERU_PDF_DPI))
        self.pdf_timeout = max(30, int(settings.CUONGRAG_MINERU_PDF_TIMEOUT_SECONDS))

    def parse_document(self, file_path: Path | str, output_dir: Path | str) -> list[MinerUOCRPage]:
        file_path = Path(file_path)
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        self._run_mineru(file_path, output_dir)

        markdown = self._load_markdown(output_dir)
        page_images = self._resolve_page_images(file_path, output_dir)

        pages = self._build_pages(markdown, page_images)
        if not pages:
            raise RuntimeError("MinerU produced no pages")
        return pages

    def _run_mineru(self, file_path: Path, output_dir: Path) -> None:
        if not self.cmd_template:
            raise RuntimeError("CUONGRAG_MINERU_CMD is empty. Provide a MinerU CLI command.")

        cmd = self.cmd_template.format(input=str(file_path), output=str(output_dir))
        logger.info("MinerU command: %s", cmd)

        proc = subprocess.run(
            cmd,
            shell=True,
            capture_output=True,
            text=True,
            timeout=self.cmd_timeout,
        )
        if proc.returncode != 0:
            stderr = (proc.stderr or "").strip()
            stdout = (proc.stdout or "").strip()
            detail = stderr or stdout or "MinerU command failed"
            raise RuntimeError(detail)

    def _load_markdown(self, output_dir: Path) -> str:
        md_path: Optional[Path] = None
        if self.md_path:
            candidate = Path(self.md_path)
            md_path = candidate if candidate.is_absolute() else output_dir / candidate
        else:
            md_candidates = sorted(
                output_dir.rglob("*.md"),
                key=lambda p: p.stat().st_size,
                reverse=True,
            )
            if md_candidates:
                md_path = md_candidates[0]

        if md_path is None or not md_path.exists():
            raise RuntimeError("MinerU markdown not found. Set CUONGRAG_MINERU_MARKDOWN_PATH.")

        markdown = md_path.read_text(encoding="utf-8", errors="ignore")
        if not markdown.strip():
            raise RuntimeError("MinerU markdown is empty")
        return markdown

    def _resolve_page_images(self, file_path: Path, output_dir: Path) -> list[Path]:
        suffix = file_path.suffix.lower()
        if suffix == ".pdf":
            return self._render_pdf_pages(file_path, output_dir / "page_images")

        if suffix in {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff"}:
            return [file_path]

        image_candidates = sorted(output_dir.rglob("*.png"))
        if image_candidates:
            return image_candidates

        # Fallback: create a placeholder image file
        placeholder = output_dir / "page-001.png"
        self._create_placeholder_image(placeholder, file_path.name)
        return [placeholder]

    def _build_pages(self, markdown: str, page_images: list[Path]) -> list[MinerUOCRPage]:
        page_markdowns = re.split(r"\n\s*---\s*\n", markdown)
        page_markdowns = [p.strip() for p in page_markdowns if p.strip()]

        if len(page_markdowns) == 1 and len(page_images) > 1:
            paragraphs = markdown.split("\n\n")
            chunk_size = max(1, len(paragraphs) // len(page_images))
            page_markdowns = []
            for i in range(0, len(paragraphs), chunk_size):
                page_markdowns.append("\n\n".join(paragraphs[i:i + chunk_size]).strip())

        pages: list[MinerUOCRPage] = []
        for i, img_path in enumerate(page_images):
            md = page_markdowns[i] if i < len(page_markdowns) else ""
            if i == len(page_images) - 1 and i < len(page_markdowns) - 1:
                md = "\n\n---\n\n".join(page_markdowns[i:])
            pages.append(MinerUOCRPage(
                page_no=i + 1,
                markdown=md,
                image_path=str(img_path),
            ))
        return pages

    def _render_pdf_pages(self, pdf_path: Path, output_dir: Path) -> list[Path]:
        import subprocess

        output_dir.mkdir(parents=True, exist_ok=True)
        prefix = output_dir / "page"

        cmd = [
            "pdftoppm",
            "-png",
            "-r",
            str(self.pdf_dpi),
            str(pdf_path),
            str(prefix),
        ]

        try:
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=self.pdf_timeout)
            if proc.returncode != 0:
                raise RuntimeError(proc.stderr or proc.stdout or "pdftoppm failed")
        except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired) as exc:
            logger.warning("pdftoppm failed, trying Pillow fallback: %s", exc)
            return self._render_pdf_pages_pillow(pdf_path, output_dir)

        images = sorted(output_dir.glob("page-*.png"))
        if not images:
            raise RuntimeError(f"No page images rendered from PDF: {pdf_path}")
        return images

    def _render_pdf_pages_pillow(self, pdf_path: Path, output_dir: Path) -> list[Path]:
        try:
            from pdf2image import convert_from_path
            images = convert_from_path(str(pdf_path), dpi=self.pdf_dpi)
            paths: list[Path] = []
            for i, img in enumerate(images):
                out = output_dir / f"page-{i + 1:03d}.png"
                img.save(out, "PNG")
                paths.append(out)
            return paths
        except Exception as exc:
            logger.warning("pdf2image fallback failed: %s", exc)
            return []

    @staticmethod
    def _create_placeholder_image(path: Path, filename: str) -> None:
        try:
            from PIL import Image, ImageDraw
            img = Image.new("RGB", (800, 100), color=(240, 240, 240))
            draw = ImageDraw.Draw(img)
            draw.text((20, 40), f"Document: {filename}", fill=(100, 100, 100))
            img.save(path, "PNG")
        except Exception:
            path.write_bytes(
                b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01"
                b"\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00"
                b"\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00"
                b"\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
            )


_service: Optional[MinerUParserService] = None


def get_mineru_parser_service() -> MinerUParserService:
    global _service
    if _service is None:
        _service = MinerUParserService()
    return _service
