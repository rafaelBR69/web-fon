// /js/opportunity-boot.js
import { models, populateOpportunity } from './opportunity-data.js';

// Espera a que exista #oportunity en el DOM (inyectado por loadPartial)
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
    // Elige el modelo que prefieras:
    // populateOpportunity('#oportunity', models.base);   // 1 villa
    populateOpportunity('#oportunity', models.scaled8);  // cluster ~8 villas
  } catch (e) {
    console.warn('[opportunity-boot] No se pudo inicializar:', e.message);
  }
})();
