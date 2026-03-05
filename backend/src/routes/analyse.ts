import { Router, Request, Response, NextFunction } from "express";
import { POSchema } from "../types/po.types";
import { computePOAnalysis, computePOAnalysisRaw } from "../engine/calculator";
import { generateNarrative } from "../engine/narrator";
import logger from "../middleware/logger";

const router = Router();

router.post(
  "/analyse",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();

    try {
      const parseResult = POSchema.safeParse(req.body);

      if (!parseResult.success) {
        // Return full Zod error details so you can see exactly which field failed
        const details = parseResult.error.errors.map((e) => ({
          field: e.path.join("."),
          message: e.message,
          received: (e as any).received,
        }));
        logger.warn({ details }, "Zod validation failed");
        res.status(400).json({
          error: "Invalid PO data",
          details,
          // Also return raw body summary for debugging
          receivedKeys: Object.keys(req.body || {}),
          itemCount: Array.isArray(req.body?.items) ? req.body.items.length : "not an array",
        });
        return;
      }

      const po = parseResult.data;
      const includeNarrative = req.query.includeNarrative === "true";

      logger.info(
        { poNumber: po.poNumber, itemCount: po.items.length, includeNarrative },
        "Analysing PO"
      );

      const rawAnalysis = computePOAnalysisRaw(po);
      const calcTime = Date.now() - startTime;
      logger.debug({ calcTime }, "Calculations complete");

      let narrative = "";
      if (includeNarrative) {
        try {
          narrative = await generateNarrative(rawAnalysis);
        } catch (aiErr) {
          logger.warn({ aiErr }, "AI narrative generation failed, using fallback");
          narrative = buildFallbackNarrative(rawAnalysis);
        }
      }

      const result = computePOAnalysis(po, narrative);

      const totalTime = Date.now() - startTime;
      logger.info({ poNumber: po.poNumber, totalTime, calcTime }, "Analysis complete");

      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", ts: new Date().toISOString() });
});

// Root route — confirms API is alive
router.get("/", (_req: Request, res: Response) => {
  res.json({ service: "PO Approval API", status: "ok", version: "1.0.0" });
});

function buildFallbackNarrative(raw: ReturnType<typeof computePOAnalysisRaw>): string {
  const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
  const lines: string[] = [`PO ${raw.poNumber} totals ${inr(raw.totalValue)}.`];
  const criticals = raw.riskFlags.filter((f) => f.severity === "critical");
  const warnings  = raw.riskFlags.filter((f) => f.severity === "warning");
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