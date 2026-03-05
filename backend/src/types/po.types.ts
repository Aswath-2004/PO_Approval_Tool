import { z } from "zod";

// Helper: accepts number | string-that-parses-to-number | null | undefined
const maybeNum = z.union([
  z.number(),
  z.string().transform((s) => parseFloat(s)),
  z.null(),
  z.undefined(),
]).transform((v) => (v == null || (typeof v === "number" && isNaN(v)) ? null : Number(v)));

const reqNum = z.union([
  z.number(),
  z.string().transform((s) => parseFloat(s)),
]).transform((v) => Number(v));

const reqBool = z.union([
  z.boolean(),
  z.string().transform((s) => s === "true" || s === "1"),
  z.number().transform((n) => n !== 0),
]);

// ─── INPUT SCHEMA ──────────────────────────────────────────────────────────────
export const POItemSchema = z.object({
  lineNo:        reqNum,
  itemId:        reqNum,
  itemName:      z.string().min(1),
  categoryName:  z.string().min(1),
  uom:           z.string().min(1),
  Qty:           reqNum,
  Rate:          reqNum,
  Amount:        reqNum,
  isBillable:    reqBool,
  isEstimated:   reqBool,
  isNonTendered: reqBool,
  mrQty:         maybeNum.optional(),
  estimatedQty:  maybeNum,
  estimatedRate: maybeNum,
}).passthrough();

export const POSchema = z.object({
  poNumber: z.string().min(1),
  vendor:   z.string().optional(),
  project:  z.string().optional(),
  items:    z.array(POItemSchema).min(1),
}).passthrough();

// ─── INFERRED TYPES ────────────────────────────────────────────────────────────
export type POItem = z.infer<typeof POItemSchema> & {
  estimatedQty: number | null;
  estimatedRate: number | null;
};
export type PurchaseOrder = z.infer<typeof POSchema>;

// ─── OUTPUT TYPES ──────────────────────────────────────────────────────────────
export interface LineVariance {
  lineNo: number;
  itemName: string;
  uom: string;
  qty: number;
  rate: number;
  amount: number;
  estimatedQty: number | null;
  estimatedRate: number | null;
  rateVariance: number | null;
  rateVarianceValue: number | null;
  qtyVariance: number | null;
  qtyVarianceValue: number | null;
  isEstimated: boolean;
  isNonTendered: boolean;
  isBillable: boolean;
}

export interface CategoryAnalysis {
  categoryName: string;
  totalValue: number;
  pctOfPO: number;
  billableValue: number;
  nonBillableValue: number;
  rateSavings: number;
  rateOverspend: number;
  netRateVariance: number;
  qtyVarianceOverspend: number;
  qtyVarianceSaving: number;
  nonEstimatedValue: number;
  nonEstimatedItems: string[];
  nonTenderedValue: number;
  nonTenderedItems: string[];
  lines: LineVariance[];
}

export interface VarianceSummary {
  totalRateSavings: number;
  totalRateOverspend: number;
  netRateVariance: number;
  totalQtyVarianceOverspend: number;
  totalQtyVarianceSaving: number;
  totalNonEstimatedValue: number;
  totalNonTenderedValue: number;
  savingsPct: number;
  overspendPct: number;
  netVariancePct: number;
  netVarianceValue: number;
  nonEstimatedPct: number;
  nonTenderedPct: number;
  qtyOverspendPct: number;
}

export interface POAnalysisResult {
  poNumber: string;
  vendor?: string;
  project?: string;
  totalValue: number;
  billableValue: number;
  nonBillableValue: number;
  billablePct: number;
  nonBillablePct: number;
  categories: CategoryAnalysis[];
  variance: VarianceSummary;
  riskFlags: RiskFlag[];
  narrative: string;
  computedAt: string;
}

export interface RiskFlag {
  severity: "critical" | "warning" | "info";
  category: string;
  message: string;
  value: number;
  pctOfPO: number;
}