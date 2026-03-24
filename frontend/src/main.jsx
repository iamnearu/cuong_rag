import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./index.css";

import App from "./App";
import WorkspacesPage from "./pages/WorkspacesPage";
import DocumentsPage from "./pages/DocumentsPage";
import ChatPage from "./pages/ChatPage";
import KnowledgeGraphPage from "./pages/KnowledgeGraphPage";
import AnalyticsPage from "./pages/AnalyticsPage";

console.log("🚀 CuongRAG App Bootstrapped!");

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <App>
      <Routes>
        <Route path="/" element={<Navigate to="/workspaces" replace />} />
        <Route path="/workspaces" element={<WorkspacesPage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/knowledge-graph" element={<KnowledgeGraphPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="*" element={<Navigate to="/workspaces" replace />} />
      </Routes>
    </App>
    <ToastContainer
      position="bottom-right"
      autoClose={3000}
      hideProgressBar={false}
      theme="dark"
    />
  </BrowserRouter>
);
