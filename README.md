# Savdomix — Ultratovushli zararkunanda qaytargich

Production landing page for Savdomix's ultrasonic pest repeller (UZ market,
Uzbek Latin, mobile-first, Meta Ads traffic, cash on delivery).

## Runtime

- **Static frontend**: `./public/` (vanilla HTML/CSS/JS, no React, no Tailwind in bundle).
- **API**: Cloudflare Pages Functions in `./functions/api/`.
- **DB**: Cloudflare D1 — sanitized audit log only (no raw PII).
- **Source of truth for full lead data**: BUYO (`https://api.buyo.network`).
- **Meta**: Pixel + Conversions API — Browser + Server `Lead` dedup via shared `event_id`.

## Architecture

```
Browser form
  → POST /api/lead  (Cloudflare Pages Function)
      → validate + idempotency check
      → BUYO adapter (real | mock)
      → sanitized D1 audit insert
      → if BUYO accepted: Meta CAPI Lead (same event_id)
  ← { ok, accepted, event_id }
Browser fires Pixel Lead with same event_id (dedup)
Success screen shown
```

## Required environment variables (server-side only, never committed)

Set via `wrangler pages secret put` or the Cloudflare dashboard:

| Name                      | Purpose                                         | Notes                                  |
|---------------------------|-------------------------------------------------|----------------------------------------|
| `BUYO_API_TOKEN`          | Bearer token for BUYO API                       | Server-only                            |
| `BUYO_FLOW_ID`            | Active ultrasonic repeller flow ID              | `zra4weGe02NE` (verified via /flows)   |
| `META_CAPI_ACCESS_TOKEN`  | Meta Conversions API access token               | Server-only                            |
| `META_TEST_EVENT_CODE`    | Optional, for Meta Test Events                  | Leave empty in production              |

Non-secret defaults (already in `wrangler.toml [vars]`):

| Name                  | Default value                                  |
|-----------------------|------------------------------------------------|
| `META_PIXEL_ID`       | `2935651803447339`                             |
| `BUYO_API_BASE`       | `https://api.buyo.network`                     |
| `BUYO_MOCK_MODE`      | `false`                                        |
| `PRODUCT_VALUE_UZS`   | `125000`                                       |
| `PRODUCT_CURRENCY`    | `UZS`                                          |

## Local development

```bash
# 1) Install Wrangler
npm install

# 2) Create local D1
npx wrangler d1 create savdomix_audit
# Copy database_id into wrangler.toml

# 3) Apply schema
npm run db:apply:local

# 4) Run
npm run dev          # http://localhost:8788
```

## Deploy

```bash
npx wrangler login
npm run db:apply:remote
npm run deploy
```

After the first deploy, set secrets in the dashboard or via:

```bash
npx wrangler pages secret put BUYO_API_TOKEN --project-name savdomix-ultrasonic-repeller
npx wrangler pages secret put BUYO_FLOW_ID --project-name savdomix-ultrasonic-repeller
npx wrangler pages secret put META_CAPI_ACCESS_TOKEN --project-name savdomix-ultrasonic-repeller
```

## Rollback

Cloudflare Pages keeps every deployment. To roll back:

1. Open Cloudflare Dashboard → Pages → `savdomix-ultrasonic-repeller` → Deployments.
2. Select the previous good deployment.
3. Click **Rollback to this deployment**.

The old deflector project (`braindiggeruz/conditioner-deflector-landing` →
`deflector.savdomix.uz`) is untouched and remains available as the historical
baseline.
