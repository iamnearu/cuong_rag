import React, { useState, useEffect, useCallback, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "react-toastify";
import { useWorkspace } from "../App";
import { api } from "../api/client";

const STATUS_ICONS = {
    pending: "⏳",
    processing: "⚙️",
    parsing: "🔍",
    indexing: "📥",
    indexed: "✅",
    failed: "❌",
};

const FILE_ICONS = {
    pdf: "📕",
    docx: "📝",
    doc: "📝",
    txt: "📃",
    md: "📑",
    pptx: "📊",
};

function StatusBadge({ status }) {
    const isProcessing = ["processing", "parsing", "indexing"].includes(status);
    return (
        <span className={`badge badge-${status}${isProcessing ? " pulse" : ""}`}>
            {STATUS_ICONS[status] || "❓"} {status}
        </span>
    );
}

function WorkspaceSelector({ workspaces, selected, onSelect }) {
    return (
        <div className="flex items-center gap-2">
            <span className="text-muted text-sm">Workspace:</span>
            <select
                className="form-select"
                style={{ width: "220px" }}
                value={selected?.id || ""}
                onChange={(e) => {
                    const ws = workspaces.find((w) => String(w.id) === e.target.value);
                    onSelect(ws || null);
                }}
            >
                <option value="">— select workspace —</option>
                {workspaces.map((ws) => (
                    <option key={ws.id} value={ws.id}>
                        {ws.name} ({ws.document_count} docs)
                    </option>
                ))}
            </select>
        </div>
    );
}

function UploadZone({ onUpload }) {
    const [uploading, setUploading] = useState(false);

    const onDrop = useCallback(async (files) => {
        if (!files.length) return;
        setUploading(true);
        await onUpload(files);
        setUploading(false);
    }, [onUpload]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            "application/pdf": [".pdf"],
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
            "text/plain": [".txt"],
            "text/markdown": [".md"],
            "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
        },
        maxSize: 50 * 1024 * 1024,
        disabled: uploading,
    });

    return (
        <div {...getRootProps()} className={`dropzone ${isDragActive ? "active" : ""}`}>
            <input {...getInputProps()} />
            {uploading ? (
                <><div className="spinner" style={{ margin: "0 auto 10px" }} /><p className="dropzone-text">Uploading...</p></>
            ) : (
                <>
                    <span className="dropzone-icon">☁️</span>
                    <p className="dropzone-text">
                        {isDragActive ? "Drop files here" : <><strong>Click to browse</strong> or drag & drop</>}
                    </p>
                    <p className="dropzone-hint">PDF, DOCX, TXT, MD, PPTX · Max 50MB per file</p>
                </>
            )}
        </div>
    );
}

