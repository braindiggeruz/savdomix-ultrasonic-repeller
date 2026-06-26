-- Savdomix Ultrasonic Repeller — D1 audit schema (NO raw PII).
--
-- Contract:
--   * BUYO is the sole system of record for complete lead data.
--   * This table is a technical / attribution audit log only.
--   * Stores HASHED phone (SHA-256) + last4 digits + status + minimal
--     attribution. No raw name. No raw phone. No tokens. No full IP.
--   * Mock submissions are clearly separated (buyo_mode='mock').

CREATE TABLE IF NOT EXISTS leads_audit (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id     TEXT NOT NULL,
  event_id          TEXT NOT NULL,
  environment       TEXT NOT NULL,        -- 'preview' | 'production' | 'dev'
  buyo_mode         TEXT NOT NULL,        -- 'real' | 'mock'
  status            TEXT NOT NULL,        -- 'mock_accepted' | 'buyo_accepted' | 'rejected' | 'error'
  buyo_lead_id      TEXT,
  buyo_flow_id      TEXT,
  buyo_http_status  INTEGER,
  buyo_error_code   TEXT,
  phone_hash        TEXT NOT NULL,        -- sha256 of canonical 998XXXXXXXXX
  phone_last4       TEXT,                 -- last 4 digits only
  utm_source        TEXT,
  utm_medium        TEXT,
  utm_campaign      TEXT,
  utm_term          TEXT,
  utm_content       TEXT,
  campaign_id       TEXT,
  adset_id          TEXT,
  ad_id             TEXT,
  placement         TEXT,
  fbclid            TEXT,
  landing_url       TEXT,
  referrer_host     TEXT,
  ip_prefix         TEXT,                 -- first 2 octets only, e.g. '95.215'
  ua_hash           TEXT,                 -- sha256 of user-agent
  capi_status       TEXT,                 -- 'sent' | 'skipped' | 'failed' | NULL
  capi_http_status  INTEGER,
  retry_count       INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_leads_audit_submission_id
  ON leads_audit(submission_id);

CREATE INDEX IF NOT EXISTS idx_leads_audit_event_id
  ON leads_audit(event_id);

CREATE INDEX IF NOT EXISTS idx_leads_audit_status
  ON leads_audit(status);

CREATE INDEX IF NOT EXISTS idx_leads_audit_created_at
  ON leads_audit(created_at);
