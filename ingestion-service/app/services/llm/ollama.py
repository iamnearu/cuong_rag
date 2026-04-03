"""
Ollama LLM & Embedding Providers
==================================
Concrete implementations using the ``ollama`` Python library for local models.
"""
from __future__ import annotations

import base64
import json
import logging
import re
from typing import Any, AsyncGenerator, Optional

import httpx
import numpy as np

from app.services.llm.base import EmbeddingProvider, LLMProvider
from app.services.llm.types import LLMMessage, LLMResult, StreamChunk

logger = logging.getLogger(__name__)

# Regex to strip <think>...</think> blocks from model output
_THINK_RE = re.compile(r"<think>.*?</think>\s*", re.DOTALL)


class OllamaLLMProvider(LLMProvider):
    """Local Ollama text/multimodal generation."""

    def __init__(
        self,
        host: str = "http://localhost:11434",
        model: str = "gemma3:12b",
        vision_model: str = "",
        api_key: str = "",
        api_timeout: float = 60.0,
    ):
        self._host = host
        self._model = model
        self._vision_model = (vision_model or "").strip()
        self._api_key = (api_key or "").strip()
        self._api_timeout = float(api_timeout or 60.0)
        self._openai_mode = bool(self._api_key) or "mkp-api.fptcloud.com" in (host or "")
        self._thinking_supported: bool | None = None  # lazy probe

    def _model_for_messages(self, messages: list[LLMMessage]) -> str:
        if self._vision_model and any(m.images for m in messages):
            return self._vision_model
        return self._model

    def _openai_endpoint(self) -> str:
        base = (self._host or "").rstrip("/")
        if base.endswith("/chat/completions"):
            return base
        if base.endswith("/v1"):
            return f"{base}/chat/completions"
        return f"{base}/v1/chat/completions"

    def _openai_headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self._api_key:
            headers["Authorization"] = f"Bearer {self._api_key}"
        return headers

    @staticmethod
    def _to_openai_messages(
        messages: list[LLMMessage],
        system_prompt: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        if system_prompt:
            out.append({"role": "system", "content": system_prompt})

        for msg in messages:
            if msg.images:
                parts: list[dict[str, Any]] = []
                if msg.content:
                    parts.append({"type": "text", "text": msg.content})
                for img in msg.images:
                    b64 = base64.b64encode(img.data).decode("utf-8")
                    parts.append(
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:{img.mime_type};base64,{b64}"},
                        }
                    )
                out.append({"role": msg.role, "content": parts})
            else:
                out.append({"role": msg.role, "content": msg.content or ""})

        return out

    @staticmethod
    def _extract_openai_content(payload: dict[str, Any]) -> str:
        choices = payload.get("choices") or []
        if not choices:
            return ""
        message = choices[0].get("message") or {}
        content = message.get("content")
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            texts = [
                p.get("text", "")
                for p in content
                if isinstance(p, dict) and p.get("type") == "text"
            ]
            return "".join(texts)
        return ""

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _to_ollama_messages(
        messages: list[LLMMessage],
        system_prompt: Optional[str] = None,
    ) -> list[dict]:
        """Convert LLMMessage list to Ollama message dicts."""
        result: list[dict] = []

        if system_prompt:
            result.append({"role": "system", "content": system_prompt})

        for msg in messages:
            entry: dict = {"role": msg.role, "content": msg.content}
            if msg.images:
                # Ollama accepts raw bytes in the 'images' field
                entry["images"] = [img.data for img in msg.images]
            result.append(entry)

        return result

    @staticmethod
    def _extract_content(response, keep_thinking: bool = False) -> str | LLMResult:
        """Extract usable text from Ollama response.

        Handles edge cases:
        - ``content`` is empty but ``thinking`` field has the answer
        - ``content`` contains embedded ``<think>...</think>`` blocks

        When *keep_thinking* is True, returns an LLMResult with the
        thinking text preserved separately.
        """
        content = response.message.content or ""
        thinking = getattr(response.message, "thinking", None) or ""

        # Strip <think>...</think> blocks from content
        if "<think>" in content:
            content = _THINK_RE.sub("", content).strip()

        # Fallback: if content is still empty, check thinking field
        if not content:
            if thinking:
                logger.warning(
                    "Ollama response.content is empty but thinking has %d chars — "
                    "using thinking as fallback", len(thinking)
                )
                content = _THINK_RE.sub("", thinking).strip()

        if keep_thinking:
            return LLMResult(content=content, thinking=thinking)
        return content

    # ------------------------------------------------------------------
    # LLMProvider interface
    # ------------------------------------------------------------------

    def complete(
        self,
        messages: list[LLMMessage],
        *,
        temperature: float = 0.0,
        max_tokens: int = 4096,
        system_prompt: Optional[str] = None,
        think: bool = False,
    ) -> str | LLMResult:
        selected_model = self._model_for_messages(messages)
        if self._openai_mode:
            try:
                payload = {
                    "model": selected_model,
                    "messages": self._to_openai_messages(messages, system_prompt),
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                    "stream": False,
                    "top_p": 1,
                    "presence_penalty": 0,
                    "frequency_penalty": 0,
                }
                resp = httpx.post(
                    self._openai_endpoint(),
                    json=payload,
                    headers=self._openai_headers(),
                    timeout=self._api_timeout,
                )
                resp.raise_for_status()
                content = self._extract_openai_content(resp.json())
                return LLMResult(content=content, thinking="") if think else content
            except Exception as e:
                logger.error(f"OpenAI-compatible LLM call failed: {e}", exc_info=True)
                return LLMResult(content="") if think else ""

        import ollama

        ollama_msgs = self._to_ollama_messages(messages, system_prompt)
        use_think = think and self.supports_thinking()

        try:
            response = ollama.chat(
                model=selected_model,
                messages=ollama_msgs,
                options={"temperature": temperature, "num_predict": max_tokens},
                think=use_think,
            )
            result = self._extract_content(response, keep_thinking=use_think)
            content = result.content if isinstance(result, LLMResult) else result
            if not content:
                logger.warning(
                    "Ollama complete() returned empty | model=%s | "
                    "content=%r | thinking=%r",
                    self._model,
                    response.message.content,
                    getattr(response.message, "thinking", None),
                )
            return result
        except Exception as e:
            logger.error(f"Ollama LLM call failed: {e}", exc_info=True)
            return LLMResult(content="") if use_think else ""

    async def acomplete(
        self,
        messages: list[LLMMessage],
        *,
        temperature: float = 0.0,
        max_tokens: int = 4096,
        system_prompt: Optional[str] = None,
        think: bool = False,
    ) -> str | LLMResult:
        """Native async via ollama.AsyncClient (better than to_thread)."""
        selected_model = self._model_for_messages(messages)
        if self._openai_mode:
            try:
                payload = {
                    "model": selected_model,
                    "messages": self._to_openai_messages(messages, system_prompt),
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                    "stream": False,
                    "top_p": 1,
                    "presence_penalty": 0,
                    "frequency_penalty": 0,
                }
                async with httpx.AsyncClient(timeout=self._api_timeout) as client:
                    resp = await client.post(
                        self._openai_endpoint(),
                        json=payload,
                        headers=self._openai_headers(),
                    )
                    resp.raise_for_status()
                content = self._extract_openai_content(resp.json())
                return LLMResult(content=content, thinking="") if think else content
            except Exception as e:
                logger.error(f"OpenAI-compatible async LLM call failed: {e}", exc_info=True)
                return LLMResult(content="") if think else ""

        import ollama

        ollama_msgs = self._to_ollama_messages(messages, system_prompt)
        use_think = think and self.supports_thinking()

        try:
            client = ollama.AsyncClient(host=self._host)
            response = await client.chat(
                model=selected_model,
                messages=ollama_msgs,
                options={"temperature": temperature, "num_predict": max_tokens},
                think=use_think,
            )
            result = self._extract_content(response, keep_thinking=use_think)
            content = result.content if isinstance(result, LLMResult) else result
            if not content:
                logger.warning(
                    "Ollama acomplete() returned empty | model=%s | "
                    "content=%r | thinking=%r",
                    self._model,
                    response.message.content,
                    getattr(response.message, "thinking", None),
                )
            return result
        except Exception as e:
            logger.error(f"Ollama async LLM call failed: {e}", exc_info=True)
            return LLMResult(content="") if use_think else ""

    async def astream(
        self,
        messages: list[LLMMessage],
        *,
        temperature: float = 0.0,
        max_tokens: int = 4096,
        system_prompt: Optional[str] = None,
        think: bool = False,
        tools: list | None = None,
    ) -> AsyncGenerator[StreamChunk, None]:
        """Streaming generation via Ollama's async stream API.

        Tool calls are detected via <tool_call>...</tool_call> tags in output.
        Uses a state machine to buffer tool call JSON before yielding.
        """
        selected_model = self._model_for_messages(messages)
        if self._openai_mode:
            payload = {
            "model": selected_model,
                "messages": self._to_openai_messages(messages, system_prompt),
                "temperature": temperature,
                "max_tokens": max_tokens,
                "stream": True,
                "top_p": 1,
                "presence_penalty": 0,
                "frequency_penalty": 0,
            }
            try:
                async with httpx.AsyncClient(timeout=self._api_timeout) as client:
                    async with client.stream(
                        "POST",
                        self._openai_endpoint(),
                        json=payload,
                        headers=self._openai_headers(),
                    ) as resp:
                        resp.raise_for_status()
                        async for line in resp.aiter_lines():
                            if not line:
                                continue
                            if line.startswith("data: "):
                                data = line[len("data: "):].strip()
                            elif line.startswith("data:"):
                                data = line[len("data:"):].strip()
                            else:
                                continue

                            if data == "[DONE]":
                                break

                            try:
                                chunk = json.loads(data)
                            except Exception:
                                continue

                            choices = chunk.get("choices") or []
                            if not choices:
                                continue
                            delta = choices[0].get("delta") or {}
                            txt = delta.get("content") or ""
                            if txt:
                                yield StreamChunk(type="text", text=txt)
                return
            except Exception as e:
                logger.error(f"OpenAI-compatible streaming failed: {e}", exc_info=True)
                yield StreamChunk(type="text", text="")
                return

        import ollama

        ollama_msgs = self._to_ollama_messages(messages, system_prompt)
        use_think = think and self.supports_thinking()

        try:
            client = ollama.AsyncClient(host=self._host)
            stream = await client.chat(
                model=selected_model,
                messages=ollama_msgs,
                options={"temperature": temperature, "num_predict": max_tokens},
                stream=True,
                think=use_think,
            )

            # State machine for <tool_call> detection
            tool_buffer = ""
            in_tool_call = False

            async for chunk in stream:
                thinking = getattr(chunk.message, "thinking", None) or ""
                content = chunk.message.content or ""

                if thinking:
                    yield StreamChunk(type="thinking", text=thinking)

                if not content:
                    continue

                if in_tool_call:
                    tool_buffer += content
                    if "</tool_call>" in tool_buffer:
                        # Extract JSON between tags
                        match = re.search(
                            r"<tool_call>(.*?)</tool_call>",
                            tool_buffer,
                            re.DOTALL,
                        )
                        if match:
                            try:
                                tool_data = json.loads(match.group(1).strip())
                                yield StreamChunk(
                                    type="function_call",
                                    function_call={
                                        "name": tool_data.get("name", ""),
                                        "args": tool_data.get("arguments", {}),
                                    },
                                )
                            except json.JSONDecodeError:
                                logger.warning("Failed to parse tool call JSON: %s", match.group(1))
                                yield StreamChunk(type="text", text=tool_buffer)
                        else:
                            yield StreamChunk(type="text", text=tool_buffer)
                        # Reset state — text after </tool_call> goes to normal
                        after = tool_buffer.split("</tool_call>", 1)[1]
                        tool_buffer = ""
                        in_tool_call = False
                        if after.strip():
                            yield StreamChunk(type="text", text=after)
                elif "<tool_call>" in content:
                    # Split at <tool_call> — yield text before, buffer the rest
                    before, rest = content.split("<tool_call>", 1)
                    if before.strip():
                        yield StreamChunk(type="text", text=before)
                    in_tool_call = True
                    tool_buffer = "<tool_call>" + rest
                    # Check if the entire tool call is in this single chunk
                    if "</tool_call>" in tool_buffer:
                        match = re.search(
                            r"<tool_call>(.*?)</tool_call>",
                            tool_buffer,
                            re.DOTALL,
                        )
                        if match:
                            try:
                                tool_data = json.loads(match.group(1).strip())
                                yield StreamChunk(
                                    type="function_call",
                                    function_call={
                                        "name": tool_data.get("name", ""),
                                        "args": tool_data.get("arguments", {}),
                                    },
                                )
                            except json.JSONDecodeError:
                                logger.warning("Failed to parse tool call JSON: %s", match.group(1))
                                yield StreamChunk(type="text", text=tool_buffer)
                        after = tool_buffer.split("</tool_call>", 1)[1]
                        tool_buffer = ""
                        in_tool_call = False
                        if after.strip():
                            yield StreamChunk(type="text", text=after)
                else:
                    # Strip <think> tags from content stream
                    cleaned = _THINK_RE.sub("", content)
                    if cleaned:
                        yield StreamChunk(type="text", text=cleaned)

            # If we ended while buffering a tool call, yield as text
            if in_tool_call and tool_buffer:
                yield StreamChunk(type="text", text=tool_buffer)

        except Exception as e:
            logger.error(f"Ollama streaming failed: {e}", exc_info=True)
            yield StreamChunk(type="text", text="")

    def supports_vision(self) -> bool:
        # Vision support depends on the model (e.g. qwen3-vl, llava, etc.)
        # We return True and let the model handle it; if the model doesn't
        # support vision, the Ollama API will return an error gracefully.
        return True

    def supports_thinking(self) -> bool:
        """Detect if the model supports thinking mode via a probe call."""
        if self._openai_mode:
            return False

        if self._thinking_supported is not None:
            return self._thinking_supported

        import ollama

        try:
            response = ollama.chat(
                model=self._model,
                messages=[{"role": "user", "content": "Hi"}],
                options={"num_predict": 2},
                think=True,
            )
            # If we get here without error, thinking is supported
            thinking = getattr(response.message, "thinking", None) or ""
            self._thinking_supported = True
            logger.info(
                f"Ollama thinking probe: model={self._model} supported=True "
                f"(thinking={len(thinking)} chars)"
            )
        except Exception as e:
            self._thinking_supported = False
            logger.info(f"Ollama thinking probe: model={self._model} supported=False ({e})")

        return self._thinking_supported


