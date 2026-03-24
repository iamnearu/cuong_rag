/**
 * CuongRAG API Client
 * Centralized fetch wrapper for /api/v1 endpoints
 */

const BASE = "/api/v1";

async function request(method, path, body, isFormData = false) {
    const headers = isFormData ? {} : { "Content-Type": "application/json" };
    const response = await fetch(`${BASE}${path}`, {
        method,
        headers,
        body: isFormData ? body : body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
        const error = await response.text();
        throw new Error(error || `HTTP ${response.status}`);
    }
    if (response.status === 204) return null;
    return response.json();
}

export const api = {
    get: (path) => request("GET", path),
    post: (path, body) => request("POST", path, body),
    put: (path, body) => request("PUT", path, body),
    del: (path) => request("DELETE", path),
    upload: (path, formData) => request("POST", path, formData, true),

    // Workspaces
    listWorkspaces: () => api.get("/workspaces"),
    createWorkspace: (data) => api.post("/workspaces", data),
    updateWorkspace: (id, data) => api.put(`/workspaces/${id}`, data),
    deleteWorkspace: (id) => api.del(`/workspaces/${id}`),

    // Documents
    listDocuments: (wsId) => api.get(`/documents/workspace/${wsId}`),
    uploadDocument: (wsId, file) => {
        const fd = new FormData();
        fd.append("file", file);
        return api.upload(`/documents/upload/${wsId}`, fd);
    },
    deleteDocument: (docId) => api.del(`/documents/${docId}`),
    getDocumentMarkdown: (docId) =>
        fetch(`${BASE}/documents/${docId}/markdown`).then((r) => r.text()),

    // RAG / Processing
    processDocument: (docId) => api.post(`/rag/process/${docId}`),
    processBatch: (ids) => api.post("/rag/process-batch", { document_ids: ids }),
    getStats: (wsId) => api.get(`/rag/stats/${wsId}`),
    getAnalytics: (wsId) => api.get(`/rag/analytics/${wsId}`),

    // Chat
    getChatHistory: (wsId) => api.get(`/rag/chat/${wsId}/history`),
    clearChatHistory: (wsId) => api.del(`/rag/chat/${wsId}/history`),

    // Knowledge Graph
    getKGGraph: (wsId, params = {}) => {
        const q = new URLSearchParams(params).toString();
        return api.get(`/rag/graph/${wsId}${q ? `?${q}` : ""}`);
    },
    getEntities: (wsId, params = {}) => {
        const q = new URLSearchParams(params).toString();
        return api.get(`/rag/entities/${wsId}${q ? `?${q}` : ""}`);
    },

    // Chat streaming (SSE)
    chatStream: (wsId, message, historyMessages = []) => {
        return fetch(`${BASE}/rag/chat/${wsId}/stream`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message, history: historyMessages }),
        });
    },
};

export default api;
