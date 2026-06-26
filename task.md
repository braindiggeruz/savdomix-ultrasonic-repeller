# Repeller landing — audit improvement (45/100 → better)

## DONE this session (copy-independent, safe)
- [x] loading="lazy" on form thumb + sticky thumb (below-fold imgs)
- [x] FIXED mobile bug: .order__grid had no responsive collapse → form card clipped on right edge. Added @media(max-width:860px) single-col. Verified 0 horizontal overflow.
- [x] "125 000 so'm dan" → "125 000 so'm" (removed misleading "from"/tier implication, single SKU)

## WAITING ON OWNER (form open) — blocks remaining copy work
1. Which trust blocks to add (real data only — no fabrication)
2. Footer contact text (phone/Telegram)
3. "15 daqiqada qo'ng'iroq" claim → keep / soften / remove (lines ~50,159,224)
4. Deploy: preview-first vs straight-to-prod

## AFTER ANSWERS
- Hero H1/H2 benefit-led Uzbek improvement (current H1: "8 turdagi zararkunandadan 7 kunda himoya")
- Add testimonials section ONLY if real provided
- Add footer contacts ONLY if provided
- Apply 15-min claim decision (3 spots)
- Uzbek grammar proofread
- Local QA (desktop+mobile, full flow), commit+push, deploy per Q4
- Verify live, update FINAL_REPORT.md

## DO NOT TOUCH
- app.js Pixel event semantics (audit-compliant already)
- Offer: 1 unit=125000 only, no bundles
- Server resolveOrderValue (125000 only)

## ENV
- server: tmux httpd :8099
- deploy: wrangler pages deploy public --project-name savdomix-ultrasonic-repeller --branch main --commit-dirty=true
- prod live: https://repeller.savdomix.uz/ commit 48c342d
