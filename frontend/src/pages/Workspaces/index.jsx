import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";

export default function WorkspacesPage({ activeWorkspaceId, onWorkspaceSelect, onWorkspacesChanged }) {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setError("");
    try {
      const data = await api.listWorkspaces();
      const list = data || [];
      setItems(list);
      onWorkspacesChanged?.(list);
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError("");
    try {
      const created = await api.createWorkspace({ name, description });
      setName("");
      setDescription("");
      await load();
      if (created?.id) {
        onWorkspaceSelect?.(created.id);
        navigate(`/rag/workspace/${created.id}/docs`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Workspace Manager</h2>
        <p className="mt-1 text-sm text-white/60">Create knowledge spaces and jump straight to docs/chat.</p>
      </div>

      <form onSubmit={onCreate} className="grid gap-3 rounded-xl border border-white/10 bg-[#121823] p-4 md:grid-cols-6">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Workspace name"
          className="rounded-lg border border-white/15 bg-[#0d121b] px-3 py-2 text-sm outline-none focus:border-emerald-400/60 md:col-span-2"
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description"
          className="rounded-lg border border-white/15 bg-[#0d121b] px-3 py-2 text-sm outline-none focus:border-emerald-400/60 md:col-span-3"
        />
        <button
          disabled={loading}
          className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-400 disabled:opacity-60"
        >
          {loading ? "Creating..." : "Create"}
        </button>
      </form>

      {error && <div className="rounded-lg border border-red-400/30 bg-red-500/10 p-2 text-sm text-red-200">{error}</div>}

      <div className="grid gap-3 lg:grid-cols-2">
        {items.map((ws) => (
          <div
            key={ws.id}
            className={`rounded-xl border p-4 ${activeWorkspaceId === ws.id ? "border-emerald-400/40 bg-emerald-500/10" : "border-white/10 bg-[#121823]"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold">{ws.name}</div>
                <div className="mt-1 text-sm text-white/70">{ws.description || "No description"}</div>
              </div>

              {activeWorkspaceId === ws.id && (
                <span className="rounded-full border border-emerald-300/40 bg-emerald-400/20 px-2 py-1 text-[11px] text-emerald-200">Active</span>
              )}
            </div>

            <div className="mt-3 flex gap-2 text-xs text-white/70">
              <span className="rounded-full bg-white/10 px-2 py-1">{ws.document_count} docs</span>
              <span className="rounded-full bg-white/10 px-2 py-1">{ws.indexed_count} indexed</span>
            </div>

            <div className="mt-4 flex gap-2">
              <Link
                className="rounded-lg bg-white/10 px-3 py-1.5 text-xs hover:bg-white/20"
                to={`/rag/workspace/${ws.id}/docs`}
                onClick={() => onWorkspaceSelect?.(ws.id)}
              >
                Documents
              </Link>
              <Link
                className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs text-emerald-200 hover:bg-emerald-500/30"
                to={`/rag/workspace/${ws.id}/chat`}
                onClick={() => onWorkspaceSelect?.(ws.id)}
              >
                Chat
              </Link>
            </div>
          </div>
        ))}

        {items.length === 0 && (
          <div className="rounded-xl border border-dashed border-white/20 bg-white/[0.02] p-8 text-center text-sm text-white/60 lg:col-span-2">
            No workspace yet. Create one above.
          </div>
        )}
      </div>
    </div>
  );
}
