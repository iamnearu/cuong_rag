import React, { useEffect, useState } from "react";
import { default as WorkspaceChatContainer } from "@/components/WorkspaceChat";
import { Link, useParams } from "react-router-dom";
import Workspace from "@/models/workspace";
import { FullScreenLoader } from "@/components/Preloader";
import { LAST_VISITED_WORKSPACE } from "@/utils/constants";
import paths from "@/utils/paths";

export default function WorkspaceChat() {
  return <ShowWorkspaceChat />;
}

function ShowWorkspaceChat() {
  const { slug } = useParams();
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState([]);
  const [docLoading, setDocLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [workingDocId, setWorkingDocId] = useState(null);
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);

  async function loadDocuments(currentSlug) {
    if (!currentSlug) return;
    setDocLoading(true);
    const docs = await Workspace.listDocuments(currentSlug);
    setDocuments(Array.isArray(docs) ? docs : []);
    setDocLoading(false);
  }

  const hasActiveIndexing = documents.some((doc) =>
    ["pending", "processing"].includes((doc.status || "").toLowerCase())
  );

  useEffect(() => {
    async function getWorkspace() {
      if (!slug) return;
      const _workspace = await Workspace.bySlug(slug);
      if (!_workspace) return setLoading(false);

      const suggestedMessages = await Workspace.getSuggestedMessages(slug);
      const pfpUrl = await Workspace.fetchPfp(slug);
      setWorkspace({
        ..._workspace,
        suggestedMessages,
        pfpUrl,
      });
      await loadDocuments(_workspace.slug);
      setLoading(false);
      localStorage.setItem(
        LAST_VISITED_WORKSPACE,
        JSON.stringify({
          slug: _workspace.slug,
          name: _workspace.name,
        })
      );
    }
    getWorkspace();
  }, [slug]);

  useEffect(() => {
    if (!workspace?.slug) return;
    if (!hasActiveIndexing && !uploading && workingDocId === null) return;

    const timer = setInterval(() => {
      loadDocuments(workspace.slug);
    }, 2000);

    return () => clearInterval(timer);
  }, [workspace?.slug, hasActiveIndexing, uploading, workingDocId]);

  async function handleUpload(e) {
    e.preventDefault();
    if (!selectedFile || !workspace?.slug) return;

    setUploading(true);
    setError("");
    const formData = new FormData();
    formData.append("file", selectedFile);
    const { response, data } = await Workspace.uploadFile(workspace.slug, formData);
    setUploading(false);

    if (!response?.ok || data?.success === false) {
      setError(data?.error || data?.message || "Upload thất bại.");
      return;
    }

    setSelectedFile(null);
    await loadDocuments(workspace.slug);
  }

  async function handleIndexDocument(doc) {
    if (!workspace?.slug || !doc?.file_path) return;
    setWorkingDocId(doc.id);
    setError("");
    setDocuments((prev) =>
      prev.map((item) =>
        item.id === doc.id ? { ...item, status: "processing", error_message: null } : item
      )
    );
    const { message } = await Workspace.modifyEmbeddings(workspace.slug, {
      adds: [doc.file_path],
      deletes: [],
    });
    if (message) setError(message);
    await loadDocuments(workspace.slug);
    setWorkingDocId(null);
  }

  async function handleDeleteDocument(doc) {
    if (!workspace?.slug || !doc?.id) return;
    setWorkingDocId(doc.id);
    const ok = await Workspace.deleteDocumentById(workspace.slug, doc.id);
    if (!ok) setError("Xóa tài liệu thất bại.");
    await loadDocuments(workspace.slug);
    setWorkingDocId(null);
  }

  if (loading) return <FullScreenLoader />;

  const statusLabel = (status = "") => {
    const s = status.toLowerCase();
    if (s === "processing") return "Đang indexing";
    if (s === "completed") return "Indexed";
    if (s === "failed") return "Thất bại";
    if (s === "pending") return "Đang chờ index";
    return status || "Không rõ";
  };

  const statusClass = (status = "") => {
    const s = status.toLowerCase();
    if (s === "processing") return "text-amber-500";
    if (s === "completed") return "text-emerald-500";
    if (s === "failed") return "text-red-500";
    return "text-theme-text-secondary";
  };

  return (
    <div className="w-screen h-screen overflow-hidden bg-theme-bg-container flex flex-col">
      <div className="h-14 border-b border-theme-sidebar-border px-4 flex items-center justify-between bg-theme-bg-secondary">
        <div className="font-semibold text-theme-text-primary truncate">
          {workspace?.name || "Workspace"}
        </div>
        <Link
          to={paths.home()}
          className="text-sm px-3 py-1.5 rounded-md bg-theme-sidebar-footer-icon text-theme-text-primary hover:bg-theme-sidebar-footer-icon-hover"
        >
          Đổi workspace
        </Link>
      </div>

      <div className="border-b border-theme-sidebar-border bg-theme-bg-secondary p-3 space-y-3">
        <form onSubmit={handleUpload} className="flex flex-col md:flex-row gap-2 md:items-center">
          <input
            type="file"
            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            className="text-sm"
          />
          <button
            type="submit"
            disabled={!selectedFile || uploading}
            className="w-fit px-3 py-1.5 rounded-md bg-theme-button-primary text-black text-sm font-semibold disabled:opacity-60"
          >
            {uploading ? "Đang upload..." : "Upload tài liệu"}
          </button>
        </form>

        {error ? <p className="text-sm text-red-500">{error}</p> : null}

        <div className="max-h-40 overflow-y-auto rounded-md border border-theme-sidebar-border">
          {docLoading ? (
            <p className="p-3 text-sm text-theme-text-secondary">Đang tải tài liệu...</p>
          ) : documents.length === 0 ? (
            <p className="p-3 text-sm text-theme-text-secondary">Chưa có tài liệu.</p>
          ) : (
            <div className="divide-y divide-theme-sidebar-border">
              {documents.map((doc) => (
                <div key={doc.id} className="p-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {doc.original_filename || doc.filename || "document"}
                    </div>
                    <div className={`text-xs ${statusClass(doc.status)}`}>
                      {statusLabel(doc.status)}
                    </div>
                    {doc.error_message ? (
                      <div className="text-xs text-red-500 truncate max-w-[360px]">
                        {doc.error_message}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleIndexDocument(doc)}
                      disabled={workingDocId === doc.id || (doc.status || "").toLowerCase() === "processing"}
                      className="px-2 py-1 text-xs rounded border border-theme-sidebar-border hover:bg-theme-sidebar-item-hover disabled:opacity-60"
                    >
                      {workingDocId === doc.id ? "Đang chạy..." : "Index"}
                    </button>
                    <button
                      onClick={() => handleDeleteDocument(doc)}
                      disabled={workingDocId === doc.id}
                      className="px-2 py-1 text-xs rounded border border-red-300 text-red-500 hover:bg-red-50/10 disabled:opacity-60"
                    >
                      Xóa
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <WorkspaceChatContainer loading={loading} workspace={workspace} />
      </div>
    </div>
  );
}
