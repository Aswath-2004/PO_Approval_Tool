import OpenAI from "openai";
import type { computePOAnalysisRaw } from "./calculator";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type RawAnalysis = ReturnType<typeof computePOAnalysisRaw>;

function inr(n: number): string {
  return "₹" + Math.round(Math.abs(n)).toLocaleString("en-IN");
}

function pct(n: number): string {
  return n.toFixed(1) + "%";
}

export async function generateNarrative(raw: RawAnalysis): Promise<string> {
  const catSummaries = raw.categories
    .map((c) => {
      const parts: string[] = [
        `  Category: ${c.categoryName}`,
        `    Total value: ${inr(c.totalValue)} (${pct(c.pctOfPO)} of PO)`,
        `    Rate savings: ${inr(c.rateSavings)}`,
        `    Rate overspend: ${inr(c.rateOverspend)}`,
        `    Net rate variance: ${c.netRateVariance >= 0 ? "+" : ""}${inr(c.netRateVariance)} (${c.netRateVariance >= 0 ? "overspend" : "saving"})`,
        `    Qty variance overspend: ${inr(c.qtyVarianceOverspend)}`,
      ];

      if (c.nonEstimatedItems.length > 0) {
        parts.push(
          `    ⚠ NON-ESTIMATED: ${c.nonEstimatedItems.join(", ")} — ${inr(c.nonEstimatedValue)} (${pct((c.nonEstimatedValue / raw.totalValue) * 100)} of PO)`
        );
      }
      if (c.nonTenderedItems.length > 0) {
        parts.push(
          `    🚨 NON-TENDERED: ${c.nonTenderedItems.join(", ")} — ${inr(c.nonTenderedValue)} (${pct((c.nonTenderedValue / raw.totalValue) * 100)} of PO)`
        );
      }

      return parts.join("\n");
    })
    .join("\n\n");

  const prompt = `You are a procurement analyst assistant for an MEP contracting company in India.
You have been given a fully computed Purchase Order analysis. ALL NUMBERS ARE PRE-CALCULATED — do NOT perform any arithmetic yourself.
Your job is ONLY to write a concise, professional approval summary in 150-200 words.

COMPUTED ANALYSIS:
PO Number: ${raw.poNumber}
Total PO Value: ${inr(raw.totalValue)}

CATEGORY BREAKDOWN:
${catSummaries}

OVERALL VARIANCE:
  Total rate savings: ${inr(raw.variance.totalRateSavings)}
  Total rate overspend: ${inr(raw.variance.totalRateOverspend)}
  Net rate variance: ${raw.variance.netRateVariance >= 0 ? "+" : ""}${inr(raw.variance.netRateVariance)}
  Qty variance overspend: ${inr(raw.variance.totalQtyVarianceOverspend)}
  Non-estimated item value: ${inr(raw.variance.totalNonEstimatedValue)}
  Non-tendered item value: ${inr(raw.variance.totalNonTenderedValue)}

RISK FLAGS (pre-identified):
${raw.riskFlags.map((f) => `  [${f.severity.toUpperCase()}] ${f.message} — ${inr(f.value)}`).join("\n")}

INSTRUCTIONS:
1. Start with a one-line PO summary (number, scope, total value).
2. List key risks as bullet points, referencing exact pre-computed values above.
3. Note any savings found.
4. End with a one-line recommendation for the approver.
5. Use Indian numbering style (₹ symbol). Do NOT invent or recalculate any numbers.
6. Be concise and professional. No fluff.`;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 500,
    messages: [
      {
        role: "system",
        content: "You are a procurement analyst. Only write narrative prose from pre-computed data. Never perform arithmetic.",
      },
      { role: "user", content: prompt },
    ],
  });

  return (response.choices[0].message.content ?? "").trim();
}
