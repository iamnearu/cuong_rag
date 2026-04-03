from __future__ import annotations

import base64
import logging
import mimetypes
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class DeepSeekOCRPage:
    page_no: int
    markdown: str
    image_path: str


class DeepSeekOCRService:
    """DeepSeek OCR runtime wrapper (Transformers path).

    - Renders PDF pages to PNG via `pdftoppm`
    - Runs DeepSeek OCR model page-by-page
    - Returns markdown text per page
    """

    def __init__(self):
        self.model_name = settings.CUONGRAG_DEEPSEEK_OCR_MODEL
        self.api_url = (getattr(settings, "CUONGRAG_DEEPSEEK_OCR_API_URL", "") or "").strip()
        self.api_timeout = float(getattr(settings, "CUONGRAG_DEEPSEEK_OCR_API_TIMEOUT", 180.0) or 180.0)
        self.api_model = (
            getattr(settings, "CUONGRAG_DEEPSEEK_OCR_API_MODEL", "DeepSeek-OCR") or "DeepSeek-OCR"
        ).strip()
        self.api_key = (getattr(settings, "CUONGRAG_DEEPSEEK_OCR_API_KEY", "") or "").strip()
        self.prompt = settings.CUONGRAG_DEEPSEEK_OCR_PROMPT
        self.base_size = max(512, int(settings.CUONGRAG_DEEPSEEK_OCR_BASE_SIZE))
        self.image_size = max(512, int(settings.CUONGRAG_DEEPSEEK_OCR_IMAGE_SIZE))
        self.crop_mode = bool(settings.CUONGRAG_DEEPSEEK_OCR_CROP_MODE)
        self.test_compress = bool(settings.CUONGRAG_DEEPSEEK_OCR_TEST_COMPRESS)

        self._tokenizer = None
        self._model = None

    @staticmethod
    def _extract_markdown_from_payload(payload: Any) -> str:
        if isinstance(payload, str):
            return payload
        if isinstance(payload, dict):
            choices = payload.get("choices")
            if isinstance(choices, list) and choices:
                first = choices[0] if isinstance(choices[0], dict) else {}
                msg = first.get("message") if isinstance(first, dict) else {}
                if isinstance(msg, dict) and isinstance(msg.get("content"), str):
                    return msg["content"]
            for key in ("markdown", "text", "content", "result"):
                if isinstance(payload.get(key), str):
                    return payload[key]
        return ""

    def _is_chat_completions_api(self) -> bool:
        u = (self.api_url or "").lower()
        return "chat/completions" in u or "mkp-api.fptcloud.com" in u

    def _chat_completion_endpoint(self) -> str:
        base = (self.api_url or "").rstrip("/")
        if base.endswith("/chat/completions"):
            return base
        if base.endswith("/v1"):
            return f"{base}/chat/completions"
        return f"{base}/v1/chat/completions"

    @staticmethod
    def _mime_for_image(path: Path) -> str:
        mime, _ = mimetypes.guess_type(str(path))
        return mime or "image/png"

    def _ocr_image_via_chat_api(self, image_path: Path) -> str:
        """OCR one image via OpenAI-compatible chat/completions API."""
        if not self.api_url:
            raise RuntimeError("CUONGRAG_DEEPSEEK_OCR_API_URL is empty")

        import httpx

        mime = self._mime_for_image(image_path)
        img_b64 = base64.b64encode(image_path.read_bytes()).decode("utf-8")
        image_url = f"data:{mime};base64,{img_b64}"

        payload = {
            "model": self.api_model,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {"url": image_url},
                        },
                        {
                            "type": "text",
                            "text": self.prompt,
                        },
                    ],
                }
            ],
            "max_tokens": 1024,
            "temperature": 1,
            "stream": False,
            "top_p": 1,
            "presence_penalty": 0,
            "frequency_penalty": 0,
        }

        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        resp = httpx.post(
            self._chat_completion_endpoint(),
            json=payload,
            headers=headers,
            timeout=self.api_timeout,
        )
        resp.raise_for_status()
        return self._clean_markdown(self._extract_markdown_from_payload(resp.json()))

    def _post_file_to_ocr_api(self, file_path: Path, kind: str) -> Any:
        """POST file to OCR API with endpoint auto-fallback.

        kind: "pdf" | "image"
        """
        if not self.api_url:
            raise RuntimeError("CUONGRAG_DEEPSEEK_OCR_API_URL is empty")

        import httpx

        base = self.api_url.rstrip("/")
        endpoint_candidates = [
            f"{base}/ocr/{kind}",
            f"{base}/{kind}",
            f"{base}/ocr",
            base,
        ]

        mime = "application/pdf" if kind == "pdf" else "image/png"
        filename = file_path.name

        last_error: Exception | None = None
        for url in endpoint_candidates:
            try:
                with open(file_path, "rb") as f:
                    files = {"file": (filename, f, mime)}
                    data = {
                        "prompt": self.prompt,
                        "model": self.model_name,
                    }
                    resp = httpx.post(url, files=files, data=data, timeout=self.api_timeout)
                    resp.raise_for_status()

                ctype = (resp.headers.get("content-type") or "").lower()
                if "application/json" in ctype:
                    return resp.json()
                text = resp.text or ""
                return {"markdown": text}
            except Exception as e:
                last_error = e
                continue

        raise RuntimeError(f"DeepSeek OCR API request failed: {last_error}")

    def _ocr_pdf_via_api(self, pdf_path: Path, temp_dir: Path) -> list[DeepSeekOCRPage]:
        """OCR PDF via API and map output to rendered page images."""
        if self._is_chat_completions_api():
            dpi = int(settings.CUONGRAG_DEEPSEEK_OCR_DPI)
            pages_dir = temp_dir / "pages"
            page_images = self._render_pdf_to_images(pdf_path, pages_dir, dpi=dpi)
            pages: list[DeepSeekOCRPage] = []
            for idx, page_img in enumerate(page_images, start=1):
                md = self._ocr_image_via_chat_api(page_img)
                pages.append(
                    DeepSeekOCRPage(
                        page_no=idx,
                        markdown=md,
                        image_path=str(page_img),
                    )
                )
            return pages

        payload = self._post_file_to_ocr_api(pdf_path, kind="pdf")

        dpi = int(settings.CUONGRAG_DEEPSEEK_OCR_DPI)
        pages_dir = temp_dir / "pages"
        page_images = self._render_pdf_to_images(pdf_path, pages_dir, dpi=dpi)

        api_pages = []
        if isinstance(payload, dict) and isinstance(payload.get("pages"), list):
            api_pages = payload["pages"]

        pages: list[DeepSeekOCRPage] = []
        if api_pages:
            for idx, page_img in enumerate(page_images, start=1):
                md = ""
                if idx - 1 < len(api_pages):
                    md = self._extract_markdown_from_payload(api_pages[idx - 1])
                pages.append(
                    DeepSeekOCRPage(
                        page_no=idx,
                        markdown=self._clean_markdown(md),
                        image_path=str(page_img),
                    )
                )
            return pages

        # Single markdown payload fallback
        full_md = self._clean_markdown(self._extract_markdown_from_payload(payload))
        split_parts = [p.strip() for p in re.split(r"\n\s*---\s*\n", full_md) if p.strip()]
        for idx, page_img in enumerate(page_images, start=1):
            md = split_parts[idx - 1] if idx - 1 < len(split_parts) else ""
            pages.append(
                DeepSeekOCRPage(
                    page_no=idx,
                    markdown=md,
                    image_path=str(page_img),
                )
            )
        return pages

    def _ocr_image_via_api(self, image_path: Path) -> list[DeepSeekOCRPage]:
        if self._is_chat_completions_api():
            md = self._ocr_image_via_chat_api(image_path)
            return [DeepSeekOCRPage(page_no=1, markdown=md, image_path=str(image_path))]

        payload = self._post_file_to_ocr_api(image_path, kind="image")
        md = self._clean_markdown(self._extract_markdown_from_payload(payload))
        return [DeepSeekOCRPage(page_no=1, markdown=md, image_path=str(image_path))]

    def _load_model(self):
        if self._model is not None and self._tokenizer is not None:
            return

        from transformers import AutoModel, AutoTokenizer

        logger.info("Loading DeepSeek OCR model: %s", self.model_name)
        self._tokenizer = AutoTokenizer.from_pretrained(
            self.model_name,
            trust_remote_code=True,
        )

        # Try flash attention first on CUDA; fallback gracefully.
        kwargs = {
            "trust_remote_code": True,
            "use_safetensors": True,
        }

        try:
            self._model = AutoModel.from_pretrained(
                self.model_name,
                _attn_implementation="flash_attention_2",
                **kwargs,
            )
        except Exception as e:
            logger.warning("DeepSeek OCR flash_attention_2 unavailable, fallback default: %s", e)
            self._model = AutoModel.from_pretrained(self.model_name, **kwargs)

        try:
            import torch

            if torch.cuda.is_available():
                self._model = self._model.eval().cuda().to(torch.bfloat16)
            else:
                self._model = self._model.eval()
        except Exception as e:
            logger.warning("DeepSeek OCR device setup warning: %s", e)
            self._model = self._model.eval()

        logger.info("DeepSeek OCR model loaded: %s", self.model_name)

    @staticmethod
    def _clean_markdown(text: str) -> str:
        if not text:
            return ""
        # Remove DeepSeek det/ref tags, keep plain markdown
        text = re.sub(r"<\|ref\|>.*?<\|/det\|>", "", text, flags=re.DOTALL)
        text = text.replace("<｜end▁of▁sentence｜>", "")
        text = text.replace("\\coloneqq", ":=").replace("\\eqqcolon", "=:")
        # Normalize long blank runs
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()

    def _ocr_single_image(self, image_file: Path, output_dir: Path) -> str:
        self._load_model()

        result = self._model.infer(
            self._tokenizer,
            prompt=self.prompt,
            image_file=str(image_file),
            output_path=str(output_dir),
            base_size=self.base_size,
            image_size=self.image_size,
            crop_mode=self.crop_mode,
            save_results=False,
            test_compress=self.test_compress,
        )

        if isinstance(result, str):
            raw = result
        elif isinstance(result, dict):
            raw = str(result.get("text", ""))
        elif isinstance(result, (list, tuple)) and result:
            raw = str(result[0])
        else:
            raw = str(result or "")

        return self._clean_markdown(raw)

    @staticmethod
    def _render_pdf_to_images(pdf_path: Path, output_dir: Path, dpi: int) -> list[Path]:
        output_dir.mkdir(parents=True, exist_ok=True)
        prefix = output_dir / "page"

        cmd = [
            "pdftoppm",
            "-png",
            "-r",
            str(max(72, dpi)),
            str(pdf_path),
            str(prefix),
        ]

        try:
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=1800)
            if proc.returncode != 0:
                raise RuntimeError(proc.stderr or proc.stdout or "pdftoppm failed")
        except FileNotFoundError:
            raise RuntimeError("pdftoppm not found. Install poppler-utils in container.")

        images = sorted(output_dir.glob("page-*.png"))
        if not images:
            raise RuntimeError(f"No page images rendered from PDF: {pdf_path}")
        return images

    def ocr_pdf(self, pdf_path: Path, temp_dir: Path) -> list[DeepSeekOCRPage]:
        if self.api_url:
            logger.info("DeepSeek OCR via API: %s", self.api_url)
            return self._ocr_pdf_via_api(pdf_path, temp_dir)

        dpi = int(settings.CUONGRAG_DEEPSEEK_OCR_DPI)
        pages_dir = temp_dir / "pages"
        output_dir = temp_dir / "ocr_out"

        page_images = self._render_pdf_to_images(pdf_path, pages_dir, dpi=dpi)

        pages: list[DeepSeekOCRPage] = []
        for idx, page_img in enumerate(page_images, start=1):
            markdown = self._ocr_single_image(page_img, output_dir)
            pages.append(
                DeepSeekOCRPage(
                    page_no=idx,
                    markdown=markdown,
                    image_path=str(page_img),
                )
            )
        return pages

    def ocr_image(self, image_path: Path, temp_dir: Path) -> list[DeepSeekOCRPage]:
        if self.api_url:
            logger.info("DeepSeek OCR image via API: %s", self.api_url)
            return self._ocr_image_via_api(image_path)

        output_dir = temp_dir / "ocr_out"
        output_dir.mkdir(parents=True, exist_ok=True)
        markdown = self._ocr_single_image(image_path, output_dir)
        return [DeepSeekOCRPage(page_no=1, markdown=markdown, image_path=str(image_path))]


_default_service: DeepSeekOCRService | None = None


def get_deepseek_ocr_service() -> DeepSeekOCRService:
    global _default_service
    if _default_service is None:
        _default_service = DeepSeekOCRService()
    return _default_service
