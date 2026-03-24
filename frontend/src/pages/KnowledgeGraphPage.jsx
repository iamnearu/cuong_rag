import React, { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "react-toastify";
import { useWorkspace } from "../App";
import { api } from "../api/client";

// Entity type → color mapping
const TYPE_COLORS = {
    PERSON: "#c0c1ff",
    ORGANIZATION: "#8083ff",
    LOCATION: "#ffb783",
    PRODUCT: "#00c896",
    TECHNOLOGY: "#40c4ff",
    CONCEPT: "#ce93d8",
    EVENT: "#f48fb1",
    DEFAULT: "#908fa0",
};

function getNodeColor(type) {
    return TYPE_COLORS[type?.toUpperCase()] || TYPE_COLORS.DEFAULT;
}

// Simple force simulation (no D3 dependency)
function useForceSimulation(nodes, edges, width, height) {
    const posRef = useRef({});
    const velRef = useRef({});
    const frameRef = useRef(null);
    const [positions, setPositions] = useState({});

    useEffect(() => {
        if (!nodes.length) return;

        // Initialize positions randomly
        const pos = {};
        const vel = {};
        nodes.forEach((n) => {
            pos[n.id] = posRef.current[n.id] || {
                x: width * 0.2 + Math.random() * width * 0.6,
                y: height * 0.2 + Math.random() * height * 0.6,
            };
            vel[n.id] = { x: 0, y: 0 };
        });
        posRef.current = pos;
        velRef.current = vel;

        let tick = 0;
        const maxTicks = 200;

        function step() {
            tick++;
            const p = posRef.current;
            const v = velRef.current;
            const k = 80; // spring length
            const repulsion = 800;
            const damping = 0.8;
            const alpha = Math.max(0.1, 1 - tick / maxTicks);

            // Repulsion between all nodes
            for (let i = 0; i < nodes.length; i++) {
                for (let j = i + 1; j < nodes.length; j++) {
                    const ni = nodes[i].id;
                    const nj = nodes[j].id;
                    const dx = p[ni].x - p[nj].x;
                    const dy = p[ni].y - p[nj].y;
                    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                    const force = (repulsion / (dist * dist)) * alpha;
                    v[ni].x += (dx / dist) * force;
                    v[ni].y += (dy / dist) * force;
                    v[nj].x -= (dx / dist) * force;
                    v[nj].y -= (dy / dist) * force;
                }
            }

            // Attraction along edges
            edges.forEach((e) => {
                const s = e.source || e.from;
                const t = e.target || e.to;
                if (!p[s] || !p[t]) return;
                const dx = p[t].x - p[s].x;
                const dy = p[t].y - p[s].y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const force = ((dist - k) / dist) * 0.1 * alpha;
                v[s].x += dx * force;
                v[s].y += dy * force;
                v[t].x -= dx * force;
                v[t].y -= dy * force;
            });

            // Center gravity
            nodes.forEach((n) => {
                const ni = n.id;
                v[ni].x += (width / 2 - p[ni].x) * 0.01 * alpha;
                v[ni].y += (height / 2 - p[ni].y) * 0.01 * alpha;
                // Apply velocity + damping
                v[ni].x *= damping;
                v[ni].y *= damping;
                p[ni].x = Math.max(30, Math.min(width - 30, p[ni].x + v[ni].x));
                p[ni].y = Math.max(30, Math.min(height - 30, p[ni].y + v[ni].y));
            });

            setPositions({ ...p });

            if (tick < maxTicks) {
                frameRef.current = requestAnimationFrame(step);
            }
        }

        frameRef.current = requestAnimationFrame(step);
        return () => cancelAnimationFrame(frameRef.current);
    }, [nodes.map((n) => n.id).join(","), edges.length, width, height]);

    return positions;
}

function KGGraph({ nodes, edges }) {
    const containerRef = useRef(null);
    const [dims, setDims] = useState({ width: 800, height: 560 });
    const [tooltip, setTooltip] = useState(null);
    const [selected, setSelected] = useState(null);

    useEffect(() => {
        const obs = new ResizeObserver((entries) => {
            const entry = entries[0];
            setDims({ width: entry.contentRect.width, height: 560 });
        });
        if (containerRef.current) obs.observe(containerRef.current);
        return () => obs.disconnect();
    }, []);

    const positions = useForceSimulation(nodes, edges, dims.width, dims.height);

    return (
        <div ref={containerRef} className="kg-container" style={{ height: 560 }}>
            <svg className="kg-svg" width={dims.width} height={dims.height}>
                {/* Edges */}
                {edges.map((e, i) => {
                    const s = e.source || e.from;
                    const t = e.target || e.to;
                    const ps = positions[s];
                    const pt = positions[t];
                    if (!ps || !pt) return null;
                    return (
                        <line
                            key={i}
                            className="kg-link"
                            x1={ps.x} y1={ps.y}
                            x2={pt.x} y2={pt.y}
                        />
                    );
                })}

                {/* Nodes */}
                {nodes.map((node) => {
                    const p = positions[node.id];
                    if (!p) return null;
                    const color = getNodeColor(node.type || node.entity_type);
                    const isSelected = selected === node.id;
                    return (
                        <g
                            key={node.id}
                            className="kg-node"
                            onClick={() => setSelected(isSelected ? null : node.id)}
                            onMouseEnter={(e) => setTooltip({ node, x: e.clientX, y: e.clientY })}
                            onMouseLeave={() => setTooltip(null)}
                        >
                            <circle
                                cx={p.x} cy={p.y}
                                r={isSelected ? 14 : 10}
                                fill={color}
                                fillOpacity={0.9}
                                stroke={isSelected ? "#fff" : "rgba(255,255,255,0.1)"}
                                strokeWidth={isSelected ? 2 : 1}
                                style={{ filter: isSelected ? `drop-shadow(0 0 6px ${color})` : "none" }}
                            />
                            <text
                                x={p.x} y={p.y + 22}
                                textAnchor="middle"
                                style={{ fontSize: 10, fill: "var(--on-surface-variant)" }}
                            >
                                {(node.name || node.id || "").slice(0, 20)}
                            </text>
                        </g>
                    );
                })}
            </svg>

            {/* Tooltip */}
            {tooltip && (
                <div
                    className="kg-tooltip"
                    style={{ top: tooltip.y - 60, left: tooltip.x + 10, position: "fixed" }}
                >
                    <div style={{ fontWeight: 600, color: "var(--primary)", marginBottom: 4 }}>
                        {tooltip.node.name || tooltip.node.id}
                    </div>
                    {tooltip.node.type && (
                        <div style={{ fontSize: 11, color: "var(--on-surface-variant)" }}>
                            Type: {tooltip.node.type}
                        </div>
                    )}
                    {tooltip.node.description && (
                        <div style={{ marginTop: 4, fontSize: 11, color: "var(--on-surface-variant)" }}>
                            {tooltip.node.description.slice(0, 100)}...
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default function KnowledgeGraphPage() {
    const [workspaces, setWorkspaces] = useState([]);
    const { selectedWorkspace, setSelectedWorkspace } = useWorkspace();
    const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterType, setFilterType] = useState("");

    useEffect(() => {
        api.listWorkspaces().then(setWorkspaces).catch(() => { });
    }, []);

    useEffect(() => {
        if (!selectedWorkspace) { setGraphData({ nodes: [], edges: [] }); return; }
        setLoading(true);
        api.getKGGraph(selectedWorkspace.id, { max_nodes: 100 })
            .then((data) => setGraphData({ nodes: data.nodes || [], edges: data.edges || [] }))
            .catch((e) => toast.error("Failed to load graph: " + e.message))
            .finally(() => setLoading(false));
    }, [selectedWorkspace]);

    // Entity types for filter
    const entityTypes = [...new Set(graphData.nodes.map((n) => n.type || n.entity_type).filter(Boolean))];

    const filteredNodes = graphData.nodes.filter((n) => {
        const matchSearch = !searchQuery || (n.name || n.id || "").toLowerCase().includes(searchQuery.toLowerCase());
        const matchType = !filterType || (n.type || n.entity_type) === filterType;
        return matchSearch && matchType;
    });

    const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));
    const filteredEdges = graphData.edges.filter(
        (e) => filteredNodeIds.has(e.source || e.from) && filteredNodeIds.has(e.target || e.to)
    );

    return (
        <div className="page-container">
            <div className="page-header flex items-center justify-between">
                <div>
                    <h1 className="page-title">Knowledge Graph</h1>
                    <p className="page-subtitle">
                        {selectedWorkspace
                            ? `${graphData.nodes.length} entities · ${graphData.edges.length} relationships`
                            : "Select a workspace to explore its knowledge graph"}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        className="form-select"
                        style={{ width: "200px" }}
                        value={selectedWorkspace?.id || ""}
                        onChange={(e) => setSelectedWorkspace(workspaces.find((w) => String(w.id) === e.target.value) || null)}
                    >
                        <option value="">— select workspace —</option>
                        {workspaces.map((ws) => <option key={ws.id} value={ws.id}>{ws.name}</option>)}
                    </select>
                </div>
            </div>

            {selectedWorkspace && (
                <div className="flex items-center gap-3 mb-4">
                    <input
                        className="form-input"
                        style={{ width: 220 }}
                        placeholder="Search entities..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <select
                        className="form-select"
                        style={{ width: 160 }}
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                    >
                        <option value="">All types</option>
                        {entityTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setSearchQuery(""); setFilterType(""); }}>
                        Reset
                    </button>
                </div>
            )}

            {/* Legend */}
            {entityTypes.length > 0 && (
                <div className="flex items-center gap-3 mb-4" style={{ flexWrap: "wrap" }}>
                    {entityTypes.slice(0, 8).map((t) => (
                        <span key={t} className="flex items-center gap-2" style={{ fontSize: 12 }}>
                            <span style={{
                                width: 10, height: 10, borderRadius: "50%", display: "inline-block",
                                background: getNodeColor(t)
                            }} />
                            <span style={{ color: "var(--on-surface-variant)" }}>{t}</span>
                        </span>
                    ))}
                </div>
            )}

            {loading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: "80px" }}>
                    <div className="spinner" style={{ width: 36, height: 36 }} />
                </div>
            ) : !selectedWorkspace ? (
                <div className="empty-state">
                    <span className="empty-state-icon">🕸️</span>
                    <h3>No workspace selected</h3>
                    <p>Select a workspace to view its knowledge graph</p>
                </div>
            ) : graphData.nodes.length === 0 ? (
                <div className="empty-state">
                    <span className="empty-state-icon">🔍</span>
                    <h3>No entities found</h3>
                    <p>Process documents with KG extraction enabled to build the knowledge graph</p>
                </div>
            ) : (
                <KGGraph nodes={filteredNodes} edges={filteredEdges} />
            )}
        </div>
    );
}
