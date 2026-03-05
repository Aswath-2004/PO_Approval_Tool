"use client";
import { useState } from "react";
import { UploadZone } from "@/components/dashboard/UploadZone";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { analysePO } from "@/lib/api";
import type { POAnalysisResult } from "@/types/analysis";

export default function Home() {
  const [result, setResult] = useState<POAnalysisResult | null>(null);
  const [rawPoJson, setRawPoJson] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: upload → instant calculation, no narrative
  const handleData = async (json: unknown) => {
    setLoading(true);
    setError(null);
    setRawPoJson(json);
    try {
      const analysis = await analysePO(json, false); // fast — no AI
      setResult(analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: user clicks "Generate Summary" → calls AI narrative
  const handleGenerateNarrative = async () => {
    if (!rawPoJson || !result) return;
    setNarrativeLoading(true);
    try {
      const withNarrative = await analysePO(rawPoJson, true);
      setResult(withNarrative);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Narrative generation failed");
    } finally {
      setNarrativeLoading(false);
    }
  };

  const handleReset = () => { setResult(null); setRawPoJson(null); setError(null); };

  return (
    <main className="min-h-screen" style={{ background: "#f8f5f0" }}>
      {/* Top bar */}
      <div className="border-b px-6 py-4 flex items-center justify-between" style={{ borderColor: "#e8d9b8", background: "#fdfaf6" }}>
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded" style={{ background: "#B8860B" }} />
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 700, color: "#1a1a2e" }}>
            PO Approval Tool
          </span>
        </div>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#9c8f7a", letterSpacing: "0.1em" }}>
          MEP CONTRACTING · INDIA
        </span>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10">
        {!result ? (
          <div className="space-y-8">
            <div className="text-center">
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 32, fontWeight: 700, color: "#1a1a2e" }}>
                Upload a Purchase Order
              </h2>
              <p className="text-sm mt-2" style={{ color: "#9c8f7a" }}>
                Drop your PO JSON for an instant approval-ready analysis
              </p>
            </div>

            <UploadZone onData={handleData} loading={loading} />

            {error && (
              <div className="rounded-xl px-5 py-4 text-sm" style={{ background: "#FEE2E2", border: "1px solid #FCA5A5", color: "#991B1B" }}>
                <strong>Error:</strong> {error}
              </div>
            )}

            {/* Sample JSON hint */}
            <div className="rounded-xl border p-5 bg-white" style={{ borderColor: "#e8e0d4" }}>
              <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "#9c8f7a", fontFamily: "'JetBrains Mono', monospace" }}>
                Expected JSON shape
              </p>
              <pre className="text-xs overflow-x-auto" style={{ color: "#4a3728", fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.6 }}>{`{
  "poNumber": "CCPL/020/24",
  "vendor": "ABC Suppliers",        // optional
  "project": "MEP Block A",         // optional
  "items": [
    {
      "lineNo": 1,
      "itemId": 2001,
      "itemName": "GI Sheet Duct 1200x600mm",
      "categoryName": "Ducting",
      "uom": "Sqm",
      "Qty": 780,
      "Rate": 430,
      "Amount": 335400,
      "isBillable": true,
      "isEstimated": true,
      "isNonTendered": false,
      "estimatedQty": 650,          // null if not estimated
      "estimatedRate": 450          // null if not estimated
    }
  ]
}`}</pre>
            </div>
          </div>
        ) : (
          <Dashboard
            result={result}
            onReset={handleReset}
            onGenerateNarrative={handleGenerateNarrative}
            narrativeLoading={narrativeLoading}
          />
        )}
      </div>
    </main>
  );
}
