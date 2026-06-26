# Savdomix Ultrasonic Repeller — Production Deploy Report

**Date:** 2026-06-26
**Domain:** https://repeller.savdomix.uz/  (Cloudflare Pages)
**Status:** LIVE IN PRODUCTION — awaiting one controlled live lead from owner.

---

## 1. What shipped
- **Emergent donor redesign** (orange #FF4500 light theme, Onest+Manrope): hero, cities ticker,
  8-pest grid, lifestyle split, 3-step "how", order form, FAQ, sticky bar, footer. Uzbek (Latin).
- **Single confirmed SKU only:** 1 unit = 125 000 so'm.
  - Bundles 2/3 (225k/315k) **DISABLED** — BUYO receives no quantity/order_value
    (only flow_id/name/phone/ip/utm_*), so multi-unit pricing was unconfirmed.
  - `199 000` strikethrough **removed everywhere** (unconfirmed discount). Clean 125 000 so'm only.
  - Server guard: `resolveOrderValue` only accepts 125000; anything else forced to 125000 / qty 1.

## 2. Infrastructure (Cloudflare)
- Pages project: `savdomix-ultrasonic-repeller` (production branch `main`).
- Deployed via `wrangler pages deploy public` (applies wrangler.toml [vars]).
- **D1 binding `AUDIT_DB` → `savdomix_audit` (44e46fb3-…)** for preview + production.
  `leads_audit` schema live (sanitized audit only — hashed phone, no raw PII, no tokens).
  (Fixed a prior misbinding to a stray `DB`→41fb65f4 with no leads_audit table.)
- **Secrets present:**
  - production: `BUYO_API_TOKEN`, `BUYO_FLOW_ID`, `META_CAPI_ACCESS_TOKEN`
  - preview: `BUYO_API_TOKEN`, `META_CAPI_ACCESS_TOKEN` (+ BUYO_FLOW_ID via wrangler var)
- **Custom domain** `repeller.savdomix.uz`: attached, DNS CNAME (proxied), SSL active. HTTP 200.
- `/api/config` → `mock_mode: false` (real BUYO + real CAPI), value 125000, pixel 2935651803447339.

## 3. Lead pipeline (functions/api/lead.js)
1. Validate name + phone (UZ canonical 998…).
2. Idempotency key = sha256(phone | day | utm_campaign)[:32]; replay-safe (no double BUYO).
3. Production guard: refuses to run if mock_mode=true in production.
4. BUYO real submit → form-urlencoded flow_id/name/phone(+998)/ip/utm_*.
5. D1 sanitized audit row written (hashed phone, last4, attribution, statuses).
6. On real BUYO accept → server CAPI Lead (same event_id as browser → dedup).
7. Returns { ok, accepted, event_id, lead_id, mode }.

## 4. Meta events (verified in code)
- PageView: once on load.
- ViewContent: once on load.
- HeroCTA_Click / FormView / FormStart: custom analytics only — never Lead.
- InitiateCheckout: exactly once, valid name+phone only, just before /api/lead, with eventID.
- Lead (browser): only after real BUYO accept; same event_id as server CAPI; deduped.
- BUYO reject/error or invalid submit: NO Lead.
- CAPI token validated live (test event → events_received:1, HTTP 200).

## 5. Verified live (repeller.savdomix.uz)
- 0 references to 199 000 / 225 000 / 315 000 / bundles.
- Only data-qty="1"; "125 000" shown consistently.
- Multi-step form works (qty → contact → summary qty 1 / 125 000 so'm). No JS errors.
- /api/config returns mock_mode:false.

## 6. Pending
- **One controlled live lead** from owner (real name + real phone via the live form).
  During test, confirm: InitiateCheckout fires once; on BUYO accept browser Lead + server CAPI
  Lead share one event_id; D1 audit row appears with status `buyo_accepted`.

## 7. Rollback
- Code: branch `backup/pre-emergent-migration-2026-06-26` @ 7c56ac5 (pre-redesign).
- Deploy: re-promote prior production deployment in CF Pages dashboard if needed.
- Current production commit: `8f6a0f7` (offer-safe single SKU).
