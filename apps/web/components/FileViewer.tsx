"use client";
import { useState } from "react";
import { api } from "../lib/api";

export function FileViewer({ projectId }: { projectId: string }) {
  const [path, setPath] = useState("/");
  const [files, setFiles] = useState<any[]>([]);
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const data = await api.listFiles(projectId, path);
      setFiles(data.files || []);
      setContent(null);
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function openFile(filePath: string) {
    setError(null);
    try {
      const data = await api.getFileContent(projectId, filePath);
      setContent(data.content);
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div className="rounded border border-[#e5e7eb] bg-white p-3 text-xs">
      <div className="mb-2 flex gap-2">
        <input value={path} onChange={(e) => setPath(e.target.value)} className="flex-1 rounded bg-white px-2 py-1 text-xs" placeholder="/path" />
        <button onClick={load} className="rounded bg-[#f0ebe5] px-3 py-1">List</button>
      </div>
      {error && <div className="text-[#b42318]">{error}</div>}
      <div className="space-y-1">
        {files.map((f) => (
          <div key={f.path} className="flex items-center justify-between rounded hover:bg-[#f7f3ef] px-1 py-0.5">
            <span>{f.isDirectory ? "📁" : "📄"} {f.name} <span className="text-[#6f6862]">{f.path}</span></span>
            {!f.isDirectory && <button onClick={() => openFile(f.path)} className="text-[#2e2b29]">Open</button>}
          </div>
        ))}
      </div>
      {content !== null && <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap bg-white p-2 text-[11px]">{content.slice(0, 8000)}</pre>}
    </div>
  );
}
