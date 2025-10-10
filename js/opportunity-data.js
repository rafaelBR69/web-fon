// /js/opportunity-data.js  (v2 con soporte de áreas y costes diferenciados)

// ========= Modelos de ejemplo (sustituye con tus cifras) =========
export const models = {
  // Ejemplo con TUS números de la imagen (ajústalos si hay matices)
  base: {
    currency: 'EUR',

    // ---- ÁREAS (nuevo) ----
    areas: {
      land_plot_m2: 121.45,
      landscape_m2: 23.31,

      // Totales por planta
      floor1_total_m2: 60.41,
      floor2_total_m2: 85.76,

      // Si conoces indoor/outdoor por planta, ponlos aquí:
      floor1_indoor_m2: 60.41,   // asunción: todo interior
      floor1_outdoor_m2: 0,

      floor2_indoor_m2: 39.72,
      floor2_outdoor_m2: 28.67
    },

    // (Opcional) desglose de estancias por si quieres mostrarlo luego
    breakdown: {
      floor1: [
        { name: 'Reception', m2: 12.82 },
        { name: 'Power House', m2: 8.75 },
        { name: 'Staff Room', m2: 10 },
        { name: 'Storage', m2: 10 }
      ]
    },

    // ---- COSTES DE CONSTRUCCIÓN (nuevo esquema) ----
    build: {
      // Si rellenas 'costs', se ignora el modo "legacy" de cost_per_m2 * built_m2
      costs: {
        indoor_per_m2_eur:    900,  // ejemplo
        outdoor_per_m2_eur:   450,  // decks/porches/terrazas
        landscape_per_m2_eur:  60   // ajardinamiento
      },
      contingency_pct: 0.10,
      // Si NO quisieras el modo áreas, puedes seguir usando:
      // built_m2: 220, cost_per_m2_eur: 750
    },

    ffe: { amount_eur: 25000 },       // mobiliario/equipamiento
    soft_costs_pct: 0.08,             // técnicos/PM sobre obra
    taxes_fees_eur: 10000,            // licencias/tasas

    // ---- Ingresos/Operación ----
    adr_eur: 230,
    occ: 0.68,
    nights: 365,

    ota_pct: 0.12,
    mgmt_pct: 0.20,
    variable_opex_pct: 0.08,
    fixed_opex_year_eur: 18000,

    // ---- Deuda / Salida ----
    debt: { ltv: 0.50, rate: 0.075, amort_years: 20 },
    exit: { exit_cap: 0.08, selling_costs_pct: 0.03 },
    horizon_years: 10
  },

  // Variante “cluster ~8 villas” (mejoras por escala)
  scaled8: {
    currency: 'EUR',
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
    build: {
      costs: {
        indoor_per_m2_eur:    920,  // quizá mejores calidades/eficiencia
        outdoor_per_m2_eur:   460,
        landscape_per_m2_eur:  60
      },
      contingency_pct: 0.10
    },
    ffe: { amount_eur: 24000 }, // compras a volumen
    soft_costs_pct: 0.08,
    taxes_fees_eur: 10000,

    adr_eur: 260,
    occ: 0.75,
    nights: 365,

    ota_pct: 0.12,
    mgmt_pct: 0.18,
    variable_opex_pct: 0.08,
    fixed_opex_year_eur: 12000,

    debt: { ltv: 0.55, rate: 0.072, amort_years: 20 },
    exit: { exit_cap: 0.075, selling_costs_pct: 0.03 },
    horizon_years: 10
  }
};

// ========= Utils =========
function formatCurrency(v, c) {
  try {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: c || 'EUR', maximumFractionDigits: 0 }).format(v);
  } catch { return `${(v||0).toFixed(0)} ${c||'EUR'}`; }
}
const pct = v => `${(v*100).toFixed(1)}%`;

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

// ========= Derivados de ÁREAS =========
function areaDerived(areas){
  areas = areas || {};
  const f1i = +areas.floor1_indoor_m2 || 0;
  const f1o = +areas.floor1_outdoor_m2 || 0;
  const f2i = +areas.floor2_indoor_m2 || 0;
  const f2o = +areas.floor2_outdoor_m2 || 0;

  const indoor_m2  = f1i + f2i;
  const outdoor_m2 = f1o + f2o;
  // Si no tienes indoor/outdoor por planta, usa los “total” como indoor por defecto
  const fallbackGFA = (areas.floor1_total_m2||0) + (areas.floor2_total_m2||0);
  const gfa_m2 = (indoor_m2 + outdoor_m2) || fallbackGFA;

  const land = +areas.land_plot_m2 || 0;
  const far = land > 0 ? (gfa_m2 / land) : 0;
  const coverage = land > 0 ? ((areas.floor1_total_m2||0) / land) : 0; // cobertura ≈ huella planta baja
  const efficiency = gfa_m2 > 0 ? (indoor_m2 / gfa_m2) : 0;

  return { land_plot_m2: land, landscape_m2: (+areas.landscape_m2||0),
           indoor_m2, outdoor_m2, gfa_m2, far, coverage, efficiency };
}

// ========= Costes de construcción =========
function buildCostFromModel(model, ad){
  const b = model.build || {};
  // Modo áreas (preferente si hay 'costs')
  if (b.costs){
    const indoor    = ad.indoor_m2  * (b.costs.indoor_per_m2_eur    || 0);
    const outdoor   = ad.outdoor_m2 * (b.costs.outdoor_per_m2_eur   || 0);
    const landscape = ad.landscape_m2 * (b.costs.landscape_per_m2_eur || 0);
    const direct    = indoor + outdoor + landscape;
    const soft      = direct * (model.soft_costs_pct || 0);
    const cont      = direct * (b.contingency_pct || 0);
    return { direct, soft, contingency: cont, total: direct + soft + cont };
  }
  // Modo legacy (compatibilidad)
  const built_m2 = b.built_m2 || ad.gfa_m2 || 0;
  const direct   = built_m2 * (b.cost_per_m2_eur || 0);
  const soft     = direct * (model.soft_costs_pct || 0);
  const cont     = direct * (b.contingency_pct || 0);
  return { direct, soft, contingency: cont, total: direct + soft + cont };
}

