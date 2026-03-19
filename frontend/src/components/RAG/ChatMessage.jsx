import React from "react";

export default function ChatMessage({ role, content, sources = [] }) {
  const isUser = role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-semibold text-emerald-200">
          AI
        </div>
      )}

      <div
        className={`max-w-[85%] rounded-2xl border px-4 py-3 shadow-sm ${
          isUser
            ? "border-emerald-400/40 bg-emerald-500/20 text-white"
            : "border-white/10 bg-[#171a21] text-[#e8ebf3]"
        }`}
      >
        <div className="mb-1 text-[11px] uppercase tracking-wide text-white/50">{isUser ? "You" : "Assistant"}</div>
        <pre className="whitespace-pre-wrap text-sm leading-6 text-inherit">{content}</pre>

        {!isUser && sources.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {sources.map((source) => (
              <span
                key={`${source.index}-${source.chunk_id}`}
                className="rounded-full border border-white/20 bg-white/5 px-2 py-1 text-xs text-white/75"
              >
                [{source.index}] {source.source_file || `doc-${source.document_id}`}
              </span>
            ))}
          </div>
        )}
      </div>

      {isUser && (
        <div className="mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-sky-500/30 text-xs font-semibold text-sky-100">
          You
        </div>
      )}
    </div>
  );
}
