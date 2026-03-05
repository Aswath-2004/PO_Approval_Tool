# PO Approval Tool

A full-stack Purchase Order analysis dashboard built for MEP contracting companies in India. Upload a PO JSON file and get an instant, deterministic variance analysis — broken down by category, flagged by risk, and optionally summarised by AI.

---

## What the Tool Does

1. You upload a Purchase Order as a `.json` file
2. The backend validates and sanitizes the data
3. A deterministic calculation engine (using `Decimal.js` for financial precision) computes:
   - Rate variance per line item and per category
   - Quantity variance per line item and per category
   - Savings vs overspend breakdown
   - Non-estimated and non-tendered item flags
   - Net variance percentage vs total PO value
4. Risk flags are generated from fixed rules (no AI involved)
5. The dashboard renders gauges, category cards, and stat panels instantly
6. Optionally, clicking **Generate Summary** sends the pre-computed numbers to GPT-4o-mini which writes a 150–200 word approval narrative — the AI does **zero arithmetic**

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), Tailwind CSS, Recharts |
| Backend | Node.js, Express, TypeScript, ts-node |
| Validation | Manual sanitization (no Zod in production path) |
| Financial math | Decimal.js (precision 20, ROUND_HALF_UP) |
| AI narrative | OpenAI GPT-4o-mini |
| Hosting | Vercel (frontend) + Render (backend) |

---

## Project Structure

```
po-approval-tool/
├── backend/
│   ├── src/
│   │   ├── engine/
│   │   │   ├── calculator.ts      ← All financial calculations
│   │   │   └── narrator.ts        ← GPT-4o-mini narrative prompt
│   │   ├── middleware/
│   │   │   ├── errorHandler.ts
│   │   │   └── logger.ts          ← Pino structured logging
│   │   ├── routes/
│   │   │   └── analyse.ts         ← POST /api/analyse endpoint
│   │   ├── types/
│   │   │   └── po.types.ts        ← TypeScript interfaces
│   │   └── index.ts               ← Express app entry point
│   ├── .env                       ← OPENAI_API_KEY, PORT
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── app/
    │   │   ├── api/analyse/
    │   │   │   └── route.ts       ← Next.js proxy to backend
    │   │   ├── globals.css
    │   │   ├── layout.tsx
    │   │   └── page.tsx           ← Upload ↔ Dashboard state
    │   ├── components/dashboard/
    │   │   ├── CategoryCard.tsx   ← Expandable category accordion
    │   │   ├── Dashboard.tsx      ← Full results view
    │   │   ├── RadialGauge.tsx    ← SVG 270° arc gauge
    │   │   └── UploadZone.tsx     ← Drag-and-drop file upload
    │   ├── lib/
    │   │   └── api.ts             ← Fetch wrapper
    │   └── types/
    │       └── analysis.ts        ← Frontend type mirrors
    ├── .env.local                 ← BACKEND_URL
    └── next.config.js
```

---

## How the Dashboard Works

### Upload Flow

```
User drops .json file
      ↓
FileReader reads it as text → JSON.parse()
      ↓
POST /api/analyse (no narrative, instant)
      ↓
Backend sanitizes → calculates → returns result
      ↓
Dashboard renders in <100ms
      ↓ (optional)
User clicks "Generate Summary"
      ↓
POST /api/analyse?includeNarrative=true
      ↓
Same calculation + GPT-4o-mini narrative
      ↓
Narrative panel updates
```

### Dashboard Components

**Radial Gauges** — three 270° SVG arc gauges showing:
- Net Variance % (how much the PO deviates from budget overall)
- Savings % (rate savings as % of PO total)
- Non-Estimated % (unbaselined spend as % of total)

**Stat Cards** — four summary numbers:
- Total PO Value
- Rate Savings
- Rate + Qty Overspend
- Net Variance (Rate + Qty combined)

**Category Cards** — one expandable card per category showing:
- Category total value and % of PO
- Rate savings / overspend mini-cards
- Qty variance overspend
- Line-item table with estimated vs actual qty/rate and colour-coded delta
- Non-estimated and non-tendered item warnings

**Risk Flag Panel** — sorted list of flags (Critical → Warning → Info) with value and % of PO

**AI Summary Panel** — blank by default, populated on demand by clicking "Generate Summary →"

---

## Calculation Engine — Deep Dive

All calculations run in `backend/src/engine/calculator.ts` using `Decimal.js`. No floating-point arithmetic — every number is computed with precision 20, rounded HALF_UP.

### Step 1 — Sanitize Input

Before any calculation, `sanitizePO()` in `analyse.ts` converts every field to its correct type using safe coercions:

```typescript
safeNum(v)        // Number(v), returns 0 if null/undefined/NaN/Infinity
safeNumOrNull(v)  // same but returns null instead of 0 for missing values
safeBool(v)       // handles boolean, "true", 1, 0
```

This means the calculation engine always receives clean, typed data regardless of what the uploaded JSON contains.

---

### Step 2 — Line-Level Variance

For each item where `isEstimated = true` and `estimatedRate` is not null, two variance values are computed:

#### Rate Variance Value

```
rateVarianceValue = (actualRate - estimatedRate) × actualQty
```

**Example:**
```
Chilled Water MS Pipe 50mm:
  actualRate    = ₹740
  estimatedRate = ₹700
  actualQty     = 500 Rmt

  rateVarianceValue = (740 - 700) × 500 = +₹20,000  ← overspend
```


#### Quantity Variance Value

```
qtyVarianceValue = (actualQty - estimatedQty) × estimatedRate
```

**Example:**
```
GI Sheet Rectangular Duct:
  actualQty     = 780 Sqm
  estimatedQty  = 650 Sqm
  estimatedRate = ₹450

  qtyVarianceValue = (780 - 650) × 450 = +₹58,500  ← overspend due to volume
```

