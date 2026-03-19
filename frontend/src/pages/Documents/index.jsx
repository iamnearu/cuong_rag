import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "@/lib/api";
import DocumentUpload from "@/components/RAG/DocumentUpload";

export default function DocumentsPage() {
  const { id } = useParams();
  const workspaceId = useMemo(() => Number(id || 1), [id]);

  const [docs, setDocs] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const loadDocs = async () => {
    try {
      const data = await api.listDocuments(workspaceId);
      setDocs(data || []);
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    loadDocs();
  }, [workspaceId]);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (!docs.some((d) => ["processing", "parsing", "indexing"].includes(String(d.status).toLowerCase()))) {
        return;
      }
      await loadDocs();
    }, 3000);
    return () => clearInterval(interval);
  }, [docs, workspaceId]);

  const onUpload = async (file) => {
    setUploading(true);
    setError("");
    try {
      await api.uploadDocument(workspaceId, file);
      await loadDocs();
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const onProcess = async (docId) => {
    setError("");
    try {
      await api.processDocument(docId);
      await loadDocs();
    } catch (e) {
      setError(e.message);
    }
  };

  const onReindex = async (docId) => {
    setError("");
    try {
      await api.reindexDocument(docId);
      await loadDocs();
    } catch (e) {
      setError(e.message);
    }
  };

  const onDelete = async (docId) => {
    setError("");
    try {
      await api.deleteDocument(docId);
      await loadDocs();
    } catch (e) {
      setError(e.message);
    }
  };

  const statusClass = (status) => {
    const s = String(status || "").toLowerCase();
    if (s === "indexed") return "bg-emerald-500/20 text-emerald-200 border-emerald-300/30";
    if (s === "failed") return "bg-red-500/20 text-red-200 border-red-300/30";
    if (["processing", "parsing", "indexing"].includes(s)) return "bg-amber-500/20 text-amber-100 border-amber-300/30";
    return "bg-white/10 text-white/70 border-white/20";
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/10 bg-[#121823] p-4">
        <h2 className="text-lg font-semibold">Documents</h2>
        <p className="mt-1 text-xs text-white/60">Workspace #{workspaceId}</p>
      </div>

      <DocumentUpload onUpload={onUpload} uploading={uploading} />
      {error && <div className="rounded-lg border border-red-400/30 bg-red-500/10 p-2 text-sm text-red-200">{error}</div>}

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#121823]">
        <table className="min-w-full text-sm">
          <thead className="bg-white/5 text-left text-white/70">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Chunks</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((doc) => (
              <tr key={doc.id} className="border-t border-white/10">
                <td className="px-3 py-2">
                  <div className="max-w-[340px] truncate font-medium">{doc.original_filename}</div>
                  <div className="text-xs text-white/45">id: {doc.id}</div>
                </td>
                <td className="px-3 py-2">
                  <span className={`rounded-full border px-2 py-1 text-xs ${statusClass(doc.status)}`}>
                    {String(doc.status).toUpperCase()}
                  </span>
                </td>
                <td className="px-3 py-2">{doc.chunk_count || 0}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => onProcess(doc.id)} className="rounded-lg bg-emerald-500/20 px-2 py-1 text-xs text-emerald-200 hover:bg-emerald-500/30">
                      Analyze
                    </button>
                    <button onClick={() => onReindex(doc.id)} className="rounded-lg bg-white/10 px-2 py-1 text-xs hover:bg-white/20">
                      Reindex
                    </button>
                    <button onClick={() => onDelete(doc.id)} className="rounded-lg bg-red-500/20 px-2 py-1 text-xs text-red-200 hover:bg-red-500/30">
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {docs.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-white/60">
                  No documents yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
