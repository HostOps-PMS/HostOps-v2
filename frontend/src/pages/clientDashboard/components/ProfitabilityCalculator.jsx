import { useState, useEffect, useMemo, useCallback } from "react";

const STORAGE_KEY = "hp_profitability_v2";

const DEFAULT_INPUTS = {
  availableNights: 30,
  nightsSold: 0,
  grossRevenue: 0,
  cleaningFee: 0,
  cancellations: 0,
  commissionRate: 15,
  processingRate: 2,
  cleaning: 0,
  rent: 0,
  utilities: 0,
  staff: 0,
  duesTaxInsurance: 0,
  maintenance: 0,
};

const FIXED_FIELDS = [
  { key: "rent",             label: "Rent / mortgage",          icon: "ti-home" },
  { key: "utilities",        label: "Utilities (power + water + net)", icon: "ti-bolt" },
  { key: "staff",            label: "Staff",                    icon: "ti-users" },
  { key: "duesTaxInsurance", label: "Dues + tax + insurance",   icon: "ti-file-invoice" },
  { key: "maintenance",      label: "Maintenance / repairs",    icon: "ti-tool" },
];

function getPeriodDays(period) {
  if (period && typeof period === "object" && Number(period.days)) return Number(period.days);
  if (typeof period === "string") {
    const p = period.toLowerCase();
    if (p.includes("week")) return 7;
    if (p.includes("year")) return 365;
    if (p.includes("day")) return 1;
  }
  return 30;
}

function normalizeToMonthly(amount, period) {
  if (!amount) return 0;
  const days = getPeriodDays(period);
  if (days <= 0) return amount;
  return (amount / days) * 30;
}

function peso(n) {
  const sign = n < 0 ? "−" : "";
  return `${sign}₱${Math.round(Math.abs(n)).toLocaleString("en-PH")}`;
}

function num(n, digits = 1) {
  return Number.isFinite(n) ? n.toFixed(digits) : "0";
}

