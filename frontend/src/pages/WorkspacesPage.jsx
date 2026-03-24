import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useWorkspace } from "../App";
import { api } from "../api/client";

function CreateWorkspaceModal({ onClose, onCreated }) {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        setLoading(true);
        try {
            const ws = await api.createWorkspace({ name: name.trim(), description: description.trim() });
            onCreated(ws);
            toast.success(`Workspace "${ws.name}" created!`);
            onClose();
        } catch (err) {
            toast.error("Failed to create workspace: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="modal">
                <h2 className="modal-title">New Workspace</h2>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Name *</label>
                        <input
                            className="form-input"
                            placeholder="e.g. Financial Reports Q4"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Description</label>
                        <textarea
                            className="form-textarea"
                            placeholder="What documents will this workspace contain?"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>
                    <div className="modal-actions">
                        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={loading || !name.trim()}>
                            {loading ? <span className="spinner" /> : "Create Workspace"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function WorkspacesPage() {
    const [workspaces, setWorkspaces] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const { setSelectedWorkspace } = useWorkspace();
    const navigate = useNavigate();

    useEffect(() => {
        api.listWorkspaces()
            .then(setWorkspaces)
            .catch((e) => toast.error("Failed to load workspaces: " + e.message))
            .finally(() => setLoading(false));
    }, []);

    const handleDelete = async (ws, e) => {
        e.stopPropagation();
        if (!confirm(`Delete workspace "${ws.name}"? This will remove all its documents and vector data.`)) return;
        try {
            await api.deleteWorkspace(ws.id);
            setWorkspaces((prev) => prev.filter((w) => w.id !== ws.id));
            toast.success("Workspace deleted");
        } catch (err) {
            toast.error("Delete failed: " + err.message);
        }
    };

    const handleSelect = (ws) => {
        setSelectedWorkspace(ws);
        navigate("/documents");
    };

    const formatDate = (d) => d ? new Date(d).toLocaleDateString() : "—";
    const formatSize = (n) => n > 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

    return (
        <div className="page-container">
            <div className="page-header flex items-center justify-between">
                <div>
                    <h1 className="page-title">Workspaces</h1>
                    <p className="page-subtitle">Organize your documents into knowledge bases</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                    + New Workspace
                </button>
            </div>

            {loading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: "60px" }}>
                    <div className="spinner" style={{ width: 32, height: 32 }} />
                </div>
            ) : workspaces.length === 0 ? (
                <div className="empty-state">
                    <span className="empty-state-icon">🗂️</span>
                    <h3>No workspaces yet</h3>
                    <p>Create your first workspace to start adding documents</p>
                    <button className="btn btn-primary mt-4" onClick={() => setShowCreate(true)}>
                        Create Workspace
                    </button>
                </div>
            ) : (
                <div className="ws-grid">
                    {workspaces.map((ws) => (
                        <div key={ws.id} className="ws-card" onClick={() => handleSelect(ws)}>
                            <div className="ws-card-icon">🗂️</div>
                            <div className="ws-card-name">{ws.name}</div>
                            <div className="ws-card-desc">{ws.description || "No description"}</div>
                            <div className="ws-card-meta">
                                <span>📄 {ws.document_count} docs</span>
                                <span>✅ {ws.indexed_count} indexed</span>
                                <span>📅 {formatDate(ws.created_at)}</span>
                            </div>
                            <div style={{ position: "absolute", top: 12, right: 12 }}>
                                <button
                                    className="btn btn-danger btn-sm"
                                    onClick={(e) => handleDelete(ws, e)}
                                    title="Delete workspace"
                                >
                                    🗑️
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showCreate && (
                <CreateWorkspaceModal
                    onClose={() => setShowCreate(false)}
                    onCreated={(ws) => setWorkspaces((prev) => [ws, ...prev])}
                />
            )}
        </div>
    );
}
