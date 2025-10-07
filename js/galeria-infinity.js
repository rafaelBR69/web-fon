/* ========= GALERÍA INFINITY – inicializador sin jQuery ========= */

export function initGaleriaInfinity(host = document) {
  const root = host.querySelector('#galeria-infinity');
  if (!root) return;

  const items = Array.from(root.querySelectorAll('.gi-item'));
  const prevBtn = root.querySelector('.gi-prev');
  const nextBtn = root.querySelector('.gi-next');

  let idx = Math.max(0, items.findIndex(el => el.classList.contains('is-active')));
  if (idx === -1) idx = 0;
  activate(idx, { focus: false });

  // Click/teclado en tarjetas
  items.forEach((el, i) => {
    el.addEventListener('click', () => activate(i, { scroll: true }));
    el.addEventListener('keydown', (ev) => {
      // Enter/Space abren
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        activate(i, { scroll: true, focus: false });
      }
      // Flechas mueven selección
      if (ev.key === 'ArrowRight') { ev.preventDefault(); activate(clamp(i + 1), { scroll: true }); }
      if (ev.key === 'ArrowLeft')  { ev.preventDefault(); activate(clamp(i - 1), { scroll: true }); }
    });
  });

  // Botones
  prevBtn?.addEventListener('click', () => activate(clamp(idx - 1), { scroll: true }));
  nextBtn?.addEventListener('click', () => activate(clamp(idx + 1), { scroll: true }));

  // Helpers
  function clamp(i) { return Math.max(0, Math.min(items.length - 1, i)); }

  function activate(i, opts = {}) {
    const { focus = true, scroll = false } = opts;

    items.forEach((el, k) => {
      const active = k === i;
      el.classList.toggle('is-active', active);
      el.setAttribute('aria-selected', active ? 'true' : 'false');
      if (active && focus) el.focus({ preventScroll: true });
    });

    idx = i;

    if (scroll) {
      // Scroll suave hacia el activo en móviles
      items[i].scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    }
  }
}

// Auto-init si cargas como script (sin bundler)
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    try { initGaleriaInfinity(document); } catch (e) { console.warn('[galeria-infinity] init error', e); }
  });
}
