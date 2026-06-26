// /app/functions/_shared/meta_capi.js
// Meta Conversions API — Lead event sender.
// Endpoint: POST https://graph.facebook.com/v19.0/{PIXEL_ID}/events

import { capiHashName, capiHashPhone, uaHash } from "./hash.js";
import { isValidFbc, isValidFbp } from "./attribution.js";

export async function buildCapiLeadPayload(params, env) {
  const {
    eventId,
    eventSourceUrl,
    clientIp,
    clientUa,
    fbp,
    fbc,
    phoneCanonical,
    firstName,
  } = params;

  const userData = {
    client_ip_address: clientIp || "",
    client_user_agent: clientUa || "",
    ph: [await capiHashPhone(phoneCanonical)],
  };
  if (firstName) userData.fn = [await capiHashName(firstName)];
  if (isValidFbp(fbp)) userData.fbp = fbp;
  if (isValidFbc(fbc)) userData.fbc = fbc;

  const valueRaw = env.PRODUCT_VALUE_UZS || "125000";
  const currency = env.PRODUCT_CURRENCY || "UZS";
  const value = Number.parseInt(valueRaw, 10) || 125000;

  const body = {
    data: [
      {
        event_name: "Lead",
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        event_source_url: eventSourceUrl || "",
        action_source: "website",
        user_data: userData,
        custom_data: {
          value,
          currency,
          content_name: env.PRODUCT_CONTENT_NAME || "Ultratovushli zararkunanda qaytargich",
          content_category: "home_appliance",
          content_ids: [env.PRODUCT_CONTENT_ID || "ultrasonic-repeller-v1"],
          content_type: "product",
        },
      },
    ],
  };
  if (env.META_TEST_EVENT_CODE) body.test_event_code = env.META_TEST_EVENT_CODE;
  return body;
}

export async function sendCapiLead(params, env) {
  const pixelId = env.META_PIXEL_ID;
  const token = env.META_CAPI_ACCESS_TOKEN;
  if (!pixelId || !token) {
    return { status: "skipped", httpStatus: 0, error: "missing_config" };
  }
  const body = await buildCapiLeadPayload(params, env);
  const url = `https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${encodeURIComponent(token)}`;
  let resp;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { status: "failed", httpStatus: 0, error: "network" };
  }
  const httpStatus = resp.status;
  if (httpStatus >= 200 && httpStatus < 300) return { status: "sent", httpStatus, error: null };
  let detail = null;
  try { detail = (await resp.text()).slice(0, 200); } catch { /* ignore */ }
  return { status: "failed", httpStatus, error: "non2xx", detail };
}

export { uaHash };
