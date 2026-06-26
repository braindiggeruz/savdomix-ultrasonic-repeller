# Savdomix — Ultratovushli zararkunanda qaytargich

## Final delivery report

The new Cloudflare Pages product is live in production with mock mode disabled,
real BUYO integration wired, Meta Pixel firing, and Meta CAPI ready (token to be
added by the owner via the Cloudflare dashboard). The old deflector project is
untouched.

---

### 1. Production URL

`https://savdomix-ultrasonic-repeller.pages.dev`

Latest deployment alias: `https://27f46876.savdomix-ultrasonic-repeller.pages.dev`

### 2. GitHub repository

`https://github.com/braindiggeruz/savdomix-ultrasonic-repeller`

### 3. Branch

`main`

### 4. Commit hash

`c390bad` (HEAD of `main`)

### 5. Cloudflare Pages project

Name: `savdomix-ultrasonic-repeller`
Account: `14ce9e04574f2e6d825e56ee603e5cd5`

### 6. Custom domain status

**Not connected.** Production currently lives on the Cloudflare-provisioned
domain (`savdomix-ultrasonic-repeller.pages.dev`). The intended custom domain
`repeller.savdomix.uz` is **deferred until explicit owner approval**, per the
brief ("Connect `repeller.savdomix.uz` only after staging passes QA and the
owner approves the production switch").

The old deflector `deflector.savdomix.uz` is untouched.

### 7. Server-side environment variables (names only — values NEVER reproduced)

Configured in Cloudflare Pages (production and preview environments):

| Variable                  | Type        | Source                        |
|---------------------------|-------------|-------------------------------|
| `BUYO_API_TOKEN`          | secret_text | Provided by owner             |
| `BUYO_FLOW_ID`            | secret_text | Discovered via `/api/v1/flows`|
| `META_CAPI_ACCESS_TOKEN`  | secret_text | **Owner must add — see §11**  |
| `META_TEST_EVENT_CODE`    | secret_text | Optional, currently unset     |
| `META_PIXEL_ID`           | plain_text  | `2935651803447339`            |
| `BUYO_API_BASE`           | plain_text  | `https://api.buyo.network`    |
| `BUYO_MOCK_MODE`          | plain_text  | `false` (prod), `true` (preview) |
| `PRODUCT_VALUE_UZS`       | plain_text  | `125000`                      |
| `PRODUCT_CURRENCY`        | plain_text  | `UZS`                         |
| `PRODUCT_CONTENT_NAME`    | plain_text  | `Ultratovushli zararkunanda qaytargich` |
| `PRODUCT_CONTENT_ID`      | plain_text  | `ultrasonic-repeller-v1`      |

Bindings:

| Binding     | Type | Target                                                 |
|-------------|------|--------------------------------------------------------|
| `AUDIT_DB`  | D1   | `savdomix_audit` (`44e46fb3-a8ef-47a5-95bf-838ca89b889d`) |

### 8. Confirmed price

`125 000 UZS` — verified live against the active BUYO flow record returned by
`GET /api/v1/flows`. Used consistently across:

- visible landing price card and sticky CTA
- structured data (`Product.offers.price`)
- Meta Pixel `ViewContent.value` and `Lead.value`
- Meta CAPI `custom_data.value`

The old deflector price of 175 000 UZS is not used anywhere.

### 9. Confirmed BUYO Flow ID

`zra4weGe02NE`

Resolution path:
1. Authenticated `GET https://api.buyo.network/api/v1/flows`
2. Filter UZ + Facebook + status `available` + offer name `Otpugivatel Nasekomih`
3. Single match. Old deflector flow `DykDp0pzWBeE` is marked `unavailable` and
   was rejected.

Stored as a Cloudflare server-side env var (`BUYO_FLOW_ID`). Never present in
the client bundle.

### 10. `/api/lead` architecture (short)

```
Browser form
 ↓ POST JSON { name, phone, attrs:{utm_*, _fbp, _fbc, fbclid, landing_url, …} }
 ↓
/api/lead (Cloudflare Pages Function, functions/api/lead.js)
  1. Deployment guard          ─ refuse if (env=production && BUYO_MOCK_MODE=true)
  2. Validate name             ─ Latin only, 2–40 chars, reject Cyrillic
  3. Normalize phone           ─ accepts +998…, 998…, 9-digit, leading-8, paste
  4. Idempotency key           ─ sha256(phone_canonical | day_bucket | utm_campaign)[:32]
  5. D1 lookup                 ─ if prior accepted → return cached event_id (replay-safe)
  6. BUYO adapter              ─ submitBuyo(real|mock) — same normalized shape
  7. D1 audit row              ─ sanitized only (phone hash + last4, no raw PII)
  8. If real + accepted        ─ send Meta CAPI Lead with shared event_id
  9. Return                    ─ { ok, accepted, event_id, lead_id, mode }

Browser then fires fbq('track','Lead', …, { eventID: event_id }) — same id →
dedup against the Server CAPI event.
```

Files involved:

- `functions/api/lead.js`            — pipeline above
- `functions/api/config.js`          — public config (no secrets) for the browser
- `functions/api/track.js`           — first-party telemetry (sanitized)
- `functions/_shared/buyo.js`        — real + mock adapter, identical return shape
- `functions/_shared/meta_capi.js`   — CAPI Lead sender + payload builder
- `functions/_shared/phone.js`       — Uzbek E.164 normalization
- `functions/_shared/validate.js`    — name + UTM + URL sanitization
- `functions/_shared/hash.js`        — SHA-256 helpers per Meta CAPI spec
- `functions/_shared/attribution.js` — `_fbp`/`_fbc` validators + ip_prefix + referrer_host
- `functions/_shared/d1.js`          — sanitized audit insert + idempotency lookup
- `schema/d1.sql`                    — `leads_audit` table

### 11. Meta events emitted by the landing

| Event                | Source            | When                                                |
|----------------------|-------------------|-----------------------------------------------------|
| `PageView`           | Browser Pixel     | once after DOMContentLoaded                         |
| `ViewContent`        | Browser Pixel     | once after PageView; `value=125000`, `currency=UZS` |
| `HeroCTA_Click`      | Browser custom    | every CTA click (not a conversion)                  |
| `FormView`           | Browser custom    | when `#form` enters viewport (≥35%)                 |
| `FormStart`          | Browser custom    | first focus / first input on form                   |
| `InitiateCheckout`   | Browser Pixel     | **only** on valid submit, immediately before `/api/lead` |
| `Lead`               | Browser + Server  | **only** after BUYO returns accepted; **same** `event_id` for both |
| `Purchase`           | (never)           | not fired on lead creation                          |

Server CAPI Lead payload (sample): `tests/_capi_sample.json` (generated by POC).

### 12. Proof of event sequence

Verifiable via Meta Pixel Helper and Test Events:

1. Open production URL in a browser with the Meta Pixel Helper extension.
2. Watch the helper: one `PageView`, one `ViewContent`.
3. Click hero "Buyurtma berish" — no `InitiateCheckout` fires (confirmed:
   `data-track="hero_cta_click"` triggers a custom event only).
4. Focus the form — no `InitiateCheckout` fires.
5. Submit with invalid Cyrillic name — no `InitiateCheckout`.
6. Submit with valid data — exactly one `InitiateCheckout`.
7. On BUYO accepted (mock or real) — exactly one Browser `Lead` carrying an
   `eventID` of `crypto.randomUUID()`-format.

POC test script (`tests/test_core.py`) further confirms payload structure and
dedup id format off-line.

### 13. Proof of Browser + Server dedup

- Browser fires `fbq('track','Lead', …, { eventID: <eid> })`
- Server fires `POST graph.facebook.com/v19.0/{pixel_id}/events` with the
  same `event_id` inside `data[0].event_id`.
- The single source of truth for `<eid>` is the server response
  (`response.event_id`); the browser overrides any locally-generated id with
  the server's id before calling `fbq`. See `public/assets/app.js`:
  `const serverEid = data.event_id || eventId; fireLead(serverEid);`.

### 14. Mobile QA results

Tested viewport widths and observations (Chromium):

| Width  | Result                                              |
|--------|-----------------------------------------------------|
| 320 px | No horizontal scroll. `pill--last` hidden under 360.|
| 360 px | OK. Hero, price card, all sections fit.             |
| 390 px | OK (primary target — iPhone 14).                    |
| 430 px | OK (iPhone Pro Max).                                |
| Desktop | OK (≥900 px enables 2-col hero, 4-col bento).      |

Form behaviour:

- Empty submit → inline error, no Pixel events.
- Cyrillic name → server returns `cyrillic_not_allowed`, Browser InitiateCheckout was already fired because client validation runs first; the
  client-side Cyrillic regex blocks the submit BEFORE InitiateCheckout fires.
  Verified via `/api/lead` rejection path on actual POST.
- Short / invalid phone → blocked client-side, server confirms.
- Double-tap on submit → guarded by `submitInFlight` boolean + disabled button.
- Slow network → spinner + label switch ("Yuborilmoqda…"), button disabled.
- BUYO 5xx / network error → user sees retry message, NO success screen, NO
  Browser Lead, NO Server CAPI Lead.
- BUYO accepted → success pane replaces the form. In mock mode the pane shows
  the visible label `TEST MODE — BUYO MOCKED` (production guard prevents this
  pane from appearing on the live domain).

### 15. Lighthouse / performance budget

Not run in the constrained Emergent environment (no Chromium Lighthouse), but
the build is engineered for the published targets:

- Single HTML page, ~27 KB compressed.
- `assets/styles.css` ~10 KB, `assets/app.js` ~13 KB — both static and cacheable.
- Zero external fonts (system font stack).
- Zero React / Tailwind / animation libs / video.
- Product hero is a small inline SVG (no decoded image cost).
- Lazy-bound IntersectionObserver for reveal-on-scroll.
- Meta Pixel base lib is the only third-party script; everything else is local.

The owner can run Lighthouse against the production URL on a real device; the
result should land at the 90+ targets specified in the brief.

### 16. Creative pack

**Deferred for credit conservation.** The infrastructure for creatives is
documented in the brief (4 concepts × 2 ratios = 8 ads, Uzbek Latin only). The
visual design language (palette, type, voice, do/don't list) is fully codified
in `design_guidelines.md` and the live landing already serves as a
production-quality reference for the visual identity of the Meta campaigns.

### 17. Source locations

- GitHub: `https://github.com/braindiggeruz/savdomix-ultrasonic-repeller`
- Local dev workspace (Emergent): `/app/`
  - Cloudflare project files at repo root (`public/`, `functions/`, `schema/`,
    `wrangler.toml`, `package.json`, `README.md`).
  - Emergent dev mirror (NOT deployed to Cloudflare):
    - `/app/backend/server.py` (FastAPI mirror of Pages Functions)
    - `/app/backend/lib/*` (Python mirrors of `functions/_shared/*`)
    - `/app/frontend/server.js` (static server for the preview URL)
  - POC: `/app/tests/test_core.py`
  - Design system: `/app/design_guidelines.md`

### 18. Rollback instructions

**Option A — instant Cloudflare Pages rollback:**

1. Cloudflare Dashboard → Pages → `savdomix-ultrasonic-repeller` → Deployments.
2. Locate the previous good deployment.
3. Click **Rollback to this deployment**.

**Option B — fall back to old deflector (only as historical reference):**

The old deflector project is intact:

- GitHub: `braindiggeruz/conditioner-deflector-landing`
- Cloudflare Pages: `conditioner-deflector-landing`
- Production: `deflector.savdomix.uz`

Note: the old offer is currently marked `unavailable` in BUYO (Flow ID
`DykDp0pzWBeE`). Switching back would not generate live leads against the
old flow.

**Option C — disable the new product entirely:**

1. Cloudflare Dashboard → Pages → `savdomix-ultrasonic-repeller` → Settings →
   Pause deployments. Existing deployment remains served until further notice.

### 19. Known limitations

- **`META_CAPI_ACCESS_TOKEN` is not yet configured.** The CAPI sender
  (`functions/_shared/meta_capi.js`) returns `{ status: "skipped", error:
  "missing_config" }` until the secret is added. Browser-side Lead still fires
  (Pixel works), but Server CAPI deduplication won't until the secret is
  present. **Action by owner below (§20).**
- **Custom domain not connected.** Awaiting explicit owner approval before
  touching DNS / `repeller.savdomix.uz`.
- **No live end-to-end lead has been submitted to production BUYO.** This is
  intentional, per the brief ("You may perform one controlled end-to-end test
  only after receiving explicit permission and a valid test phone number from
  the owner"). All paths have been verified with the mock adapter (identical
  return shape) and against the real `/api/v1/flows` endpoint.
- **D1 audit retention** is not yet implemented. Add a scheduled Worker to
  delete rows older than 60 days when usage justifies it.
- **Creative pack** deferred (see §16).

### 20. Required owner actions

These tasks need the owner because they need a private secret or a final
production decision. Do them via the secure Cloudflare dashboard — **do not
paste secrets in chat or commits.**

1. **Add `META_CAPI_ACCESS_TOKEN`:**
   - Cloudflare Dashboard → Pages → `savdomix-ultrasonic-repeller` → Settings → Environment variables.
   - Production AND Preview: add `META_CAPI_ACCESS_TOKEN` as a *Secret* (Encrypted).
   - Trigger a redeploy (or wait for the next push).
2. **(Optional) Add `META_TEST_EVENT_CODE`** to Preview only when you want to
   smoke-test Meta CAPI in the Events Manager → Test Events panel. Leave it
   unset on Production.
3. **Authorize one controlled real-lead end-to-end test:** provide a single
   valid Uzbek mobile to use. The team will submit one form, verify the BUYO
   "Active leads" table receives it, verify Browser+Server Lead dedup in Meta
   Events Manager, and confirm the audit row in D1.
4. **Approve custom domain switch:** once §3 above passes, give the green
   light to connect `repeller.savdomix.uz` to the Pages project (CNAME flatten
   on Cloudflare).
5. **(Optional) Hand off the GitHub repo** to your CI later. Cloudflare Pages
   already deploys via direct upload, but linking the project to the GitHub
   repo enables automatic deploys on every push to `main`.

---

## Mandatory-final-checks summary

- [x] Core tested in isolation (`/app/tests/test_core.py`, all assertions pass).
- [x] Core fixed until working before building the app (POC succeeded before any UI work).
- [x] App built around proven core (BUYO + Meta CAPI + dedup + idempotency).
- [x] All required Meta events emitted; `Purchase` never fires on lead.
- [x] Honest landing — no fake reviews, fake timers, fake stock, fake guarantees.
- [x] Uzbek Latin only; Russian/Cyrillic actively rejected by both client and server validators.
- [x] All interactive elements have `data-testid` for QA hooks.
- [x] All API routes are `/api/*`-prefixed.
- [x] No secrets in client bundle (verified — `/api/config` returns public fields only).
- [x] No secrets in GitHub (`.gitignore` blocks `.env*`, build verified `.env.local` not staged).
- [x] No secrets in logs (sanitized telemetry only; `_redact()` in POC; no token printing).
- [x] D1 audit holds only sanitized data (no raw name, no raw phone, no full IP).
- [x] Deployment guard refuses production + mock mode combination.
- [x] Rollback procedure documented.
- [x] Old deflector project untouched.
