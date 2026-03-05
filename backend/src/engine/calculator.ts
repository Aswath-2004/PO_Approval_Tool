import Decimal from "decimal.js";
import type {
  PurchaseOrder,
  POItem,
  CategoryAnalysis,
  LineVariance,
  VarianceSummary,
  POAnalysisResult,
  RiskFlag,
} from "../types/po.types";

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// ─── HELPERS ───────────────────────────────────────────────────────────────────

// Crash-proof Decimal constructor.
// Decimal.js throws if given null, undefined, NaN, Infinity, or non-numeric strings.
// This wrapper converts all of those to 0 safely.
function d(n: unknown): Decimal {
  if (n == null) return new Decimal(0);
  const num = typeof n === "string" ? parseFloat(n) : Number(n);
  if (!isFinite(num)) return new Decimal(0);
  return new Decimal(num);
}

function toNum(dec: Decimal): number {
  return dec.toDecimalPlaces(2).toNumber();
}

function pctOf(part: Decimal, total: Decimal): number {
  if (total.isZero()) return 0;
  return toNum(part.div(total).mul(100));
}

// ─── LINE VARIANCE ─────────────────────────────────────────────────────────────

function computeLineVariance(item: POItem): LineVariance {
  // Safely read all numeric fields — they may be null/undefined after Zod transform
  const actualRate = d(item.Rate);
  const actualQty  = d(item.Qty);
  const estRate    = item.estimatedRate != null ? d(item.estimatedRate) : null;
  const estQty     = item.estimatedQty  != null ? d(item.estimatedQty)  : null;

  const hasEstimate = item.isEstimated && estRate !== null;

  let rateVariance:      number | null = null;
  let rateVarianceValue: number | null = null;
  let qtyVariance:       number | null = null;
  let qtyVarianceValue:  number | null = null;

  if (hasEstimate && estRate !== null) {
    // Rate variance: (actualRate - estimatedRate) × actualQty
    rateVariance      = toNum(actualRate.minus(estRate));
    rateVarianceValue = toNum(actualRate.minus(estRate).mul(actualQty));

    // Qty variance: (actualQty - estimatedQty) × estimatedRate
    if (estQty !== null) {
      qtyVariance      = toNum(actualQty.minus(estQty));
      qtyVarianceValue = toNum(actualQty.minus(estQty).mul(estRate));
    }
  }

  return {
    lineNo:            typeof item.lineNo === "number" ? item.lineNo : Number(item.lineNo),
    itemName:          item.itemName,
    uom:               item.uom,
    qty:               toNum(actualQty),
    rate:              toNum(actualRate),
    amount:            toNum(d(item.Amount)),
    estimatedQty:      item.estimatedQty  ?? null,
    estimatedRate:     item.estimatedRate ?? null,
    rateVariance,
    rateVarianceValue,
    qtyVariance,
    qtyVarianceValue,
    isEstimated:   Boolean(item.isEstimated),
    isNonTendered: Boolean(item.isNonTendered),
    isBillable:    Boolean(item.isBillable),
  };
}

// ─── CATEGORY ANALYSIS ─────────────────────────────────────────────────────────

