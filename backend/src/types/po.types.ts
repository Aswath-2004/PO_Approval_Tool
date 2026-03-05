import { z } from "zod";

// ─── INPUT SCHEMA ──────────────────────────────────────────────────────────────
export const POItemSchema = z.object({
  lineNo: z.number().int().positive(),
  itemId: z.number().int().positive(),
  itemName: z.string().min(1),
  categoryName: z.string().min(1),
  uom: z.string().min(1),
  Qty: z.number().positive(),
  Rate: z.number().nonnegative(),
  Amount: z.number().nonnegative(),
  isBillable: z.boolean(),
  isEstimated: z.boolean(),
  isNonTendered: z.boolean(),
  mrQty: z.number().nonnegative().nullable().optional(),
  estimatedQty: z.number().positive().nullable(),
  estimatedRate: z.number().nonnegative().nullable(),
});

export const POSchema = z.object({
  poNumber: z.string().min(1),
  vendor: z.string().optional(),
  project: z.string().optional(),
  items: z.array(POItemSchema).min(1, "PO must have at least one item"),
});

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
  rateVariance: number | null;        // actual - estimated (per unit)
  rateVarianceValue: number | null;   // variance × estimatedQty (pure rate effect)
  qtyVariance: number | null;         // actual - estimated qty
  qtyVarianceValue: number | null;    // qty variance × actual rate
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

  // Rate variance (holding qty constant at estimated)
  rateSavings: number;
  rateOverspend: number;
  netRateVariance: number;           // positive = overspend, negative = saving

  // Quantity variance
  qtyVarianceOverspend: number;      // extra cost due to qty > estimatedQty
  qtyVarianceSaving: number;         // cost reduction due to qty < estimatedQty

  // Risk flags
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
  netVariancePct: number;   // abs(rateOverspend + qtyOverspend - rateSavings) / totalValue
  netVarianceValue: number; // rateOverspend + qtyOverspend - rateSavings (signed)
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
  narrative: string; // AI-generated summary
  computedAt: string;
}

export interface RiskFlag {
  severity: "critical" | "warning" | "info";
  category: string;
  message: string;
  value: number;
  pctOfPO: number;
}
