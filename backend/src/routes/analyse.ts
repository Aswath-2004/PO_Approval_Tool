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
        const details = parseResult.error.errors.map((e) => ({
          field: e.path.join("."),
          message: e.message,
          code: e.code,
        }));
        logger.warn({ details, body: JSON.stringify(req.body).slice(0, 500) }, "Validation failed");
        res.status(400).json({
          error: "Invalid PO data",
          details,
          hint: "Check that all required fields are present. estimatedQty and estimatedRate can be null for non-estimated items.",
        });
        return;
      }

      const po = parseResult.data;
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