function computeCategory(
  categoryName: string,
  items: POItem[],
  poTotal: Decimal
): CategoryAnalysis {
  const lines = items.map(computeLineVariance);

  const totalValue    = items.reduce((s, i) => s.plus(d(i.Amount)), new Decimal(0));
  const billableValue = items.filter(i => Boolean(i.isBillable))
                             .reduce((s, i) => s.plus(d(i.Amount)), new Decimal(0));
  const nonBillableValue = totalValue.minus(billableValue);

  let rateSavings  = new Decimal(0);
  let rateOverspend = new Decimal(0);

  for (const line of lines) {
    if (line.rateVarianceValue != null) {
      const rv = d(line.rateVarianceValue);
      if (rv.isNegative())      rateSavings   = rateSavings.plus(rv.abs());
      else if (rv.isPositive()) rateOverspend = rateOverspend.plus(rv);
    }
  }

  let qtyVarianceOverspend = new Decimal(0);
  let qtyVarianceSaving    = new Decimal(0);

  for (const line of lines) {
    if (line.qtyVarianceValue != null) {
      const qv = d(line.qtyVarianceValue);
      if (qv.isPositive())      qtyVarianceOverspend = qtyVarianceOverspend.plus(qv);
      else if (qv.isNegative()) qtyVarianceSaving    = qtyVarianceSaving.plus(qv.abs());
    }
  }

  const nonEstimatedItems = items.filter(i => !Boolean(i.isEstimated));
  const nonEstimatedValue = nonEstimatedItems.reduce((s, i) => s.plus(d(i.Amount)), new Decimal(0));

  const nonTenderedItems = items.filter(i => Boolean(i.isNonTendered));
  const nonTenderedValue = nonTenderedItems.reduce((s, i) => s.plus(d(i.Amount)), new Decimal(0));

  return {
    categoryName,
    totalValue:           toNum(totalValue),
    pctOfPO:              pctOf(totalValue, poTotal),
    billableValue:        toNum(billableValue),
    nonBillableValue:     toNum(nonBillableValue),
    rateSavings:          toNum(rateSavings),
    rateOverspend:        toNum(rateOverspend),
    netRateVariance:      toNum(rateOverspend.minus(rateSavings)),
    qtyVarianceOverspend: toNum(qtyVarianceOverspend),
    qtyVarianceSaving:    toNum(qtyVarianceSaving),
    nonEstimatedValue:    toNum(nonEstimatedValue),
    nonEstimatedItems:    nonEstimatedItems.map(i => i.itemName),
    nonTenderedValue:     toNum(nonTenderedValue),
    nonTenderedItems:     nonTenderedItems.map(i => i.itemName),
    lines,
  };
}

// ─── RISK FLAGS ────────────────────────────────────────────────────────────────

function computeRiskFlags(categories: CategoryAnalysis[], totalPO: number): RiskFlag[] {
  const flags: RiskFlag[] = [];

  for (const cat of categories) {
    if (cat.nonTenderedValue > 0)
      flags.push({ severity: "critical", category: cat.categoryName,
        message: `Non-tendered items in ${cat.categoryName}: ${cat.nonTenderedItems.join(", ")}`,
        value: cat.nonTenderedValue, pctOfPO: pctOf(d(cat.nonTenderedValue), d(totalPO)) });

    if (cat.nonEstimatedValue > 0)
      flags.push({ severity: "warning", category: cat.categoryName,
        message: `Non-estimated items in ${cat.categoryName}: ${cat.nonEstimatedItems.join(", ")}`,
        value: cat.nonEstimatedValue, pctOfPO: pctOf(d(cat.nonEstimatedValue), d(totalPO)) });

    if (cat.rateOverspend > 0)
      flags.push({ severity: "warning", category: cat.categoryName,
        message: `Rate overspend in ${cat.categoryName}`,
        value: cat.rateOverspend, pctOfPO: pctOf(d(cat.rateOverspend), d(totalPO)) });

    if (cat.qtyVarianceOverspend > 0)
      flags.push({ severity: "warning", category: cat.categoryName,
        message: `Quantity above estimate in ${cat.categoryName}`,
        value: cat.qtyVarianceOverspend, pctOfPO: pctOf(d(cat.qtyVarianceOverspend), d(totalPO)) });

    if (cat.rateSavings > 0)
      flags.push({ severity: "info", category: cat.categoryName,
        message: `Rate savings in ${cat.categoryName}`,
        value: cat.rateSavings, pctOfPO: pctOf(d(cat.rateSavings), d(totalPO)) });
  }

  const order = { critical: 0, warning: 1, info: 2 };
  return flags.sort((a, b) => order[a.severity] - order[b.severity]);
}

// ─── SHARED AGGREGATION ────────────────────────────────────────────────────────

