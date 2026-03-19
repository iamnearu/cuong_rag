import React, { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import WorkspacesPage from "@/pages/Workspaces";
import DocumentsPage from "@/pages/Documents";
import RAGChatPage from "@/pages/RAGChat";
import { api } from "@/lib/api";

const ACTIVE_WORKSPACE_KEY = "cuongrag.activeWorkspaceId";

export default function App() {
  const location = useLocation();
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(() => {
    const cached = Number(localStorage.getItem(ACTIVE_WORKSPACE_KEY) || 0);
    return Number.isFinite(cached) && cached > 0 ? cached : null;
  });

  const activeWorkspace = useMemo(
    () => workspaces.find((ws) => ws.id === activeWorkspaceId) || null,
    [workspaces, activeWorkspaceId]
  );

  const refreshWorkspaces = async () => {
    try {
      const data = await api.listWorkspaces();
      setWorkspaces(Array.isArray(data) ? data : []);
    } catch {
      setWorkspaces([]);
    }
  };

  useEffect(() => {
    refreshWorkspaces();
  }, []);

  useEffect(() => {
    const match = location.pathname.match(/\/workspace\/(\d+)\//);
    if (!match) return;
    const wsId = Number(match[1]);
    if (!Number.isFinite(wsId) || wsId <= 0) return;
    setActiveWorkspaceId(wsId);
    localStorage.setItem(ACTIVE_WORKSPACE_KEY, String(wsId));
  }, [location.pathname]);

  useEffect(() => {
    if (workspaces.length === 0) {
      setActiveWorkspaceId(null);
      localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
      return;
    }

    const exists = workspaces.some((ws) => ws.id === activeWorkspaceId);
    if (!exists) {
      const fallbackId = workspaces[0].id;
      setActiveWorkspaceId(fallbackId);
      localStorage.setItem(ACTIVE_WORKSPACE_KEY, String(fallbackId));
    }
  }, [workspaces, activeWorkspaceId]);

  const selectWorkspace = (workspaceId) => {
    setActiveWorkspaceId(workspaceId);
    localStorage.setItem(ACTIVE_WORKSPACE_KEY, String(workspaceId));
  };

  const docsPath = activeWorkspaceId ? `/rag/workspace/${activeWorkspaceId}/docs` : "/rag/workspaces";
  const chatPath = activeWorkspaceId ? `/rag/workspace/${activeWorkspaceId}/chat` : "/rag/workspaces";

  return (
    <div className="flex h-screen bg-[#0b0f14] text-[#e6e8ee]">
      <aside className="hidden w-[290px] shrink-0 border-r border-white/10 bg-[#0f141b] p-4 lg:flex lg:flex-col">
        <div className="mb-4 rounded-xl border border-white/10 bg-[#151b24] p-3">
          <div className="text-sm font-semibold tracking-wide text-white">CuongRAG</div>
          <div className="mt-1 text-xs text-white/55">Local all-GPU test mode</div>
        </div>

        <Link
          to="/rag/workspaces"
          className="mb-3 rounded-lg bg-emerald-500 px-3 py-2 text-center text-sm font-medium text-white hover:bg-emerald-400"
        >
          + New Workspace
        </Link>

        <div className="mb-3 grid grid-cols-2 gap-2 text-sm">
          <NavLink
            to={docsPath}
            className={({ isActive }) =>
              `rounded-md px-3 py-2 text-center transition ${isActive ? "bg-white/15 text-white" : "bg-white/5 text-white/70 hover:bg-white/10"} ${!activeWorkspaceId ? "pointer-events-none opacity-40" : ""}`
            }
          >
            Documents
          </NavLink>
          <NavLink
            to={chatPath}
            className={({ isActive }) =>
              `rounded-md px-3 py-2 text-center transition ${isActive ? "bg-emerald-500/20 text-emerald-200" : "bg-white/5 text-white/70 hover:bg-white/10"} ${!activeWorkspaceId ? "pointer-events-none opacity-40" : ""}`
            }
          >
            Chat
          </NavLink>
        </div>

        <div className="mb-2 text-xs uppercase tracking-wider text-white/40">Workspaces</div>
        <div className="space-y-2 overflow-auto pr-1">
          {workspaces.length === 0 && (
            <div className="rounded-lg border border-dashed border-white/15 p-3 text-xs text-white/55">No workspace yet.</div>
          )}
          {workspaces.map((ws) => (
            <div
              key={ws.id}
              className={`rounded-lg border p-2 ${activeWorkspaceId === ws.id ? "border-emerald-400/50 bg-emerald-500/10" : "border-white/10 bg-white/[0.03]"}`}
            >
              <button
                onClick={() => selectWorkspace(ws.id)}
                className="w-full text-left"
              >
                <div className="truncate text-sm font-medium">{ws.name}</div>
                <div className="text-[11px] text-white/55">{ws.document_count} docs · {ws.indexed_count} indexed</div>
              </button>

              <div className="mt-2 flex gap-2 text-[11px]">
                <Link
                  to={`/rag/workspace/${ws.id}/docs`}
                  onClick={() => selectWorkspace(ws.id)}
                  className="rounded bg-white/10 px-2 py-1 text-white/80 hover:bg-white/20"
                >
                  Docs
                </Link>
                <Link
                  to={`/rag/workspace/${ws.id}/chat`}
                  onClick={() => selectWorkspace(ws.id)}
                  className="rounded bg-emerald-500/20 px-2 py-1 text-emerald-200 hover:bg-emerald-500/30"
                >
                  Chat
                </Link>
              </div>
            </div>
          ))}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-white/10 bg-[#0b0f14]/90 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
            <div>
              <h1 className="text-base font-semibold tracking-tight">Cuong RAG</h1>
              <p className="text-xs text-white/55">{activeWorkspace ? `Active: ${activeWorkspace.name}` : "Choose or create workspace"}</p>
            </div>

            <NavLink
              to="/rag/workspaces"
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm transition ${isActive ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10"}`
              }
            >
              Manage
            </NavLink>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 overflow-auto p-4">
          <Routes>
            <Route path="/" element={<Navigate to="/rag/workspaces" replace />} />
            <Route path="/rag" element={<Navigate to="/rag/workspaces" replace />} />
            <Route
              path="/rag/workspaces"
              element={
                <WorkspacesPage
                  activeWorkspaceId={activeWorkspaceId}
                  onWorkspaceSelect={selectWorkspace}
                  onWorkspacesChanged={setWorkspaces}
                />
              }
            />
            <Route path="/rag/workspace/:id/docs" element={<DocumentsPage />} />
            <Route path="/rag/workspace/:id/chat" element={<RAGChatPage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
