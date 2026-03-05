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

// Configure Decimal.js for financial precision
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// ─── HELPERS ───────────────────────────────────────────────────────────────────

function d(n: number | null | undefined): Decimal {
  if (n == null) return new Decimal(0);
  return new Decimal(n);
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
  const hasEstimate = item.isEstimated && item.estimatedRate != null;

  let rateVariance: number | null = null;
  let rateVarianceValue: number | null = null;
  let qtyVariance: number | null = null;
  let qtyVarianceValue: number | null = null;

  if (hasEstimate) {
    const actualRate = d(item.Rate);
    const estRate = d(item.estimatedRate);
    const actualQty = d(item.Qty);

    // FIX 1a — Rate variance: (actualRate - estimatedRate) × actualQty
    // Spec: overspend/saving by rate = Qty × (Rate - estimatedRate)
    rateVariance = toNum(actualRate.minus(estRate));
    rateVarianceValue = toNum(actualRate.minus(estRate).mul(actualQty));

    // FIX 1b — Qty variance overspend: max(Qty - estimatedQty, 0) × estimatedRate
    // Spec: qty overspend uses estimatedRate as the baseline cost per unit,
    // so it reflects what the extra volume should have cost at budget rates.
    // Negative qty variance (under-run) is tracked separately as qty saving.
    if (item.estimatedQty != null) {
      const estQty = d(item.estimatedQty);
      qtyVariance = toNum(actualQty.minus(estQty));
      // Overspend: only when actual > estimated, valued at estimatedRate
      // Saving:    only when actual < estimated, valued at estimatedRate
      qtyVarianceValue = toNum(actualQty.minus(estQty).mul(estRate));
    }
  }

  return {
    lineNo: item.lineNo,
    itemName: item.itemName,
    uom: item.uom,
    qty: item.Qty,
    rate: item.Rate,
    amount: item.Amount,
    estimatedQty: item.estimatedQty ?? null,
    estimatedRate: item.estimatedRate ?? null,
    rateVariance,
    rateVarianceValue,
    qtyVariance,
    qtyVarianceValue,
    isEstimated: item.isEstimated,
    isNonTendered: item.isNonTendered,
    isBillable: item.isBillable,
  };
}

// ─── CATEGORY ANALYSIS ─────────────────────────────────────────────────────────

function computeCategory(
  categoryName: string,
  items: POItem[],
  poTotal: Decimal
): CategoryAnalysis {
  const lines = items.map(computeLineVariance);

  // Totals
  const totalValue = items.reduce((s, i) => s.plus(d(i.Amount)), new Decimal(0));
  const billableValue = items
    .filter((i) => i.isBillable)
    .reduce((s, i) => s.plus(d(i.Amount)), new Decimal(0));
  const nonBillableValue = totalValue.minus(billableValue);

  // Rate variance (only estimated items)
  let rateSavings = new Decimal(0);
  let rateOverspend = new Decimal(0);

  for (const line of lines) {
    if (line.rateVarianceValue != null) {
      const rv = d(line.rateVarianceValue);
      if (rv.isNegative()) {
        rateSavings = rateSavings.plus(rv.abs()); // saving = negative variance
      } else if (rv.isPositive()) {
        rateOverspend = rateOverspend.plus(rv);    // overspend = positive variance
      }
    }
  }

  // Quantity variance
  let qtyVarianceOverspend = new Decimal(0);
  let qtyVarianceSaving = new Decimal(0);

  for (const line of lines) {
    if (line.qtyVarianceValue != null) {
      const qv = d(line.qtyVarianceValue);
      if (qv.isPositive()) {
        qtyVarianceOverspend = qtyVarianceOverspend.plus(qv);
      } else if (qv.isNegative()) {
        qtyVarianceSaving = qtyVarianceSaving.plus(qv.abs());
      }
    }
  }

  // Risk items
  const nonEstimatedItems = items.filter((i) => !i.isEstimated);
  const nonEstimatedValue = nonEstimatedItems.reduce(
    (s, i) => s.plus(d(i.Amount)),
    new Decimal(0)
  );

  const nonTenderedItems = items.filter((i) => i.isNonTendered);
  const nonTenderedValue = nonTenderedItems.reduce(
    (s, i) => s.plus(d(i.Amount)),
    new Decimal(0)
  );

  return {
    categoryName,
    totalValue: toNum(totalValue),
    pctOfPO: pctOf(totalValue, poTotal),
    billableValue: toNum(billableValue),
    nonBillableValue: toNum(nonBillableValue),
    rateSavings: toNum(rateSavings),
    rateOverspend: toNum(rateOverspend),
    netRateVariance: toNum(rateOverspend.minus(rateSavings)),
    qtyVarianceOverspend: toNum(qtyVarianceOverspend),
    qtyVarianceSaving: toNum(qtyVarianceSaving),
    nonEstimatedValue: toNum(nonEstimatedValue),
    nonEstimatedItems: nonEstimatedItems.map((i) => i.itemName),
    nonTenderedValue: toNum(nonTenderedValue),
    nonTenderedItems: nonTenderedItems.map((i) => i.itemName),
    lines,
  };
}

