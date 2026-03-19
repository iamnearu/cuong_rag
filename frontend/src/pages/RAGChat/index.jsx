import React, { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "@/lib/api";
import ChatMessage from "@/components/RAG/ChatMessage";
import SourceCard from "@/components/RAG/SourceCard";
import KGGraph from "@/components/RAG/KGGraph";

export default function RAGChatPage() {
  const { id } = useParams();
  const workspaceId = useMemo(() => Number(id || 1), [id]);

  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [sources, setSources] = useState([]);
  const [thinking, setThinking] = useState("");
  const [graph, setGraph] = useState({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onAsk = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;

    const userMsg = { role: "user", content: question };
    setMessages((prev) => [...prev, userMsg]);
    setQuestion("");
    setLoading(true);
    setError("");

    try {
      const response = await api.chat(workspaceId, {
        message: userMsg.content,
        history: messages.map((m) => ({ role: m.role, content: m.content })),
        enable_thinking: true,
      });

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: response.answer || "",
          sources: response.sources || [],
        },
      ]);
      setSources(response.sources || []);
      setThinking(response.thinking || "");

      const graphData = await api.getGraph(workspaceId).catch(() => ({ nodes: [], edges: [] }));
      setGraph(graphData || { nodes: [], edges: [] });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid h-[calc(100vh-130px)] gap-4 lg:grid-cols-12">
      <div className="flex min-h-0 flex-col lg:col-span-8">
        <div className="mb-3 rounded-xl border border-white/10 bg-[#121823] p-4">
          <h2 className="text-lg font-semibold">RAG Chat</h2>
          <p className="mt-1 text-xs text-white/60">Workspace #{workspaceId}</p>
        </div>

        <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-white/10 bg-[#121823]">
          <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4">
            {messages.length === 0 && (
              <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.03] p-8 text-center text-sm text-white/60">
                Ask something about your indexed documents.
              </div>
            )}

            {messages.map((m, idx) => (
              <ChatMessage key={idx} role={m.role} content={m.content} sources={m.sources} />
            ))}
          </div>

          <form onSubmit={onAsk} className="border-t border-white/10 p-4">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onAsk(e);
                }
              }}
              rows={3}
              placeholder="Message CuongRAG..."
              className="w-full resize-none rounded-xl border border-white/15 bg-[#0c0f14] p-3 text-sm text-white outline-none focus:border-emerald-400/50"
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-white/50">Enter to send · Shift+Enter for newline</span>
              <button
                disabled={loading}
                className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-400 disabled:opacity-60"
              >
                {loading ? "Thinking..." : "Send"}
              </button>
            </div>
          </form>
        </div>

        {error && <div className="rounded border border-red-400/30 bg-red-500/10 p-2 text-sm text-red-200">{error}</div>}
      </div>

      <div className="space-y-4 lg:col-span-4">
        <div className="rounded-xl border border-white/10 bg-[#121823] p-3">
          <div className="mb-2 text-sm font-medium">Thinking</div>
          <div className="max-h-52 overflow-auto whitespace-pre-wrap text-xs text-white/70">
            {thinking || "No thinking trace"}
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-white/10 bg-[#121823] p-3">
          <div className="text-sm font-medium">Sources</div>
          {sources.length === 0 && <div className="text-xs text-white/60">No source citations</div>}
          {sources.map((source) => (
            <SourceCard key={`${source.index}-${source.chunk_id}`} source={source} />
          ))}
        </div>

        <KGGraph graph={graph} />
      </div>
    </div>
  );
}
