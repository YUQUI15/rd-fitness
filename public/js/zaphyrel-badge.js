/* ============================================================================
 * ZAPHYREL · Insignia Universal de Autoría para Proyectos ("by ZAPHYREL")
 * - Posición fija en esquina inferior izquierda, fina, compacta y elegante
 * - Encapsulada en Shadow DOM (cero conflictos CSS con Tailwind/Bootstrap/MUI)
 * - Emblema PBR oficial (2 aros átomo + 3 líneas cian + Prisma Cristal) embebido
 * - Auto-adaptable 100% en vivo a Modo Claro y Modo Oscuro de cualquier proyecto
 * - Evita colisiones automáticas con barras inferiores móviles o menús laterales
 * Uso 1 línea: <script src="https://zaphyrel-site.vercel.app/assets/zaphyrel-badge.js" defer></script>
 * ========================================================================== */
(() => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__zaphyrelBadgeLoaded) {
    window.ZaphyrelBadge?.refresh?.();
    return;
  }
  window.__zaphyrelBadgeLoaded = true;

  const EMBLEM_URI = "data:image/webp;base64,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";
  const DEFAULT_HREF = "https://zaphyrel-site.vercel.app";

  const curScript = document.currentScript || document.querySelector('script[src*="zaphyrel-badge.js"]');
  const gCfg = window.ZAPHYREL_BADGE_CONFIG || {};
  const attr = (k, def) => {
    const sk = curScript?.getAttribute?.('data-' + k);
    if (sk !== null && sk !== undefined && sk !== '') return sk;
    const camel = k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    return gCfg[camel] !== undefined ? String(gCfg[camel]) : def;
  };

  const CFG = {
    prefix: attr('prefix', 'by'),
    brand: attr('brand', 'ZAPHYREL'),
    href: attr('href', DEFAULT_HREF),
    theme: attr('theme', 'auto'),
    variant: attr('variant', 'glass'),
    position: attr('position', 'bottom-left'),
    subtitle: attr('subtitle', 'Ecosistemas Digitales · Arequipa'),
    offsetLeft: attr('offset-left', ''),
    offsetBottom: attr('offset-bottom', ''),
    noAuto: curScript?.hasAttribute?.('data-no-auto') || gCfg.noAuto === true
  };

  const FALLBACK_SVG = `<svg viewBox="0 0 120 120" width="18" height="18" aria-hidden="true"><defs><linearGradient id="zybPrism" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5EB8FF"/><stop offset=".5" stop-color="#D5BEFF"/><stop offset="1" stop-color="#FF9AFF"/></linearGradient></defs><g fill="none" stroke="url(#zybPrism)" stroke-width="2.2" opacity=".75"><ellipse cx="60" cy="60" rx="50" ry="20" transform="rotate(-32 60 60)"/><ellipse cx="60" cy="60" rx="50" ry="20" transform="rotate(32 60 60)"/></g><path d="M12 52H26L23 55H12ZM6 59H28L25 63H6ZM13 67H30L27 70H13Z" fill="#5EB8FF"/><polygon points="60,18 102,60 60,102 18,60" fill="#0A1020" stroke="url(#zybPrism)" stroke-width="3"/><path d="M40 39H82L61 60H51L67 44H36Z" fill="#FFFFFF"/><path d="M80 81H38L59 60H69L53 76H84Z" fill="url(#zybPrism)"/></svg>`;

  function parseColorLuminance(str) {
    if (!str || str === 'transparent') return null;
    const m = str.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/i);
    if (!m) return null;
    const a = m[4] !== undefined ? parseFloat(m[4]) : 1;
    if (a <= 0.18) return null;
    const toLin = v => {
      const c = Number(v) / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * toLin(m[1]) + 0.7152 * toLin(m[2]) + 0.0722 * toLin(m[3]);
  }

  function detectHostTheme(explicit) {
    const req = (explicit || '').toLowerCase().trim();
    if (req === 'dark' || req === 'night' || req === 'oscuro') return 'dark';
    if (req === 'light' || req === 'day' || req === 'claro') return 'light';

    const root = document.documentElement;
    const body = document.body;
    const nodes = [root, body].filter(Boolean);

    for (const el of nodes) {
      for (const a of ['data-theme', 'data-bs-theme', 'data-color-scheme', 'data-mode', 'data-ui-theme']) {
        const val = (el.getAttribute(a) || '').toLowerCase().trim();
        if (!val) continue;
        if (/^(dark|night|oscuro|noche|noir)$/.test(val)) return 'dark';
        if (/^(light|day|claro|dia|pearl)$/.test(val)) return 'light';
      }
      const cl = el.classList;
      if (cl) {
        if (cl.contains('dark') || cl.contains('dark-mode') || cl.contains('theme-dark') || cl.contains('night')) return 'dark';
        if (cl.contains('light') || cl.contains('light-mode') || cl.contains('theme-light') || cl.contains('day')) return 'light';
      }
    }

    for (const el of [body, root].filter(Boolean)) {
      try {
        const lum = parseColorLuminance(getComputedStyle(el).backgroundColor);
        if (lum !== null) return lum < 0.45 ? 'dark' : 'light';
      } catch (_) {}
    }

    try {
      const cs = getComputedStyle(root).colorScheme;
      if (cs === 'dark') return 'dark';
      if (cs === 'light') return 'light';
    } catch (_) {}

    try {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch (_) {
      return 'dark';
    }
  }

  const SHEET_CSS = `
    :host {
      all: initial;
      position: fixed;
      left: var(--zy-left, 14px);
      bottom: var(--zy-bottom, 14px);
      z-index: 2147482000;
      display: inline-block;
      pointer-events: none;
      font-family: "Outfit", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      -webkit-font-smoothing: antialiased;
      color-scheme: normal;
      transition: left .24s cubic-bezier(.22,1,.36,1), bottom .24s cubic-bezier(.22,1,.36,1), opacity .22s ease;
    }
    :host([data-zy-pos="bottom-right"]) {
      left: auto;
      right: var(--zy-right, 14px);
    }
    :host([hidden]) { display: none !important; }
    @media print { :host { display: none !important; } }

    .zy-wrap {
      position: relative;
      display: inline-flex;
      align-items: center;
      pointer-events: auto;
    }

    .zy-pill {
      --zy-bg: rgba(9, 13, 25, 0.80);
      --zy-bg-hover: rgba(12, 18, 34, 0.94);
      --zy-border: rgba(169, 220, 255, 0.22);
      --zy-border-hover: rgba(169, 220, 255, 0.56);
      --zy-ink: #F8FAFF;
      --zy-prefix: rgba(203, 213, 225, 0.78);
      --zy-shadow: 0 8px 24px -6px rgba(0, 0, 0, 0.62), inset 0 1px 0 rgba(255, 255, 255, 0.14);
      --zy-shadow-hover: 0 12px 30px -6px rgba(0, 0, 0, 0.74), 0 0 18px -4px rgba(94, 184, 255, 0.36), inset 0 1px 0 rgba(255, 255, 255, 0.22);
      --zy-pop-bg: rgba(8, 12, 23, 0.95);
      --zy-pop-ink: #F8FAFF;
      --zy-pop-sub: #94A3B8;

      box-sizing: border-box;
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      height: 28px;
      padding: 2px 10px 2px 3px;
      border-radius: 999px;
      text-decoration: none;
      background: var(--zy-bg);
      border: 1px solid var(--zy-border);
      box-shadow: var(--zy-shadow);
      backdrop-filter: blur(14px) saturate(160%);
      -webkit-backdrop-filter: blur(14px) saturate(160%);
      color: var(--zy-ink);
      cursor: pointer;
      user-select: none;
      transition: transform .18s cubic-bezier(.22,1,.36,1), border-color .15s ease, box-shadow .18s ease, opacity .15s ease;
    }

    :host([data-zy-mode="light"]) .zy-pill {
      --zy-bg: rgba(255, 255, 255, 0.86);
      --zy-bg-hover: rgba(255, 255, 255, 0.98);
      --zy-border: rgba(15, 23, 42, 0.13);
      --zy-border-hover: rgba(56, 139, 253, 0.45);
      --zy-ink: #090E1C;
      --zy-prefix: #475569;
      --zy-shadow: 0 6px 20px -6px rgba(15, 23, 42, 0.16), 0 1px 3px rgba(15, 23, 42, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.95);
      --zy-shadow-hover: 0 10px 26px -6px rgba(15, 23, 42, 0.22), 0 0 14px -4px rgba(56, 189, 248, 0.28), inset 0 1px 0 rgba(255, 255, 255, 1);
      --zy-pop-bg: rgba(255, 255, 255, 0.97);
      --zy-pop-ink: #090E1C;
      --zy-pop-sub: #475569;
    }

    :host([data-zy-variant="minimal"]) .zy-pill {
      height: 25px;
      padding: 2px 9px 2px 3px;
      opacity: 0.84;
    }
    :host([data-zy-variant="minimal"]) .zy-pill:hover,
    :host([data-zy-variant="minimal"]) .zy-pill:focus-visible {
      opacity: 1;
    }
    :host([data-zy-variant="editorial"]) .zy-pill {
      border-radius: 9px;
      padding: 3px 10px 3px 4px;
    }
    :host([data-zy-variant="editorial"]) .zy-socket {
      border-radius: 6px;
    }

    .zy-pill:hover,
    .zy-pill:focus-visible {
      transform: translateY(-1.5px);
      background: var(--zy-bg-hover);
      border-color: var(--zy-border-hover);
      box-shadow: var(--zy-shadow-hover);
      outline: none;
    }
    .zy-pill:focus-visible {
      outline: 2px solid #5EB8FF;
      outline-offset: 2px;
    }

    /* Micro-capsula optica oscura: garantiza 100% nitidez del Prisma 3D en Oscuro y en Claro */
    .zy-socket {
      position: relative;
      width: 21px;
      height: 21px;
      border-radius: 999px;
      flex-shrink: 0;
      display: grid;
      place-items: center;
      background: radial-gradient(circle at 32% 26%, #162344 0%, #060A16 100%);
      box-shadow: inset 0 0 0 1px rgba(129, 189, 248, 0.38), 0 1px 4px rgba(0, 0, 0, 0.35);
      overflow: hidden;
      transition: transform .3s cubic-bezier(.22,1,.36,1), box-shadow .3s ease;
    }
    :host([data-zy-variant="minimal"]) .zy-socket {
      width: 19px;
      height: 19px;
    }
    .zy-pill:hover .zy-socket {
      transform: scale(1.06);
      box-shadow: inset 0 0 0 1px rgba(169, 220, 255, 0.68), 0 0 10px rgba(94, 184, 255, 0.45);
    }

    .zy-img {
      width: 17px;
      height: 17px;
      display: block;
      object-fit: contain;
      filter: drop-shadow(0 0 2px rgba(94, 184, 255, 0.35));
      transition: transform .45s cubic-bezier(.22,1,.36,1);
    }
    :host([data-zy-variant="minimal"]) .zy-img {
      width: 15px;
      height: 15px;
    }
    .zy-pill:hover .zy-img {
      transform: scale(1.07);
    }

    .zy-text {
      display: inline-flex;
      align-items: baseline;
      gap: 4.5px;
      line-height: 1;
      white-space: nowrap;
    }
    .zy-prefix {
      font-size: 8.5px;
      font-weight: 500;
      letter-spacing: 0.11em;
      text-transform: uppercase;
      color: var(--zy-prefix);
    }
    .zy-brand {
      font-size: 10.5px;
      font-weight: 700;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--zy-ink);
    }
    .zy-dot {
      width: 4px;
      height: 4px;
      border-radius: 50%;
      flex-shrink: 0;
      background: linear-gradient(135deg, #5EB8FF 0%, #D5BEFF 55%, #FF9AFF 100%);
      box-shadow: 0 0 6px rgba(94, 184, 255, 0.72);
      opacity: 0.85;
      transition: transform .25s ease, opacity .25s ease;
    }
    .zy-pill:hover .zy-dot {
      transform: scale(1.25);
      opacity: 1;
    }

    /* Mini tarjeta flotante al pasar el mouse / enfocar */
    .zy-tip {
      position: absolute;
      left: 0;
      bottom: calc(100% + 8px);
      padding: 7px 11px;
      border-radius: 10px;
      background: var(--zy-pop-bg);
      border: 1px solid var(--zy-border);
      box-shadow: 0 12px 28px -8px rgba(0, 0, 0, 0.35);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      pointer-events: none;
      opacity: 0;
      transform: translateY(4px) scale(0.98);
      transform-origin: bottom left;
      transition: opacity .2s ease, transform .2s cubic-bezier(.22,1,.36,1);
      white-space: nowrap;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    :host([data-zy-pos="bottom-right"]) .zy-tip {
      left: auto;
      right: 0;
      transform-origin: bottom right;
    }
    .zy-wrap:hover .zy-tip,
    .zy-pill:focus-visible + .zy-tip {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
    .zy-tip-title {
      font-size: 10.5px;
      font-weight: 600;
      color: var(--zy-pop-ink);
      letter-spacing: 0.02em;
    }
    .zy-tip-sub {
      font-size: 9px;
      font-weight: 500;
      color: var(--zy-pop-sub);
      letter-spacing: 0.04em;
    }

    @media (max-width: 560px) {
      .zy-pill {
        height: 24px;
        gap: 5.5px;
        padding: 2px 8.5px 2px 2.5px;
      }
      .zy-socket { width: 18px; height: 18px; }
      .zy-img { width: 14px; height: 14px; }
      .zy-prefix { font-size: 7.8px; letter-spacing: 0.09em; }
      .zy-brand { font-size: 9.5px; letter-spacing: 0.13em; }
      .zy-dot { width: 3.5px; height: 3.5px; }
      .zy-tip { display: none; }
    }

    @media (prefers-reduced-motion: reduce) {
      :host, .zy-pill, .zy-socket, .zy-img, .zy-dot, .zy-tip { transition: none !important; }
      .zy-pill:hover { transform: none; }
      .zy-pill:hover .zy-socket, .zy-pill:hover .zy-img { transform: none; }
    }
  `;

  class ZaphyrelBadgeElement extends HTMLElement {
    constructor() {
      super();
      this._root = this.attachShadow({ mode: 'open' });
      this._rendered = false;
    }
    connectedCallback() {
      if (!this._rendered) this._render();
      this.syncTheme();
      this.adjustOffsets();
    }
    static get observedAttributes() {
      return ['prefix', 'brand', 'href', 'theme', 'variant', 'position', 'subtitle'];
    }
    attributeChangedCallback() {
      if (this._rendered) this._updateLabels();
      this.syncTheme();
    }
    _render() {
      this._rendered = true;
      const s = this._root;
      s.innerHTML = `<style>${SHEET_CSS}</style>
        <div class="zy-wrap">
          <a class="zy-pill" part="pill" target="_blank" rel="noopener noreferrer">
            <span class="zy-socket" aria-hidden="true">
              <img class="zy-img" alt="Zaphyrel" decoding="async" />
            </span>
            <span class="zy-text">
              <span class="zy-prefix"></span>
              <span class="zy-brand"></span>
            </span>
            <span class="zy-dot" aria-hidden="true"></span>
          </a>
          <div class="zy-tip" aria-hidden="true">
            <span class="zy-tip-title"></span>
            <span class="zy-tip-sub">zaphyrel-site.vercel.app ↗</span>
          </div>
        </div>`;

      const img = s.querySelector('.zy-img');
      img.src = EMBLEM_URI;
      img.addEventListener('error', () => {
        const sock = s.querySelector('.zy-socket');
        if (sock) sock.innerHTML = FALLBACK_SVG;
      });
      this._updateLabels();
    }
    _updateLabels() {
      const s = this._root;
      const prefix = this.getAttribute('prefix') ?? CFG.prefix;
      const brand = this.getAttribute('brand') ?? CFG.brand;
      const href = this.getAttribute('href') ?? CFG.href;
      const sub = this.getAttribute('subtitle') ?? CFG.subtitle;
      const variant = this.getAttribute('variant') ?? CFG.variant;
      const pos = this.getAttribute('position') ?? CFG.position;

      this.setAttribute('data-zy-variant', variant);
      this.setAttribute('data-zy-pos', pos);

      const link = s.querySelector('.zy-pill');
      link.href = href;
      link.setAttribute('aria-label', `${prefix} ${brand} — Visitar sitio oficial`);
      s.querySelector('.zy-prefix').textContent = prefix;
      s.querySelector('.zy-brand').textContent = brand;
      s.querySelector('.zy-tip-title').textContent = `${brand} · ${sub}`;
    }
    syncTheme(override) {
      const explicit = override || this.getAttribute('theme') || CFG.theme;
      const mode = detectHostTheme(explicit === 'auto' ? '' : explicit);
      this.setAttribute('data-zy-mode', mode);
    }
    adjustOffsets() {
      if (CFG.offsetLeft) {
        this.style.setProperty('--zy-left', CFG.offsetLeft);
      }
      if (CFG.offsetBottom) {
        this.style.setProperty('--zy-bottom', CFG.offsetBottom);
      }
      if (CFG.offsetLeft && CFG.offsetBottom) return;

      let leftPx = 14;
      let bottomPx = 14;
      const isMobile = window.innerWidth <= 560;
      if (isMobile) { leftPx = 10; bottomPx = 10; }

      try {
        const candidates = document.querySelectorAll('nav, .nav, [role="navigation"], [data-mobile-nav], #quickSyncDock, .mobile-nav, .bottom-nav, .tabbar, .md\\:hidden.fixed');
        for (const el of candidates) {
          if (el === this || this.contains(el)) continue;
          const st = getComputedStyle(el);
          if (st.position !== 'fixed' || st.display === 'none' || st.visibility === 'hidden' || parseFloat(st.opacity) === 0) continue;
          const r = el.getBoundingClientRect();
          if (r.width <= 0 || r.height <= 0) continue;

          // Sidebar fija a la izquierda (ej. Panel Admin Desktop .admin .nav)
          if (r.left <= 12 && r.width >= 44 && r.width <= 160 && r.height >= window.innerHeight * 0.5 && r.bottom >= window.innerHeight - 32) {
            leftPx = Math.max(leftPx, Math.round(r.right + 12));
            continue;
          }
          // Barra inferior fija (ej. PWA nav móvil / dock flotante / Mobile Bottom Pill)
          if (r.bottom >= window.innerHeight - 30 && r.height >= 32 && r.height <= 120 && r.left <= 185 && r.right >= 80) {
            bottomPx = Math.max(bottomPx, Math.round(window.innerHeight - r.top + 10));
          }
        }
      } catch (_) {}

      if (!CFG.offsetLeft) this.style.setProperty('--zy-left', `max(${leftPx}px, env(safe-area-inset-left, 0px))`);
      if (!CFG.offsetBottom) this.style.setProperty('--zy-bottom', `max(${bottomPx}px, env(safe-area-inset-bottom, 0px))`);
    }
  }

  if (!customElements.get('zaphyrel-badge')) {
    customElements.define('zaphyrel-badge', ZaphyrelBadgeElement);
  }

  let mountedEl = null;
  let observer = null;
  let syncTimer = null;

  function scheduleSync() {
    if (!mountedEl) return;
    mountedEl.syncTheme();
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      mountedEl?.syncTheme();
      mountedEl?.adjustOffsets();
    }, 90);
  }

  function mountBadge() {
    if (mountedEl && mountedEl.isConnected) return mountedEl;
    const existing = document.querySelector('zaphyrel-badge');
    if (existing) {
      mountedEl = existing;
      mountedEl.syncTheme();
      mountedEl.adjustOffsets();
      return mountedEl;
    }
    if (!document.body) return null;
    mountedEl = document.createElement('zaphyrel-badge');
    document.body.appendChild(mountedEl);

    if (!observer && typeof MutationObserver !== 'undefined') {
      observer = new MutationObserver(scheduleSync);
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class', 'data-theme', 'data-bs-theme', 'data-color-scheme', 'data-mode', 'data-ui-theme', 'style']
      });
      if (document.body) {
        observer.observe(document.body, {
          attributes: true,
          attributeFilter: ['class', 'data-theme', 'data-bs-theme', 'data-color-scheme', 'data-mode', 'style']
        });
      }
    }
    return mountedEl;
  }

  window.ZaphyrelBadge = {
    get element() { return mountedEl || document.querySelector('zaphyrel-badge'); },
    mount: mountBadge,
    refresh: scheduleSync,
    setTheme(mode) {
      const el = this.element;
      if (!el) return;
      if (!mode || mode === 'auto') { el.removeAttribute('theme'); CFG.theme = 'auto'; }
      else { el.setAttribute('theme', mode); CFG.theme = mode; }
      el.syncTheme();
    },
    setVariant(v) {
      const el = this.element;
      if (el && v) el.setAttribute('variant', v);
    },
    hide() { const el = this.element; if (el) el.hidden = true; },
    show() { const el = this.element; if (el) el.hidden = false; }
  };

  if (!CFG.noAuto) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        mountBadge();
        setTimeout(scheduleSync, 250);
      });
    } else {
      mountBadge();
      setTimeout(scheduleSync, 150);
    }
    try {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      if (mq.addEventListener) mq.addEventListener('change', scheduleSync);
      else if (mq.addListener) mq.addListener(scheduleSync);
    } catch (_) {}
    window.addEventListener('zaphyrel:theme', scheduleSync);
    window.addEventListener('storage', scheduleSync);
    window.addEventListener('resize', () => mountedEl?.adjustOffsets?.(), { passive: true });
    window.addEventListener('load', scheduleSync, { passive: true });
  }
})();