function aggregate(po: PurchaseOrder) {
  const catMap = new Map<string, POItem[]>();
  for (const item of po.items) {
    const existing = catMap.get(item.categoryName) ?? [];
    catMap.set(item.categoryName, [...existing, item]);
  }

  const totalValue    = po.items.reduce((s, i) => s.plus(d(i.Amount)), new Decimal(0));
  const billableValue = po.items.filter(i => Boolean(i.isBillable))
                                .reduce((s, i) => s.plus(d(i.Amount)), new Decimal(0));

  const categories = Array.from(catMap.entries())
    .map(([name, items]) => computeCategory(name, items, totalValue));

  const totalRateSavings  = categories.reduce((s, c) => s.plus(d(c.rateSavings)),  new Decimal(0));
  const totalRateOverspend= categories.reduce((s, c) => s.plus(d(c.rateOverspend)),new Decimal(0));
  const totalQtyOverspend = categories.reduce((s, c) => s.plus(d(c.qtyVarianceOverspend)), new Decimal(0));
  const totalQtySaving    = categories.reduce((s, c) => s.plus(d(c.qtyVarianceSaving)),    new Decimal(0));
  const totalNonEstimated = categories.reduce((s, c) => s.plus(d(c.nonEstimatedValue)),    new Decimal(0));
  const totalNonTendered  = categories.reduce((s, c) => s.plus(d(c.nonTenderedValue)),     new Decimal(0));
  const netRateVariance   = totalRateOverspend.minus(totalRateSavings);
  const netVarianceValue  = totalRateOverspend.plus(totalQtyOverspend).minus(totalRateSavings);

  return {
    totalValue, billableValue,
    nonBillableValue: totalValue.minus(billableValue),
    categories,
    totalRateSavings, totalRateOverspend, totalQtyOverspend,
    totalQtySaving, totalNonEstimated, totalNonTendered,
    netRateVariance, netVarianceValue,
  };
}

// ─── PUBLIC API ────────────────────────────────────────────────────────────────

export function computePOAnalysis(po: PurchaseOrder, narrative: string): POAnalysisResult {
  const a = aggregate(po);

  const variance: VarianceSummary = {
    totalRateSavings:          toNum(a.totalRateSavings),
    totalRateOverspend:        toNum(a.totalRateOverspend),
    netRateVariance:           toNum(a.netRateVariance),
    totalQtyVarianceOverspend: toNum(a.totalQtyOverspend),
    totalQtyVarianceSaving:    toNum(a.totalQtySaving),
    totalNonEstimatedValue:    toNum(a.totalNonEstimated),
    totalNonTenderedValue:     toNum(a.totalNonTendered),
    savingsPct:      pctOf(a.totalRateSavings,  a.totalValue),
    overspendPct:    pctOf(a.totalRateOverspend, a.totalValue),
    netVariancePct:  pctOf(a.netVarianceValue.abs(), a.totalValue),
    netVarianceValue:toNum(a.netVarianceValue),
    nonEstimatedPct: pctOf(a.totalNonEstimated, a.totalValue),
    nonTenderedPct:  pctOf(a.totalNonTendered,  a.totalValue),
    qtyOverspendPct: pctOf(a.totalQtyOverspend, a.totalValue),
  };

  return {
    poNumber:        po.poNumber,
    vendor:          po.vendor,
    project:         po.project,
    totalValue:      toNum(a.totalValue),
    billableValue:   toNum(a.billableValue),
    nonBillableValue:toNum(a.nonBillableValue),
    billablePct:     pctOf(a.billableValue,    a.totalValue),
    nonBillablePct:  pctOf(a.nonBillableValue, a.totalValue),
    categories:      a.categories,
    variance,
    riskFlags:       computeRiskFlags(a.categories, toNum(a.totalValue)),
    narrative,
    computedAt:      new Date().toISOString(),
  };
}

export function computePOAnalysisRaw(po: PurchaseOrder) {
  const a = aggregate(po);
  return {
    poNumber:   po.poNumber,
    totalValue: toNum(a.totalValue),
    categories: a.categories,
    variance: {
      totalRateSavings:          toNum(a.totalRateSavings),
      totalRateOverspend:        toNum(a.totalRateOverspend),
      netRateVariance:           toNum(a.netRateVariance),
      netVarianceValue:          toNum(a.netVarianceValue),
      totalQtyVarianceOverspend: toNum(a.totalQtyOverspend),
      totalNonEstimatedValue:    toNum(a.totalNonEstimated),
      totalNonTenderedValue:     toNum(a.totalNonTendered),
    },
    riskFlags: computeRiskFlags(a.categories, toNum(a.totalValue)),
  };
}