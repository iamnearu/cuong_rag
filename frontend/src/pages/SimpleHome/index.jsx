import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Workspace from "@/models/workspace";

export default function SimpleHome() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [workspaces, setWorkspaces] = useState([]);
  const [error, setError] = useState("");

  async function loadWorkspaces() {
    setLoading(true);
    const items = await Workspace.all();
    setWorkspaces(items || []);
    setLoading(false);
  }

  useEffect(() => {
    loadWorkspaces();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    const wsName = name.trim();
    if (!wsName) return;

    setCreating(true);
    setError("");
    const { workspace, message } = await Workspace.new({ name: wsName });
    setCreating(false);

    if (!workspace?.slug) {
      setError(message || "Không tạo được workspace.");
      return;
    }

    navigate(`/workspace/${workspace.slug}`);
  }

  return (
    <div className="w-screen h-screen bg-theme-bg-container text-theme-text-primary flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-theme-sidebar-border bg-theme-bg-secondary p-6 space-y-5">
        <div>
          <h1 className="text-xl font-bold">CMMS RAG - Chat</h1>
          <p className="text-sm text-theme-text-secondary">Giao diện rút gọn: chỉ chọn workspace và chat.</p>
        </div>

        <form onSubmit={handleCreate} className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tên workspace mới"
            className="flex-1 rounded-lg px-3 py-2 bg-theme-bg-chat-input border border-theme-chat-input-border outline-none"
          />
          <button
            type="submit"
            disabled={creating}
            className="rounded-lg px-4 py-2 bg-theme-button-primary text-black font-semibold disabled:opacity-60"
          >
            {creating ? "Đang tạo..." : "Tạo"}
          </button>
        </form>

        {error ? <p className="text-sm text-red-500">{error}</p> : null}

        <div className="space-y-2">
          <p className="text-sm font-medium">Workspace hiện có</p>
          {loading ? (
            <p className="text-sm text-theme-text-secondary">Đang tải...</p>
          ) : workspaces.length === 0 ? (
            <p className="text-sm text-theme-text-secondary">Chưa có workspace. Tạo mới để bắt đầu chat.</p>
          ) : (
            <div className="grid gap-2">
              {workspaces.map((ws) => (
                <button
                  key={ws.slug}
                  onClick={() => navigate(`/workspace/${ws.slug}`)}
                  className="text-left rounded-lg border border-theme-sidebar-border px-3 py-2 hover:bg-theme-sidebar-item-hover"
                >
                  <div className="font-medium">{ws.name}</div>
                  <div className="text-xs text-theme-text-secondary">/{ws.slug}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