function exportReceipt(calc, inputs, eff) {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
  const timeStr = now.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" });
  const isProfit = calc.netProfit >= 0;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>HostOps — Profitability Report ${dateStr}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Courier New', monospace; background: #fff; color: #111; max-width: 420px; margin: 0 auto; padding: 32px 24px; }
    .center { text-align: center; }

    /* Logo area */
    .logo-wrap { display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 6px; }
    .logo-icon { width: 38px; height: 38px; background: #0c1c14; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .logo-icon svg { display: block; }
    .logo-name { font-family: 'Courier New', monospace; font-size: 22px; font-weight: bold; letter-spacing: 2px; color: #0c1c14; }
    .logo-name span { color: #1e8760; }

    .subtitle { font-size: 11px; color: #555; letter-spacing: 1px; text-transform: uppercase; margin-top: 2px; }
    .date { font-size: 11px; color: #777; margin-top: 4px; }
    .divider { border: none; border-top: 1px dashed #bbb; margin: 16px 0; }
    .divider-solid { border: none; border-top: 2px solid #111; margin: 16px 0; }
    .section-title { font-size: 10px; font-weight: bold; letter-spacing: 2px; text-transform: uppercase; color: #555; margin-bottom: 8px; }
    .row { display: flex; justify-content: space-between; font-size: 13px; padding: 3px 0; }
    .row.bold { font-weight: bold; font-size: 14px; }
    .row.accent { color: ${isProfit ? "#1e8760" : "#c13515"}; font-weight: bold; font-size: 15px; }
    .kpi-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 12px 0; }
    .kpi-box { border: 1px solid #ddd; border-radius: 6px; padding: 10px 12px; }
    .kpi-label { font-size: 9px; letter-spacing: 1.5px; text-transform: uppercase; color: #777; }
    .kpi-value { font-size: 16px; font-weight: bold; margin-top: 3px; }
    .verdict { border: 2px solid ${isProfit ? "#1e8760" : "#c13515"}; border-radius: 8px; padding: 12px 16px; margin: 16px 0; text-align: center; }
    .verdict-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: ${isProfit ? "#1e8760" : "#c13515"}; }
    .verdict-value { font-size: 18px; font-weight: bold; color: ${isProfit ? "#1e8760" : "#c13515"}; }
    .footer { margin-top: 24px; text-align: center; font-size: 10px; color: #aaa; letter-spacing: 1px; }
    .footer-logo { font-size: 11px; font-weight: bold; color: #0c1c14; letter-spacing: 1.5px; margin-bottom: 4px; }
    .footer-logo span { color: #1e8760; }
    @media print {
      body { padding: 8px; }
      @page { size: A4 portrait; margin: 10mm 14mm; }
    }
  </style>
</head>
<body>
  <div class="center">
    <div class="logo-wrap">
      <div class="logo-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 9.5L12 3L21 9.5V20C21 20.55 20.55 21 20 21H15V15H9V21H4C3.45 21 3 20.55 3 20V9.5Z" fill="#d4e8dd"/>
          <path d="M9 21V15H15V21" stroke="#26a676" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M3 9.5L12 3L21 9.5" stroke="#26a676" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div class="logo-name">Host<span>Ops</span></div>
    </div>
    <div class="subtitle">Profitability Report</div>
    <div class="date">${dateStr} · ${timeStr}</div>
  </div>
  <hr class="divider-solid"/>
  <div class="section-title">Operations</div>
  <div class="row"><span>Available Nights</span><span>${inputs.availableNights}</span></div>
  <div class="row"><span>Nights Sold</span><span>${eff.nightsSold}</span></div>
  <div class="row"><span>Occupancy Rate</span><span>${calc.occupancy.toFixed(1)}%</span></div>
  <hr class="divider"/>
  <div class="section-title">Revenue Breakdown</div>
  <div class="row"><span>Gross Booking Revenue</span><span>${peso(calc.gross)}</span></div>
  <div class="row"><span>+ Cleaning Fee (guest)</span><span>+${peso(calc.cleaningFee)}</span></div>
  <div class="row"><span>− Cancellations / Refunds</span><span>−${peso(calc.cancellations)}</span></div>
  <div class="row bold"><span>= Net Revenue</span><span>${peso(calc.netRevenue)}</span></div>
  <hr class="divider"/>
  <div class="section-title">Variable Costs</div>
  <div class="row"><span>Channel Commission (${inputs.commissionRate}%)</span><span>−${peso(calc.commission)}</span></div>
  <div class="row"><span>Payment Processing (${inputs.processingRate}%)</span><span>−${peso(calc.processing)}</span></div>
  <div class="row"><span>Cleaning + Supplies</span><span>−${peso(inputs.cleaning)}</span></div>
  <hr class="divider"/>
  <div class="section-title">Fixed Costs</div>
  <div class="row"><span>Rent / Mortgage</span><span>−${peso(inputs.rent)}</span></div>
  <div class="row"><span>Utilities</span><span>−${peso(inputs.utilities)}</span></div>
  <div class="row"><span>Staff</span><span>−${peso(inputs.staff)}</span></div>
  <div class="row"><span>Dues + Tax + Insurance</span><span>−${peso(inputs.duesTaxInsurance)}</span></div>
  <div class="row"><span>Maintenance / Repairs</span><span>−${peso(inputs.maintenance)}</span></div>
  <div class="row bold"><span>Total Fixed Costs</span><span>−${peso(calc.fixedCosts)}</span></div>
  <hr class="divider-solid"/>
  <div class="verdict">
    <div class="verdict-label">${isProfit ? "✓ Profitable" : "✗ Operating at a Loss"}</div>
    <div class="verdict-value">${peso(calc.netProfit)} / month</div>
    <div style="font-size:12px; margin-top:4px; color:#555;">${calc.margin.toFixed(1)}% margin</div>
  </div>
  <div class="kpi-grid">
    <div class="kpi-box"><div class="kpi-label">ADR</div><div class="kpi-value">${peso(calc.adr)}</div></div>
    <div class="kpi-box"><div class="kpi-label">RevPAR</div><div class="kpi-value">${peso(calc.revPAR)}</div></div>
    <div class="kpi-box"><div class="kpi-label">Cost / Night</div><div class="kpi-value">${calc.sold > 0 ? peso(calc.costPerNight) : "—"}</div></div>
    <div class="kpi-box"><div class="kpi-label">Break-even Occ.</div><div class="kpi-value">${calc.breakEvenOcc.toFixed(0)}%</div></div>
  </div>
  <hr class="divider"/>
  <div class="footer">
    <div class="footer-logo">Host<span>Ops</span></div>
    <div>go.hostops.online</div>
    <div style="margin-top:4px;">— KEEP THIS COPY —</div>
  </div>
</body>
</html>`;

  const win = window.open("", "_blank");
  win.document.write(html);
  win.document.close();
  setTimeout(() => {
    win.focus();
    win.print();
  }, 400);
}

export default function ProfitabilityPanel({ dark = false, stats = {}, period = "monthly" }) {
  const realRevenue = Number(stats?.revenue || 0);
  const realNights = Number(stats?.nights || 0);
  const realOccupancy = Number(stats?.occupancy || 0);
  const hasSmoobuData = realRevenue > 0 || realNights > 0;
  const periodDays = getPeriodDays(period);

  const smoobuMonthly = {
    grossRevenue: normalizeToMonthly(realRevenue, period),
    nightsSold: realNights > 0 ? Math.round((realNights / periodDays) * 30) : 0,
  };

  const [inputs, setInputs] = useState(DEFAULT_INPUTS);
  const [overrides, setOverrides] = useState({ grossRevenue: false, nightsSold: false });
  const [expanded, setExpanded] = useState(false);
const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load saved state
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setInputs({ ...DEFAULT_INPUTS, ...(parsed.inputs || {}) });
        setOverrides(parsed.overrides || { grossRevenue: false, nightsSold: false });
      }
    } catch (e) {
      console.warn("Failed to load:", e);
    }
    setLoaded(true);
  }, []);

  // Save state
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ inputs, overrides }));
    } catch (e) {
      console.warn("Failed to save:", e);
    }
  }, [inputs, overrides, loaded]);

  const updateInput = useCallback((field, value) => {
    setInputs((prev) => ({ ...prev, [field]: Math.max(0, Number(value) || 0) }));
  }, []);

  const toggleOverride = useCallback((field) => {
    setOverrides((prev) => ({ ...prev, [field]: !prev[field] }));
  }, []);

  const resetAll = useCallback(() => {
    setShowResetConfirm(true);
  }, []);

  // Effective values — Smoobu or manual override
  const eff = useMemo(() => {
    const grossRevenue = overrides.grossRevenue || !hasSmoobuData
      ? inputs.grossRevenue
      : smoobuMonthly.grossRevenue;
    const nightsSold = overrides.nightsSold || !hasSmoobuData
      ? inputs.nightsSold
      : smoobuMonthly.nightsSold;
    return { grossRevenue, nightsSold };
  }, [overrides, hasSmoobuData, smoobuMonthly, inputs.grossRevenue, inputs.nightsSold]);

  // Computations
  const calc = useMemo(() => {
    const gross = eff.grossRevenue;
    const cleaningFee = inputs.cleaningFee;
    const cancellations = inputs.cancellations;
    const netRevenue = gross + cleaningFee - cancellations;

    const commission = gross * (inputs.commissionRate / 100);
    const processing = gross * (inputs.processingRate / 100);

    const variableCosts = commission + processing + inputs.cleaning;
    const fixedCosts = FIXED_FIELDS.reduce((s, f) => s + (inputs[f.key] || 0), 0);
    const totalCosts = variableCosts + fixedCosts;

    const netProfit = netRevenue - totalCosts;
    const margin = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0;

    const available = Math.max(1, inputs.availableNights);
    const sold = eff.nightsSold;
    const occupancy = Math.min(100, (sold / available) * 100);

    const adr = sold > 0 ? gross / sold : 0;
    const revPAR = gross / available;
    const costPerNight = sold > 0 ? totalCosts / sold : 0;

    const potential = adr * available;
    const variableRate = (inputs.commissionRate + inputs.processingRate) / 100;
    const breakEvenOcc =
      potential > 0 && variableRate < 1
        ? Math.min(100, Math.max(0, (fixedCosts / (potential * (1 - variableRate))) * 100))
        : 0;

    return {
      gross, cleaningFee, cancellations, netRevenue,
      commission, processing, variableCosts, fixedCosts, totalCosts,
      netProfit, margin, occupancy,
      adr, revPAR, costPerNight, breakEvenOcc,
      available, sold,
    };
  }, [eff, inputs]);

  const t = useMemo(() => getTheme(dark), [dark]);
  const isProfit = calc.netProfit >= 0;
  const meetsBreakEven = calc.occupancy >= calc.breakEvenOcc;

  return (
    <div style={t.card}>
      {/* Header */}
      <div style={t.header}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={t.titleRow}>
            <span style={t.title}>Profitability Calculator</span>
            <span style={t.periodPill}>Monthly view</span>
          </div>
          <div style={t.subtitle}>
            {hasSmoobuData
              ? "Itemized costs and operations — pre-filled from Smoobu, fully editable"
              : "Enter your operations, revenue, and costs to see profitability"}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
            <div style={{ ...t.savedBadge, width: "fit-content" }}>
              <i className="ti ti-cloud-check" style={{ fontSize: 13, marginRight: 5 }} aria-hidden="true" />
              Auto-saved
            </div>
            <button
              type="button"
              onClick={() => exportReceipt(calc, inputs, eff)}
              style={{
                display: "inline-flex", alignItems: "center",
                fontSize: 12, color: "#fff",
                background: "#1e8760", border: "none",
                padding: "7px 13px", borderRadius: 8,
                cursor: "pointer", fontWeight: 600,
                fontFamily: "inherit", gap: 5,
              }}
            >
              <i className="ti ti-printer" style={{ fontSize: 13 }} aria-hidden="true" />
              Export receipt
            </button>
          </div>
        </div>
      </div>

      <div style={t.divider} />

      {/* Operations */}
      <div style={t.section}>
        <div style={t.sectionLabel}>
          <i className="ti ti-calendar-stats" style={t.sectionIcon} aria-hidden="true" />
          Operations (monthly)
        </div>
        <div style={t.grid2}>
          <Field
            t={t}
            label="Available nights"
            hint="Bookable nights per month"
            value={inputs.availableNights}
            onChange={(v) => updateInput("availableNights", v)}
          />
          <Field
            t={t}
            label="Nights sold"
            hint={hasSmoobuData && !overrides.nightsSold ? "From Smoobu" : "Manual"}
            value={eff.nightsSold}
            onChange={(v) => updateInput("nightsSold", v)}
            disabled={hasSmoobuData && !overrides.nightsSold}
            showOverride={hasSmoobuData}
            overrideActive={overrides.nightsSold}
            onToggleOverride={() => toggleOverride("nightsSold")}
          />
        </div>
      </div>

      {/* Revenue */}
      <div style={t.section}>
        <div style={t.sectionLabel}>
          <i className="ti ti-cash" style={t.sectionIcon} aria-hidden="true" />
          Revenue
        </div>
        <div style={t.grid3}>
          <Field
            t={t}
            label="Gross booking revenue"
            hint={hasSmoobuData && !overrides.grossRevenue ? "From Smoobu" : "Manual"}
            value={eff.grossRevenue}
            onChange={(v) => updateInput("grossRevenue", v)}
            currency
            disabled={hasSmoobuData && !overrides.grossRevenue}
            showOverride={hasSmoobuData}
            overrideActive={overrides.grossRevenue}
            onToggleOverride={() => toggleOverride("grossRevenue")}
          />
          <Field
            t={t}
            label="Cleaning fee charged to guest"
            value={inputs.cleaningFee}
            onChange={(v) => updateInput("cleaningFee", v)}
            currency
          />
          <Field
            t={t}
            label="Cancellations / refunds"
            value={inputs.cancellations}
            onChange={(v) => updateInput("cancellations", v)}
            currency
          />
        </div>
      </div>

      {/* Variable Costs */}
      <div style={t.section}>
        <div style={t.sectionLabel}>
          <i className="ti ti-percentage" style={t.sectionIcon} aria-hidden="true" />
          Variable costs <span style={t.sectionHint}>scales with bookings</span>
        </div>
        <Slider
          t={t}
          label="Channel commission"
          value={inputs.commissionRate}
          min={0}
          max={25}
          step={1}
          unit="%"
          onChange={(v) => updateInput("commissionRate", v)}
        />
        <Slider
          t={t}
          label="Payment processing"
          value={inputs.processingRate}
          min={0}
          max={5}
          step={0.5}
          unit="%"
          onChange={(v) => updateInput("processingRate", v)}
        />
        <div style={{ marginTop: 14, maxWidth: 280 }}>
          <Field
            t={t}
            label="Cleaning + supplies (actual cost)"
            value={inputs.cleaning}
            onChange={(v) => updateInput("cleaning", v)}
            currency
          />
        </div>
      </div>

      {/* Fixed Costs */}
      <div style={t.section}>
        <div style={t.sectionLabel}>
          <i className="ti ti-lock" style={t.sectionIcon} aria-hidden="true" />
          Fixed costs <span style={t.sectionHint}>paid even with no guests</span>
        </div>
        <div style={t.costGrid}>
          {FIXED_FIELDS.map((f) => (
            <Field
              key={f.key}
              t={t}
              label={f.label}
              icon={f.icon}
              value={inputs[f.key]}
              onChange={(v) => updateInput(f.key, v)}
              currency
            />
          ))}
        </div>
      </div>

      {/* Verdict */}
      <div style={isProfit ? t.verdictGood : t.verdictBad}>
        <div style={t.verdictIcon}>
          <i className={isProfit ? "ti ti-circle-check" : "ti ti-alert-triangle"} aria-hidden="true" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={t.verdictTitle}>
            {isProfit
              ? `Profitable — ${peso(calc.netProfit)} net per month (${num(calc.margin)}% margin)`
              : `Operating at a loss — ${peso(calc.netProfit)} per month`}
          </div>
          {!isProfit && calc.breakEvenOcc > 0 && (
            <div style={t.verdictBody}>
              Need {num(calc.breakEvenOcc, 0)}% occupancy to break even · currently at {num(calc.occupancy, 0)}%
            </div>
          )}
        </div>
      </div>

      {/* KPI Grid */}
      <div style={t.kpiGrid}>
        <Kpi t={t} label="Net profit" value={peso(calc.netProfit)} accent={isProfit ? "good" : "bad"} />
        <Kpi t={t} label="Margin" value={`${num(calc.margin)}%`} />
        <Kpi t={t} label="ADR" sub="price per night" value={peso(calc.adr)} />
        <Kpi t={t} label="RevPAR" sub="revenue per available night" value={peso(calc.revPAR)} />
        <Kpi t={t} label="Cost / occupied night" value={calc.sold > 0 ? peso(calc.costPerNight) : "—"} />
        <Kpi
          t={t}
          label="Occupancy vs break-even"
          value={`${num(calc.occupancy, 0)}% / ${num(calc.breakEvenOcc, 0)}%`}
          accent={meetsBreakEven ? "good" : "bad"}
        />
      </div>

      {/* Breakdown */}
      <button type="button" onClick={() => setExpanded(!expanded)} style={t.expandBtn}>
        <i
          className={`ti ${expanded ? "ti-chevron-up" : "ti-chevron-down"}`}
          style={{ marginRight: 6 }}
          aria-hidden="true"
        />
        {expanded ? "Hide calculation breakdown" : "View calculation breakdown"}
      </button>

      {expanded && (
        <div style={t.breakdown}>
          <BRow t={t} label="Gross booking revenue" value={peso(calc.gross)} />
          <BRow t={t} label="+ Cleaning fee from guest" value={`+${peso(calc.cleaningFee)}`} />
          <BRow t={t} label="− Cancellations" value={`−${peso(calc.cancellations)}`} />
          <BRow t={t} label="= Net revenue" value={peso(calc.netRevenue)} divider />
          <BRow t={t} label={`− Channel commission (${inputs.commissionRate}%)`} value={`−${peso(calc.commission)}`} />
          <BRow t={t} label={`− Payment processing (${inputs.processingRate}%)`} value={`−${peso(calc.processing)}`} />
          {inputs.cleaning > 0 && <BRow t={t} label="− Cleaning + supplies" value={`−${peso(inputs.cleaning)}`} />}
          {FIXED_FIELDS.map((f) =>
            inputs[f.key] > 0 ? (
              <BRow key={f.key} t={t} label={`− ${f.label}`} value={`−${peso(inputs[f.key])}`} />
            ) : null
          )}
          <BRow t={t} label="= NET PROFIT" value={peso(calc.netProfit)} divider bold accent={isProfit ? "good" : "bad"} />
        </div>
      )}

      {/* Reset Confirm Modal */}
      {showResetConfirm && (
        <div
          onClick={(e) => e.target === e.currentTarget && setShowResetConfirm(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(12,28,20,0.45)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            zIndex: 10200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div style={{
            background: "#fff",
            borderRadius: 20,
            padding: "28px 28px 24px",
            width: "100%",
            maxWidth: 360,
            boxShadow: "0 24px 64px rgba(12,28,20,0.22)",
            textAlign: "center",
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: "50%",
              background: "rgba(193,53,21,0.08)",
              display: "inline-flex", alignItems: "center",
              justifyContent: "center", marginBottom: 14,
            }}>
              <i className="ti ti-refresh" style={{ fontSize: 22, color: "#c13515" }} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: t.text, marginBottom: 8 }}>
              Reset all inputs?
            </div>
            <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 24, lineHeight: 1.5 }}>
              This will clear all your entered values and restore defaults.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setShowResetConfirm(false)}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: 10,
                  border: `1px solid ${t.card.border}`,
                  background: "transparent", fontSize: 13,
                  fontWeight: 600, color: t.textMuted, cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setInputs(DEFAULT_INPUTS);
                  setOverrides({ grossRevenue: false, nightsSold: false });
                  setShowResetConfirm(false);
                }}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: 10,
                  border: "none", background: "#c13515",
                  fontSize: 13, fontWeight: 700,
                  color: "#fff", cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={t.footer}>
        <button type="button" onClick={resetAll} style={t.resetBtn}>
          <i className="ti ti-refresh" style={{ fontSize: 13, marginRight: 5 }} aria-hidden="true" />
          Reset all
        </button>
        <div style={t.footerNote}>Saved in this browser only</div>
      </div>
    </div>
  );
}

function Field({ t, label, hint, icon, value, onChange, currency, disabled, showOverride, overrideActive, onToggleOverride }) {
  return (
    <div>
      <div style={t.fieldHeader}>
        <label style={t.fieldLabel}>
          {icon && <i className={`ti ${icon}`} style={t.fieldIcon} aria-hidden="true" />}
          {label}
        </label>
        {showOverride && (
          <button type="button" onClick={onToggleOverride} style={t.overrideBtn}>
            <i
              className={`ti ${overrideActive ? "ti-arrow-back-up" : "ti-edit"}`}
              style={{ fontSize: 11, marginRight: 3 }}
              aria-hidden="true"
            />
            {overrideActive ? "Use Smoobu" : "Override"}
          </button>
        )}
      </div>
      <div style={{ ...t.inputWrap, ...(disabled ? t.inputWrapDisabled : {}) }}>
        {currency && <span style={t.currency}>₱</span>}
        <input
          type="number"
          min="0"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
          disabled={disabled}
          style={{ ...t.input, ...(disabled ? t.inputDisabled : {}) }}
        />
      </div>
      {hint && <div style={t.fieldHint}>{hint}</div>}
    </div>
  );
}

function Slider({ t, label, value, min, max, step, unit, onChange }) {
  return (
    <div style={t.sliderRow}>
      <label style={t.sliderLabel}>{label}</label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={t.slider}
      />
      <span style={t.sliderValue}>{value}{unit}</span>
    </div>
  );
}

function Kpi({ t, label, sub, value, accent }) {
  const color =
    accent === "good" ? t.accent :
    accent === "bad"  ? t.danger :
                        t.text;
  return (
    <div style={t.kpiCard}>
      <div style={t.kpiLabel}>{label}</div>
      {sub && <div style={t.kpiSub}>{sub}</div>}
      <div style={{ ...t.kpiValue, color }}>{value}</div>
    </div>
  );
}

function BRow({ t, label, value, divider, bold, accent }) {
  const color =
    accent === "good" ? t.accent :
    accent === "bad"  ? t.danger :
                        t.text;
  return (
    <div style={{ ...t.breakRow, ...(divider ? t.breakRowDivider : {}), ...(bold ? t.breakRowBold : {}) }}>
      <span style={t.breakLabel}>{label}</span>
      <span style={{ ...t.breakValue, color, fontWeight: bold ? 600 : 500 }}>{value}</span>
    </div>
  );
}

function getTheme(dark) {
  const cardBg = dark ? "#0f1f17" : "#ffffff";
  const surface = dark ? "#13261d" : "#fafbfa";
  const border = dark ? "#1f3328" : "#ebf0ec";
  const text = dark ? "#eaf5f0" : "#0c1c14";
  const textMuted = dark ? "#9bb3a8" : "#6b7975";
  const textSubtle = dark ? "#7a9087" : "#9aa6a1";
  const accent = "#1e8760";
  const accentSoft = dark ? "rgba(30, 135, 96, 0.15)" : "rgba(30, 135, 96, 0.08)";
  const danger = "#c13515";
  const dangerSoft = dark ? "rgba(193, 53, 21, 0.15)" : "rgba(193, 53, 21, 0.08)";

  return {
    accent, danger, text, textMuted,

    card: {
      background: cardBg, border: `1px solid ${border}`,
      borderRadius: 16, padding: "clamp(16px, 4vw, 28px)",
      color: text, fontFamily: "inherit",
      maxHeight: "85vh",
      overflowY: "auto",
      overflowX: "hidden",
      WebkitOverflowScrolling: "touch",
      overscrollBehavior: "contain",
      width: "100%",
      boxSizing: "border-box",
    },
    header: {
      display: "flex", justifyContent: "space-between", alignItems: "flex-start",
      flexWrap: "wrap", gap: 16, marginBottom: 20,
    },
    titleRow: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
    title: { fontSize: 20, fontWeight: 600, letterSpacing: "-0.01em" },
    subtitle: { fontSize: 13, color: textMuted, marginTop: 4 },
    periodPill: {
      fontSize: 11, fontWeight: 500,
      background: accentSoft, color: accent,
      padding: "3px 9px", borderRadius: 999,
    },
    savedBadge: {
      display: "inline-flex", alignItems: "center",
      fontSize: 11, color: textMuted,
      background: surface, border: `1px solid ${border}`,
      padding: "4px 10px", borderRadius: 999,
    },
    divider: { height: 1, background: border, margin: "0 0 22px" },

    section: { marginBottom: 24 },
    sectionLabel: {
      display: "flex", alignItems: "center", gap: 8,
      fontSize: 13, fontWeight: 600, color: text,
      marginBottom: 14, letterSpacing: "-0.005em",
    },
    sectionIcon: { fontSize: 15, color: accent },
    sectionHint: { fontSize: 11, fontWeight: 400, color: textSubtle, marginLeft: 6 },

    grid2: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))",
      gap: 14,
    },
    grid3: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))",
      gap: 14,
    },
    costGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))",
      gap: 14,
    },

    fieldHeader: {
      display: "flex", justifyContent: "space-between", alignItems: "center",
      marginBottom: 6, gap: 8,
    },
    fieldLabel: {
      display: "flex", alignItems: "center",
      fontSize: 12, color: textMuted, fontWeight: 500,
    },
    fieldIcon: { fontSize: 13, color: textMuted, marginRight: 5 },
    fieldHint: { fontSize: 10, color: textSubtle, marginTop: 4, textTransform: "uppercase", letterSpacing: "0.04em" },

    overrideBtn: {
      display: "inline-flex", alignItems: "center",
      fontSize: 10, color: accent,
      background: "transparent", border: "none",
      padding: "2px 6px", borderRadius: 4,
      cursor: "pointer", fontWeight: 500,
      textTransform: "uppercase", letterSpacing: "0.04em",
    },

    inputWrap: {
      display: "flex", alignItems: "center",
      background: cardBg, border: `1px solid ${border}`,
      borderRadius: 8, padding: "0 12px",
      transition: "border-color 0.15s",
    },
    inputWrapDisabled: { background: surface, opacity: 0.85 },
    currency: { color: textMuted, fontSize: 14, marginRight: 6 },
    input: {
      flex: 1, border: "none", outline: "none",
      background: "transparent", color: text,
      fontSize: 14, padding: "10px 0", width: "100%",
      fontFamily: "inherit",
    },
    inputDisabled: { color: textMuted, cursor: "not-allowed" },

    sliderRow: {
      display: "grid",
      gridTemplateColumns: "minmax(140px, 1fr) 2fr auto",
      alignItems: "center", gap: 14,
      padding: "8px 0",
    },
    sliderLabel: { fontSize: 13, color: textMuted },
    slider: { width: "100%", accentColor: accent },
    sliderValue: {
      fontSize: 13, fontWeight: 600, color: text,
      minWidth: 44, textAlign: "right",
    },

    verdictGood: {
      display: "flex", alignItems: "center", gap: 14,
      background: accentSoft, color: accent,
      border: `1px solid ${dark ? "rgba(30,135,96,0.3)" : "rgba(30,135,96,0.18)"}`,
      borderRadius: 12, padding: "16px 18px",
      marginBottom: 16,
    },
    verdictBad: {
      display: "flex", alignItems: "center", gap: 14,
      background: dangerSoft, color: danger,
      border: `1px solid ${dark ? "rgba(193,53,21,0.3)" : "rgba(193,53,21,0.18)"}`,
      borderRadius: 12, padding: "16px 18px",
      marginBottom: 16,
    },
    verdictIcon: {
      width: 38, height: 38, borderRadius: 10,
      background: cardBg, display: "flex",
      alignItems: "center", justifyContent: "center",
      fontSize: 20, flexShrink: 0,
    },
    verdictTitle: { fontSize: 15, fontWeight: 600, letterSpacing: "-0.005em" },
    verdictBody: { fontSize: 13, opacity: 0.9, marginTop: 3 },

    kpiGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(min(150px, 100%), 1fr))",
      gap: 12, marginBottom: 8,
    },
    kpiCard: {
      background: surface, border: `1px solid ${border}`,
      borderRadius: 12, padding: "14px 16px",
    },
    kpiLabel: {
      fontSize: 11, color: textMuted,
      textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500,
    },
    kpiSub: { fontSize: 10, color: textSubtle, marginTop: 2 },
    kpiValue: {
      fontSize: 20, fontWeight: 600,
      marginTop: 6, letterSpacing: "-0.01em",
    },

    expandBtn: {
      display: "inline-flex", alignItems: "center",
      fontSize: 13, color: accent,
      background: "transparent", border: "none",
      padding: "12px 0", cursor: "pointer",
      fontWeight: 500,
    },

    breakdown: {
      padding: "16px 20px",
      background: surface, border: `1px solid ${border}`,
      borderRadius: 12, marginBottom: 8,
    },
    breakRow: {
      display: "flex", justifyContent: "space-between",
      padding: "6px 0", fontSize: 13,
    },
    breakRowDivider: { paddingTop: 10, marginTop: 4, borderTop: `1px solid ${border}` },
    breakRowBold: { fontSize: 15, paddingTop: 12, marginTop: 6 },
    breakLabel: { color: textMuted },
    breakValue: { color: text, fontWeight: 500 },

    footer: {
      display: "flex", justifyContent: "space-between", alignItems: "center",
      marginTop: 16, paddingTop: 16,
      borderTop: `1px solid ${border}`,
      gap: 12, flexWrap: "wrap",
    },
    resetBtn: {
      display: "inline-flex", alignItems: "center",
      fontSize: 12, color: textMuted,
      background: "transparent", border: `1px solid ${border}`,
      padding: "6px 11px", borderRadius: 8,
      cursor: "pointer", fontWeight: 500,
    },
    footerNote: { fontSize: 11, color: textSubtle },
  };
}