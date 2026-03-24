import React, { useState, useEffect } from "react";
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from "recharts";
import { toast } from "react-toastify";
import { useWorkspace } from "../App";
import { api } from "../api/client";

function StatCard({ icon, label, value, sub }) {
    return (
        <div className="stat-card">
            <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
            <div className="stat-label">{label}</div>
            <div className="stat-value">{value ?? "—"}</div>
            {sub && <div className="stat-sub">{sub}</div>}
        </div>
    );
}

const COLORS = ["#c0c1ff", "#8083ff", "#ffb783", "#00c896", "#40c4ff"];

const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{
            background: "var(--surface-container-high)",
            border: "1px solid rgba(70,69,84,0.5)",
            borderRadius: 8,
            padding: "8px 12px",
            fontSize: 12,
            color: "var(--on-surface)",
        }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
            {payload.map((p) => (
                <div key={p.name}>
                    <span style={{ color: p.color }}>{p.name}: </span>
                    <span>{p.value}</span>
                </div>
            ))}
        </div>
    );
};

export default function AnalyticsPage() {
    const [workspaces, setWorkspaces] = useState([]);
    const { selectedWorkspace, setSelectedWorkspace } = useWorkspace();
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        api.listWorkspaces().then(setWorkspaces).catch(() => { });
    }, []);

    useEffect(() => {
        if (!selectedWorkspace) { setAnalytics(null); return; }
        setLoading(true);
        api.getAnalytics(selectedWorkspace.id)
            .then(setAnalytics)
            .catch((e) => toast.error("Failed to load analytics: " + e.message))
            .finally(() => setLoading(false));
    }, [selectedWorkspace]);

    const stats = analytics?.stats;
    const kg = analytics?.kg_analytics;
    const breakdown = analytics?.document_breakdown || [];

    const chartData = breakdown
        .filter((d) => d.status === "indexed")
        .slice(0, 12)
        .map((d) => ({
            name: (d.filename || "doc").replace(/\.[^.]+$/, "").slice(0, 20),
            Chunks: d.chunk_count || 0,
            Pages: d.page_count || 0,
            Images: d.image_count || 0,
        }));

    return (
        <div className="page-container">
            <div className="page-header flex items-center justify-between">
                <div>
                    <h1 className="page-title">Analytics</h1>
                    <p className="page-subtitle">Knowledge base performance and document metrics</p>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        className="form-select"
                        style={{ width: "220px" }}
                        value={selectedWorkspace?.id || ""}
                        onChange={(e) => setSelectedWorkspace(workspaces.find((w) => String(w.id) === e.target.value) || null)}
                    >
                        <option value="">— select workspace —</option>
                        {workspaces.map((ws) => <option key={ws.id} value={ws.id}>{ws.name}</option>)}
                    </select>
                </div>
            </div>

            {!selectedWorkspace ? (
                <div className="empty-state">
                    <span className="empty-state-icon">📊</span>
                    <h3>Select a workspace</h3>
                    <p>Choose a workspace to view its analytics</p>
                </div>
            ) : loading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: "60px" }}>
                    <div className="spinner" style={{ width: 32, height: 32 }} />
                </div>
            ) : (
                <>
                    {/* Stats Grid */}
                    <div className="grid-4 mb-4">
                        <StatCard icon="📄" label="Total Documents" value={stats?.total_documents} sub={`${stats?.indexed_documents || 0} indexed`} />
                        <StatCard icon="🧩" label="Total Chunks" value={stats?.total_chunks?.toLocaleString()} sub="Vector embeddings" />
                        <StatCard icon="🖼️" label="Images Extracted" value={stats?.image_count} sub="From documents" />
                        {kg ? (
                            <StatCard icon="🕸️" label="KG Entities" value={kg.entity_count?.toLocaleString()} sub={`${kg.relationship_count || 0} relationships`} />
                        ) : (
                            <StatCard icon="🕸️" label="KG Entities" value="—" sub="No KG data" />
                        )}
                    </div>

                    {/* KG Entity Types */}
                    {kg?.entity_types && Object.keys(kg.entity_types).length > 0 && (
                        <div className="card mb-4">
                            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: "var(--on-surface)" }}>
                                Entity Types Distribution
                            </h3>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                {Object.entries(kg.entity_types)
                                    .sort(([, a], [, b]) => b - a)
                                    .slice(0, 12)
                                    .map(([type, count], i) => (
                                        <span
                                            key={type}
                                            style={{
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: 6,
                                                padding: "4px 10px",
                                                borderRadius: 999,
                                                background: `${COLORS[i % COLORS.length]}20`,
                                                border: `1px solid ${COLORS[i % COLORS.length]}40`,
                                                fontSize: 12,
                                                color: COLORS[i % COLORS.length],
                                            }}
                                        >
                                            {type} <strong>{count}</strong>
                                        </span>
                                    ))}
                            </div>
                        </div>
                    )}

                    {/* Charts */}
                    {chartData.length > 0 && (
                        <div className="card mb-4">
                            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: "var(--on-surface)" }}>
                                Document Breakdown (indexed documents)
                            </h3>
                            <ResponsiveContainer width="100%" height={260}>
                                <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
                                    <XAxis
                                        dataKey="name"
                                        tick={{ fill: "var(--on-surface-variant)", fontSize: 10 }}
                                        angle={-35}
                                        textAnchor="end"
                                    />
                                    <YAxis tick={{ fill: "var(--on-surface-variant)", fontSize: 10 }} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar dataKey="Chunks" radius={[4, 4, 0, 0]}>
                                        {chartData.map((_, i) => (
                                            <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.85} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Document Table */}
                    <div className="card">
                        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: "var(--on-surface)" }}>
                            All Documents
                        </h3>
                        <div className="table-container">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Document</th>
                                        <th>Status</th>
                                        <th>Chunks</th>
                                        <th>Pages</th>
                                        <th>Images</th>
                                        <th>Size</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {breakdown.map((doc) => (
                                        <tr key={doc.document_id}>
                                            <td>
                                                <span style={{ color: "var(--on-surface)", fontWeight: 500 }}>
                                                    {doc.filename}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`badge badge-${doc.status}`}>
                                                    {doc.status}
                                                </span>
                                            </td>
                                            <td>{doc.chunk_count || "—"}</td>
                                            <td>{doc.page_count || "—"}</td>
                                            <td>{doc.image_count || "—"}</td>
                                            <td>
                                                {doc.file_size
                                                    ? doc.file_size > 1024 * 1024
                                                        ? `${(doc.file_size / 1024 / 1024).toFixed(1)}MB`
                                                        : `${(doc.file_size / 1024).toFixed(0)}KB`
                                                    : "—"}
                                            </td>
                                        </tr>
                                    ))}
                                    {breakdown.length === 0 && (
                                        <tr>
                                            <td colSpan={6} style={{ textAlign: "center", opacity: 0.5, padding: "32px" }}>
                                                No documents yet
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
