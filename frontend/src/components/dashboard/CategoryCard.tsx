"use client";
import { useState } from "react";
import type { CategoryAnalysis } from "@/types/analysis";

const inr = (n: number) =>
  "₹" + Math.round(Math.abs(n)).toLocaleString("en-IN");
const signedInr = (n: number) => (n >= 0 ? "+" : "−") + inr(n);

const CAT_COLORS: Record<string, string> = {
  Ducting: "#B8860B",
  "Ducting Accessories": "#2E6DA4",
  Piping: "#A0522D",
};
const getColor = (name: string) => CAT_COLORS[name] ?? "#6B7280";

function Chip({
  children,
  color,
}: {
  children: React.ReactNode;
  color: string;
}) {
  return (
    <span
      className="inline-block rounded px-1.5 py-0.5 text-xs font-bold"
      style={{
        color,
        border: `1px solid ${color}44`,
        background: color + "14",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 9,
        letterSpacing: "0.05em",
      }}
    >
      {children}
    </span>
  );
}

export function CategoryCard({
  cat,
  totalPO,
  delay,
}: {
  cat: CategoryAnalysis;
  totalPO: number;
  delay: number;
}) {
  const [open, setOpen] = useState(false);
  const color = getColor(cat.categoryName);

  return (
    <div
      className="fade-up rounded-xl border bg-white shadow-sm overflow-hidden"
      style={{ animationDelay: `${delay}ms`, borderColor: "#e8e0d4" }}
    >
      {/* ── HEADER ── */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-amber-50/50 transition-colors"
      >
        {/* Color dot */}
        <div
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ background: color }}
        />

        {/* Name + badges */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="font-semibold"
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 18,
                color: "#1a1a2e",
              }}
            >
              {cat.categoryName}
            </span>
            <div className="flex gap-1.5 flex-wrap">
              {cat.nonEstimatedItems.length > 0 && (
                <Chip color="#B8860B">NON-ESTIMATED</Chip>
              )}
              {cat.nonTenderedItems.length > 0 && (
                <Chip color="#DC2626">NON-TENDERED</Chip>
              )}
              {cat.rateOverspend > 0 && (
                <Chip color="#DC2626">OVERSPEND</Chip>
              )}
              {cat.rateSavings > 0 && (
                <Chip color="#16A34A">SAVINGS</Chip>
              )}
              {cat.qtyVarianceOverspend > 0 && (
                <Chip color="#D97706">QTY VARIANCE</Chip>
              )}
            </div>
          </div>
          {/* Bar */}
          <div className="mt-2 h-1.5 rounded-full bg-amber-100 overflow-hidden w-full">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${cat.pctOfPO}%`, background: color }}
            />
          </div>
        </div>

        {/* Value */}
        <div className="text-right flex-shrink-0">
          <div
            className="font-bold"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 15,
              color: "#1a1a2e",
            }}
          >
            {inr(cat.totalValue)}
          </div>
          <div
            className="text-xs"
            style={{ color, fontFamily: "'JetBrains Mono', monospace" }}
          >
            {cat.pctOfPO.toFixed(1)}%
          </div>
        </div>

        <span
          className="text-xs text-stone-400 ml-1 transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "none" }}
        >
          ▼
        </span>
      </button>

      {/* ── EXPANDED DETAIL ── */}
      {open && (
        <div className="border-t px-5 py-4 space-y-4 bg-stone-50" style={{ borderColor: "#e8e0d4" }}>
          {/* Variance mini-cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: "Rate Savings",
                value: cat.rateSavings,
                color: "#16A34A",
                show: cat.rateSavings > 0,
              },
              {
                label: "Rate Overspend",
                value: cat.rateOverspend,
                color: "#DC2626",
                show: cat.rateOverspend > 0,
              },
              {
                label: "Qty Overspend",
                value: cat.qtyVarianceOverspend,
                color: "#D97706",
                show: cat.qtyVarianceOverspend > 0,
              },
              {
                label: "Net Rate Variance",
                value: cat.netRateVariance,
                color: cat.netRateVariance > 0 ? "#DC2626" : "#16A34A",
                show: true,
              },
            ].map(({ label, value, color, show }) => (
              <div
                key={label}
                className="rounded-lg p-3 border bg-white"
                style={{ borderColor: "#e8e0d4" }}
              >
                <div
                  className="text-xs uppercase tracking-wide mb-1"
                  style={{ color: "#9c8f7a", fontFamily: "'JetBrains Mono', monospace", fontSize: 9 }}
                >
                  {label}
                </div>
                <div
                  className="font-bold"
                  style={{ color: show && value !== 0 ? color : "#ccc", fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}
                >
                  {!show || value === 0 ? "—" : label === "Net Rate Variance" ? signedInr(value) : inr(value)}
                </div>
              </div>
            ))}
          </div>

          {/* Line item table */}
          <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "#e8e0d4" }}>
            <table className="w-full text-xs bg-white">
              <thead>
                <tr className="border-b" style={{ borderColor: "#e8e0d4" }}>
                  {["Item", "Qty", "Rate", "Est. Rate", "Amount", "Flags"].map(
                    (h) => (
                      <th
                        key={h}
                        className="py-2 px-3 text-left font-medium uppercase tracking-wide"
                        style={{ color: "#9c8f7a", fontSize: 9, fontFamily: "'JetBrains Mono', monospace" }}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {cat.lines.map((line) => {
                  const rv = line.rateVarianceValue;
                  const qv = line.qtyVariance;
                  return (
                    <tr
                      key={line.lineNo}
                      className="border-b last:border-0"
                      style={{ borderColor: "#f0ebe4" }}
                    >
                      <td className="py-2.5 px-3">
                        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 13, color: "#1a1a2e" }}>
                          {line.itemName}
                        </div>
                        <div style={{ color: "#9c8f7a", fontSize: 9 }}>{line.uom}</div>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-stone-700">
                        {line.qty}
                        {qv != null && qv !== 0 && (
                          <span style={{ color: qv > 0 ? "#D97706" : "#16A34A", marginLeft: 4 }}>
                            ({qv > 0 ? "+" : ""}{qv})
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-stone-700">₹{line.rate}</td>
                      <td className="py-2.5 px-3 font-mono text-stone-400">
                        {line.estimatedRate != null ? (
                          <>
                            ₹{line.estimatedRate}
                            {rv != null && rv !== 0 && (
                              <span style={{ color: rv > 0 ? "#DC2626" : "#16A34A", marginLeft: 4 }}>
                                ({rv > 0 ? "+" : "−"}₹{Math.abs(line.rateVariance ?? 0)})
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-stone-300">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-stone-800">
                        {inr(line.amount)}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex gap-1 flex-wrap">
                          {!line.isEstimated && <Chip color="#B8860B">NE</Chip>}
                          {line.isNonTendered && <Chip color="#DC2626">NT</Chip>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Risk alerts */}
          {cat.nonEstimatedItems.length > 0 && (
            <div className="rounded-lg px-4 py-2.5 text-xs" style={{ background: "#FEF3C7", border: "1px solid #FCD34D", color: "#92400E" }}>
              <strong>⚠ Non-Estimated:</strong> {cat.nonEstimatedItems.join(", ")} —{" "}
              <strong>{inr(cat.nonEstimatedValue)}</strong> ({((cat.nonEstimatedValue / totalPO) * 100).toFixed(1)}% of PO)
            </div>
          )}
          {cat.nonTenderedItems.length > 0 && (
            <div className="rounded-lg px-4 py-2.5 text-xs" style={{ background: "#FEE2E2", border: "1px solid #FCA5A5", color: "#991B1B" }}>
              <strong>🚨 Non-Tendered:</strong> {cat.nonTenderedItems.join(", ")} —{" "}
              <strong>{inr(cat.nonTenderedValue)}</strong> ({((cat.nonTenderedValue / totalPO) * 100).toFixed(1)}% of PO)
            </div>
          )}
        </div>
      )}
    </div>
  );
}
