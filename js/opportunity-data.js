// /js/opportunity-data.js  (v4.1: precio fijo por unidad, presets realistas y explicación)
// Nota: gestión calculada sobre NET si mgmt_on_net === true

// ========= MODELOS (legacy: se mantienen por compatibilidad, pero NO se usan para inversión) =========
export const models = {
  base: {
    currency: 'EUR',
    // Áreas (no influyen en cálculo comercial)
    areas: {
      land_plot_m2: 121.45,
      landscape_m2: 23.31,
      floor1_total_m2: 60.41,
      floor2_total_m2: 85.76,
      floor1_indoor_m2: 60.41,
      floor1_outdoor_m2: 0,
      floor2_indoor_m2: 39.72,
      floor2_outdoor_m2: 28.67
    },
    // Campos internos (no se usan en el cálculo comercial de esta página)
    build: { costs: { indoor_per_m2_eur: 0, outdoor_per_m2_eur: 0, landscape_per_m2_eur: 0 }, contingency_pct: 0 },
    ffe: { amount_eur: 0 },
    soft_costs_pct: 0,
    taxes_fees_eur: 0,

    // Defaults “placeholder”; serán sobreescritos con presets
    adr_eur: 175,
    occ: 0.59,
    nights: 365,
    ota_pct: 0.15,
    mgmt_pct: 0.18,
    variable_opex_pct: 0.08,
    fixed_opex_year_eur: 12000,

    debt: { ltv: 0.55, rate: 0.072, amort_years: 20 },
    exit: { exit_cap: 0.08, selling_costs_pct: 0.03 },
    horizon_years: 10
  },
  scaled8: {} // compat con tu boot; usaremos base + presets igualmente
};

// ========= PRESETS ABSOLUTOS (lo que verá el cliente) =========
// Ajustados a rangos realistas de Lombok (2024–2025 aprox.)
export const presets = {
  conservador: {
    adr_eur: 160,  occ: 0.50, nights: 365,
    ota_pct: 0.14,
    mgmt_pct: 0.18, mgmt_on_net: true,       // gestión sobre NET (GROSS - OTA)
    variable_opex_pct: 0.08,
    fixed_opex_year_eur: 9000,
    debt: { ltv: 0.55, rate: 0.072, amort_years: 20 },
    exit: { exit_cap: 0.08, selling_costs_pct: 0.03 }
  },
  base: {
    adr_eur: 170,  occ: 0.55, nights: 365,
    ota_pct: 0.14,
    mgmt_pct: 0.18, mgmt_on_net: true,
    variable_opex_pct: 0.08,
    fixed_opex_year_eur: 7500,
    debt: { ltv: 0.55, rate: 0.072, amort_years: 20 },
    exit: { exit_cap: 0.08, selling_costs_pct: 0.03 }
  },
  optimista: {
    adr_eur: 200,  occ: 0.65, nights: 365,
    ota_pct: 0.14,
    mgmt_pct: 0.18, mgmt_on_net: true,
    variable_opex_pct: 0.08,
    fixed_opex_year_eur: 7000,
    debt: { ltv: 0.55, rate: 0.072, amort_years: 20 },
    exit: { exit_cap: 0.08, selling_costs_pct: 0.03 }
  }
};

// (legacy) Multiplicadores antiguos: se mantienen por compatibilidad, no usados aquí
export const scenarios = {
  conservador: { adr_mult: 0.90, occ_mult: 0.85, fixed_opex_mult: 1.05 },
  base:        { adr_mult: 1.00, occ_mult: 1.00, fixed_opex_mult: 1.00 },
  optimista:   { adr_mult: 1.10, occ_mult: 0.92, fixed_opex_mult: 0.95 }
};

// ========= Utils =========
export function formatCurrency(v, c) {
  try {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: c || 'EUR', maximumFractionDigits: 0 }).format(v);
  } catch { return `${(v||0).toFixed(0)} ${c||'EUR'}`; }
}
const clamp = (v,min,max)=>Math.min(max,Math.max(min,v));
const pctFmt = v => `${(v*100).toFixed(1)}%`;

function annualDebtPayment(P, r, n){
  if (!P || !r || !n) return 0;
  const d = 1 - Math.pow(1+r, -n);
  if (!d) return 0;
  return P * (r / d);
}
function loanBalanceAfterYears(P, r, n, y){
  if (!P || !r || !n) return 0;
  const A = annualDebtPayment(P, r, n);
  let bal = P, years = Math.max(0, Math.min(y||0, n));
  for (let i=0; i<years; i++){
    const interest = bal * r;
    bal = Math.max(0, bal - (A - interest));
  }
  return bal;
}
function xirr(cashflows){
  let r = 0.12;
  for (let i=0;i<100;i++){
    let f=0, df=0;
    for (let t=0; t<cashflows.length; t++){
      const v = cashflows[t], d = Math.pow(1+r,t);
      f  += v/d;
      df -= (t*v)/Math.pow(1+r,t+1);
    }
    const nr = r - f/df;
    if (!isFinite(nr)) break;
    if (Math.abs(nr - r) < 1e-6) { r = nr; break; }
    r = nr;
  }
  return r;
}

