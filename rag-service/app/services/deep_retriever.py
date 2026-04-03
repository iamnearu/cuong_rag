"""
Deep Retriever
===============

Hybrid retrieval combining Knowledge Graph (LightRAG) + Local Vector Search
+ Cross-encoder Reranking (bge-reranker-v2-m3).

Pipeline:
  1. KG query  (parallel) → entity/relationship summary
  2. Vector search → over-fetch top-N candidates (CUONGRAG_VECTOR_PREFETCH)
  3. Cross-encoder rerank → precision filter to top-K (CUONGRAG_RERANKER_TOP_K)
  4. Merge with citations + optional image references
"""
from __future__ import annotations

import asyncio
import logging
import re
from collections import defaultdict
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.document import Document, DocumentImage, DocumentTable
from app.services.embedder import EmbeddingService
from app.services.vector_store import VectorStore
from app.services.knowledge_graph_service import KnowledgeGraphService
from app.services.reranker import RerankerService, get_reranker_service
from app.services.models.parsed_document import (
    Citation,
    DeepRetrievalResult,
    EnrichedChunk,
    ExtractedImage,
    ExtractedTable,
)

logger = logging.getLogger(__name__)


class DeepRetriever:
    """
    Hybrid retriever: KG traversal + vector similarity + cross-encoder reranking.
    """

    def __init__(
        self,
        workspace_id: int,
        kg_service: Optional[KnowledgeGraphService],
        vector_store: VectorStore,
        embedder: EmbeddingService,
        db: Optional[AsyncSession] = None,
        reranker: Optional[RerankerService] = None,
    ):
        self.workspace_id = workspace_id
        self.kg_service = kg_service
        self.vector_store = vector_store
        self.embedder = embedder
        self.db = db
        self.reranker = reranker or get_reranker_service()

    async def query(
        self,
        question: str,
        mode: str = "hybrid",
        top_k: int = 5,
        document_ids: Optional[list[int]] = None,
        include_images: bool = True,
    ) -> DeepRetrievalResult:
        """
        Execute hybrid retrieval with reranking.

        Flow:
          1. [parallel] KG query + Vector over-fetch (CUONGRAG_VECTOR_PREFETCH)
          2. Cross-encoder rerank vector results → final top_k
          3. Optionally find related images from chunk pages
          4. Assemble structured context for LLM

        Args:
            question: Natural language query
            mode: "hybrid" (default), "naive", "local", "global", "vector_only"
            top_k: Number of final chunks to return (after reranking)
            document_ids: Optional filter to specific documents
            include_images: Whether to find related images

        Returns:
            DeepRetrievalResult with chunks, citations, context, and optional images
        """
        # Multi-hop detection: split complex question into sub-queries and merge.
        if (
            settings.CUONGRAG_MULTI_HOP_ENABLED
            and mode in {"hybrid", "consensus"}
            and self._is_multi_hop_question(question)
        ):
            sub_queries = self._split_sub_queries(question)
            logger.info(f"Multi-hop detected: {len(sub_queries)} sub-queries")
            per_query = await asyncio.gather(
                *[
                    self._query_single(
                        question=sq,
                        mode="hybrid",
                        top_k=max(top_k, settings.CUONGRAG_RERANKER_TOP_K),
                        document_ids=document_ids,
                    )
                    for sq in sub_queries
                ]
            )

            all_chunks: list[EnrichedChunk] = []
            all_citations: list[Citation] = []
            kg_parts: list[str] = []
            seen_keys: set[str] = set()

            for chunks_i, citations_i, kg_i in per_query:
                if kg_i:
                    kg_parts.append(kg_i)
                for c, ct in zip(chunks_i, citations_i):
                    key = self._chunk_key(c)
                    if key in seen_keys:
                        continue
                    seen_keys.add(key)
                    all_chunks.append(c)
                    all_citations.append(ct)

            chunks, citations = await asyncio.to_thread(
                self._rerank_chunks,
                question,
                all_chunks,
                all_citations,
                top_k,
            )
            kg_summary = "\n\n".join([p for p in kg_parts if p.strip()])
        else:
            chunks, citations, kg_summary = await self._query_single(
                question=question,
                mode=mode,
                top_k=top_k,
                document_ids=document_ids,
            )

        # Find related images and tables
        image_refs = []
        table_refs = []
        if include_images and self.db and chunks:
            page_nos = {(c.document_id, c.page_no) for c in chunks if c.page_no > 0}
            if page_nos:
                image_refs, table_refs = await asyncio.gather(
                    self._find_related_images(page_nos),
                    self._find_related_tables(page_nos),
                )

        # Assemble context
        context = self._assemble_context(chunks, citations, kg_summary, image_refs, table_refs)

        return DeepRetrievalResult(
            chunks=chunks,
            citations=citations,
            context=context,
            query=question,
            mode=mode,
            knowledge_graph_summary=kg_summary,
            image_refs=image_refs,
            table_refs=table_refs,
        )

    async def _query_single(
        self,
        question: str,
        mode: str,
        top_k: int,
        document_ids: Optional[list[int]],
    ) -> tuple[list[EnrichedChunk], list[Citation], str]:
        """Retrieve for a single query with either standard hybrid or consensus mode."""
        if mode in {"hybrid", "consensus"}:
            return await self._consensus_query(question, top_k, document_ids)

        # Run KG and vector search in parallel
        kg_task = None
        if self.kg_service and mode != "vector_only":
            kg_task = asyncio.create_task(
                self._kg_query(question, mode)
            )

        # Over-fetch from vector DB for reranking
        prefetch_k = max(settings.CUONGRAG_VECTOR_PREFETCH, top_k * 3)
        vector_task = asyncio.create_task(
            asyncio.to_thread(
                self._vector_query, question, prefetch_k, document_ids
            )
        )

        # Await results
        kg_summary = ""
        if kg_task:
            try:
                kg_summary = await kg_task
            except Exception as e:
                logger.warning(f"KG query failed, continuing with vector only: {e}")

        raw_chunks, raw_citations = await vector_task

        # Rerank: cross-encoder scoring for precision
        chunks, citations = await asyncio.to_thread(
            self._rerank_chunks, question, raw_chunks, raw_citations, top_k
        )

        return chunks, citations, kg_summary

    async def _consensus_query(
        self,
        question: str,
        top_k: int,
        document_ids: Optional[list[int]],
    ) -> tuple[list[EnrichedChunk], list[Citation], str]:
        """Consensus retriever: Graph local + Graph global + Vector hybrid.

        Strategy:
        1) Build local/global KG context snippets.
        2) Run 3 vector retrieval streams in parallel:
           - vector_hybrid: question
           - graph_local: question + local KG snippet
           - graph_global: question + global KG snippet
        3) Prioritize chunk intersection across methods.
        4) Rerank merged candidates with cross-encoder.
        """
        top_k_each = max(settings.CUONGRAG_CONSENSUS_TOP_K_EACH, top_k)

        local_ctx_task = asyncio.create_task(self._kg_query_variant(question, "local"))
        global_ctx_task = asyncio.create_task(self._kg_query_variant(question, "global"))

        vector_task = asyncio.create_task(
            asyncio.to_thread(self._vector_query, question, top_k_each, document_ids)
        )

        local_ctx, global_ctx = await asyncio.gather(local_ctx_task, global_ctx_task)

        local_query = f"{question}\n{local_ctx}" if local_ctx else question
        global_query = f"{question}\n{global_ctx}" if global_ctx else question

        local_task = asyncio.create_task(
            asyncio.to_thread(self._vector_query, local_query, top_k_each, document_ids)
        )
        global_task = asyncio.create_task(
            asyncio.to_thread(self._vector_query, global_query, top_k_each, document_ids)
        )

        (vec_chunks, vec_citations), (loc_chunks, loc_citations), (glo_chunks, glo_citations) = await asyncio.gather(
            vector_task, local_task, global_task
        )

        merged_chunks, merged_citations = self._merge_consensus_results(
            vector_result=(vec_chunks, vec_citations),
            local_result=(loc_chunks, loc_citations),
            global_result=(glo_chunks, glo_citations),
            top_k=top_k_each,
        )

        final_chunks, final_citations = await asyncio.to_thread(
            self._rerank_chunks,
            question,
            merged_chunks,
            merged_citations,
            top_k,
        )

        kg_parts = []
        if local_ctx:
            kg_parts.append(f"[KG Local]\n{local_ctx}")
        if global_ctx:
            kg_parts.append(f"[KG Global]\n{global_ctx}")
        kg_summary = "\n\n".join(kg_parts)

        return final_chunks, final_citations, kg_summary

    async def _kg_query_variant(self, question: str, variant: str) -> str:
        """Build KG context for local/global query styles."""
        if not self.kg_service:
            return ""
        try:
            if variant == "local":
                return await asyncio.wait_for(
                    self.kg_service.get_relevant_context(
                        question,
                        max_entities=12,
                        max_relationships=16,
                    ),
                    timeout=settings.CUONGRAG_KG_QUERY_TIMEOUT,
                )
            return await asyncio.wait_for(
                self.kg_service.get_relevant_context(
                    question,
                    max_entities=30,
                    max_relationships=45,
                ),
                timeout=settings.CUONGRAG_KG_QUERY_TIMEOUT,
            )
        except Exception:
            return ""

    def _merge_consensus_results(
        self,
        vector_result: tuple[list[EnrichedChunk], list[Citation]],
        local_result: tuple[list[EnrichedChunk], list[Citation]],
        global_result: tuple[list[EnrichedChunk], list[Citation]],
        top_k: int,
    ) -> tuple[list[EnrichedChunk], list[Citation]]:
        """Merge 3 retrieval streams, prioritizing intersections."""
        methods = [vector_result, local_result, global_result]

        vote_count: dict[str, int] = defaultdict(int)
        chunk_map: dict[str, EnrichedChunk] = {}
        citation_map: dict[str, Citation] = {}
        vector_order: list[str] = []

        for m_idx, (chunks, citations) in enumerate(methods):
            seen_this_method: set[str] = set()
            for i, (chunk, citation) in enumerate(zip(chunks, citations)):
                key = self._chunk_key(chunk)
                if key in seen_this_method:
                    continue
                seen_this_method.add(key)
                vote_count[key] += 1
                chunk_map[key] = chunk
                citation_map[key] = citation
                if m_idx == 0:
                    vector_order.append(key)

        # Priority 1: intersection (>=2 methods)
        intersection_keys = [k for k, v in vote_count.items() if v >= 2]
        intersection_keys.sort(key=lambda k: (-vote_count[k], vector_order.index(k) if k in vector_order else 10**9))

        selected_keys: list[str] = []
        min_intersection = max(1, int(settings.CUONGRAG_CONSENSUS_MIN_INTERSECTION))
        for k in intersection_keys:
            selected_keys.append(k)
            if len(selected_keys) >= min_intersection:
                break

        # Priority 2: fill from full intersection list then vector results
        for k in intersection_keys:
            if k not in selected_keys:
                selected_keys.append(k)
            if len(selected_keys) >= top_k:
                break

        if len(selected_keys) < top_k:
            for k in vector_order:
                if k not in selected_keys:
                    selected_keys.append(k)
                if len(selected_keys) >= top_k:
                    break

        merged_chunks = [chunk_map[k] for k in selected_keys if k in chunk_map]
        merged_citations = [citation_map[k] for k in selected_keys if k in citation_map]
        return merged_chunks, merged_citations

    @staticmethod
    def _chunk_key(chunk: EnrichedChunk) -> str:
        return f"{chunk.document_id}:{chunk.page_no}:{chunk.chunk_index}"

    @staticmethod
    def _is_multi_hop_question(question: str) -> bool:
        text = question.lower().strip()
        if len(text.split()) < 6:
            return False
        patterns = [
            r"\bso sánh\b",
            r"\bvà\b",
            r"\bđồng thời\b",
            r"\bkhác nhau\b",
            r"\bvs\b",
            r"\bbetween\b",
            r"\band\b",
        ]
        hits = sum(1 for p in patterns if re.search(p, text))
        return hits >= 2

    @staticmethod
    def _split_sub_queries(question: str) -> list[str]:
        normalized = re.sub(r"\s+", " ", question.strip())
        parts = re.split(r"\b(?:và|đồng thời|;|\.|,\s+và|and|vs)\b", normalized, flags=re.IGNORECASE)
        cleaned = [p.strip(" .,;:\n\t") for p in parts if p and p.strip(" .,;:\n\t")]
        if len(cleaned) <= 1:
            return [normalized]
        return cleaned[:4]

    async def _kg_query(self, question: str, mode: str) -> str:
        """Get raw KG context (entities + relationships) relevant to the question.

        Uses factual graph data instead of LLM-generated narrative to avoid
        hallucination from LightRAG's aquery().
        """
        if not self.kg_service:
            return ""
        try:
            return await asyncio.wait_for(
                self.kg_service.get_relevant_context(question),
                timeout=settings.CUONGRAG_KG_QUERY_TIMEOUT,
            )
        except asyncio.TimeoutError:
            logger.warning("KG raw context retrieval timed out")
            return ""
        except Exception as e:
            logger.warning(f"KG raw context failed: {e}")
            return ""

    def _vector_query(
        self,
        question: str,
        top_k: int,
        document_ids: Optional[list[int]],
    ) -> tuple[list[EnrichedChunk], list[Citation]]:
        """Synchronous vector search via PostgreSQL pgvector (over-fetch stage)."""
        query_embedding = self.embedder.embed_query(question)

        where = None
        if document_ids:
            where = {"document_id": {"$in": document_ids}}

        results = self.vector_store.query(
            query_embedding=query_embedding,
            n_results=top_k,
            where=where,
        )

        chunks = []
        citations = []

        for i, doc_text in enumerate(results.get("documents", [])):
            meta = results["metadatas"][i] if results.get("metadatas") else {}

            heading_path = []
            heading_str = meta.get("heading_path", "")
            if heading_str:
                heading_path = heading_str.split(" > ") if isinstance(heading_str, str) else []

            image_refs = []
            image_ids_str = meta.get("image_ids", "")
            if image_ids_str and isinstance(image_ids_str, str):
                image_refs = [iid for iid in image_ids_str.split("|") if iid]

            table_refs = []
            table_ids_str = meta.get("table_ids", "")
            if table_ids_str and isinstance(table_ids_str, str):
                table_refs = [tid for tid in table_ids_str.split("|") if tid]

            chunk = EnrichedChunk(
                content=doc_text,
                chunk_index=meta.get("chunk_index", i),
                source_file=meta.get("source", ""),
                document_id=meta.get("document_id", 0),
                page_no=meta.get("page_no", 0),
                heading_path=heading_path,
                image_refs=image_refs,
                table_refs=table_refs,
                has_table=meta.get("has_table", False),
                has_code=meta.get("has_code", False),
            )
            chunks.append(chunk)

            citations.append(Citation(
                source_file=meta.get("source", "Unknown"),
                document_id=meta.get("document_id", 0),
                page_no=meta.get("page_no", 0),
                heading_path=heading_path,
            ))

        return chunks, citations

    def _rerank_chunks(
        self,
        question: str,
        chunks: list[EnrichedChunk],
        citations: list[Citation],
        top_k: int,
    ) -> tuple[list[EnrichedChunk], list[Citation]]:
        """
        Cross-encoder reranking: score each (query, chunk) pair jointly,
        then filter by relevance threshold and return top_k.
        """
        if not chunks:
            return [], []

        # Extract texts for reranking
        doc_texts = [c.content for c in chunks]

        reranked = self.reranker.rerank(
            query=question,
            documents=doc_texts,
            top_k=top_k,
            min_score=settings.CUONGRAG_MIN_RELEVANCE_SCORE,
        )

        if not reranked:
            if settings.CUONGRAG_STRICT_EMPTY_ON_RERANK:
                logger.warning(
                    f"Reranker filtered all {len(chunks)} chunks below threshold "
                    f"{settings.CUONGRAG_MIN_RELEVANCE_SCORE}; returning empty result"
                )
                return [], []
            # Optional fallback mode
            logger.warning(
                f"Reranker filtered all {len(chunks)} chunks below threshold "
                f"{settings.CUONGRAG_MIN_RELEVANCE_SCORE}, falling back to top 3"
            )
            return chunks[:min(3, len(chunks))], citations[:min(3, len(citations))]

        # Map reranked results back to original chunks/citations
        reranked_chunks = [chunks[r.index] for r in reranked]
        reranked_citations = [citations[r.index] for r in reranked]

        logger.info(
            f"Reranked {len(chunks)} → {len(reranked)} chunks "
            f"(scores: {reranked[0].score:.3f} → {reranked[-1].score:.3f})"
        )

        return reranked_chunks, reranked_citations

    async def _find_related_images(
        self,
        page_refs: set[tuple[int, int]],  # (document_id, page_no)
    ) -> list[ExtractedImage]:
        """Find images on the exact same pages as retrieved chunks."""
        if not self.db:
            return []

        images = []
        for doc_id, page_no in page_refs:
            result = await self.db.execute(
                select(DocumentImage).where(
                    DocumentImage.document_id == doc_id,
                    DocumentImage.page_no == page_no,
                )
            )
            for img in result.scalars().all():
                images.append(ExtractedImage(
                    image_id=img.image_id,
                    document_id=img.document_id,
                    page_no=img.page_no,
                    file_path=img.file_path,
                    caption=img.caption,
                    width=img.width,
                    height=img.height,
                    mime_type=img.mime_type,
                ))

        # Deduplicate by image_id
        seen = set()
        unique = []
        for img in images:
            if img.image_id not in seen:
                seen.add(img.image_id)
                unique.append(img)

        return unique

    async def _find_related_tables(
        self,
        page_refs: set[tuple[int, int]],
    ) -> list[ExtractedTable]:
        """Find tables on the exact same pages as retrieved chunks."""
        if not self.db:
            return []

        tables = []
        for doc_id, page_no in page_refs:
            result = await self.db.execute(
                select(DocumentTable).where(
                    DocumentTable.document_id == doc_id,
                    DocumentTable.page_no == page_no,
                )
            )
            for tbl in result.scalars().all():
                tables.append(ExtractedTable(
                    table_id=tbl.table_id,
                    document_id=tbl.document_id,
                    page_no=tbl.page_no,
                    content_markdown=tbl.content_markdown,
                    caption=tbl.caption,
                    num_rows=tbl.num_rows,
                    num_cols=tbl.num_cols,
                ))

        # Deduplicate by table_id
        seen = set()
        unique = []
        for tbl in tables:
            if tbl.table_id not in seen:
                seen.add(tbl.table_id)
                unique.append(tbl)

        return unique

    @staticmethod
    def _assemble_context(
        chunks: list[EnrichedChunk],
        citations: list[Citation],
        kg_summary: str,
        image_refs: list[ExtractedImage],
        table_refs: list[ExtractedTable] | None = None,
    ) -> str:
        """Assemble a structured context string for the LLM."""
        parts = []

        # KG insights
        if kg_summary:
            parts.append("## Knowledge Graph Insights")
            parts.append(kg_summary)
            parts.append("")

        # Retrieved chunks with citations
        if chunks:
            parts.append("## Retrieved Document Sections")
            for i, (chunk, citation) in enumerate(zip(chunks, citations)):
                parts.append(f"### [{i + 1}] {citation.format()}")
                parts.append(chunk.content)
                parts.append("")

        # Available images
        if image_refs:
            parts.append("## Available Document Images")
            for img in image_refs:
                caption_str = f': "{img.caption}"' if img.caption else ""
                parts.append(
                    f"- Image p.{img.page_no}{caption_str} (id: {img.image_id})"
                )
            parts.append("")

        # Available tables
        if table_refs:
            parts.append("## Available Document Tables")
            for tbl in table_refs:
                caption_str = f': "{tbl.caption}"' if tbl.caption else ""
                parts.append(
                    f"- Table p.{tbl.page_no} ({tbl.num_rows}x{tbl.num_cols}){caption_str}"
                )
            parts.append("")

        if not parts:
            return "No relevant documents found for this query."

        return "\n".join(parts)
