import React from "react";

export default function KGGraph({ graph }) {
  const nodes = graph?.nodes || [];
  const edges = graph?.edges || [];

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <div className="mb-3 text-sm font-medium">Knowledge Graph</div>
      <div className="mb-2 text-xs text-white/60">Nodes: {nodes.length} · Edges: {edges.length}</div>
      <div className="grid gap-2 md:grid-cols-2">
        {nodes.slice(0, 12).map((node) => (
          <div key={node.id || node.name} className="rounded border border-white/10 bg-black/20 p-2">
            <div className="text-xs text-sky-300">{node.entity_type || "Entity"}</div>
            <div className="text-sm text-white/90">{node.id || node.name}</div>
          </div>
        ))}
      </div>
      {nodes.length === 0 && <div className="text-sm text-white/60">No graph data yet.</div>}
    </div>
  );
}