// ========= Carga preset sobre el modelo base (sin tocar áreas/obra) =========
function applyPreset(model, presetKey='base'){
  const m0 = model || models.base;
  const p = presets[presetKey] || presets.base;
  const m = JSON.parse(JSON.stringify(m0));
  // Ingresos / OPEX
  m.adr_eur = p.adr_eur;
  m.occ = clamp(p.occ, 0, 1);
  m.nights = p.nights ?? 365;
  m.ota_pct = p.ota_pct;
  m.mgmt_pct = p.mgmt_pct;
  m.mgmt_on_net = !!p.mgmt_on_net;           // <<<<<<
  m.variable_opex_pct = p.variable_opex_pct;
  m.fixed_opex_year_eur = p.fixed_opex_year_eur;
  // Deuda / salida
  m.debt = { ...(m.debt||{}), ...(p.debt||{}) };
  m.exit = { ...(m.exit||{}), ...(p.exit||{}) };
  // Horizonte / moneda
  m.horizon_years = m.horizon_years || 10;
  m.currency = m.currency || 'EUR';
  return m;
}

// ========= Cálculo “por unidad” (sin usar costes de obra) =========
function computePerUnit(m){
  const gross = (m.adr_eur || 0) * (m.occ || 0) * (m.nights || 0);
  const ota   = gross * (m.ota_pct || 0);
  const mgmtBase = (m.mgmt_on_net ? (gross - ota) : gross); // <<<<<< gestión sobre NET opcional
  const mgmt  = mgmtBase * (m.mgmt_pct || 0);
  const varOx = gross * (m.variable_opex_pct || 0);
  const opex  = ota + mgmt + varOx + (m.fixed_opex_year_eur || 0);
  const NOI   = gross - opex;
  return { gross, ota, mgmtBase, mgmt, varOx, opex, NOI };
}

// ========= Cálculo financiero principal basado en precio fijo por unidad =========
function recomputeFromUnitPrice(m, unitPriceEUR){
  const per = computePerUnit(m);

  // Deuda y flujo
  const inv    = Math.max(0, unitPriceEUR || 0);
  const loan   = inv * (m.debt?.ltv || 0);
  const equity = inv - loan;
  const ads    = annualDebtPayment(loan, (m.debt?.rate || 0), (m.debt?.amort_years || 0));
  const cfb    = per.NOI - ads;

  // KPIs por unidad
  const capRate = inv > 0 ? (per.NOI / inv) : 0;
  const coc     = equity > 0 ? (cfb / equity) : 0;
  const payback = (cfb > 0 && equity > 0) ? (equity / cfb) : Infinity;

  // Salida (venta a cap sobre NOI)
  const exitCap = m.exit?.exit_cap || 0.08;
  const exitValue = exitCap > 0 ? (per.NOI / exitCap) : 0;
  const sellingCosts = exitValue * (m.exit?.selling_costs_pct || 0.03);
  const loanOut = loanBalanceAfterYears(loan, (m.debt?.rate || 0), (m.debt?.amort_years || 0), (m.horizon_years || 10));
  const netSale = exitValue - sellingCosts - loanOut;

  // IRR
  const years = Math.max(1, m.horizon_years || 10);
  const cf = [-equity];
  for (let y=1; y<=years; y++){
    cf.push(cfb + (y===years ? netSale : 0));
  }
  const irr = xirr(cf);

  return {
    inv, loan, equity, ads, cfb,
    perNOI: per.NOI,
    capRate, coc, payback, irr,
    _per: per
  };
}

