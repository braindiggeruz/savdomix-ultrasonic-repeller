// Savdomix landing — vanilla JS (Meta Pixel + SINGLE-STEP form + attribution + telemetry).
// v5: removed the quantity step (qty locked to 1 anyway) — form is one step now.
// All API calls hit /api/* (Cloudflare Pages Functions).
//
// Meta event contract (production semantics) — UNCHANGED from v4:
//   PageView          : once on load (browser + server CAPI, same event_id dedup)
//   ViewContent       : once on load (browser + server CAPI, same event_id dedup)
//   Hero CTA          : custom 'HeroCTA_Click' only — NO InitiateCheckout
//   FormStart         : custom, once, on first focus/input of name or phone
//   invalid submit    : NO InitiateCheckout
//   valid name+phone  : exactly one InitiateCheckout (browser) + server CAPI
//                       InitiateCheckout — SAME event_id (dedup), before /api/lead
//   real BUYO accept  : Browser Lead + (server fires CAPI Lead) — SAME event_id
//   BUYO reject/error : NO Lead
//   no Purchase / no AddToCart

(function () {
  "use strict";
  const $ = (s, e) => (e || document).querySelector(s);
  const $$ = (s, e) => Array.from((e || document).querySelectorAll(s));
  const nowMs = () => Date.now();

  function uuidv4() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    const b = new Uint8Array(16); crypto.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
    return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;
  }
  function setCookie(n, v, d) { const e = new Date(Date.now() + d * 864e5).toUTCString(); document.cookie = `${n}=${encodeURIComponent(v)}; expires=${e}; path=/; SameSite=Lax`; }
  function getCookie(n) { const m = document.cookie.match(new RegExp("(?:^|; )" + n.replace(/[.$?*|{}()\[\]\\\/+^]/g, "\\$&") + "=([^;]*)")); return m ? decodeURIComponent(m[1]) : null; }

  // --- attribution ---
  const ATTR_KEYS = ["utm_source","utm_medium","utm_campaign","utm_term","utm_content","campaign_id","adset_id","ad_id","placement","fbclid"];
  const STORAGE_KEY = "sdmx_attr_v1";
  function captureAttribution() {
    const params = new URL(window.location.href).searchParams;
    let stored = null; try { stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); } catch { stored = null; }
    const next = stored && typeof stored === "object" ? { ...stored } : {};
    let updated = false;
    ATTR_KEYS.forEach((k) => { const v = params.get(k); if (v && (!next[k] || k === "fbclid")) { next[k] = v.slice(0, 256); updated = true; } });
    next.landing_url = window.location.href; next.referrer = document.referrer || null;
    if (!stored || updated) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {} }
    let fbp = getCookie("_fbp");
    if (!fbp) { fbp = `fb.1.${Date.now()}.${Math.floor(Math.random()*1e10)}`; setCookie("_fbp", fbp, 90); }
    let fbc = getCookie("_fbc");
    // Rebuild fbc from fbclid — prefer current URL param, fall back to stored
    // fbclid from a previous visit (recovers attribution across sessions).
    const fbclidForFbc = params.get("fbclid") || next.fbclid || (stored && stored.fbclid) || null;
    if (!fbc && fbclidForFbc) { fbc = `fb.1.${Date.now()}.${fbclidForFbc}`; setCookie("_fbc", fbc, 90); }
    next._fbp = fbp || null; next._fbc = fbc || null;
    return next;
  }
  function getAttrs() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; } }

  // --- stable anonymous external_id (Advanced Matching) ---
  const EXT_ID_KEY = "sdmx_xid_v1";
  function getExternalId() {
    let id = null;
    try { id = localStorage.getItem(EXT_ID_KEY); } catch {}
    if (!id) {
      id = uuidv4();
      try { localStorage.setItem(EXT_ID_KEY, id); } catch {}
      try { setCookie(EXT_ID_KEY, id, 365); } catch {}
    }
    return id;
  }

  // --- telemetry ---
  function track(event, extra) {
    const body = JSON.stringify({ event, ts: nowMs(), page: window.location.pathname, attrs: getAttrs(), ...(extra || {}) });
    try { if (navigator.sendBeacon) { navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" })); return; } } catch {}
    fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  }

  // --- server-side InitiateCheckout (CAPI dedup) ---
  // Fire-and-forget; never blocks the lead submission. Same event_id as browser.
  function sendServerInitiateCheckout(eventId, leadBody) {
    try {
      const payload = JSON.stringify({
        client_event_id: eventId,
        name: leadBody.name || null,
        phone: leadBody.phone || null,
        external_id: leadBody.external_id || null,
        order_value: leadBody.order_value,
        quantity: leadBody.quantity,
        attrs: {
          _fbp: (leadBody.attrs && leadBody.attrs._fbp) || null,
          _fbc: (leadBody.attrs && leadBody.attrs._fbc) || null,
          fbclid: (leadBody.attrs && leadBody.attrs.fbclid) || null,
          landing_url: (leadBody.attrs && leadBody.attrs.landing_url) || window.location.href,
        },
      });
      fetch("/api/track-ic", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true, credentials: "same-origin" }).catch(() => {});
    } catch {}
  }

  // --- Meta Pixel ---
  const FIRED = { PageView: false, ViewContent: false, InitiateCheckout: false, Lead: false };
  let CONFIG = { pixel_id: "2935651803447339", value: 125000, currency: "UZS", content_name: "Ultratovushli zararkunanda qaytargich", content_id: "ultrasonic-repeller-v1", mock_mode: false };

  function pixelInit() {
    if (!window.fbq) return;
    if (!window.__fbq_inited__) {
      // Advanced Matching: pass external_id + country so the browser pixel sends
      // extra identity signals (Meta hashes these automatically). Raises match quality.
      var am = {};
      try { var xid = getExternalId(); if (xid) am.external_id = xid; } catch {}
      am.country = "uz";
      try { fbq("init", CONFIG.pixel_id, am); } catch { fbq("init", CONFIG.pixel_id); }
      window.__fbq_inited__ = true;
    }
  }
  // Mirror a top-funnel event to server CAPI with the SAME event_id (dedup).
  function sendServerEvent(eventName, eventId) {
    try {
      var attrs = getAttrs();
      var payload = JSON.stringify({
        event_name: eventName,
        client_event_id: eventId,
        external_id: getExternalId(),
        attrs: { _fbp: attrs._fbp || null, _fbc: attrs._fbc || null, fbclid: attrs.fbclid || null, landing_url: attrs.landing_url || window.location.href },
      });
      fetch("/api/track-event", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true, credentials: "same-origin" }).catch(function () {});
    } catch {}
  }
  function firePageView() {
    if (FIRED.PageView || !window.fbq) return; pixelInit();
    var eid = uuidv4();
    fbq("track", "PageView", {}, { eventID: eid });
    sendServerEvent("PageView", eid);
    FIRED.PageView = true;
  }
  function fireViewContent() {
    if (FIRED.ViewContent || !window.fbq) return; pixelInit();
    var eid = uuidv4();
    fbq("track", "ViewContent", { content_name: CONFIG.content_name, content_category: "home_appliance", content_ids: [CONFIG.content_id], content_type: "product", value: CONFIG.value, currency: CONFIG.currency }, { eventID: eid });
    sendServerEvent("ViewContent", eid);
    FIRED.ViewContent = true;
  }
  function fireHeroCtaCustom() { if (!window.fbq) return; fbq("trackCustom", "HeroCTA_Click"); }
  function fireInitiateCheckout(eventId, value, qty) {
    if (FIRED.InitiateCheckout || !window.fbq) return; pixelInit();
    fbq("track", "InitiateCheckout", { content_name: CONFIG.content_name, content_ids: [CONFIG.content_id], num_items: qty || 1, value: value || CONFIG.value, currency: CONFIG.currency }, { eventID: eventId });
    FIRED.InitiateCheckout = true;
  }
  function fireLead(eventId, value, qty) {
    if (FIRED.Lead || !window.fbq) return; pixelInit();
    fbq("track", "Lead", { content_name: CONFIG.content_name, content_ids: [CONFIG.content_id], num_items: qty || 1, value: value || CONFIG.value, currency: CONFIG.currency }, { eventID: eventId });
    FIRED.Lead = true;
  }

  async function loadConfig() {
    try { const r = await fetch("/api/config", { credentials: "same-origin" }); if (r.ok) { Object.assign(CONFIG, (await r.json()) || {}); } } catch {}
  }

  // --- smooth scroll / CTA ---
  function bindSmoothScroll() {
    $$("[data-scrollto]").forEach((b) => {
      b.addEventListener("click", (ev) => {
        const t = document.querySelector(b.getAttribute("data-scrollto")); if (!t) return;
        ev.preventDefault();
        window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - 8, behavior: "smooth" });
        if (b.dataset.track === "hero_cta_click") { fireHeroCtaCustom(); track("hero_cta_click"); }
        // focus the first form field so mobile users can type immediately
        const nameEl = $("#nameInput");
        if (nameEl) setTimeout(() => { try { nameEl.focus({ preventScroll: true }); } catch {} }, 450);
      });
    });
  }
  function bindReveal() {
    if (!("IntersectionObserver" in window)) { $$(".reveal").forEach((e) => e.classList.add("is-in")); return; }
    const io = new IntersectionObserver((en) => { en.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } }); }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    $$(".reveal").forEach((e) => io.observe(e));
  }

  // --- phone mask ---
  function formatUZ(d) { const p = d.slice(0,9); let o=""; const a=p.slice(0,2),b=p.slice(2,5),c=p.slice(5,7),e=p.slice(7,9); if(a)o+=a; if(b)o+=(o?" ":"")+b; if(c)o+=" "+c; if(e)o+=" "+e; return o; }
  function normDigits(raw) { let d = String(raw||"").replace(/\D+/g,""); if(d.startsWith("00998"))d=d.slice(2); if(d.length===10&&d.startsWith("8"))d=d.slice(1); if(d.startsWith("998"))d=d.slice(3); return d.slice(0,9); }
  function bindPhoneMask() {
    const p = $("#phoneInput"); if (!p) return;
    p.addEventListener("input", (e) => { e.target.value = formatUZ(normDigits(e.target.value)); });
    p.addEventListener("paste", () => setTimeout(() => { p.value = formatUZ(normDigits(p.value)); }, 0));
  }

  // --- validators ---
  const NAME_RE = /^[A-Za-z\u0400-\u04FF\u02BB\u02BC\u2018\u2019' \-\u02B9]{2,40}$/;
  function validateName(v) { const s = String(v||"").trim(); if (s.length < 2) return { ok:false, msg:"To'g'ri ism kiriting (2–40 harf)" }; if (s.length > 40) return { ok:false, msg:"Ism juda uzun." }; if (!NAME_RE.test(s)) return { ok:false, msg:"Ismda faqat harflar, bo'sh joy yoki tire bo'lishi mumkin." }; return { ok:true, value:s }; }
  const OPS = new Set(["33","50","55","61","62","65","66","67","69","70","71","72","73","74","75","76","77","78","79","88","90","91","93","94","95","97","98","99"]);
  function validatePhone(d) { if (!d || d.length !== 9) return { ok:false, msg:"Telefon raqamingizni to'liq kiriting." }; if (!OPS.has(d.slice(0,2))) return { ok:false, msg:"Telefon raqami formati noto'g'ri." }; return { ok:true, value:"998"+d }; }

  function showError(m) { const el = $("#formError"); if (!el) return; el.textContent = m; el.classList.remove("hidden"); }
  function clearError() { const el = $("#formError"); if (!el) return; el.textContent = ""; el.classList.add("hidden"); }

  // --- quantity state ---
  // Single confirmed SKU only: 1 unit = 125 000 UZS (BUYO receives no quantity/value).
  const SELECTED_QTY = 1, SELECTED_PRICE = 125000;
  const selectedQty = SELECTED_QTY, selectedPrice = SELECTED_PRICE;

  // --- FormStart: once, on first interaction with any form field (v5: no steps) ---
  let formStartFired = false;
  function fireFormStartOnce() {
    if (formStartFired) return;
    formStartFired = true;
    if (window.fbq) fbq("trackCustom", "FormStart");
    track("form_start");
  }
  function bindFormStart() {
    ["#nameInput", "#phoneInput"].forEach((sel) => {
      const el = $(sel); if (!el) return;
      el.addEventListener("focus", fireFormStartOnce, { once: true });
      el.addEventListener("input", fireFormStartOnce, { once: true });
    });
  }

  // --- submit ---
  let submitInFlight = false;
  function bindForm() {
    const form = $("#orderForm"); if (!form) return;
    const nameEl = $("#nameInput"), phoneEl = $("#phoneInput");
    const btn = form.querySelector(".formSubmit");
    const label = btn.querySelector(".formSubmit__label");
    const spinner = btn.querySelector(".spinner");

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault(); if (submitInFlight) return;
      clearError();
      const nameCheck = validateName(nameEl.value);
      const phoneCheck = validatePhone(normDigits(phoneEl.value));
      if (!nameCheck.ok) { nameEl.classList.add("is-invalid"); showError(nameCheck.msg); nameEl.focus(); return; }
      nameEl.classList.remove("is-invalid");
      if (!phoneCheck.ok) { phoneEl.parentElement.classList.add("is-invalid"); showError(phoneCheck.msg); phoneEl.focus(); return; }
      phoneEl.parentElement.classList.remove("is-invalid");

      const attrs = getAttrs();
      const eventId = uuidv4();
      const body = {
        name: nameCheck.value,
        phone: "+" + phoneCheck.value,
        quantity: SELECTED_QTY,
        order_value: SELECTED_PRICE,
        attrs: {
          utm_source: attrs.utm_source || null, utm_medium: attrs.utm_medium || null,
          utm_campaign: attrs.utm_campaign || null, utm_term: attrs.utm_term || null, utm_content: attrs.utm_content || null,
          campaign_id: attrs.campaign_id || null, adset_id: attrs.adset_id || null, ad_id: attrs.ad_id || null,
          placement: attrs.placement || null, fbclid: attrs.fbclid || null,
          _fbp: attrs._fbp || null, _fbc: attrs._fbc || null,
          landing_url: attrs.landing_url || window.location.href,
          quantity: selectedQty, order_value: selectedPrice,
        },
        external_id: getExternalId(),
        client_event_id: eventId,
      };

      // InitiateCheckout — once, valid submit only.
      // Browser pixel + server CAPI share the SAME event_id (dedup).
      fireInitiateCheckout(eventId, selectedPrice, selectedQty);
      sendServerInitiateCheckout(eventId, body);
      track("valid_submit", { event_id: eventId });

      submitInFlight = true; btn.disabled = true; btn.setAttribute("aria-busy", "true");
      label.textContent = "Yuborilmoqda…"; spinner.classList.remove("hidden");

      try {
        track("api_started");
        const resp = await fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin" });
        const data = await resp.json().catch(() => ({}));
        if (resp.ok && data && data.accepted) {
          const eid = data.event_id || eventId;
          if (CONFIG.mock_mode || data.mode === "mock") {
            track("mock_buyo_accepted", { event_id: eid }); track("mock_lead_would_fire", { event_id: eid });
          } else {
            fireLead(eid, selectedPrice, selectedQty);
            track("buyo_accepted", { event_id: eid }); track("lead_success", { event_id: eid });
          }
          showSuccess();
        } else {
          track("buyo_rejected", { http: resp.status, code: (data && data.code) || "unknown" });
          showError("Buyurtmani yuborib bo'lmadi. Iltimos, bir oz kutib qayta urinib ko'ring.");
          btn.classList.add("shake"); setTimeout(() => btn.classList.remove("shake"), 400);
          submitInFlight = false; btn.disabled = false; btn.removeAttribute("aria-busy"); label.textContent = "Buyurtmani tasdiqlash"; spinner.classList.add("hidden");
        }
      } catch {
        track("api_error");
        showError("Ulanish bilan muammo. Internet aloqasini tekshirib qayta urinib ko'ring.");
        submitInFlight = false; btn.disabled = false; btn.removeAttribute("aria-busy"); label.textContent = "Buyurtmani tasdiqlash"; spinner.classList.add("hidden");
      }
    });
  }
  function showSuccess() {
    $("#orderForm").classList.add("hidden");
    const head = document.querySelector(".formCard__head"); if (head) head.classList.add("hidden");
    const urg = document.querySelector(".urgency--form"); if (urg) urg.classList.add("hidden");
    const pane = $("#successPane"); if (pane) { pane.classList.remove("hidden"); pane.scrollIntoView({ behavior: "smooth", block: "center" }); }
  }

  let formViewFired = false;
  function bindFormView() {
    const f = $("#order"); if (!f || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((en) => { en.forEach((e) => { if (e.isIntersecting && !formViewFired) { formViewFired = true; if (window.fbq) fbq("trackCustom", "FormView"); track("form_view"); io.unobserve(e.target); } }); }, { threshold: 0.3 });
    io.observe(f);
  }

  async function boot() {
    captureAttribution();
    await loadConfig();
    pixelInit(); firePageView(); fireViewContent(); track("landing_view");
    bindSmoothScroll(); bindReveal(); bindPhoneMask(); bindFormStart(); bindForm(); bindFormView();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
