"use client";
import { useCallback, useState } from "react";

interface UploadZoneProps {
  onData: (json: unknown) => void;
  loading: boolean;
}

export function UploadZone({ onData, loading }: UploadZoneProps) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processFile = useCallback(
    (file: File) => {
      if (!file.name.endsWith(".json")) {
        setError("Please upload a .json file.");
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target?.result as string);
          setError(null);
          onData(parsed);
        } catch {
          setError("Invalid JSON — could not parse file.");
        }
      };
      reader.readAsText(file);
    },
    [onData]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className="relative rounded-2xl border-2 border-dashed transition-all duration-200 flex flex-col items-center justify-center py-16 px-8 text-center cursor-pointer"
      style={{
        borderColor: dragging ? "#B8860B" : "#d6cfc4",
        background: dragging ? "#FEFCE8" : "#fdfaf6",
      }}
    >
      <input
        type="file"
        accept=".json"
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        onChange={onFileChange}
        disabled={loading}
      />

      {loading ? (
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: "#B8860B", borderTopColor: "transparent" }}
          />
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, color: "#B8860B" }}>
            Analysing Purchase Order…
          </p>
          <p className="text-xs text-stone-400">Computing variances · Generating narrative</p>
        </div>
      ) : (
        <>
          <div className="text-4xl mb-4" style={{ color: "#B8860B" }}>📄</div>
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, color: "#1a1a2e", fontWeight: 600 }}>
            Drop your PO JSON file here
          </p>
          <p className="text-sm text-stone-400 mt-2">
            or click to browse · accepts <code className="text-amber-700">.json</code>
          </p>
          {error && (
            <p className="mt-4 text-sm font-medium" style={{ color: "#DC2626" }}>
              ⚠ {error}
            </p>
          )}
        </>
      )}
    </div>
  );
}
