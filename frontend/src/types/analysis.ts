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

export interface RiskFlag {
  severity: "critical" | "warning" | "info";
  category: string;
  message: string;
  value: number;
  pctOfPO: number;
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