export default function DocumentsPage() {
    const [workspaces, setWorkspaces] = useState([]);
    const { selectedWorkspace, setSelectedWorkspace } = useWorkspace();
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(false);
    const pollingRef = useRef(null);

    // Load workspaces on mount
    useEffect(() => {
        api.listWorkspaces()
            .then(setWorkspaces)
            .catch((e) => toast.error("Failed to load workspaces: " + e.message));
    }, []);

    // Load documents when workspace changes
    useEffect(() => {
        if (!selectedWorkspace) { setDocuments([]); return; }
        setLoading(true);
        api.listDocuments(selectedWorkspace.id)
            .then(setDocuments)
            .catch((e) => toast.error("Failed to load documents: " + e.message))
            .finally(() => setLoading(false));
    }, [selectedWorkspace]);

    // Polling: refresh docs while any are processing
    useEffect(() => {
        const hasProcessing = documents.some((d) =>
            ["processing", "parsing", "indexing"].includes(d.status)
        );
        if (hasProcessing && selectedWorkspace) {
            pollingRef.current = setTimeout(async () => {
                try {
                    const docs = await api.listDocuments(selectedWorkspace.id);
                    setDocuments(docs);
                } catch (_) { }
            }, 3000);
        }
        return () => clearTimeout(pollingRef.current);
    }, [documents, selectedWorkspace]);

    const handleUpload = async (files) => {
        if (!selectedWorkspace) { toast.warn("Select a workspace first"); return; }
        const results = await Promise.allSettled(
            files.map((file) => api.uploadDocument(selectedWorkspace.id, file))
        );
        const succeeded = results.filter((r) => r.status === "fulfilled").length;
        if (succeeded > 0) {
            toast.success(`${succeeded} file(s) uploaded`);
            const docs = await api.listDocuments(selectedWorkspace.id);
            setDocuments(docs);
        }
        const failed = results.filter((r) => r.status === "rejected");
        failed.forEach((r) => toast.error("Upload failed: " + r.reason?.message));
    };

    const handleProcess = async (doc) => {
        try {
            await api.processDocument(doc.id);
            toast.info(`Processing "${doc.original_filename}"...`);
            setDocuments((prev) =>
                prev.map((d) => d.id === doc.id ? { ...d, status: "processing" } : d)
            );
        } catch (err) {
            toast.error("Failed to process: " + err.message);
        }
    };

    const handleDelete = async (doc) => {
        if (!confirm(`Delete "${doc.original_filename}"?`)) return;
        try {
            await api.deleteDocument(doc.id);
            setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
            toast.success("Document deleted");
        } catch (err) {
            toast.error("Delete failed: " + err.message);
        }
    };

    const handleProcessAll = async () => {
        const pending = documents.filter((d) => d.status === "pending" || d.status === "failed");
        if (!pending.length) { toast.info("No documents to process"); return; }
        try {
            await api.processBatch(pending.map((d) => d.id));
            toast.info(`Processing ${pending.length} document(s)...`);
            setDocuments((prev) =>
                prev.map((d) => pending.find((p) => p.id === d.id) ? { ...d, status: "processing" } : d)
            );
        } catch (err) {
            toast.error("Batch process failed: " + err.message);
        }
    };

    const formatSize = (bytes) => {
        if (!bytes) return "—";
        if (bytes < 1024) return `${bytes}B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
        return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
    };

    const getFileIcon = (filename) => {
        const ext = (filename || "").split(".").pop().toLowerCase();
        return FILE_ICONS[ext] || "📄";
    };

    const pendingCount = documents.filter((d) => ["pending", "failed"].includes(d.status)).length;

    return (
        <div className="page-container">
            <div className="page-header flex items-center justify-between">
                <div>
                    <h1 className="page-title">Documents</h1>
                    <p className="page-subtitle">Upload and index documents into your workspace</p>
                </div>
                <WorkspaceSelector
                    workspaces={workspaces}
                    selected={selectedWorkspace}
                    onSelect={setSelectedWorkspace}
                />
            </div>

            {selectedWorkspace ? (
                <>
                    <UploadZone onUpload={handleUpload} />

                    <div className="flex items-center justify-between mt-4 mb-4">
                        <div className="text-sm text-muted">
                            {documents.length} document{documents.length !== 1 ? "s" : ""}
                            {pendingCount > 0 && <> · <span className="text-primary">{pendingCount} ready to analyze</span></>}
                        </div>
                        {pendingCount > 0 && (
                            <button className="btn btn-primary btn-sm" onClick={handleProcessAll}>
                                ⚙️ Analyze All ({pendingCount})
                            </button>
                        )}
                    </div>

                    {loading ? (
                        <div style={{ display: "flex", justifyContent: "center", padding: "40px" }}>
                            <div className="spinner" style={{ width: 28, height: 28 }} />
                        </div>
                    ) : documents.length === 0 ? (
                        <div className="empty-state">
                            <span className="empty-state-icon">📭</span>
                            <h3>No documents yet</h3>
                            <p>Upload files above to get started</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {documents.map((doc) => {
                                const isProcessing = ["processing", "parsing", "indexing"].includes(doc.status);
                                return (
                                    <div key={doc.id} className="doc-row">
                                        <div className="doc-icon">{getFileIcon(doc.original_filename)}</div>
                                        <div className="doc-info">
                                            <div className="doc-name">{doc.original_filename}</div>
                                            <div className="doc-meta">
                                                {formatSize(doc.file_size)}
                                                {doc.chunk_count > 0 && ` · ${doc.chunk_count} chunks`}
                                                {doc.page_count > 0 && ` · ${doc.page_count} pages`}
                                            </div>
                                        </div>
                                        <StatusBadge status={doc.status} />
                                        <div className="doc-actions">
                                            {(doc.status === "pending" || doc.status === "failed") && (
                                                <button
                                                    className="btn btn-primary btn-sm"
                                                    onClick={() => handleProcess(doc)}
                                                >
                                                    ⚙️ Analyze
                                                </button>
                                            )}
                                            {isProcessing && <div className="spinner" />}
                                            <button
                                                className="btn btn-danger btn-sm btn-icon"
                                                onClick={() => handleDelete(doc)}
                                                title="Delete"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            ) : (
                <div className="empty-state">
                    <span className="empty-state-icon">📂</span>
                    <h3>Select a workspace</h3>
                    <p>Choose a workspace from the dropdown above to manage its documents</p>
                </div>
            )}
        </div>
    );
}
