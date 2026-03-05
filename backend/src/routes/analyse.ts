import { Router, Request, Response, NextFunction } from "express";
import { computePOAnalysis, computePOAnalysisRaw } from "../engine/calculator";
import { generateNarrative } from "../engine/narrator";
import logger from "../middleware/logger";
import type { PurchaseOrder, POItem } from "../types/po.types";

const router = Router();

// Safely convert any value to number, returning 0 for nullish/invalid
function safeNum(v: unknown): number {
  if (v == null) return 0;
  const n = Number(v);
  return isFinite(n) ? n : 0;
}

// Safely convert to nullable number (returns null if missing/null/undefined)
function safeNumOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
}

function safeBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (v === 1 || v === "true" || v === "1") return true;
  return false;
}

// Sanitize a raw item from the uploaded JSON into a well-typed POItem
function sanitizeItem(raw: Record<string, unknown>, index: number): POItem {
  return {
    lineNo:        safeNum(raw.lineNo ?? index + 1),
    itemId:        safeNum(raw.itemId ?? index + 1),
    itemName:      String(raw.itemName ?? `Item ${index + 1}`),
    categoryName:  String(raw.categoryName ?? "Uncategorised"),
    uom:           String(raw.uom ?? ""),
    Qty:           safeNum(raw.Qty),
    Rate:          safeNum(raw.Rate),
    Amount:        safeNum(raw.Amount),
    isBillable:    safeBool(raw.isBillable),
    isEstimated:   safeBool(raw.isEstimated),
    isNonTendered: safeBool(raw.isNonTendered),
    estimatedQty:  safeNumOrNull(raw.estimatedQty),
    estimatedRate: safeNumOrNull(raw.estimatedRate),
  } as POItem;
}

// Sanitize the full PO body — no Zod, no transforms, no crashes
function sanitizePO(body: Record<string, unknown>): PurchaseOrder | null {
  if (!body || typeof body !== "object") return null;
  if (!body.poNumber || typeof body.poNumber !== "string") return null;
  if (!Array.isArray(body.items) || body.items.length === 0) return null;

  return {
    poNumber: String(body.poNumber),
    vendor:   body.vendor   ? String(body.vendor)  : undefined,
    project:  body.project  ? String(body.project) : undefined,
    items:    (body.items as Record<string, unknown>[]).map(sanitizeItem),
  } as PurchaseOrder;
}

router.post(
  "/analyse",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();
    try {
      const po = sanitizePO(req.body as Record<string, unknown>);

      if (!po) {
        res.status(400).json({
          error: "Invalid PO data",
          hint: "Body must have poNumber (string) and items (non-empty array)",
          received: {
            hasPoNumber: !!(req.body as Record<string,unknown>)?.poNumber,
            itemsIsArray: Array.isArray((req.body as Record<string,unknown>)?.items),
            itemCount: Array.isArray((req.body as Record<string,unknown>)?.items)
              ? (req.body as Record<string,unknown>[])?.length : 0,
          }
        });
        return;
      }

      const includeNarrative = req.query.includeNarrative === "true";
      logger.info({ poNumber: po.poNumber, itemCount: po.items.length, includeNarrative }, "Analysing PO");

      const rawAnalysis = computePOAnalysisRaw(po);
      logger.debug({ calcTime: Date.now() - startTime }, "Calculations complete");

      let narrative = "";
      if (includeNarrative) {
        try {
          narrative = await generateNarrative(rawAnalysis);
        } catch (aiErr) {
          logger.warn({ aiErr }, "AI narrative failed, using fallback");
          narrative = buildFallbackNarrative(rawAnalysis);
        }
      }

      const result = computePOAnalysis(po, narrative);
      logger.info({ poNumber: po.poNumber, totalTime: Date.now() - startTime }, "Done");
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.get("/health", (_req, res) => {
  res.json({ status: "ok", ts: new Date().toISOString() });
});

router.get("/", (_req, res) => {
  res.json({ service: "PO Approval API", status: "ok", version: "1.0.0" });
});

function buildFallbackNarrative(raw: ReturnType<typeof computePOAnalysisRaw>): string {
  const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
  const lines = [`PO ${raw.poNumber} totals ${inr(raw.totalValue)}.`];
  for (const f of raw.riskFlags.filter(f => f.severity !== "info"))
    lines.push(`• ${f.message} — ${inr(f.value)}`);
  return lines.join("\n");
}

export default router;