// ========= API pública: cálculo por N unidades =========
export function computeUnits(model, {
  units = 1,
  unitPriceEUR = 100000,
  scenario = 'base'
} = {}){
  const u = clamp(Math.round(units||1), 1, 999);
  // Cargamos preset absoluto sobre el modelo base
  const m = applyPreset(model || models.base, scenario);

  // Por unidad con precio fijo
  const k = recomputeFromUnitPrice(m, unitPriceEUR);

  // Totales
  const investment = k.inv   * u;
  const equity     = k.equity* u;
  const loan       = k.loan  * u;
  const NOI        = k.perNOI* u;
  const ads        = k.ads   * u;
  const cfb        = k.cfb   * u;

  // KPIs totales
  const capRate = investment > 0 ? (NOI / investment) : 0;
  const coc     = equity > 0 ? (cfb / equity) : 0;
  const payback = (cfb > 0 && equity > 0) ? (equity / cfb) : Infinity;

  // IRR total
  const years = m.horizon_years || 10;
  const cf = [-equity];
  for (let y=1; y<=years; y++){
    const exitCap = m.exit?.exit_cap || 0.08;
    const exitValuePer = exitCap > 0 ? (k.perNOI / exitCap) : 0;
    const sellingCostsPer = exitValuePer * (m.exit?.selling_costs_pct || 0.03);
    const loanOutPer = loanBalanceAfterYears(k.loan, (m.debt?.rate || 0), (m.debt?.amort_years || 0), y);
    const netSalePer = exitValuePer - sellingCostsPer - loanOutPer;

    const cfy = (k.perNOI - k.ads) * u + (y===years ? netSalePer * u : 0);
    cf.push(cfy);
  }
  const irr = xirr(cf);

  return {
    scenario,
    units: u,
    currency: m.currency || 'EUR',
    totals: { investment, equity, loan, NOI, ads, cfb },
    kpis: { capRate, coc, payback, irr },
    perUnit: {
      investment: k.inv, equity: k.equity, loan: k.loan, NOI: k.perNOI, ads: k.ads,
      capRate: k.capRate, coc: k.coc, payback: k.payback, irr: k.irr
    },
    assumptions: {
      adr_eur: m.adr_eur, occ: m.occ, nights: m.nights,
      ota_pct: m.ota_pct, mgmt_pct: m.mgmt_pct, mgmt_on_net: !!m.mgmt_on_net,
      variable_opex_pct: m.variable_opex_pct, fixed_opex_year_eur: m.fixed_opex_year_eur,
      debt: { ...m.debt }, exit: { ...m.exit }, horizon_years: m.horizon_years
    }
  };
}

// ========= Azúcar: 3 escenarios a la vez =========
export function computeScenarios(model, { units=1, unitPriceEUR=100000 } = {}){
  const keys = ['conservador','base','optimista'];
  const out = {};
  for (const k of keys){
    out[k] = computeUnits(model, { units, unitPriceEUR, scenario: k });
  }
  return out;
}

// ========= “Cómo calculamos” — explicación paso a paso (per-unit) =========
export function buildPerUnitExplanation(model, { unitPriceEUR=100000, scenario='base' } = {}){
  const m = applyPreset(model || models.base, scenario);
  const per = computePerUnit(m);
  const loan = unitPriceEUR * (m.debt?.ltv || 0);
  const equity = unitPriceEUR - loan;
  const ads = annualDebtPayment(loan, (m.debt?.rate || 0), (m.debt?.amort_years || 0));
  const cf = per.NOI - ads;
  const payback = (cf > 0 && equity > 0) ? (equity / cf) : Infinity;
  const cap = unitPriceEUR > 0 ? (per.NOI / unitPriceEUR) : 0;
  const coc = equity > 0 ? (cf / equity) : 0;

  return {
    scenario,
    unitPriceEUR,
    steps: [
      { label: 'Ingresos brutos (GROSS)',      formula: 'ADR × Ocupación × Noches', value: per.gross,      key:'gross' },
      { label: 'Comisión OTA',                 formula: 'GROSS × OTA%',             value: per.ota,        key:'ota' },
      { label: 'Gestión',
        formula: (m.mgmt_on_net ? 'NET (GROSS − OTA) × Gestión%' : 'GROSS × Gestión%'),
        value: per.mgmt, key:'mgmt' },
      { label: 'Variables',                    formula: 'GROSS × Variables%',       value: per.varOx,      key:'var' },
      { label: 'Fijos anuales',                formula: 'Fijos',                     value: m.fixed_opex_year_eur, key:'fixed' },
      { label: 'OPEX total',                   formula: 'OTA + Gestión + Var + Fijos', value: per.opex,    key:'opex' },
      { label: 'NOI',                          formula: 'GROSS − OPEX',             value: per.NOI,        key:'noi' },
      { label: 'Préstamo',                     formula: 'Precio × LTV',             value: loan,           key:'loan' },
      { label: 'Equity',                       formula: 'Precio − Préstamo',        value: equity,         key:'equity' },
      { label: 'Cuota anual (ADS)',            formula: 'Amortización francesa',    value: ads,            key:'ads' },
      { label: 'Flujo anual (CF)',             formula: 'NOI − ADS',                value: cf,             key:'cf' },
      { label: 'Payback',                      formula: 'Equity / CF',              value: payback,        key:'payback', fmt:'years' },
      { label: 'Cap rate',                     formula: 'NOI / Precio',             value: cap,            key:'cap',    fmt:'pct' },
      { label: 'Cash-on-Cash',                 formula: 'CF / Equity',              value: coc,            key:'coc',    fmt:'pct' }
    ],
    assumptions: {
      adr_eur: m.adr_eur, occ: m.occ, nights: m.nights,
      ota_pct: m.ota_pct, mgmt_pct: m.mgmt_pct, mgmt_on_net: !!m.mgmt_on_net,
      variable_opex_pct: m.variable_opex_pct, fixed_opex_year_eur: m.fixed_opex_year_eur,
      debt: { ...m.debt }, exit: { ...m.exit }, horizon_years: m.horizon_years,
      currency: m.currency || 'EUR'
    }
  };
}

