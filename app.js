/* ──────────────────────────────
   1. Menú hamburguesa
──────────────────────────────── */
function toggleNav () {
  const navLinks = document.getElementById('navLinks');
  navLinks.classList.toggle('active');
  navLinks.style.color = 'white';
}

/* ──────────────────────────────
   2. Animaciones “reveal” al hacer scroll
──────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const io = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          obs.unobserve(entry.target);      // quita si quieres repetir
        }
      });
    },
    { threshold: 0.3 }                      // 30 % visible
  );
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));
});

/* ──────────────────────────────
   3. Pop‑up  (formulario → Google Sheets)
──────────────────────────────── */

/* Configuración */
const TIME_DELAY = 19_000;     // 19 s

/* Referencias DOM (pueden NO existir en algunas páginas) */
const modal        = document.getElementById('infoModal');
const overlay      = document.getElementById('modalOverlay');
const btnClose     = document.getElementById('modalClose');
const leadForm     = document.getElementById('leadForm');

const thankModal   = document.getElementById('thankModal');
const thankOverlay = document.getElementById('thankOverlay');
const thankClose   = document.getElementById('thankClose');
const thankOk      = document.getElementById('thankOk');
const CANVAS_SIZE = 1024;

/* Helper ─ añade listener sólo si el nodo existe */
const on = (el, evt, fn) => el && el.addEventListener(evt, fn);

/* Helpers pop‑up */
const openModal  = () => modal      && modal.classList.add('show');
const closeModal = () => modal      && modal.classList.remove('show');
const openThank  = () => thankModal && thankModal.classList.add('show');
const closeThank = () => thankModal && thankModal.classList.remove('show');

/* Cerrar modales */
on(btnClose   , 'click', closeModal);
on(overlay    , 'click', closeModal);
on(thankClose , 'click', closeThank);
on(thankOk    , 'click', closeThank);
on(thankOverlay,'click', closeThank);

/* Apertura automática SOLO por tiempo */
if (modal) {
  setTimeout(openModal, TIME_DELAY);
}

/* ==== Envío a Google Sheets para TODOS los formularios data‑lead ==== */
document.querySelectorAll('form[data-lead]').forEach(form => {
  form.addEventListener('submit', async e => {
    e.preventDefault();

    /* ➊ Recogemos campos + honeypot ---------------------------------- */
    const fd = new FormData(form);

    /* Honeypot: si el campo invisible “website” NO está vacío ⇒ bot */
    if (fd.get('website')?.trim()) {           // 👈
      console.warn('[Spam‑bot] envío bloqueado'); // 👈
      return;                                  // 👈  abortamos envío
    }
    fd.delete('website');                      // 👈  ya no lo necesitamos

    const data = Object.fromEntries(fd.entries());

    /* ➋ Fuente de la solicitud (para la hoja) */
    data.origin = form.dataset.origin || 'Formulario Web';

    try {
      /* cierra pop‑up o muestra gracias, si existen */
      if (typeof closeModal === 'function') closeModal();
      if (typeof openThank  === 'function') openThank();

      /* ➌ Envío sin CORS a Google Sheets */
      await fetch(
        'https://script.google.com/macros/s/AKfycbxlBgB28gJM1LyutP76PLlsJy9dWhuZTgwFwT3fYZrEH4CBZu0UQ8peW3hkz8Nnsukjqw/exec',
        { method: 'POST', mode: 'no-cors', body: JSON.stringify(data) }
      );

      form.reset();          // limpia el formulario
    } catch (err) {
      console.error(err);
      alert('Ups, no se pudo enviar. Inténtalo de nuevo.');
    }
  });
});
  /* ---------- Orquestación de la promo ---------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  const startPromo = () => {
    buildPromoList();        // crea el <ul> con los “0”
    observePromoCounters();  // espera al 10 % de visibilidad y anima
  };

  if (i18next.isInitialized) {
    startPromo();            // i18next ya estaba listo
  } else {
    i18next.on('initialized', startPromo); // se ejecutará cuando acabe
  }
});

// app.js  (raíz del proyecto)

async function loadPartial(id, url) {
  const res  = await fetch(url);
  const html = await res.text();
  document.getElementById(id).innerHTML = html;
}


// Cuando TODAS las imágenes están cargadas:
window.addEventListener('load', () => {
  const img = document.getElementById('blockA-img');
  if (!img) return;                 // esta página no tiene el plano → salir

  if (!window.jQuery) {             // jQuery no está → salir sin romper nada
    console.warn('Mapster: jQuery no está cargado en esta página.');
    return;
  }
  if (!$.fn || !$.fn.mapster) {     // plugin no está → salir
    console.warn('Mapster: plugin jquery.imagemapster no encontrado.');
    return;
  }

  if (!$(img).data('mapster')) {
    $(img).mapster({
      singleSelect: true,
      render_highlight: { fillColor: 'e1b77f', fillOpacity: 0.45 },
      showToolTip: true,
      onConfigured: () => console.log('ImageMapster listo')
      // …más opciones…
    });
  }
});
// Switch Día/Noche (hover en desktop, click en táctil)
document.addEventListener('DOMContentLoaded', () => {
  const root  = document.getElementById('galeria-dia-noche');
  if (!root) return;

  const day   = root.querySelector('.mode-day');
  const night = root.querySelector('.mode-night');
  const items = root.querySelectorAll('.dn-switch .switch-item');

  const isTouch = window.matchMedia('(hover: none)').matches;
  let hoverTimer;

  function activate(mode){
    // actualizar estados visuales
    items.forEach(i => i.classList.toggle('active', i.dataset.mode === mode));
    day.classList.toggle('is-active',   mode === 'day');
    night.classList.toggle('is-active', mode === 'night');
  }

  // Desktop: cambiar con hover (mouseenter) — con un pequeño delay anti-parpadeo
  if (!isTouch) {
    items.forEach(item => {
      item.addEventListener('mouseenter', () => {
        clearTimeout(hoverTimer);
        const mode = item.dataset.mode;
        hoverTimer = setTimeout(() => activate(mode), 60); // ← ajusta si quieres
      });
    });
  }

  // Táctil (y fallback): click/tap
  items.forEach(item => {
    item.addEventListener('click', () => activate(item.dataset.mode));
  });
});
