import React, { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "react-toastify";
import { useWorkspace } from "../App";
import { api } from "../api/client";

function BotAvatar({ size = 26, className = "" }) {
    return (
        <img
            src="/bot-avatar.svg"
            alt="Bot avatar"
            className={className}
            style={{ width: size, height: size }}
        />
    );
}

function WorkspaceSelector({ workspaces, selected, onSelect }) {
    return (
        <div className="flex items-center gap-2">
            <select
                className="form-select"
                style={{ width: "200px" }}
                value={selected?.id || ""}
                onChange={(e) => onSelect(workspaces.find((w) => String(w.id) === e.target.value) || null)}
            >
                <option value="">— select workspace —</option>
                {workspaces.map((ws) => (
                    <option key={ws.id} value={ws.id}>{ws.name}</option>
                ))}
            </select>
        </div>
    );
}

function TypingIndicator() {
    return (
        <div className="message-bubble message-assistant with-avatar">
            <BotAvatar className="chat-bot-avatar" size={28} />
            <div className="typing-indicator">
                <div className="typing-dot" />
                <div className="typing-dot" />
                <div className="typing-dot" />
            </div>
        </div>
    );
}

/* ─── Source Chunk Viewer Modal ────────────────────────────────── */
function SourceModal({ source, onClose }) {
    if (!source) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="source-modal"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="source-modal-header">
                    <div>
                        <div className="source-modal-title">
                            [{source.index}] {source.chunk_id || "chunk"}
                        </div>
                        <div className="source-modal-meta">
                            {source.page_no ? `Trang ${source.page_no}` : ""}
                            {source.heading_path?.length > 0 && ` · ${source.heading_path.join(" > ")}`}
                            {source.score > 0 && ` · Score: ${source.score.toFixed(3)}`}
                        </div>
                    </div>
                    <button className="source-modal-close" onClick={onClose}>✕</button>
                </div>
                <div className="source-modal-body">
                    <pre className="source-modal-content">{source.content || "Không có nội dung"}</pre>
                </div>
            </div>
        </div>
    );
}

/* ─── Source Chip (clickable) ─────────────────────────────────── */
function SourceChip({ source, index, onClick }) {
    const hasContent = source.content && source.content.length > 0;
    return (
        <div
            className={`source-chip ${hasContent ? "source-chip-clickable" : ""}`}
            onClick={() => hasContent && onClick(source)}
            title={hasContent ? "Click để xem nội dung chunk" : ""}
        >
            <div className="source-chip-header">
                <strong>[{source.index || index + 1}] {source.chunk_id || "chunk"}</strong>
                {source.page_no ? <span className="source-chip-page">Trang {source.page_no}</span> : null}
            </div>
            {hasContent && (
                <div className="source-chip-preview">
                    {source.content.slice(0, 200)}{source.content.length > 200 ? "…" : ""}
                </div>
            )}
            {hasContent && (
                <div className="source-chip-action">📄 Xem chi tiết</div>
            )}
        </div>
    );
}