// ========= Cálculo financiero principal =========
function compute(model){
  model = model || models.base;

  const ad = areaDerived(model.areas || {});
  const b  = buildCostFromModel(model, ad);

  const landCost   = (ad.land_plot_m2 || 0) * ((model.land && model.land.price_per_m2_eur) || 0);
  const landCosts  = landCost * ((model.land && model.land.purchase_costs_pct) || 0);
  const ffe        = (model.ffe && model.ffe.amount_eur) || 0;
  const taxesFees  = model.taxes_fees_eur || 0;

  const totalInvestment = landCost + landCosts + b.total + ffe + taxesFees;

  // Ingresos
  const gross    = (model.adr_eur || 0) * (model.occ || 0) * (model.nights || 0);
  const ota      = gross * (model.ota_pct || 0);
  const mgmt     = gross * (model.mgmt_pct || 0);
  const varOpex  = gross * (model.variable_opex_pct || 0);
  const opex     = ota + mgmt + varOpex + (model.fixed_opex_year_eur || 0);

  const NOI = gross - opex;

  // Deuda
  const debt  = model.debt || {};
  const loan  = totalInvestment * (debt.ltv || 0);
  const equity = totalInvestment - loan;
  const ads   = annualDebtPayment(loan, (debt.rate || 0), (debt.amort_years || 0));
  const cfb   = NOI - ads;

  // KPIs
  const capRate = totalInvestment > 0 ? (NOI / totalInvestment) : 0;
  const coc     = equity > 0 ? (cfb / equity) : 0;
  const payback = (cfb > 0 && equity > 0) ? (equity / cfb) : Infinity;

  // Salida
  const ex = model.exit || {};
  const exitCap = ex.exit_cap || 0.08;
  const exitValue = exitCap > 0 ? (NOI / exitCap) : 0;
  const sellingCosts = exitValue * (ex.selling_costs_pct || 0.03);
  const loanOut = loanBalanceAfterYears(loan, (debt.rate || 0), (debt.amort_years || 0), (model.horizon_years || 0));
  const netSale = exitValue - sellingCosts - loanOut;

  const years = Math.max(1, model.horizon_years || 10);
  const cf = [-equity];
  for (let y=1; y<=years; y++){
    cf.push(cfb + (y===years ? netSale : 0));
  }
  const irr = xirr(cf);

  return {
    // financieros
    totalInvestment, gross, NOI, equity, ads, cfb, capRate, coc, payback, irr,
    // construcción/terreno
    landCost, landCosts,
    build: b, ffe, taxesFees,
    // áreas derivadas
    areas: ad,
    currency: model.currency || 'EUR'
  };
}

// ========= Pintado DOM (KPIs + métricas de área si existen) =========
export function populateOpportunity(rootSel='#oportunity', model=models.base){
  const root = document.querySelector(rootSel);
  if (!root) return;

  const r = compute(model);
  const q = sel => root.querySelector(sel);
  const setKpi = (key, text) => { const el = root.querySelector('[data-kpi="'+key+'"]'); if (el) el.textContent = text; };

  // KPIs
  setKpi('cap-rate', pct(r.capRate));
  setKpi('coc',      pct(r.coc));
  setKpi('payback',  (r.payback===Infinity ? '—' : (r.payback.toFixed(1) + ' años')));
  setKpi('irr',      pct(r.irr));

  // Nota resumen
  const note = q('.opty__note');
  if (note){
    note.innerHTML =
      'Inversión total estimada: <b>' + formatCurrency(r.totalInvestment, r.currency) + '</b> · ' +
      'Ingresos brutos: <b>'         + formatCurrency(r.gross,          r.currency) + '</b> · ' +
      'NOI: <b>'                     + formatCurrency(r.NOI,            r.currency) + '</b> · ' +
      'Equity: <b>'                  + formatCurrency(r.equity,         r.currency) + '</b>';
  }

  // ---- (Opcional) Métricas de área si tienes placeholders en HTML ----
  function setArea(key, val, unit='m²'){
    const el = root.querySelector('[data-area="'+key+'"]');
    if (el) el.textContent = (val==null ? '—' : (val.toFixed ? val.toFixed(2) : val)) + (unit ? ' ' + unit : '');
  }
  function setMetric(key, val){
    const el = root.querySelector('[data-metric="'+key+'"]');
    if (!el) return;
    if (key === 'efficiency')      el.textContent = pct(val);
    else if (key === 'coverage')   el.textContent = pct(val);
    else if (key === 'far')        el.textContent = val.toFixed(2);
  }

  setArea('land-plot',  r.areas.land_plot_m2);
  setArea('landscape',  r.areas.landscape_m2);
  setArea('indoor',     r.areas.indoor_m2);
  setArea('outdoor',    r.areas.outdoor_m2);
  setArea('gfa',        r.areas.gfa_m2, 'm² GFA');

  setMetric('far',       r.areas.far);
  setMetric('coverage',  r.areas.coverage);
  setMetric('efficiency',r.areas.efficiency);

  // (Opcional) también puedes mostrar costes de obra:
  const bc = root.querySelector('[data-build-total]');
  if (bc) bc.textContent = formatCurrency(r.build.total, r.currency);
}
