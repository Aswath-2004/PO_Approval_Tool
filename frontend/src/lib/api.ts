import type { POAnalysisResult } from "@/types/analysis";

/**
 * Analyse a PO JSON.
 * @param poJson      - raw parsed PO object
 * @param includeNarrative - default false for instant response; pass true to request AI summary
 */
export async function analysePO(
  poJson: unknown,
  includeNarrative = false
): Promise<POAnalysisResult> {
  const url = `/api/analyse${includeNarrative ? "?includeNarrative=true" : ""}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(poJson),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error ?? `Request failed: ${res.status}`);
  }

  return res.json();
}
