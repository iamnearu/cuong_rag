const RAG_API = import.meta.env.VITE_RAG_API_URL || "http://localhost:8081";
const INGEST_API = import.meta.env.VITE_INGEST_API_URL || "http://localhost:8082";
const KG_API = import.meta.env.VITE_KG_API_URL || "http://localhost:8083";

async function request(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed (${res.status})`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  listWorkspaces: () => request(`${RAG_API}/api/v1/workspaces`),
  createWorkspace: (payload) =>
    request(`${RAG_API}/api/v1/workspaces`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),

  listDocuments: (workspaceId) =>
    request(`${RAG_API}/api/v1/documents/workspace/${workspaceId}`),

  uploadDocument: async (workspaceId, file) => {
    const form = new FormData();
    form.append("file", file);
    return request(`${INGEST_API}/api/v1/ingest/upload/${workspaceId}`, {
      method: "POST",
      body: form,
    });
  },

  processDocument: (documentId) =>
    request(`${INGEST_API}/api/v1/ingest/process/${documentId}`, {
      method: "POST",
    }),

  getDocumentStatus: (documentId) =>
    request(`${INGEST_API}/api/v1/ingest/status/${documentId}`),

  reindexDocument: (documentId) =>
    request(`${INGEST_API}/api/v1/ingest/reindex/${documentId}`, {
      method: "POST",
    }),

  deleteDocument: (documentId) =>
    request(`${INGEST_API}/api/v1/ingest/document/${documentId}`, {
      method: "DELETE",
    }),

  chat: (workspaceId, payload) =>
    request(`${RAG_API}/api/v1/rag/chat/${workspaceId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),

  getGraph: (workspaceId) => request(`${KG_API}/api/v1/kg/graph/${workspaceId}`),
};