function ChatMessage({ msg, onSourceClick }) {
    const [showSources, setShowSources] = useState(false);
    const isUser = msg.role === "user";
    const sources = msg.sources || [];

    // Simple markdown rendering
    const renderContent = (text) => {
        return text
            .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
            .replace(/\*(.*?)\*/g, "<em>$1</em>")
            .replace(/`(.*?)`/g, "<code>$1</code>")
            .replace(/\n/g, "<br/>");
    };

    return (
        <div className={`message-bubble ${isUser ? "message-user" : "message-assistant"} ${!isUser ? "with-avatar" : ""}`}>
            {!isUser && <BotAvatar className="chat-bot-avatar" size={28} />}
            <div>
                <div className="bubble-content">
                    <div dangerouslySetInnerHTML={{ __html: renderContent(msg.content) }} />
                    {!isUser && sources.length > 0 && (
                        <>
                            <button className="sources-toggle" onClick={() => setShowSources((s) => !s)}>
                                {showSources ? "▲ Ẩn" : "▶ Xem"} {sources.length} nguồn tài liệu
                            </button>
                            {showSources && (
                                <div className="sources-panel">
                                    {sources.map((src, i) => (
                                        <SourceChip
                                            key={i}
                                            source={src}
                                            index={i}
                                            onClick={onSourceClick}
                                        />
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
                <div className="message-meta">{isUser ? "You" : "CuongRAG"}</div>
            </div>
        </div>
    );
}

export default function ChatPage() {
    const [workspaces, setWorkspaces] = useState([]);
    const { selectedWorkspace, setSelectedWorkspace } = useWorkspace();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [streaming, setStreaming] = useState(false);
    const [selectedSource, setSelectedSource] = useState(null);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        api.listWorkspaces().then(setWorkspaces).catch(() => { });
    }, []);

    // Load chat history when workspace changes
    useEffect(() => {
        if (!selectedWorkspace) { setMessages([]); return; }
        api.getChatHistory(selectedWorkspace.id)
            .then((data) => {
                const msgs = (data.messages || []).map((m) => ({
                    role: m.role,
                    content: m.content,
                    sources: m.sources || [],
                }));
                setMessages(msgs);
            })
            .catch(() => setMessages([]));
    }, [selectedWorkspace]);

    // Auto scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleClear = async () => {
        if (!selectedWorkspace) return;
        if (!confirm("Xóa toàn bộ lịch sử chat?")) return;
        try {
            await api.clearChatHistory(selectedWorkspace.id);
            setMessages([]);
            toast.success("Đã xóa lịch sử chat");
        } catch (err) {
            toast.error("Lỗi: " + err.message);
        }
    };

    const handleSend = useCallback(async () => {
        if (!input.trim() || !selectedWorkspace || streaming) return;

        const userMessage = { role: "user", content: input.trim(), sources: [] };
        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setStreaming(true);

        // Build history for backend (last 10 messages)
        const history = messages.slice(-10).map((m) => ({ role: m.role, content: m.content }));

        let assistantContent = "";
        let assistantSources = [];

        try {
            const response = await api.chatStream(selectedWorkspace.id, userMessage.content, history);

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            // Add empty assistant message placeholder
            setMessages((prev) => [...prev, { role: "assistant", content: "", sources: [] }]);

            let currentEvent = "";
            let buffer = "";  // Buffer for incomplete SSE lines

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                // Append new data to buffer
                buffer += decoder.decode(value, { stream: true });

                // Process complete lines only (split by \n)
                const lines = buffer.split("\n");
                // Keep the last incomplete line in buffer
                buffer = lines.pop() || "";

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed) continue;

                    if (trimmed.startsWith("event: ")) {
                        currentEvent = trimmed.slice(7).trim();
                    } else if (trimmed.startsWith("data: ")) {
                        const data = trimmed.slice(6).trim();
                        if (data === "[DONE]") continue;

                        try {
                            const parsed = JSON.parse(data);

                            if (currentEvent === "token" && parsed.text) {
                                assistantContent += parsed.text;
                            } else if (currentEvent === "token_rollback") {
                                // Model started a tool call after streaming tokens
                                // — discard speculative tokens
                                assistantContent = "";
                            } else if (currentEvent === "complete") {
                                if (parsed.answer && !assistantContent) {
                                    assistantContent = parsed.answer;
                                }
                                if (parsed.sources) {
                                    assistantSources = parsed.sources;
                                }
                            } else if (currentEvent === "sources" && parsed.sources) {
                                assistantSources = parsed.sources;
                            }

                            // Update UI immediately for each token
                            setMessages((prev) => {
                                const updated = [...prev];
                                updated[updated.length - 1] = {
                                    role: "assistant",
                                    content: assistantContent,
                                    sources: assistantSources,
                                };
                                return updated;
                            });
                        } catch (e) {
                            // JSON parse error — could be a partial chunk, skip
                        }
                    }
                }
            }

            // Process any remaining buffer
            if (buffer.trim()) {
                const trimmed = buffer.trim();
                if (trimmed.startsWith("data: ")) {
                    const data = trimmed.slice(6).trim();
                    if (data !== "[DONE]") {
                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.answer && !assistantContent) {
                                assistantContent = parsed.answer;
                            }
                            if (parsed.sources) {
                                assistantSources = parsed.sources;
                            }
                            setMessages((prev) => {
                                const updated = [...prev];
                                updated[updated.length - 1] = {
                                    role: "assistant",
                                    content: assistantContent,
                                    sources: assistantSources,
                                };
                                return updated;
                            });
                        } catch (e) { /* ignore */ }
                    }
                }
            }
        } catch (err) {
            if (err.name !== "AbortError") {
                toast.error("Chat thất bại: " + err.message);
                setMessages((prev) => {
                    const updated = [...prev];
                    if (updated[updated.length - 1]?.role === "assistant" && !assistantContent) {
                        updated.pop();
                    }
                    return updated;
                });
            }
        } finally {
            setStreaming(false);
        }
    }, [input, selectedWorkspace, streaming, messages]);

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="chat-layout">
            {/* Header */}
            <div className="chat-header">
                <BotAvatar className="chat-header-avatar" size={28} />
                <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: "15px" }}>Chat & Retrieval</div>
                    <div style={{ fontSize: "11px", color: "var(--on-surface-variant)" }}>
                        {selectedWorkspace ? `Workspace: ${selectedWorkspace.name}` : "Chọn workspace để bắt đầu"}
                    </div>
                </div>
                <WorkspaceSelector workspaces={workspaces} selected={selectedWorkspace} onSelect={setSelectedWorkspace} />
                {selectedWorkspace && messages.length > 0 && (
                    <button className="btn btn-ghost btn-sm" onClick={handleClear}>
                        🗑️ Xóa
                    </button>
                )}
            </div>

            {/* Messages */}
            <div className="chat-messages">
                {!selectedWorkspace ? (
                    <div className="empty-state">
                        <span className="empty-state-icon">🔍</span>
                        <h3>Chọn workspace</h3>
                        <p>Chọn một workspace có tài liệu đã index để bắt đầu chat</p>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="empty-state">
                        <BotAvatar className="empty-state-chat-avatar" size={56} />
                        <h3>Bắt đầu hội thoại</h3>
                        <p>Hỏi bất kỳ điều gì về tài liệu trong <strong>{selectedWorkspace.name}</strong></p>
                    </div>
                ) : (
                    messages.map((msg, i) => (
                        <ChatMessage
                            key={i}
                            msg={msg}
                            onSourceClick={setSelectedSource}
                        />
                    ))
                )}
                {streaming && !messages[messages.length - 1]?.content && <TypingIndicator />}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="chat-input-area">
                <div className="chat-input-row">
                    <textarea
                        className="chat-textarea"
                        rows={2}
                        placeholder={selectedWorkspace ? "Đặt câu hỏi về tài liệu..." : "Chọn workspace trước"}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={!selectedWorkspace || streaming}
                    />
                    <button
                        className="btn btn-primary"
                        onClick={handleSend}
                        disabled={!selectedWorkspace || !input.trim() || streaming}
                        style={{ height: "fit-content" }}
                    >
                        {streaming ? <span className="spinner" /> : "Gửi ↑"}
                    </button>
                </div>
                <div style={{ fontSize: "11px", color: "var(--outline)", marginTop: "6px" }}>
                    Enter để gửi · Shift+Enter xuống dòng
                </div>
            </div>

            {/* Source Detail Modal */}
            <SourceModal source={selectedSource} onClose={() => setSelectedSource(null)} />
        </div>
    );
}
