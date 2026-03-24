import React, { createContext, useContext, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/* ── WorkspaceContext — share current workspace across pages ── */
export const WorkspaceContext = createContext(null);
export const useWorkspace = () => useContext(WorkspaceContext);

const NAV_ITEMS = [
  { path: "/workspaces", icon: "🗂️", label: "Workspaces" },
  { path: "/documents", icon: "📄", label: "Documents" },
  { path: "/chat", icon: "/bot-avatar.svg", label: "Chat" },
  { path: "/knowledge-graph", icon: "🕸️", label: "Knowledge Graph" },
  { path: "/analytics", icon: "📊", label: "Analytics" },
];

function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <aside className="app-sidebar">
      {/* Brand */}
      <div className="sidebar-brand">
        <img className="sidebar-brand-icon" src="/bot-avatar.svg" alt="CuongRAG avatar" />
        <div>
          <div className="sidebar-brand-title">CuongRAG</div>
          <div className="sidebar-brand-sub">RAG Microservices</div>
        </div>
      </div>

      {/* Nav */}
      <div className="sidebar-section-label">Navigation</div>
      {NAV_ITEMS.map(({ path, icon, label }) => (
        <button
          key={path}
          className={`nav-item ${location.pathname === path ? "active" : ""}`}
          onClick={() => navigate(path)}
        >
          {typeof icon === "string" && icon.startsWith("/") ? (
            <img className="nav-icon nav-icon-avatar" src={icon} alt={`${label} icon`} />
          ) : (
            <span className="nav-icon">{icon}</span>
          )}
          {label}
        </button>
      ))}

      {/* Footer */}
      <div style={{ marginTop: "auto", padding: "16px", borderTop: "1px solid rgba(70,69,84,0.2)" }}>
        <div style={{ fontSize: "11px", color: "var(--outline)" }}>
          CuongRAG v1.0
        </div>
        <div style={{ fontSize: "10px", color: "var(--outline-variant)", marginTop: "2px" }}>
          Intelligent Ether
        </div>
      </div>
    </aside>
  );
}

export default function App({ children }) {
  const [selectedWorkspace, setSelectedWorkspace] = useState(null);

  return (
    <WorkspaceContext.Provider value={{ selectedWorkspace, setSelectedWorkspace }}>
      <div className="app-shell">
        <Sidebar />
        <main className="app-main">
          {children}
        </main>
      </div>
    </WorkspaceContext.Provider>
  );
}
