"use client";
import { RadialGauge } from "./RadialGauge";
import { CategoryCard } from "./CategoryCard";
import type { POAnalysisResult, RiskFlag } from "@/types/analysis";

const inr = (n: number) => "₹" + Math.round(Math.abs(n)).toLocaleString("en-IN");

function RiskBadge({ flag }: { flag: RiskFlag }) {
  const styles = {
    critical: { bg: "#FEE2E2", border: "#FCA5A5", text: "#991B1B", icon: "🚨" },
    warning:  { bg: "#FEF3C7", border: "#FCD34D", text: "#92400E", icon: "⚠️" },
    info:     { bg: "#ECFDF5", border: "#6EE7B7", text: "#065F46", icon: "✓"  },
  };
  const s = styles[flag.severity];
  return (
    <div
      className="rounded-lg px-4 py-2.5 flex items-start gap-2 text-sm"
      style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.text }}
    >
      <span className="flex-shrink-0">{s.icon}</span>
      <div>
        <span>{flag.message}</span>
        <span className="font-bold ml-2">{inr(flag.value)}</span>
        <span className="ml-1 opacity-70">({flag.pctOfPO.toFixed(1)}% of PO)</span>
      </div>
    </div>
  );
}

function StatCard({
  label, value, sub, accent,
}: { label: string; value: string; sub?: string; accent: string }) {
  return (
    <div
      className="rounded-xl p-4 border bg-white"
      style={{ borderColor: "#e8e0d4", borderLeft: `4px solid ${accent}` }}
    >
      <div className="text-xs uppercase tracking-widest mb-1" style={{ color: "#9c8f7a", fontFamily: "'JetBrains Mono', monospace", fontSize: 9 }}>
        {label}
      </div>
      <div className="font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, color: accent }}>
        {value}
      </div>
      {sub && <div className="text-xs mt-0.5" style={{ color: "#9c8f7a" }}>{sub}</div>}
    </div>
  );
}

