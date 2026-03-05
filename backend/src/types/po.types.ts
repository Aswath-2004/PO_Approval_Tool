import { z } from "zod";

// ─── INPUT SCHEMA ──────────────────────────────────────────────────────────────
// Coerce strings to numbers where possible (handles "780" as well as 780)
// All nullable fields accept null, undefined, or missing entirely
export const POItemSchema = z.object({
  lineNo:        z.coerce.number().int().positive(),
  itemId:        z.coerce.number().int().positive(),
  itemName:      z.string().min(1),
  categoryName:  z.string().min(1),
  uom:           z.string().min(1),
  Qty:           z.coerce.number().nonnegative(),
  Rate:          z.coerce.number().nonnegative(),
  Amount:        z.coerce.number().nonnegative(),
  isBillable:    z.boolean(),
  isEstimated:   z.boolean(),
  isNonTendered: z.boolean(),
  // Optional fields — present in some PO exports, ignored in calculations
  mrQty:         z.coerce.number().nonnegative().nullable().optional(),
  // estimatedQty and estimatedRate must be null when isEstimated = false
  // Accept null, undefined, or a number (coerced from string if needed)
  estimatedQty:  z.union([z.coerce.number().nonnegative(), z.null()]).optional().transform(v => v ?? null),
  estimatedRate: z.union([z.coerce.number().nonnegative(), z.null()]).optional().transform(v => v ?? null),
})
// Accept any extra fields without rejecting (real PO exports have many extra columns)
.passthrough();

export const POSchema = z.object({
  poNumber: z.string().min(1),
  vendor:   z.string().optional(),
  project:  z.string().optional(),
  items:    z.array(POItemSchema).min(1, "PO must have at least one item"),
}).passthrough();

// ─── INFERRED TYPES ────────────────────────────────────────────────────────────
export type POItem = z.infer<typeof POItemSchema>;
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
