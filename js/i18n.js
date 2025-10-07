/* ===========================================================
   i18n.js  →  inicializa i18next y gestiona el selector idioma
   =========================================================== */

/* 1 · Pinta textos y atributos cada vez que cambie el idioma */
function renderPage () {
  // a) texto interno
  document
    .querySelectorAll('[data-i18n]:not([data-i18n*="\\["])')
    .forEach(el => { el.innerHTML = i18next.t(el.dataset.i18n); });

  // b) [attr]clave ; [attr2]clave2 ...
  document
    .querySelectorAll('[data-i18n*="\\["]')
    .forEach(el => {
      el.dataset.i18n.split(';').forEach(str => {
        const m = str.match(/^\s*\[([^\]]+)]\s*(.+)$/);
        if (m) el.setAttribute(m[1], i18next.t(m[2]));
      });
    });

  // c) placeholder legacy
  document
    .querySelectorAll('[data-i18n-placeholder]')
    .forEach(el => { el.placeholder = i18next.t(el.dataset.i18nPlaceholder); });

  // d) sincroniza <select> y <html lang>
  const sel = document.getElementById('langSwitcher');
  if (sel) sel.value = i18next.resolvedLanguage; // 'es' | 'en'
  document.documentElement.setAttribute('lang', i18next.resolvedLanguage || 'es');
}

/* 2 · Inicializa i18next una sola vez para todo el sitio */
i18next
  .use(i18nextHttpBackend)
  .use(i18nextBrowserLanguageDetector)
  .init({
    supportedLngs: ['es', 'en'],
    fallbackLng : 'es',
    load: 'languageOnly',
    nonExplicitSupportedLngs: true,
    detection: {
      order : ['localStorage', 'htmlTag', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng'
    },
    preload: ['es', 'en'],
    backend: { loadPath: '/langs/{{lng}}.json' },
    initImmediate: false,
    debug: false
  })
  .then(renderPage)
  .catch(console.error);

/* 3 · Cambia idioma al tocar el <select> (normalizado a minúsculas) */
document.addEventListener('change', e => {
  if (e.target.id === 'langSwitcher') {
    const lng = String(e.target.value || '').toLowerCase(); // <-- clave
    i18next.changeLanguage(lng);
  }
});

/* 4 · Reactualiza si el idioma cambia por cualquier otro medio */
i18next.on('languageChanged', renderPage);
