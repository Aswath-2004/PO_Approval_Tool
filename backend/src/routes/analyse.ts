import { Router, Request, Response, NextFunction } from "express";
import { POSchema } from "../types/po.types";
import { computePOAnalysis, computePOAnalysisRaw } from "../engine/calculator";
import { generateNarrative } from "../engine/narrator";
import logger from "../middleware/logger";

const router = Router();

/**
 * POST /api/analyse
 * Body: PurchaseOrder JSON
 * Query: ?includeNarrative=true  (default: false — keeps response <10ms)
 * Returns: POAnalysisResult
 *
 * Narrative is opt-in so the default path is instant (pure calculation).
 * The frontend calls this endpoint first with includeNarrative=false,
 * then the user can click "Generate Summary" which calls with includeNarrative=true.
 */
router.post(
  "/analyse",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();

    try {
      // 1. Validate input with Zod
      const parseResult = POSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: "Invalid PO data",
          details: parseResult.error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        });
        return;
      }

      const po = parseResult.data;

      // FIX 3 — narrative is opt-in. Default false keeps the endpoint fast.
      const includeNarrative = req.query.includeNarrative === "true";

      logger.info(
        { poNumber: po.poNumber, itemCount: po.items.length, includeNarrative },
        "Analysing PO"
      );

      // 2. Run deterministic calculations — always fast (<5ms)
      const rawAnalysis = computePOAnalysisRaw(po);
      const calcTime = Date.now() - startTime;
      logger.debug({ calcTime }, "Calculations complete");

      // 3. Narrative: only when explicitly requested
      let narrative = "";
      if (includeNarrative) {
        try {
          narrative = await generateNarrative(rawAnalysis);
        } catch (aiErr) {
          logger.warn({ aiErr }, "AI narrative generation failed, using fallback");
          narrative = buildFallbackNarrative(rawAnalysis);
        }
      }

      // 4. Assemble final result
      const result = computePOAnalysis(po, narrative);

      const totalTime = Date.now() - startTime;
      logger.info(
        { poNumber: po.poNumber, totalTime, calcTime, includeNarrative },
        "Analysis complete"
      );

      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/health
 */
router.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", ts: new Date().toISOString() });
});

// ─── FALLBACK NARRATIVE ────────────────────────────────────────────────────────
function buildFallbackNarrative(raw: ReturnType<typeof computePOAnalysisRaw>): string {
  const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
  const lines: string[] = [
    `PO ${raw.poNumber} totals ${inr(raw.totalValue)}.`,
  ];

  const criticals = raw.riskFlags.filter((f) => f.severity === "critical");
  const warnings = raw.riskFlags.filter((f) => f.severity === "warning");

  if (criticals.length > 0) {
    lines.push("Critical risks:");
    for (const f of criticals) lines.push(`• ${f.message} — ${inr(f.value)}`);
  }
  if (warnings.length > 0) {
    lines.push("Warnings:");
    for (const f of warnings) lines.push(`• ${f.message} — ${inr(f.value)}`);
  }
  if (raw.variance.totalRateSavings > 0) {
    lines.push(`Rate savings identified: ${inr(raw.variance.totalRateSavings)}.`);
  }

  return lines.join("\n");
}

export default router;