export function Dashboard({
  result,
  onReset,
  onGenerateNarrative,
  narrativeLoading,
}: {
  result: POAnalysisResult;
  onReset: () => void;
  onGenerateNarrative: () => void;
  narrativeLoading: boolean;
}) {
  const v = result.variance;
  // Use the new netVarianceValue which includes both rate + qty overspend
  const netPositive = (v.netVarianceValue ?? v.netRateVariance) > 0;

  return (
    <div className="space-y-8 pb-16">

      {/* ── HEADER ── */}
      <div className="fade-up flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest mb-1" style={{ color: "#B8860B", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.18em" }}>
            Purchase Order · Approval Review
          </div>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 40, fontWeight: 700, color: "#1a1a2e", lineHeight: 1 }}>
            {result.poNumber}
          </h1>
          {result.project && (
            <p className="text-sm mt-1" style={{ color: "#9c8f7a" }}>{result.project}</p>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs uppercase tracking-widest" style={{ color: "#9c8f7a", fontFamily: "'JetBrains Mono', monospace", fontSize: 9 }}>Total Value</div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 34, fontWeight: 700, color: "#1a1a2e" }}>
              {inr(result.totalValue)}
            </div>
            <div className="text-xs" style={{ color: "#16A34A", fontFamily: "'JetBrains Mono', monospace" }}>
              {result.billablePct.toFixed(0)}% billable
            </div>
          </div>
          <button
            onClick={onReset}
            className="rounded-lg px-3 py-2 text-xs border transition-colors hover:bg-amber-50"
            style={{ borderColor: "#d6cfc4", color: "#9c8f7a", fontFamily: "'JetBrains Mono', monospace" }}
          >
            ← New PO
          </button>
        </div>
      </div>

      {/* Decorative rule */}
      <div className="fade-up flex items-center gap-3" style={{ animationDelay: "50ms" }}>
        <div className="flex-1 h-px" style={{ background: "#e8d9b8" }} />
        <div className="w-2 h-2 rounded-full" style={{ background: "#B8860B" }} />
        <div className="flex-1 h-px" style={{ background: "#e8d9b8" }} />
      </div>

      {/* ── AI NARRATIVE ── */}
      <div
        className="fade-up rounded-xl p-5 border"
        style={{ animationDelay: "80ms", background: "#FFFBF0", borderColor: "#F6D860" }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs uppercase tracking-widest" style={{ color: "#B8860B", fontFamily: "'JetBrains Mono', monospace", fontSize: 9 }}>
            ✦ AI Summary
          </div>
          {!result.narrative && (
            <button
              onClick={onGenerateNarrative}
              disabled={narrativeLoading}
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium border transition-all hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                borderColor: "#B8860B",
                color: "#B8860B",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
              }}
            >
              {narrativeLoading ? (
                <>
                  <span
                    className="inline-block w-3 h-3 rounded-full border border-t-transparent animate-spin"
                    style={{ borderColor: "#B8860B", borderTopColor: "transparent" }}
                  />
                  Generating…
                </>
              ) : (
                "Generate Summary →"
              )}
            </button>
          )}
        </div>

        {result.narrative ? (
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 16, color: "#3d2e0e", lineHeight: 1.7, whiteSpace: "pre-line" }}>
            {result.narrative}
          </p>
        ) : (
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#c5a96a" }}>
            {narrativeLoading
              ? "Generating AI approval summary…"
              : "Click 'Generate Summary' to get an AI-written approval narrative. Calculations above are already complete."}
          </p>
        )}
      </div>

      {/* ── RISK FLAGS ── */}
      {result.riskFlags.length > 0 && (
        <div className="fade-up space-y-2" style={{ animationDelay: "120ms" }}>
          <h2 className="text-xs uppercase tracking-widest mb-3" style={{ color: "#9c8f7a", fontFamily: "'JetBrains Mono', monospace" }}>
            Risk Flags
          </h2>
          {result.riskFlags.map((f, i) => (
            <RiskBadge key={i} flag={f} />
          ))}
        </div>
      )}

      {/* ── GAUGES ── */}
      <div
        className="fade-up rounded-2xl border bg-white p-6"
        style={{ animationDelay: "160ms", borderColor: "#e8e0d4" }}
      >
        <h2 className="text-xs uppercase tracking-widest mb-5" style={{ color: "#9c8f7a", fontFamily: "'JetBrains Mono', monospace" }}>
          Risk Exposure
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6 justify-items-center">
          <RadialGauge value={v.totalNonEstimatedValue} max={result.totalValue} color="#B8860B" label="Non-Estimated" subLabel={inr(v.totalNonEstimatedValue)} delay={0} />
          <RadialGauge value={v.totalNonTenderedValue} max={result.totalValue} color="#DC2626" label="Non-Tendered" subLabel={inr(v.totalNonTenderedValue)} delay={80} />
          <RadialGauge value={v.totalRateOverspend} max={result.totalValue} color="#EF4444" label="Rate Overspend" subLabel={inr(v.totalRateOverspend)} delay={160} />
          <RadialGauge value={v.totalRateSavings} max={result.totalValue} color="#16A34A" label="Rate Savings" subLabel={inr(v.totalRateSavings)} delay={240} />
          <RadialGauge value={v.totalQtyVarianceOverspend} max={result.totalValue} color="#D97706" label="Qty Overspend" subLabel={inr(v.totalQtyVarianceOverspend)} delay={320} />
        </div>
      </div>

      {/* ── STAT CARDS ── */}
      <div className="fade-up grid grid-cols-2 sm:grid-cols-4 gap-3" style={{ animationDelay: "200ms" }}>
        <StatCard label="Rate Savings" value={inr(v.totalRateSavings)} sub={v.savingsPct.toFixed(1) + "% of PO"} accent="#16A34A" />
        <StatCard label="Rate Overspend" value={inr(v.totalRateOverspend)} sub={v.overspendPct.toFixed(1) + "% of PO"} accent="#DC2626" />
        <StatCard
          label="Net Variance (Rate+Qty)"
          value={(netPositive ? "+" : "−") + inr(v.netVarianceValue ?? v.netRateVariance)}
          sub={netPositive ? "Net cost increase" : "Net cost reduction"}
          accent={netPositive ? "#DC2626" : "#16A34A"}
        />
        <StatCard label="Qty Overspend" value={inr(v.totalQtyVarianceOverspend)} sub={v.qtyOverspendPct.toFixed(1) + "% of PO"} accent="#D97706" />
      </div>

      {/* ── CATEGORY BARS SUMMARY ── */}
      <div className="fade-up rounded-2xl border bg-white p-5" style={{ animationDelay: "240ms", borderColor: "#e8e0d4" }}>
        <h2 className="text-xs uppercase tracking-widest mb-4" style={{ color: "#9c8f7a", fontFamily: "'JetBrains Mono', monospace" }}>
          Value by Category
        </h2>
        <div className="space-y-3">
          {[...result.categories]
            .sort((a, b) => b.totalValue - a.totalValue)
            .map((cat) => {
              const color = { Ducting: "#B8860B", "Ducting Accessories": "#2E6DA4", Piping: "#A0522D" }[cat.categoryName] ?? "#6B7280";
              return (
                <div key={cat.categoryName} className="flex items-center gap-3 text-sm">
                  <div className="w-36 text-right truncate" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 14, color: "#1a1a2e" }}>
                    {cat.categoryName}
                  </div>
                  <div className="flex-1 h-2 rounded-full bg-amber-100 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${cat.pctOfPO}%`, background: color }} />
                  </div>
                  <div className="w-24 text-right font-mono text-stone-700 text-xs">{inr(cat.totalValue)}</div>
                  <div className="w-10 text-right text-xs" style={{ color, fontFamily: "'JetBrains Mono', monospace" }}>
                    {cat.pctOfPO.toFixed(1)}%
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* ── CATEGORY DETAIL CARDS ── */}
      <div>
        <h2 className="text-xs uppercase tracking-widest mb-4" style={{ color: "#9c8f7a", fontFamily: "'JetBrains Mono', monospace" }}>
          Category Breakdown <span className="normal-case text-stone-300">(click to expand)</span>
        </h2>
        <div className="space-y-3">
          {[...result.categories]
            .sort((a, b) => b.totalValue - a.totalValue)
            .map((cat, i) => (
              <CategoryCard key={cat.categoryName} cat={cat} totalPO={result.totalValue} delay={i * 60} />
            ))}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-xs" style={{ color: "#c5b89a", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em" }}>
        All calculations deterministic · AI used for narrative only · {new Date(result.computedAt).toLocaleString("en-IN")}
      </div>
    </div>
  );
}