class OllamaEmbeddingProvider(EmbeddingProvider):
    """Local Ollama text embedding."""

    def __init__(
        self,
        host: str = "http://localhost:11434",
        model: str = "bge-m3",
    ):
        self._host = host
        self._model = model
        self._dimension: Optional[int] = None

    def _detect_dimension(self) -> int:
        """Detect embedding dimension by running a probe."""
        import ollama

        try:
            result = ollama.embed(model=self._model, input=["dimension probe"])
            dim = len(result.embeddings[0])
            logger.info(f"Detected Ollama embedding dimension: {dim} for model {self._model}")
            return dim
        except Exception as e:
            logger.warning(f"Failed to detect embedding dimension: {e}, defaulting to config")
            from app.core.config import settings
            return settings.KG_EMBEDDING_DIMENSION

    @staticmethod
    def _sanitize_texts(texts: list[str]) -> list[str]:
        """Clean texts to prevent Ollama embedding NaN errors.

        Some texts (empty, special chars only, extremely long) cause
        bge-m3 via Ollama to return NaN embeddings or 500 errors.
        """
        sanitized = []
        for t in texts:
            t = t.strip()
            if not t:
                t = "[empty]"
            # Truncate extremely long texts (>8192 tokens ≈ 32k chars)
            if len(t) > 32000:
                t = t[:32000]
            sanitized.append(t)
        return sanitized

    def embed_sync(self, texts: list[str]) -> np.ndarray:
        import ollama

        clean = self._sanitize_texts(texts)
        try:
            result = ollama.embed(model=self._model, input=clean)
            arr = np.array(result.embeddings, dtype=np.float32)
            # Guard NaN — replace with zeros
            if np.any(np.isnan(arr)):
                logger.warning("Ollama embed_sync produced NaN values — replacing with zeros")
                arr = np.nan_to_num(arr, nan=0.0)
            return arr
        except Exception as e:
            logger.error(f"Ollama embedding failed: {e}")
            dim = self.get_dimension()
            return np.zeros((len(texts), dim), dtype=np.float32)

    async def embed(self, texts: list[str]) -> np.ndarray:
        """Native async embedding via ollama.AsyncClient."""
        import ollama

        clean = self._sanitize_texts(texts)
        try:
            client = ollama.AsyncClient(host=self._host)
            result = await client.embed(model=self._model, input=clean)
            arr = np.array(result.embeddings, dtype=np.float32)
            # Guard NaN — replace with zeros
            if np.any(np.isnan(arr)):
                logger.warning("Ollama async embed produced NaN values — replacing with zeros")
                arr = np.nan_to_num(arr, nan=0.0)
            return arr
        except Exception as e:
            logger.error(f"Ollama async embedding failed: {e}")
            dim = self.get_dimension()
            return np.zeros((len(texts), dim), dtype=np.float32)

    def get_dimension(self) -> int:
        if self._dimension is None:
            self._dimension = self._detect_dimension()
        return self._dimension
