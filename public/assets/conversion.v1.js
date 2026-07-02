// Savdomix conversion boosters v1 — countdown, stock scarcity, social-proof toasts.
// Purely presentational. Does NOT touch the order form, /api/lead, or Meta Pixel logic.
(function () {
  "use strict";
  var $ = function (s, e) { return (e || document).querySelector(s); };
  var $$ = function (s, e) { return Array.prototype.slice.call((e || document).querySelectorAll(s)); };

  // ---------- countdown to local midnight (promo "ends today") ----------
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function tickCountdown() {
    var now = new Date();
    var end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
    var s = Math.max(0, Math.floor((end - now) / 1000));
    var t = pad(Math.floor(s / 3600)) + ":" + pad(Math.floor((s % 3600) / 60)) + ":" + pad(s % 60);
    $$(".cd-time").forEach(function (el) { el.textContent = t; });
  }
  if ($$(".cd-time").length) { tickCountdown(); setInterval(tickCountdown, 1000); }

  // ---------- stock scarcity (deterministic per day, decreases over the day) ----------
  function dayseed() {
    var d = new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }
  function stockLeft() {
    var seed = dayseed();
    var base = 11 + (seed % 5);              // 11..15 at the start of the day
    var drop = Math.floor(new Date().getHours() / 2); // -1 every 2 hours
    return Math.max(3, base - drop);
  }
  function renderStock() {
    var left = stockLeft();
    var total = 20;
    var el = $("#stockNum"); if (el) el.textContent = left;
    var fill = $("#stockFill"); if (fill) fill.style.width = Math.max(12, Math.round((left / total) * 100)) + "%";
  }
  if ($("#stockNum")) { renderStock(); setInterval(renderStock, 60000); }

  // ---------- social proof toasts ----------
  var ORDERS = [
    ["Dilnoza", "Toshkent"], ["Sardor", "Samarqand"], ["Nigora", "Andijon"],
    ["Bekzod", "Farg'ona"], ["Malika", "Namangan"], ["Jasur", "Buxoro"],
    ["Zilola", "Toshkent"], ["Otabek", "Qarshi"], ["Gulnora", "Nukus"],
    ["Aziz", "Toshkent"], ["Feruza", "Samarqand"], ["Ulug'bek", "Xiva"],
    ["Kamola", "Jizzax"], ["Rustam", "Termiz"]
  ];
  var MINUTES = [2, 4, 5, 7, 9, 11, 14, 17, 21, 26];
  var SP_KEY = "sdmx_sp_count";
  var MAX_PER_SESSION = 5;

  function spCount() { try { return parseInt(sessionStorage.getItem(SP_KEY) || "0", 10); } catch (e) { return 0; } }
  function spInc() { try { sessionStorage.setItem(SP_KEY, String(spCount() + 1)); } catch (e) {} }

  var toastEl = null, hideTimer = null, idx = Math.floor(Math.random() * ORDERS.length);
  function ensureToast() {
    if (toastEl) return toastEl;
    toastEl = document.createElement("div");
    toastEl.className = "sp-toast";
    toastEl.setAttribute("aria-live", "polite");
    toastEl.innerHTML = '<div class="sp-toast__ic">✅</div><div><div class="sp-toast__name"></div><div class="sp-toast__text"></div></div>';
    document.body.appendChild(toastEl);
    toastEl.addEventListener("click", function () { toastEl.classList.remove("show"); });
    return toastEl;
  }
  function showToast() {
    if (document.hidden || spCount() >= MAX_PER_SESSION) return;
    var el = ensureToast();
    var o = ORDERS[idx % ORDERS.length]; idx++;
    var m = MINUTES[Math.floor(Math.random() * MINUTES.length)];
    el.querySelector(".sp-toast__name").textContent = o[0] + " (" + o[1] + ")";
    el.querySelector(".sp-toast__text").textContent = m + " daqiqa oldin buyurtma berdi";
    el.classList.add("show");
    spInc();
    clearTimeout(hideTimer);
    hideTimer = setTimeout(function () { el.classList.remove("show"); }, 5200);
  }
  function scheduleNext(first) {
    if (spCount() >= MAX_PER_SESSION) return;
    var delay = first ? 9000 : 26000 + Math.random() * 18000;
    setTimeout(function () { showToast(); scheduleNext(false); }, delay);
  }
  scheduleNext(true);
})();