// ─── RISK FLAGS ────────────────────────────────────────────────────────────────

function computeRiskFlags(
  categories: CategoryAnalysis[],
  totalPO: number
): RiskFlag[] {
  const flags: RiskFlag[] = [];

  for (const cat of categories) {
    if (cat.nonTenderedValue > 0) {
      flags.push({
        severity: "critical",
        category: cat.categoryName,
        message: `Non-tendered items in ${cat.categoryName}: ${cat.nonTenderedItems.join(", ")}`,
        value: cat.nonTenderedValue,
        pctOfPO: pctOf(d(cat.nonTenderedValue), d(totalPO)),
      });
    }
    if (cat.nonEstimatedValue > 0) {
      flags.push({
        severity: "warning",
        category: cat.categoryName,
        message: `Non-estimated items in ${cat.categoryName}: ${cat.nonEstimatedItems.join(", ")}`,
        value: cat.nonEstimatedValue,
        pctOfPO: pctOf(d(cat.nonEstimatedValue), d(totalPO)),
      });
    }
    if (cat.rateOverspend > 0) {
      flags.push({
        severity: "warning",
        category: cat.categoryName,
        message: `Rate overspend in ${cat.categoryName}`,
        value: cat.rateOverspend,
        pctOfPO: pctOf(d(cat.rateOverspend), d(totalPO)),
      });
    }
    if (cat.qtyVarianceOverspend > 0) {
      flags.push({
        severity: "warning",
        category: cat.categoryName,
        message: `Quantity above estimate in ${cat.categoryName}`,
        value: cat.qtyVarianceOverspend,
        pctOfPO: pctOf(d(cat.qtyVarianceOverspend), d(totalPO)),
      });
    }
    if (cat.rateSavings > 0) {
      flags.push({
        severity: "info",
        category: cat.categoryName,
        message: `Rate savings in ${cat.categoryName}`,
        value: cat.rateSavings,
        pctOfPO: pctOf(d(cat.rateSavings), d(totalPO)),
      });
    }
  }

  // Sort: critical first, then warning, then info
  const order = { critical: 0, warning: 1, info: 2 };
  return flags.sort((a, b) => order[a.severity] - order[b.severity]);
}

// ─── MAIN ENGINE FUNCTION ──────────────────────────────────────────────────────

