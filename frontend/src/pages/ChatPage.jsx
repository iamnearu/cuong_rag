import React, { useState, useEffect, useRef } from "react";
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

function ChatMessage({ msg }) {
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
                                {showSources ? "▲" : "▶"} {sources.length} source{sources.length !== 1 ? "s" : ""}
                            </button>
                            {showSources && (
                                <div className="sources-panel">
                                    {sources.slice(0, 5).map((src, i) => (
                                        <div key={i} className="source-chip">
                                            <strong>[{src.index || i + 1}] {src.chunk_id || "chunk"}</strong>
                                            {src.content?.slice(0, 150)}{src.content?.length > 150 ? "..." : ""}
                                        </div>
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
    const messagesEndRef = useRef(null);
    const abortRef = useRef(null);

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
        if (!confirm("Clear all chat history for this workspace?")) return;
        try {
            await api.clearChatHistory(selectedWorkspace.id);
            setMessages([]);
            toast.success("Chat history cleared");
        } catch (err) {
            toast.error("Failed to clear: " + err.message);
        }
    };

    const handleSend = async () => {
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

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split("\n");

                for (const line of lines) {
                    if (line.startsWith("event: ")) {
                        currentEvent = line.slice(7).trim();
                    } else if (line.startsWith("data: ")) {
                        const data = line.slice(6).trim();
                        if (data === "[DONE]") break;
                        try {
                            const parsed = JSON.parse(data);

                            // Event: token
                            if (currentEvent === "token" && parsed.text) {
                                assistantContent += parsed.text;
                            }
                            // Event: complete (fallback in case tokens missed)
                            else if (currentEvent === "complete") {
                                if (parsed.answer && !assistantContent) {
                                    assistantContent = parsed.answer;
                                }
                                if (parsed.sources) {
                                    assistantSources = parsed.sources;
                                }
                            }
                            // Event: sources (when sent before complete)
                            else if (currentEvent === "sources" && parsed.sources) {
                                assistantSources = parsed.sources;
                            }

                            // Always update state to render the UI
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
                            console.warn("Error parsing chunk:", data, e);
                        }
                    }
                }
            }
        } catch (err) {
            if (err.name !== "AbortError") {
                toast.error("Chat failed: " + err.message);
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
    };

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
                        {selectedWorkspace ? `Workspace: ${selectedWorkspace.name}` : "Select a workspace to start"}
                    </div>
                </div>
                <WorkspaceSelector workspaces={workspaces} selected={selectedWorkspace} onSelect={setSelectedWorkspace} />
                {selectedWorkspace && messages.length > 0 && (
                    <button className="btn btn-ghost btn-sm" onClick={handleClear}>
                        🗑️ Clear
                    </button>
                )}
            </div>

            {/* Messages */}
            <div className="chat-messages">
                {!selectedWorkspace ? (
                    <div className="empty-state">
                        <span className="empty-state-icon">🔍</span>
                        <h3>Select a workspace</h3>
                        <p>Choose a workspace with indexed documents to start chatting</p>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="empty-state">
                        <BotAvatar className="empty-state-chat-avatar" size={56} />
                        <h3>Start a conversation</h3>
                        <p>Ask anything about your documents in <strong>{selectedWorkspace.name}</strong></p>
                    </div>
                ) : (
                    messages.map((msg, i) => <ChatMessage key={i} msg={msg} />)
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
                        placeholder={selectedWorkspace ? "Ask a question about your documents..." : "Select a workspace first"}
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
                        {streaming ? <span className="spinner" /> : "Send ↑"}
                    </button>
                </div>
                <div style={{ fontSize: "11px", color: "var(--outline)", marginTop: "6px" }}>
                    Enter to send · Shift+Enter for newline
                </div>
            </div>
        </div>
    );
}
