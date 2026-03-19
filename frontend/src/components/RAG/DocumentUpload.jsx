import React, { useRef } from "react";

export default function DocumentUpload({ onUpload, uploading }) {
  const fileRef = useRef(null);

  const pickFile = (file) => {
    if (file) onUpload(file);
  };

  return (
    <div
      className="rounded-xl border border-dashed border-white/20 bg-[#121823] p-5"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const file = e.dataTransfer?.files?.[0];
        pickFile(file);
      }}
    >
      <div className="mb-1 text-sm font-medium">Upload document</div>
      <div className="mb-4 text-xs text-white/60">Drag & drop or choose file (PDF / DOCX / TXT / MD / PPTX)</div>
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          pickFile(file);
        }}
      />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-400 disabled:opacity-60"
      >
        {uploading ? "Uploading..." : "Choose file"}
      </button>
    </div>
  );
}
