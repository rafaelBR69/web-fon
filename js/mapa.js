// /js/mapa.js
export async function initLombokMap(
  hostEl = (document.getElementById('section-lombok-map') || document)
){
  const { animate, svg } = await import('https://cdn.jsdelivr.net/npm/animejs@4.1.3/+esm');

  const $  = (sel) => (hostEl instanceof Element ? hostEl : document).querySelector(sel);
  const $$ = (sel) => (hostEl instanceof Element ? hostEl : document).querySelectorAll(sel);
  const scope = (hostEl instanceof Element ? hostEl : document.documentElement);

  const mapEl = $('#map');
  const scene = $('#scene');
  const wrap  = $('#mapWrap');
  if (!mapEl || !scene || !wrap) { console.warn('[mapa] faltan nodos'); return; }

  scene.querySelector('rect')?.setAttribute('pointer-events','none');

  const cssVarNumber = (el, name, fallback = 0) => {
    const raw = getComputedStyle(el).getPropertyValue(name).trim();
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : fallback;
  };

  const CSS_TX       = cssVarNumber(scope, '--tx', 0);
  const CSS_TY       = cssVarNumber(scope, '--ty', 0);
  const CSS_MIN_ZOOM = cssVarNumber(scope, '--map-min-zoom', 1.4);
  const state = { tx: CSS_TX, ty: CSS_TY, zoom: CSS_MIN_ZOOM };

  const applyTransform = () => {
    mapEl.style.transform = `translate(${state.tx}px, ${state.ty}px) scale(${state.zoom})`;
  };
  const syncUnderlay = () => {
    wrap.style.setProperty('--underfill-offx', (state.tx * 0.6) + 'px');
    wrap.style.setProperty('--underfill-offy', (state.ty * 0.6) + 'px');
    wrap.style.setProperty('--underfill-zoom', String(state.zoom));
  };

  /* ===== Teselas ===== */
  const TILE = 256, ZOOM = 10, MAX_ZOOM = 2.2;
  const SHARP = { x0:840, x1:844, y0:534, y1:539 };
  const SHARP_W = (SHARP.x1 - SHARP.x0 + 1) * TILE; // 1280
  const SHARP_H = (SHARP.y1 - SHARP.y0 + 1) * TILE; // 1024

  const VBW = 1350, VBH = 670;  // viewBox del #scene

  function lonLatToCxCy(lon, lat){
    const N = 2 ** ZOOM, R = TILE;
    const x = (lon + 180) / 360 * N * R;
    const s = Math.sin(lat * Math.PI/180);
    const y = (0.5 - Math.log((1+s)/(1-s)) / (4*Math.PI)) * N * R;
    return { cx: x - SHARP.x0*R, cy: y - SHARP.y0*R };
  }

  function centerAt(cx, cy, zoom, { biasX = 0, biasY = 0 } = {}){
    const r = scene.getBoundingClientRect();
    state.zoom = zoom;
    state.tx = (r.width  * 0.5) - cx * zoom + biasX;
    state.ty = (r.height * 0.5) - cy * zoom + biasY;
    applyTransform();
    syncUnderlay();
  }

  function computeZoomToCoverWidth(padding = 0){
    const r = scene.getBoundingClientRect();
    return Math.min((r.width / SHARP_W) * (1 + padding), MAX_ZOOM);
  }

  const URL = (z,y,x) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;

  function putTile(group, xCol, yRow, href){
    if (!group) return;
    const XLINK = 'http://www.w3.org/1999/xlink';
    const img = document.createElementNS('http://www.w3.org/2000/svg','image');
    img.setAttribute('x', String((xCol - SHARP.x0) * TILE));
    img.setAttribute('y', String((yRow - SHARP.y0) * TILE));
    img.setAttribute('width',  String(TILE));
    img.setAttribute('height', String(TILE));
    img.setAttribute('href', href);
    img.setAttributeNS(XLINK, 'href', href);
    group.appendChild(img);
  }

  function fitMapToWrap() {
    const r = scene.getBoundingClientRect();
    const w = r.width, h = r.height;

    // 1) zoom provisional para contener
    const containZoom = Math.min(w / VBW, h / VBH);

    // 2) zoom REAL a usar
    const z = Math.max(CSS_MIN_ZOOM, Math.min(containZoom, MAX_ZOOM));
    state.zoom = z;

    // 3) tx/ty usando el zoom REAL (no el provisional)
    state.tx = (w - VBW * z) / 2;
    state.ty = (h - VBH * z) / 2;

    applyTransform();
    syncUnderlay();

    const poiScale = z ? (1 / z) : 1;
    (document.querySelector('#section-lombok-map') || document.documentElement)
      .style.setProperty('--poi-scale', poiScale.toString());
  }

  /* Mantener el MISMO punto del mapa centrado tras un resize */
  let lastRect = scene.getBoundingClientRect();
  function keepSameMapCenterAfterResize(){
    const oldR = lastRect;
    const cxMap = (oldR.width  * 0.5 - state.tx) / state.zoom;
    const cyMap = (oldR.height * 0.5 - state.ty) / state.zoom;
    const r = scene.getBoundingClientRect();
    state.tx = (r.width  * 0.5) - cxMap * state.zoom;
    state.ty = (r.height * 0.5) - cyMap * state.zoom;
    applyTransform();
    syncUnderlay();
    lastRect = r;
  }

  function computeOverscan(){
    const r = scene.getBoundingClientRect();
    const blurBand = cssVarNumber(scope, '--blur-band', 56);
    const PARALLAX_X = 12, PARALLAX_Y = 9;
    const extraX = (r.width  * (MAX_ZOOM - 1))*0.5 + blurBand + PARALLAX_X;
    const extraY = (r.height * (MAX_ZOOM - 1))*0.5 + blurBand + PARALLAX_Y;
    const extraCols = Math.ceil(extraX / TILE) + 1;
    const extraRows = Math.ceil(extraY / TILE) + 1;
    return { xStart: SHARP.x0 - extraCols, xEnd: SHARP.x1 + extraCols,
             yStart: SHARP.y0 - extraRows, yEnd: SHARP.y1 + extraRows };
  }

  function buildTiles(){
    const under = $('#tilesUnder');
    const sharp = $('#tilesSharp');
    if (!under || !sharp) return;

    under.innerHTML = '';
    sharp.innerHTML = '';
    const { xStart, xEnd, yStart, yEnd } = computeOverscan();

    for(let y=yStart; y<=yEnd; y++){
      for(let x=xStart; x<=xEnd; x++){
        putTile(under, x, y, URL(ZOOM,y,x));
      }
    }
    for(let y=SHARP.y0; y<=SHARP.y1; y++){
      for(let x=SHARP.x0; x<=SHARP.x1; x++){
        putTile(sharp, x, y, URL(ZOOM,y,x));
      }
    }
  }

  // Punto de referencia (Mandalika)
  const TARGET = lonLatToCxCy(116.3040991783982, -8.89532564158422);

  function fitAndCenter(){
    const fitZ = computeZoomToCoverWidth(0.00);
    const z    = Math.max(CSS_MIN_ZOOM, fitZ);
    const r = scene.getBoundingClientRect();
    const biasY = -Math.round(r.height * 0.14);
    centerAt(TARGET.cx, TARGET.cy, z, { biasY });
  }

  buildTiles();
  fitMapToWrap();
  lastRect = scene.getBoundingClientRect();

  /* ===== Reflows estables (evitar “saltos” al abrir DevTools) ===== */
  let rafId = 0;
  const onResizeStable = () => {
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      buildTiles();                   // recomputa overscan con el tamaño nuevo
      keepSameMapCenterAfterResize(); // mantiene el mismo centro del mapa
    });
  };
  addEventListener('resize', onResizeStable);

  /* ===== Parallax ===== */
  let parallaxEnabled = false;
  const setParallax = (on)=>{ parallaxEnabled = !!on; };

  scene.addEventListener('mousemove', (e)=>{
    if(!parallaxEnabled) return;
    const r = scene.getBoundingClientRect();
    const cx = (e.clientX - r.left)/r.width  - 0.5;
    const cy = (e.clientY - r.top) /r.height - 0.5;
  });
  scene.addEventListener('mouseleave', ()=>{
    if(!parallaxEnabled) return;
  });

  /* ===== Zoom con rueda (Ctrl/Cmd) ===== */
  let currentZoom = state.zoom;
  const STEP_FACTOR = 0.10;
  function setZoom(z){
    currentZoom = Math.min(MAX_ZOOM, Math.max(CSS_MIN_ZOOM, z));
    state.zoom = currentZoom;
    scope.style.setProperty('--map-zoom', currentZoom.toFixed(3));
    const poiScale = currentZoom ? (1 / currentZoom) : 1;
    (document.querySelector('#section-lombok-map') || document.documentElement)
      .style.setProperty('--poi-scale', poiScale.toString());
    applyTransform();
    syncUnderlay();
  }

  wrap.addEventListener('wheel', (e)=>{
    const intentZoom = e.ctrlKey || e.metaKey;
    if (!intentZoom) return;
    e.preventDefault();
    const dir = e.deltaY > 0 ? -1 : 1;
    setZoom(currentZoom * (1 + STEP_FACTOR * dir));
  }, { passive:false });

  /* ===== Panel + circuito ===== */
  const panel      = $('#panel');
  const panelTitle = $('#panelTitle');
  const btnToggle  = $('#btnToggle');
  const poisGroup  = $('#pois');

  let carAnimation = null, drawAnimation = null;
  let running = false, panelOpen = false;
  let currentPoi = null;

  /* === i18n helpers (mejorados) === */
  const POI_ALIAS = {
    'poi-mandalika'              : 'mandalika',
    'poi-airport'                : 'airport',
    'poi-infinity'               : 'infinity',
    'poi-rinjani'                : 'rinjani',
    'poi-gili-trawangan'         : 'gili',
    'poi-selong-belanak'         : 'selong',
    'poi-tanjung-aan-merese'     : 'tanjung',
    'poi-sendang-gile-tiu-kelep' : 'senaru',
    'poi-pink-beach'             : 'pink',
    'poi-senggigi'               : 'senggigi',
    'poi-lombok-label'           : 'lombok',
    'poi-bali-label'             : 'bali'
  };
  function aliasFromPoiId(id=''){ return POI_ALIAS[id] || id.replace(/^poi-/, '').replace(/-label$/,''); }

  const i18nReady = () => Boolean(window.i18next && i18next.isInitialized);
  const hasKey = (k) => i18nReady() && i18next.exists(k);

  // Traduce una clave o usa fallback; no muestra la key cruda
  function tr(k, fb=''){
    if (i18nReady() && typeof i18next.t === 'function') {
      return i18next.t(k, { defaultValue: fb });
    }
    return fb;
  }

  // Prueba varias claves (útil por namespaces diferentes) antes del fallback
  function trAny(keys, fb=''){
    const arr = Array.isArray(keys) ? keys : [keys];
    for (const k of arr){
      if (hasKey(k)) return i18next.t(k);
    }
    for (const k of arr){
      const v = tr(k, null);
      if (v !== null && v !== k) return v;
    }
    return fb;
  }

  /* === Efecto de escritura (typing) para títulos y texto === */
  function typeInText(el, text, msPerChar = 18) {
    if (!el) return;
    el.textContent = '';
    let idx = 0;
    const tick = () => {
      if (idx <= (text?.length ?? 0)) {
        el.textContent = (text || '').slice(0, idx++);
        setTimeout(tick, msPerChar);
      }
    };
    tick();
  }

  function ensureTrackDom(){
    const stage = $('#svg-createmotionpath');
    if (!stage) return { ok:false };
    let carEl = stage.querySelector('.car') || $('.car');
    if (!carEl) { carEl = document.createElement('div'); carEl.className = 'car motion-path-car'; stage.appendChild(carEl); }
    let path = stage.querySelector('#suzuka') || stage.querySelector('#trackSVG path') || stage.querySelector('path');
    if (!path) return { ok:false };
    const wrapG  = stage.querySelector('#trackWrap');
    const scaleG = stage.querySelector('#trackScale');
    return { ok:true, stage, path, carEl, wrapG, scaleG };
  }

  function computeCenter(path){
    const b = path.getBBox();
    return { cx: b.x + b.width/2, cy: b.y + b.height/2 };
  }
  function applyTrackTransforms(scale, offsetY){
    const refs = ensureTrackDom();
    if (!refs.ok) return;
    const { path, wrapG, scaleG } = refs;
    const { cx, cy } = computeCenter(path);
    scaleG && scaleG.setAttribute('transform', `translate(${cx} ${cy}) scale(${scale}) translate(${-cx} ${-cy})`);
    wrapG  && wrapG.setAttribute('transform', `translate(0 ${offsetY})`);
  }
  function rebuildAnimations(){
    const refs = ensureTrackDom();
    if (!refs.ok) { console.warn('[mapa] Falta path o .car'); return; }
    const { path, carEl } = refs;
    carAnimation && carAnimation.cancel();
    drawAnimation && drawAnimation.cancel();
    const { translateX, translateY, rotate } = svg.createMotionPath(path);
    const drawable = svg.createDrawable(path);
    carAnimation  = animate(carEl,   { ease:'linear', duration:5000, loop:true, translateX, translateY, rotate });
    drawAnimation = animate(drawable,{ draw:'0 1',    ease:'linear', duration:5000, loop:true });
    running = true;
    if (btnToggle){ btnToggle.textContent = '⏸'; btnToggle.setAttribute('aria-label','Pausar'); }
  }
  function stopAnimations(){
    carAnimation && carAnimation.cancel();
    drawAnimation && drawAnimation.cancel();
    carAnimation = drawAnimation = null;
    running = false;
    if (btnToggle){ btnToggle.textContent = '⏯'; btnToggle.setAttribute('aria-label','Reproducir/Pausar'); }
  }
  function openPanel(){
    if (!panel) return;
    panel.classList.remove('hidden');
    animate(panel, { opacity:[0,.98], translateY:[8,0], duration:250, easing:'easeOutQuad' });
    panelOpen = true; setParallax(false);
  }
  function closePanel(){
    if (!panel) return;
    animate(panel, { opacity:[.98,0], translateY:[0,8], duration:200, easing:'easeOutQuad',
      complete:()=>panel.classList.add('hidden') });
    panelOpen = false; setParallax(true);
    stopAnimations();
    currentPoi = null;
  }
  btnToggle?.addEventListener('click', ()=>{
    if (!carAnimation) { if (currentPoi?.track) rebuildAnimations(); return; }
    if (running){ carAnimation.pause(); drawAnimation.pause(); running=false; btnToggle.textContent='▶'; btnToggle.setAttribute('aria-label','Reproducir'); }
    else { carAnimation.play(); drawAnimation.play(); running=true; btnToggle.textContent='⏸'; btnToggle.setAttribute('aria-label','Pausar'); }
  });

  poisGroup?.addEventListener('pointerdown', ()=> setParallax(false), true);
  poisGroup?.addEventListener('pointerup',   ()=> setTimeout(()=> setParallax(!panelOpen), 120), true);

  /* ===== Datos ===== */
  async function tryFetch(url){
    const res = await fetch(url, { cache:'no-store' });
    if(!res.ok) throw new Error('HTTP '+res.status);
    return res.json();
  }

  // Reemplaza SOLO esta función en /js/mapa.js
  async function loadData(){
    const lang =
      (window.i18next?.language ||
      document.documentElement.lang ||
      navigator.language ||
      'es').split('-')[0].toLowerCase();

    // Intenta primero por idioma (ej: /data/mapa-data-en.json)
    const byLang = [
      `/data/mapa-data-${lang}.json`,
      `./data/mapa-data-${lang}.json`,
      `data/mapa-data-${lang}.json`,
      `mapa-data-${lang}.json`
    ];

    // Luego el genérico (tu actual mapa-data.json en ES)
    const generic = [
      '/data/mapa-data.json','./data/mapa-data.json','data/mapa-data.json','mapa-data.json'
    ];

    for (const url of [...byLang, ...generic]) {
      try { return await tryFetch(url); } catch(_e){}
    }

    console.warn('[mapa] usando fallback de POIs');
    return { pois: [] };
  }

  /* ===== Panel info list (solo 'Descripción') ===== */
  function ensureInfoList(){
    if (!panel) return null;
    let infoList = panel.querySelector('#infoList');
    let headerH4 = panel.querySelector('#trackInfo h4');
    if (infoList) {
      if (headerH4) headerH4.textContent = trAny(['map.panel.summary','panel.summary','common.summary'],'Resumen');
      return infoList;
    }
    const trackInfo = document.createElement('section');
    trackInfo.className = 'track-info';
    trackInfo.id = 'trackInfo';
    const h4 = document.createElement('h4');
    h4.textContent = trAny(['map.panel.summary','panel.summary','common.summary'],'Resumen');
    infoList = document.createElement('dl'); infoList.id = 'infoList';
    trackInfo.appendChild(h4); trackInfo.appendChild(infoList);
    panel.appendChild(trackInfo);
    return infoList;
  }

  function ensureMediaBox(){
    if (!panel) return null;
    let media = panel.querySelector('.panel-media');
    if (media) return media;

    // crea <figure> al inicio, justo después del header
    const header = panel.querySelector('.panel__header') || panel.firstChild;
    media = document.createElement('figure');
    media.className = 'panel-media';
    media.innerHTML = `
      <img alt="" loading="lazy" decoding="async">
      <figcaption class="caption"></figcaption>
    `;
    if (header && header.nextSibling) {
      panel.insertBefore(media, header.nextSibling);
    } else {
      panel.insertBefore(media, panel.firstChild);
    }
    return media;
  }

  function renderMedia(photo){
    const box = ensureMediaBox();
    if (!box) return;
    const img = box.querySelector('img');
    const cap = box.querySelector('.caption');

    if (photo && photo.src){
      img.onload = () => { box.style.display = ''; };
      img.onerror = () => {
        console.warn('[mapa] No se pudo cargar la imagen:', photo.src);
        box.style.display = 'none';
      };
      img.src = photo.src;           // usa rutas servidas por HTTP
      img.alt = photo.alt || '';
      if (photo.srcset) img.srcset = photo.srcset;
      cap.textContent = photo.caption || '';
    } else {
      box.style.display = 'none';
    }
  }

  // === SOLO 'Descripción' en la lista (quitado Historia y Fecha habitual) ===
  function renderInfo(resumen){
    const infoList = ensureInfoList();
    if (!infoList){ console.warn('[mapa] No se pudo crear/encontrar #infoList'); return; }
    infoList.innerHTML = '';
    const add = (t, v) => {
      if (!v) return;
      const dt = document.createElement('dt'); dt.textContent = t;
      const dd = document.createElement('dd'); dd.textContent = '';
      infoList.appendChild(dt); infoList.appendChild(dd);
      typeInText(dd, String(v), 12);
    };
    const labelDesc = trAny(
      ['map.panel.fields.description','panel.fields.description','common.description'],
      'Descripción'
    );
    add(labelDesc, resumen?.descripcion);

    if (!infoList.children.length){
      const dt = document.createElement('dt'); dt.textContent = trAny(['map.panel.fields.generic','panel.fields.generic'],'Info');
      const dd = document.createElement('dd'); dd.textContent = '';
      infoList.appendChild(dt); infoList.appendChild(dd);
      typeInText(dd, trAny(['map.panel.fields.noData','panel.fields.noData'],'Sin datos para este punto.'), 12);
    }
  }

  /* ===== Construcción de POIs ===== */
  function buildPOIs(data){
    const group = $('#pois');
    if (!group) return;
    group.innerHTML = '';

    (data.pois || []).forEach(p=>{
      const hasLonLat = ('lat' in (p.coords||{})) && ('lon' in p.coords);
      const xy = hasLonLat ? lonLatToCxCy(p.coords.lon, p.coords.lat)
                          : { cx: p.coords.cx, cy: p.coords.cy };
      const cx = xy.cx, cy = xy.cy;

      const isLabelOnly = !!p.noDot;                  // ← no dibujar punto
      const interactive = !isLabelOnly && !!p.panel;  // ← solo interactivos si tienen punto y panel

      // 1) (Opcional) círculo del POI
      if (!isLabelOnly){
        const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        c.classList.add('poi');
        c.setAttribute('id', p.id);
        c.setAttribute('cx', cx);
        c.setAttribute('cy', cy);
        c.setAttribute('r',  p.coords.r ?? 7);
        group.appendChild(c);
      }

      // 2) etiqueta (usa labelKey si está definida)
      const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      t.classList.add('poi-label');
      if (p.bigLabel) t.classList.add('poi-label--region');

      const anchor = p.anchor || (isLabelOnly ? 'middle' : 'start');
      t.setAttribute('text-anchor', anchor);
      t.setAttribute('x', isLabelOnly ? cx : (cx + 4));
      t.setAttribute('y', cy);

      const alias = aliasFromPoiId(p.id);
      const labelKey = p.labelKey || `map.pois.${alias}.label`;
      t.textContent = tr(labelKey, p.label ?? '');

      // Solo las etiquetas de POIs con punto deberían abrir panel
      if (interactive) t.setAttribute('data-poi-id', p.id);

      group.appendChild(t);
    });

    // Entrada con animación solo para los puntos
    const poiNodes = $$('.poi');
    if (poiNodes && poiNodes.length){
      animate(poiNodes, { opacity:[0,1], r:[0,7], delay:(_el,i)=>300+i*120, duration:450, easing:'easeOutQuad' });
    }
  }

  const data = await loadData();
  buildPOIs(data);

  // Si i18n ya está listo, refrescamos ahora; si no, cuando cargue
  if (i18nReady()) refreshPoiLabels();

  /* ===== Click en POI → abre panel con textos traducidos ===== */
  poisGroup?.addEventListener('click', (ev) => {
    const circle = ev.target.closest?.('circle.poi');
    const poiId = circle?.id || ev.target.getAttribute?.('data-poi-id');
    if (!poiId) return;
    const poi = (data.pois || []).find(p => p.id === poiId);
    if (!poi) return;
    const same = panelOpen && currentPoi?.id === poi.id;
    if (same){ closePanel(); currentPoi = null; return; }
    currentPoi = poi;

    const alias = aliasFromPoiId(poi.id);

    // Título del panel (usa labelKey si existe)
    if (panelTitle){
      panelTitle.textContent = '';
      const title = tr(poi.labelKey || `map.pois.${alias}.label`, poi.label || trAny(['map.panel.titleFallback','panel.titleFallback'],'Detalle'));
      typeInText(panelTitle, title, 14);
    }

    // Foto: alt/caption traducidos (src viene de JSON; keys opcionales)
    const photo = {
      src    : poi.panel?.photo?.src || poi.photo?.src,
      alt    : tr(poi.photo?.altKey || `map.pois.${alias}.photo.alt`,     poi.panel?.photo?.alt || poi.photo?.alt || ''),
      caption: tr(poi.photo?.captionKey || `map.pois.${alias}.photo.caption`, poi.panel?.photo?.caption || poi.photo?.caption || '')
    };
    renderMedia(photo);

    // Resumen SOLO con 'descripcion' (usa descripcionKey si existe)
    const descKey = poi.panel?.resumen?.descripcionKey || `map.pois.${alias}.resumen.descripcion`;
    const resumen = { descripcion: tr(descKey, poi.panel?.resumen?.descripcion) };
    renderInfo(resumen);

    openPanel();
    applyTrackFromPoi(poi);
  });

  /* Cerrar panel al hacer clic fuera de POIs o sobre el “fondo” */
  wrap.addEventListener('click', (e)=>{
    const clickedPoi = e.target.closest?.('circle.poi,[data-poi-id]');
    const insidePanel = e.target.closest?.('#panel');
    if (!clickedPoi && !insidePanel && panelOpen){
      closePanel();
    }
  });

  /* Cerrar panel con ESC */
  addEventListener('keydown', (e)=>{
    if (e.key === 'Escape' && panelOpen) closePanel();
  });

  /* ===== Circuito por-POI ===== */
  function applyTrackFromPoi(poi){
    const stage = $('#svg-createmotionpath');
    if(!stage){ stopAnimations(); return; }
    if(!poi.track){ stage.style.display = 'none'; stopAnimations(); return; }
    stage.style.display = '';
    const s  = (poi.track.scale   ?? cssVarNumber(scope, '--track-scale',   0.46));
    const oy = (poi.track.offsetY ?? cssVarNumber(scope, '--track-offset-y', 0));
    const st = (poi.track.stroke  ?? cssVarNumber(scope, '--track-stroke',  6));
    scope.style.setProperty('--track-scale', String(s));
    scope.style.setProperty('--track-offset-y', `${oy}px`);
    scope.style.setProperty('--track-stroke', `${st}px`);
    applyTrackTransforms(Number(s), Number(oy));
    rebuildAnimations();
  }

  /* ===== i18n: refrescar etiquetas cuando i18next esté listo/cargado/cambie ===== */
  function refreshPoiLabels(){
    // Labels de los puntos
    const labels = $('#pois')?.querySelectorAll('.poi-label');
    if (labels) {
      labels.forEach(node => {
        const id = node.getAttribute('data-poi-id') || node.previousElementSibling?.id || '';
        const alias = aliasFromPoiId(id);
        // Si el POI existe en data, intenta usar su labelKey
        const p = (data.pois || []).find(x => x.id === id);
        const key = p?.labelKey || `map.pois.${alias}.label`;
        const fallback = p?.label || node.textContent || '';
        node.textContent = tr(key, fallback);
      });
    }

    // actualizar cabecera "Resumen" si existe
    const h4 = panel?.querySelector('#trackInfo h4');
    if (h4) h4.textContent = trAny(['map.panel.summary','panel.summary','common.summary'],'Resumen');

    // si el panel está abierto, re-render SOLO 'Descripción' y media con sus keys
    if (panelOpen && currentPoi){
      const poi = currentPoi;
      const alias = aliasFromPoiId(poi.id);

      if (panelTitle){
        panelTitle.textContent = tr(poi.labelKey || `map.pois.${alias}.label`, poi.label || trAny(['map.panel.titleFallback','panel.titleFallback'],'Detalle'));
      }
      const photo = {
        src    : poi.panel?.photo?.src || poi.photo?.src,
        alt    : tr(poi.photo?.altKey || `map.pois.${alias}.photo.alt`,     poi.panel?.photo?.alt || poi.photo?.alt || ''),
        caption: tr(poi.photo?.captionKey || `map.pois.${alias}.photo.caption`, poi.panel?.photo?.caption || poi.photo?.caption || '')
      };
      renderMedia(photo);

      const descKey = poi.panel?.resumen?.descripcionKey || `map.pois.${alias}.resumen.descripcion`;
      const resumen = { descripcion: tr(descKey, poi.panel?.resumen?.descripcion) };
      renderInfo(resumen);
    }
  }

  // Eventos i18next para refrescar cuando realmente esté listo
  if (window.i18next){
    if (i18next.isInitialized) refreshPoiLabels();
    i18next.on?.('initialized', refreshPoiLabels);
    i18next.on?.('loaded',      refreshPoiLabels);
    i18next.on?.('languageChanged', refreshPoiLabels);
  }
}