export function computePOAnalysis(
  po: PurchaseOrder,
  narrative: string
): POAnalysisResult {
  // Group items by category
  const catMap = new Map<string, POItem[]>();
  for (const item of po.items) {
    const existing = catMap.get(item.categoryName) ?? [];
    catMap.set(item.categoryName, [...existing, item]);
  }

  // PO totals
  const totalValue = po.items.reduce((s, i) => s.plus(d(i.Amount)), new Decimal(0));
  const billableValue = po.items
    .filter((i) => i.isBillable)
    .reduce((s, i) => s.plus(d(i.Amount)), new Decimal(0));
  const nonBillableValue = totalValue.minus(billableValue);

  // Compute per-category
  const categories = Array.from(catMap.entries()).map(([name, items]) =>
    computeCategory(name, items, totalValue)
  );

  // Aggregate variance summary
  const totalRateSavings = categories.reduce((s, c) => s.plus(d(c.rateSavings)), new Decimal(0));
  const totalRateOverspend = categories.reduce((s, c) => s.plus(d(c.rateOverspend)), new Decimal(0));
  const totalQtyOverspend = categories.reduce((s, c) => s.plus(d(c.qtyVarianceOverspend)), new Decimal(0));
  const totalQtySaving = categories.reduce((s, c) => s.plus(d(c.qtyVarianceSaving)), new Decimal(0));
  const totalNonEstimated = categories.reduce((s, c) => s.plus(d(c.nonEstimatedValue)), new Decimal(0));
  const totalNonTendered = categories.reduce((s, c) => s.plus(d(c.nonTenderedValue)), new Decimal(0));
  const netRateVariance = totalRateOverspend.minus(totalRateSavings);

  // FIX 2 — Net variance includes BOTH rate and qty overspend components:
  // netVarianceValue = totalRateOverspend + totalQtyOverspend - totalRateSavings
  // This is the true additional cost exposure vs the original budget.
  const netVarianceValue = totalRateOverspend.plus(totalQtyOverspend).minus(totalRateSavings);

  const variance: VarianceSummary = {
    totalRateSavings: toNum(totalRateSavings),
    totalRateOverspend: toNum(totalRateOverspend),
    netRateVariance: toNum(netRateVariance),
    totalQtyVarianceOverspend: toNum(totalQtyOverspend),
    totalQtyVarianceSaving: toNum(totalQtySaving),
    totalNonEstimatedValue: toNum(totalNonEstimated),
    totalNonTenderedValue: toNum(totalNonTendered),
    savingsPct: pctOf(totalRateSavings, totalValue),
    overspendPct: pctOf(totalRateOverspend, totalValue),
    netVariancePct: pctOf(netVarianceValue.abs(), totalValue), // FIX: was only rate variance
    netVarianceValue: toNum(netVarianceValue),                 // new field — total net exposure
    nonEstimatedPct: pctOf(totalNonEstimated, totalValue),
    nonTenderedPct: pctOf(totalNonTendered, totalValue),
    qtyOverspendPct: pctOf(totalQtyOverspend, totalValue),
  };

  const riskFlags = computeRiskFlags(categories, toNum(totalValue));

  return {
    poNumber: po.poNumber,
    vendor: po.vendor,
    project: po.project,
    totalValue: toNum(totalValue),
    billableValue: toNum(billableValue),
    nonBillableValue: toNum(nonBillableValue),
    billablePct: pctOf(billableValue, totalValue),
    nonBillablePct: pctOf(nonBillableValue, totalValue),
    categories,
    variance,
    riskFlags,
    narrative,
    computedAt: new Date().toISOString(),
  };
}

// ─── EXPORT ANALYSIS-ONLY (without narrative, for AI prompt building) ──────────

export function computePOAnalysisRaw(po: PurchaseOrder) {
  const catMap = new Map<string, POItem[]>();
  for (const item of po.items) {
    const existing = catMap.get(item.categoryName) ?? [];
    catMap.set(item.categoryName, [...existing, item]);
  }

  const totalValue = po.items.reduce((s, i) => s.plus(d(i.Amount)), new Decimal(0));
  const categories = Array.from(catMap.entries()).map(([name, items]) =>
    computeCategory(name, items, totalValue)
  );

  const totalRateSavings = categories.reduce((s, c) => s.plus(d(c.rateSavings)), new Decimal(0));
  const totalRateOverspend = categories.reduce((s, c) => s.plus(d(c.rateOverspend)), new Decimal(0));
  const totalQtyOverspend = categories.reduce((s, c) => s.plus(d(c.qtyVarianceOverspend)), new Decimal(0));
  const totalNonEstimated = categories.reduce((s, c) => s.plus(d(c.nonEstimatedValue)), new Decimal(0));
  const totalNonTendered = categories.reduce((s, c) => s.plus(d(c.nonTenderedValue)), new Decimal(0));

  return {
    poNumber: po.poNumber,
    totalValue: toNum(totalValue),
    categories,
    variance: {
      totalRateSavings: toNum(totalRateSavings),
      totalRateOverspend: toNum(totalRateOverspend),
      netRateVariance: toNum(totalRateOverspend.minus(totalRateSavings)),
      netVarianceValue: toNum(totalRateOverspend.plus(totalQtyOverspend).minus(totalRateSavings)),
      totalQtyVarianceOverspend: toNum(totalQtyOverspend),
      totalNonEstimatedValue: toNum(totalNonEstimated),
      totalNonTenderedValue: toNum(totalNonTendered),
    },
    riskFlags: computeRiskFlags(categories, toNum(totalValue)),
  };
}
