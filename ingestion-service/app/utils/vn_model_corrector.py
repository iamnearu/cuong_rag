"""
Vietnamese Model Corrector - Sửa dấu tiếng Việt bằng ProtonX Seq2Seq model.
"""

import logging
import re
import importlib
from typing import List

_log = logging.getLogger(__name__)

_model = None
_tokenizer = None
_device = None

BATCH_SIZE = 16
CHUNK_WORD_SIZE = 64
MAX_NEW_TOKENS = 160

_SKIP_PATTERNS = [
    re.compile(r"^\s*$"),
    re.compile(r"^\s*!\[|^\s*\["),
    re.compile(r"^\s*<"),
    re.compile(r"^\s*[-*+]\s*$"),
    re.compile(r"^\s*\|"),
    re.compile(r"^\s*```"),
    re.compile(r"^\s*---"),
    re.compile(r"^\s*\d+\.\s*$"),
    re.compile(r"^https?://"),
    re.compile(r"^[A-Za-z0-9.@:/\-_]+$"),
]


def _should_skip_line(line: str) -> bool:
    for p in _SKIP_PATTERNS:
        if p.match(line):
            return True
    return False


def _load_model(model_name: str):
    global _model, _tokenizer, _device
    if _model is not None and _tokenizer is not None:
        return _model, _tokenizer, _device

    transformers = importlib.import_module("transformers")
    AutoTokenizer = getattr(transformers, "AutoTokenizer")
    AutoModelForSeq2SeqLM = getattr(transformers, "AutoModelForSeq2SeqLM")

    torch = importlib.import_module("torch")

    _tokenizer = AutoTokenizer.from_pretrained(model_name)
    _device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    torch_dtype = torch.float16 if _device.type == "cuda" else torch.float32
    _model = AutoModelForSeq2SeqLM.from_pretrained(model_name, torch_dtype=torch_dtype)
    _model.to(_device)
    _model.eval()
    _log.info("Loaded ProtonX model: %s on %s", model_name, _device)
    return _model, _tokenizer, _device


def _decode_batch(texts: List[str], model_name: str) -> List[str]:
    if not texts:
        return []

    torch = importlib.import_module("torch")
    model, tokenizer, device = _load_model(model_name)
    inputs = tokenizer(
        texts,
        return_tensors="pt",
        padding=True,
        truncation=True,
        max_length=MAX_NEW_TOKENS,
    ).to(device)

    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            num_beams=4,
            max_new_tokens=MAX_NEW_TOKENS,
            early_stopping=True,
        )

    return tokenizer.batch_decode(outputs, skip_special_tokens=True)


def correct_with_model(text: str, model_name: str) -> str:
    if not text:
        return text

    lines = text.split("\n")
    all_chunks_text: List[str] = []
    lines_to_process = []

    for idx, line in enumerate(lines):
        line_content = line.strip()
        if not line_content or _should_skip_line(line):
            continue

        stripped = line.lstrip()
        indent = line[: len(line) - len(stripped)]
        bullet_match = re.match(r"^([-*+]\s+|\d+\.\s+|#+\s*)", stripped)
        if bullet_match:
            bullet = bullet_match.group(0)
            content = stripped[len(bullet):]
        else:
            bullet = ""
            content = stripped

        if not content.strip():
            continue

        words = content.split()
        chunks = []
        if len(words) <= CHUNK_WORD_SIZE:
            chunks.append(content)
        else:
            for i in range(0, len(words), CHUNK_WORD_SIZE):
                chunks.append(" ".join(words[i : i + CHUNK_WORD_SIZE]))

        lines_to_process.append(
            {
                "line_idx": idx,
                "indent": indent,
                "bullet": bullet,
                "chunk_count": len(chunks),
                "start_chunk_idx": len(all_chunks_text),
            }
        )
        all_chunks_text.extend(chunks)

    if not all_chunks_text:
        return text

    corrected_chunks: List[str] = []
    total = len(all_chunks_text)
    for i in range(0, total, BATCH_SIZE):
        batch = all_chunks_text[i : i + BATCH_SIZE]
        corrected_chunks.extend(_decode_batch(batch, model_name=model_name))

    result_lines = list(lines)
    for item in lines_to_process:
        idx = item["line_idx"]
        start = item["start_chunk_idx"]
        count = item["chunk_count"]
        corrected_parts = corrected_chunks[start : start + count]
        corrected_content = " ".join(corrected_parts)
        result_lines[idx] = item["indent"] + item["bullet"] + corrected_content

    return "\n".join(result_lines)