// Render opcional (pinta una tarjetita si existe [data-explain] dentro de #oportunity)
export function renderExplanation(rootSel='#oportunity', expl){
  const root = document.querySelector(rootSel);
  if (!root) return;
  const host = root.querySelector('[data-explain]');
  if (!host) return;

  const cur = expl.assumptions.currency || 'EUR';
  const F = (v) => formatCurrency(v, cur);

  const rows = expl.steps.map(s=>{
    let val = s.value;
    if (s.fmt === 'pct') val = pctFmt(val);
    else if (s.fmt === 'years') val = (val===Infinity ? '—' : `${val.toFixed(2)} años`);
    else val = F(val);
    return `
      <li class="opty__how-row">
        <div class="opty__how-col opty__how-col--what"><b>${s.label}</b><br><small class="opty__muted">${s.formula}</small></div>
        <div class="opty__how-col opty__how-col--val">${val}</div>
      </li>`;
  }).join('');

  host.innerHTML = `
    <article class="opty__card">
      <h4 class="opty__card-title">Cómo calculamos</h4>
      <ul class="opty__list opty__how-list">${rows}</ul>
      <p class="opty__muted" style="margin-top:8px;">
        Supuestos — ADR: <b>${formatCurrency(expl.assumptions.adr_eur, cur)}</b>,
        Ocupación: <b>${pctFmt(expl.assumptions.occ)}</b>, OTA: <b>${pctFmt(expl.assumptions.ota_pct)}</b>,
        Gestión: <b>${pctFmt(expl.assumptions.mgmt_pct)}</b>${expl.assumptions.mgmt_on_net ? ' (sobre NET)' : ''},
        Variables: <b>${pctFmt(expl.assumptions.variable_opex_pct)}</b>,
        Fijos: <b>${formatCurrency(expl.assumptions.fixed_opex_year_eur, cur)}</b>, LTV: <b>${pctFmt(expl.assumptions.debt.ltv||0)}</b>.
      </p>
      <p class="opty__muted" style="font-size:.95em">Cálculos orientativos, antes de impuestos y sujetos a estacionalidad y condiciones reales de operación.</p>
    </article>`;
}

// ========= Pintado DOM (KPIs + explicación si hay host) =========
export function populateOpportunity(rootSel='#oportunity', model=models.base){
  return populateOpportunityAdvanced(rootSel, model, {});
}

export function populateOpportunityAdvanced(rootSel='#oportunity', model=models.base, {
  units = 1,
  unitPriceEUR = 100000,
  scenario = 'base'
} = {}){
  const root = document.querySelector(rootSel);
  if (!root) return;

  const r = computeUnits(model, { units, unitPriceEUR, scenario });

  const setKpi = (key, text) => {
    const el = root.querySelector('[data-kpi="'+key+'"]');
    if (el) el.textContent = text;
  };

  // KPIs (agregados por N unidades)
  setKpi('cap-rate', pctFmt(r.kpis.capRate));
  setKpi('coc',      pctFmt(r.kpis.coc));
  setKpi('payback',  (r.kpis.payback===Infinity ? '—' : (r.kpis.payback.toFixed(1) + ' años')));
  setKpi('irr',      pctFmt(r.kpis.irr));

  // Nota resumen (totales)
  const note = root.querySelector('.opty__note');
  if (note){
    note.innerHTML =
      `Unidades: <b>${r.units}</b> · ` +
      `Precio/unidad: <b>${formatCurrency(unitPriceEUR, r.currency)}</b> · ` +
      `Inversión total: <b>${formatCurrency(r.totals.investment, r.currency)}</b> · ` +
      `NOI total: <b>${formatCurrency(r.totals.NOI, r.currency)}</b> · ` +
      `Equity total: <b>${formatCurrency(r.totals.equity, r.currency)}</b>`;
  }

  // Explicación (per-unit) si el HTML incluye [data-explain]
  const expl = buildPerUnitExplanation(model, { unitPriceEUR, scenario });
  renderExplanation(rootSel, expl);
}
