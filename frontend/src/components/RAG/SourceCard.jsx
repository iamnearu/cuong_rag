import React from "react";

export default function SourceCard({ source }) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#0f141d] p-3">
      <div className="mb-2 text-xs text-emerald-300">[{source.index}] score: {(source.score || 0).toFixed(3)}</div>
      <div className="mb-1 text-xs text-white/60">
        doc #{source.document_id} · page {source.page_no || 0}
      </div>
      <p className="line-clamp-6 text-sm leading-6 text-white/85">{source.content}</p>
    </div>
  );
}
