// Savdomix landing — vanilla JS (Meta Pixel + form + attribution + telemetry).
// All API calls hit /api/* (Cloudflare Pages Functions in production,
// a FastAPI mirror in the Emergent preview environment).

(function () {
  "use strict";

  // --- helpers ----------------------------------------------------
  const $ = (sel, el) => (el || document).querySelector(sel);
  const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));

  function nowMs() { return Date.now(); }

  function uuidv4() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    const b = new Uint8Array(16);
    crypto.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
    return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;
  }

  function setCookie(name, value, days) {
    const exp = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${exp}; path=/; SameSite=Lax`;
  }
  function getCookie(name) {
    const m = document.cookie.match(new RegExp("(?:^|; )" + name.replace(/[.$?*|{}()\[\]\\\/+^]/g, "\\$&") + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : null;
  }

  // --- attribution capture ---------------------------------------
  const ATTR_KEYS = ["utm_source","utm_medium","utm_campaign","utm_term","utm_content",
                     "campaign_id","adset_id","ad_id","placement","fbclid"];
  const STORAGE_KEY = "sdmx_attr_v1";

  function captureAttribution() {
    const url = new URL(window.location.href);
    const params = url.searchParams;
    let stored = null;
    try { stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); } catch { stored = null; }
    const next = stored && typeof stored === "object" ? { ...stored } : {};
    let updated = false;
    ATTR_KEYS.forEach((k) => {
      const v = params.get(k);
      if (v && (!next[k] || k === "fbclid")) { next[k] = v.slice(0, 256); updated = true; }
    });
    next.landing_url = window.location.href;
    next.referrer = document.referrer || null;
    if (!stored || updated) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    }

    // _fbp: create if missing
    let fbp = getCookie("_fbp");
    if (!fbp) {
      const rand = Math.floor(Math.random() * 1e10);
      fbp = `fb.1.${Date.now()}.${rand}`;
      setCookie("_fbp", fbp, 90);
    }
    // _fbc: build from fbclid if missing
    let fbc = getCookie("_fbc");
    if (!fbc && (next.fbclid || params.get("fbclid"))) {
      const f = next.fbclid || params.get("fbclid");
      fbc = `fb.1.${Date.now()}.${f}`;
      setCookie("_fbc", fbc, 90);
    }
    next._fbp = fbp || null;
    next._fbc = fbc || null;
    return next;
  }

  // --- telemetry --------------------------------------------------
  function track(event, extra) {
    const body = JSON.stringify({
      event,
      ts: nowMs(),
      page: window.location.pathname,
      attrs: getAttrs(),
      ...(extra || {}),
    });
    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon("/api/track", blob);
        return;
      }
    } catch { /* fallthrough */ }
    fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  }
  function getAttrs() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; }
  }

  // --- Meta Pixel -------------------------------------------------
  const PIXEL_FIRED = { PageView: false, ViewContent: false, InitiateCheckout: false, Lead: false };
  let CONFIG = { pixel_id: "2935651803447339", value: 125000, currency: "UZS", content_name: "Ultratovushli zararkunanda qaytargich", content_id: "ultrasonic-repeller-v1", mock_mode: false };

  function pixelInit() {
    if (!window.fbq) return;
    if (!window.__fbq_inited__) {
      fbq("init", CONFIG.pixel_id);
      window.__fbq_inited__ = true;
    }
  }
  function firePageView() {
    if (PIXEL_FIRED.PageView || !window.fbq) return;
    pixelInit();
    fbq("track", "PageView");
    PIXEL_FIRED.PageView = true;
  }
  function fireViewContent() {
    if (PIXEL_FIRED.ViewContent || !window.fbq) return;
    pixelInit();
    fbq("track", "ViewContent", {
      content_name: CONFIG.content_name,
      content_category: "home_appliance",
      content_ids: [CONFIG.content_id],
      content_type: "product",
      value: CONFIG.value,
      currency: CONFIG.currency,
    });
    PIXEL_FIRED.ViewContent = true;
  }
  function fireHeroCtaCustom() {
    if (!window.fbq) return;
    fbq("trackCustom", "HeroCTA_Click");
  }
  function fireFormView() {
    if (!window.fbq) return;
    fbq("trackCustom", "FormView");
  }
  function fireFormStart() {
    if (!window.fbq) return;
    fbq("trackCustom", "FormStart");
  }
  function fireInitiateCheckout(eventId) {
    if (PIXEL_FIRED.InitiateCheckout || !window.fbq) return;
    pixelInit();
    fbq("track", "InitiateCheckout", {
      content_name: CONFIG.content_name,
      content_ids: [CONFIG.content_id],
      value: CONFIG.value,
      currency: CONFIG.currency,
    }, { eventID: eventId });
    PIXEL_FIRED.InitiateCheckout = true;
  }
  function fireLead(eventId) {
    if (PIXEL_FIRED.Lead || !window.fbq) return;
    pixelInit();
    fbq("track", "Lead", {
      content_name: CONFIG.content_name,
      content_ids: [CONFIG.content_id],
      value: CONFIG.value,
      currency: CONFIG.currency,
    }, { eventID: eventId });
    PIXEL_FIRED.Lead = true;
  }

  // --- Config fetch ----------------------------------------------
  async function loadConfig() {
    try {
      const r = await fetch("/api/config", { credentials: "same-origin" });
      if (r.ok) {
        const d = await r.json();
        Object.assign(CONFIG, d || {});
      }
    } catch { /* keep defaults */ }
  }

  // --- Smooth scroll for CTA buttons ------------------------------
  function bindSmoothScroll() {
    $$("[data-scrollto]").forEach((b) => {
      b.addEventListener("click", (ev) => {
        const sel = b.getAttribute("data-scrollto");
        const target = sel ? document.querySelector(sel) : null;
        if (!target) return;
        ev.preventDefault();
        const top = target.getBoundingClientRect().top + window.scrollY - 8;
        window.scrollTo({ top, behavior: "smooth" });
        if (b.dataset.track === "hero_cta_click") {
          fireHeroCtaCustom();
          track("hero_cta_click");
        }
      });
    });
  }

  // --- Reveal on scroll ------------------------------------------
  function bindReveal() {
    if (!("IntersectionObserver" in window)) {
      $$(".reveal").forEach((el) => el.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } });
    }, { root: null, threshold: 0.12, rootMargin: "0px 0px -10% 0px" });
    $$(".reveal").forEach((el) => io.observe(el));
  }

  // --- Phone mask (Uzbek, +998) -----------------------------------
  function formatUZ(d) {
    const p = d.slice(0, 9);
    const a = p.slice(0, 2);
    const b = p.slice(2, 5);
    const c = p.slice(5, 7);
    const e = p.slice(7, 9);
    let out = "";
    if (a) out += a;
    if (b) out += (out ? " " : "") + b;
    if (c) out += " " + c;
    if (e) out += " " + e;
    return out;
  }
  function normalizeInputToDigits(raw) {
    let digits = String(raw || "").replace(/\D+/g, "");
    if (digits.startsWith("00998")) digits = digits.slice(2);
    if (digits.length === 10 && digits.startsWith("8")) digits = digits.slice(1);
    if (digits.startsWith("998")) digits = digits.slice(3);
    return digits.slice(0, 9);
  }
  function bindPhoneMask() {
    const phone = $("#phoneInput");
    if (!phone) return;
    phone.addEventListener("input", (ev) => {
      const digits = normalizeInputToDigits(ev.target.value);
      ev.target.value = formatUZ(digits);
    });
    phone.addEventListener("paste", () => {
      setTimeout(() => {
        const digits = normalizeInputToDigits(phone.value);
        phone.value = formatUZ(digits);
      }, 0);
    });
  }

  // --- Form validators -------------------------------------------
  // Accept both Latin and Cyrillic Uzbek names
  const MIXED_NAME_RE = /^[A-Za-z\u0400-\u04FF\u02BB\u02BC\u2018\u2019' \-\u02B9]{2,40}$/;
  function validateName(v) {
    const s = String(v || "").trim();
    if (s.length < 2) return { ok: false, code: "too_short", msg: "Iltimos, ismingizni kiriting." };
    if (s.length > 40) return { ok: false, code: "too_long", msg: "Ism juda uzun." };
    if (!MIXED_NAME_RE.test(s)) return { ok: false, code: "invalid", msg: "Ismda faqat harflar, bo'sh joy yoki tire bo'lishi mumkin." };
    return { ok: true, value: s };
  }
  function validatePhoneDigits(d) {
    if (!d || d.length !== 9) return { ok: false, code: "phone", msg: "Telefon raqamingizni to‘liq kiriting." };
    const op = d.slice(0, 2);
    const allowed = new Set(["33","50","55","61","62","65","66","67","69",
                              "70","71","72","73","74","75","76","77","78","79",
                              "88","90","91","93","94","95","97","98","99"]);
    if (!allowed.has(op)) return { ok: false, code: "phone_op", msg: "Bunday telefon raqami formati noto‘g‘ri." };
    return { ok: true, value: "998" + d };
  }

  function showError(msg) {
    const el = $("#formError");
    if (!el) return;
    el.textContent = msg;
    el.classList.remove("hidden");
  }
  function clearError() {
    const el = $("#formError");
    if (!el) return;
    el.textContent = "";
    el.classList.add("hidden");
  }

  // --- Form submit -----------------------------------------------
  let submitInFlight = false;
  let formStartFired = false;
  function bindForm() {
    const form = $("#orderForm");
    if (!form) return;
    const nameEl = $("#nameInput");
    const phoneEl = $("#phoneInput");
    const submitBtn = form.querySelector(".formSubmit");
    const submitLabel = submitBtn.querySelector(".formSubmit__label");
    const spinner = submitBtn.querySelector(".spinner");

    const onFirstInteraction = () => {
      if (formStartFired) return;
      formStartFired = true;
      fireFormStart();
      track("form_start");
    };
    [nameEl, phoneEl].forEach((el) => {
      el.addEventListener("focus", onFirstInteraction, { once: true });
      el.addEventListener("input", onFirstInteraction, { once: true });
    });

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      if (submitInFlight) return;

      clearError();
      const nameCheck = validateName(nameEl.value);
      const digits = normalizeInputToDigits(phoneEl.value);
      const phoneCheck = validatePhoneDigits(digits);

      if (!nameCheck.ok) {
        nameEl.classList.add("is-invalid");
        showError(nameCheck.msg);
        nameEl.focus();
        return;
      } else { nameEl.classList.remove("is-invalid"); }

      if (!phoneCheck.ok) {
        phoneEl.classList.add("is-invalid");
        showError(phoneCheck.msg);
        phoneEl.focus();
        return;
      } else { phoneEl.classList.remove("is-invalid"); }

      // Build payload
      const attrs = getAttrs();
      const eventId = uuidv4();
      const body = {
        name: nameCheck.value,
        phone: "+" + phoneCheck.value,  // +998XXXXXXXXX
        attrs: {
          utm_source: attrs.utm_source || null,
          utm_medium: attrs.utm_medium || null,
          utm_campaign: attrs.utm_campaign || null,
          utm_term: attrs.utm_term || null,
          utm_content: attrs.utm_content || null,
          campaign_id: attrs.campaign_id || null,
          adset_id: attrs.adset_id || null,
          ad_id: attrs.ad_id || null,
          placement: attrs.placement || null,
          fbclid: attrs.fbclid || null,
          _fbp: attrs._fbp || null,
          _fbc: attrs._fbc || null,
          landing_url: attrs.landing_url || window.location.href,
        },
        client_event_id: eventId,
      };

      // InitiateCheckout (once, valid submit only)
      fireInitiateCheckout(eventId);
      track("valid_submit", { event_id: eventId });

      // UI: loading
      submitInFlight = true;
      submitBtn.disabled = true;
      submitBtn.setAttribute("aria-busy", "true");
      submitLabel.textContent = "Yuborilmoqda…";
      spinner.classList.remove("hidden");

      try {
        track("api_started");
        const resp = await fetch("/api/lead", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          credentials: "same-origin",
        });
        const data = await resp.json().catch(() => ({}));

        if (resp.ok && data && data.accepted) {
          // Use server's event_id (single source of truth for dedup)
          const serverEid = data.event_id || eventId;
          if (CONFIG.mock_mode || data.mode === "mock") {
            track("mock_buyo_accepted", { event_id: serverEid });
            track("mock_lead_would_fire", { event_id: serverEid });
          } else {
            fireLead(serverEid);
            track("buyo_accepted", { event_id: serverEid });
            track("lead_success", { event_id: serverEid });
          }
          showSuccess();
        } else {
          track("buyo_rejected", { http: resp.status, code: (data && data.code) || "unknown" });
          showError("Buyurtmani yuborib bo‘lmadi. Iltimos, bir oz kutib qayta urinib ko‘ring.");
          submitBtn.classList.add("shake");
          setTimeout(() => submitBtn.classList.remove("shake"), 400);
          submitInFlight = false;
          submitBtn.disabled = false;
          submitBtn.removeAttribute("aria-busy");
          submitLabel.textContent = "Buyurtmani yuborish";
          spinner.classList.add("hidden");
        }
      } catch (e) {
        track("api_error");
        showError("Ulanish bilan muammo. Internet aloqasini tekshirib qayta urinib ko‘ring.");
        submitInFlight = false;
        submitBtn.disabled = false;
        submitBtn.removeAttribute("aria-busy");
        submitLabel.textContent = "Buyurtmani yuborish";
        spinner.classList.add("hidden");
      }
    });
  }

  function showSuccess() {
    const card = $(".formCard");
    const form = $("#orderForm");
    const pane = $("#successPane");
    if (form) form.classList.add("hidden");
    if (card && card.querySelector(".formCard__head")) card.querySelector(".formCard__head").classList.add("hidden");
    if (pane) pane.classList.remove("hidden");
    pane && pane.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // --- FormView when form scrolls into view ----------------------
  let formViewFired = false;
  function bindFormViewObserver() {
    const form = $("#form");
    if (!form || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && !formViewFired) {
          formViewFired = true;
          fireFormView();
          track("form_view");
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.35 });
    io.observe(form);
  }

  // --- Boot -------------------------------------------------------
  async function boot() {
    captureAttribution();
    await loadConfig();
    pixelInit();
    // Fire PageView and ViewContent ONCE, after config is ready.
    firePageView();
    fireViewContent();
    track("landing_view");

    bindSmoothScroll();
    bindReveal();
    bindPhoneMask();
    bindForm();
    bindFormViewObserver();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
