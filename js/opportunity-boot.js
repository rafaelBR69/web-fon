// /js/opportunity-boot.js
import { models, populateOpportunityAdvanced } from './opportunity-data.js';

// Espera a que exista #oportunity en el DOM
function waitFor(selector, { timeout=10000, interval=100 } = {}){
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const tick = () => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);
      if (Date.now() - t0 > timeout) return reject(new Error('Timeout esperando ' + selector));
      setTimeout(tick, interval);
    };
    tick();
  });
}

(async () => {
  try {
    await waitFor('#oportunity');

    // Defaults del módulo de inversión
    let state = {
      units: 1,                 // 1..9
      unitPriceEUR: 100000,     // Precio fijo por unidad
      scenario: 'base'          // 'conservador' | 'base' | 'optimista'
    };

    // Pintado inicial
    const render = () => {
      populateOpportunityAdvanced('#oportunity', models.scaled8, state);
    };
    render();

    // Si el HTML incluye un <select data-units>, lo conectamos
    const selUnits = document.querySelector('[data-units]');
    if (selUnits){
      selUnits.addEventListener('change', () => {
        const n = parseInt(selUnits.value, 10);
        state.units = isFinite(n) ? Math.max(1, Math.min(9, n)) : 1;
        render();
      });
    }

    // Si el HTML incluye un <select data-scenario>, lo conectamos
    const selScn = document.querySelector('[data-scenario]');
    if (selScn){
      selScn.addEventListener('change', () => {
        const v = (selScn.value || 'base').toLowerCase();
        state.scenario = ['conservador','base','optimista'].includes(v) ? v : 'base';
        render();
      });
    }

    // (Opcional) Si más adelante quieres permitir editar el precio/unidad
    const inpPrice = document.querySelector('[data-unit-price]');
    if (inpPrice){
      const toNum = (s) => Number(String(s).replace(/[^\d.,-]/g,'').replace('.', '').replace(',', '.'));
      inpPrice.addEventListener('change', () => {
        const v = toNum(inpPrice.value);
        state.unitPriceEUR = isFinite(v) && v > 0 ? v : 100000;
        render();
      });
    }

  } catch (e) {
    console.warn('[opportunity-boot] No se pudo inicializar:', e.message);
  }
})();