### Step 3 — Category Aggregation

For each category, all line variances are summed:

```
rateSavings          = Σ abs(rateVarianceValue) for lines where value < 0
rateOverspend        = Σ rateVarianceValue      for lines where value > 0
netRateVariance      = rateOverspend - rateSavings

qtyVarianceOverspend = Σ qtyVarianceValue for lines where value > 0
qtyVarianceSaving    = Σ abs(qtyVarianceValue) for lines where value < 0
```

Items where `isEstimated = false` have **no variance computed** (there is no baseline to compare against). Their total value is tracked separately as `nonEstimatedValue`.

Items where `isNonTendered = true` have their total value tracked as `nonTenderedValue`.

---

### Step 4 — PO-Level Variance Summary

All category values are summed to produce PO-level totals:

```
netVarianceValue = totalRateOverspend + totalQtyOverspend - totalRateSavings
```

This is the **true total additional cost exposure** vs the original budget. It combines both sources of cost increase (rate and volume) and subtracts any rate savings achieved.

```
netVariancePct = abs(netVarianceValue) / totalPOValue × 100
```

**Worked example:**
```
totalRateOverspend  = ₹20,000   (Piping rate went up)
totalQtyOverspend   = ₹76,800   (Ducting + Accessories volume above estimate)
totalRateSavings    = ₹14,950   (GI Duct + Collar Damper rate came down)

netVarianceValue    = 20,000 + 76,800 - 14,950 = +₹81,850  (net overspend)

If totalPOValue = ₹9,15,250:
netVariancePct      = 81,850 / 9,15,250 × 100 = 8.9%
```

---

### Variance Decomposition Summary

| Metric | Formula | Meaning |
|---|---|---|
| Rate variance per line | `(Rate - estRate) × Qty` | Extra cost due to price change |
| Qty variance per line | `(Qty - estQty) × estRate` | Extra cost due to volume change |
| Category rate savings | Sum of negative rate variances | Where prices came in below budget |
| Category rate overspend | Sum of positive rate variances | Where prices exceeded budget |
| Net variance value | `rateOverspend + qtyOverspend - rateSavings` | Total cost exposure vs budget |
| Net variance % | `abs(net) / totalPO × 100` | Overall budget deviation |

---

## Risk Flag Rules

Risk flags are generated by deterministic rules, sorted Critical → Warning → Info:

| Severity | Trigger | Meaning |
|---|---|---|
| 🔴 Critical | `nonTenderedValue > 0` | Items procured without competitive quotes — possible price inflation, no audit trail |
| 🟡 Warning | `nonEstimatedValue > 0` | Items with no budget baseline — cannot assess if over or under spend |
| 🟡 Warning | `rateOverspend > 0` | Supplier rate exceeded estimated/agreed rate |
| 🟡 Warning | `qtyVarianceOverspend > 0` | More material used than planned — possible scope increase |
| 🔵 Info | `rateSavings > 0` | Rate came in below estimate — positive variance |

Each flag includes the rupee value and percentage of total PO.

---

## AI Narrative Generation

When `?includeNarrative=true` is passed, the backend calls GPT-4o-mini **after** all calculations are complete. The AI receives a structured prompt containing **only pre-computed numbers** — it never performs arithmetic.

The prompt includes:
- PO number and total value
- Per-category breakdown (totals, rate variance, qty variance, non-estimated/tendered flags)
- Overall variance summary (all values pre-formatted in ₹ with Indian numbering)
- Pre-identified risk flags with severities and values

The AI is explicitly instructed:
> "ALL NUMBERS ARE PRE-CALCULATED — do NOT perform any arithmetic yourself. Your job is ONLY to write a concise, professional approval summary in 150–200 words."

If the AI call fails for any reason, a plain-text fallback narrative is generated deterministically from the same data. The tool never shows a blank summary — either the AI version or the fallback is always returned.

---

## API Reference

### `POST /api/analyse`

Analyse a Purchase Order JSON.

**Query params:**
- `includeNarrative=true` — include GPT-4o-mini narrative (adds ~1–2s latency). Default: `false`

**Request body:** PO JSON (see schema below)

**Response:** `POAnalysisResult` JSON with all calculated fields, categories, variance summary, risk flags, and optional narrative.

### `GET /api/health`

Returns `{ "status": "ok", "ts": "..." }`. Used to check if the backend is awake (Render free tier sleeps after 15 min inactivity).

---

## Input JSON Schema

```json
{
  "poNumber": "CCPL/020/24",
  "vendor": "ABC Suppliers",
  "project": "MEP Block A",
  "items": [
    {
      "lineNo": 1,
      "itemId": 2001,
      "itemName": "GI Sheet Rectangular Duct",
      "categoryName": "Ducting",
      "uom": "Sqm",
      "Qty": 780,
      "Rate": 430,
      "Amount": 335400,
      "isBillable": true,
      "isEstimated": true,
      "isNonTendered": false,
      "estimatedQty": 650,
      "estimatedRate": 450
    }
  ]
}
```
## Key Design Principles

- **AI never does arithmetic.** All numbers come from Decimal.js. The AI only converts pre-computed numbers into prose.
- **Fail gracefully.** If the AI narrative fails, a deterministic fallback is returned. The tool never breaks due to AI unavailability.
- **Instant by default.** The default API call skips narrative generation entirely. The dashboard loads in under 100ms. Narrative is a secondary on-demand action.
- **Financial precision.** Decimal.js with precision 20 and ROUND_HALF_UP — no floating-point rounding errors on money values.
- **Permissive input.** The sanitizer accepts real-world PO exports with extra columns, string numbers, and missing optional fields without crashing.
