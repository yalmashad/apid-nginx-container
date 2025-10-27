/*
 * api_discovery.js
 * – Captures request / response, performs random sampling, filters-out
 *   static assets, and forwards selected payloads to Telemetry_Ingestion_Service.
 */

const cfg = {
  sample_rate: 1,
  static_regex: /\.(jpg|jpeg|gif|png|css|js|ico|xml|rss|txt)$/i
};


const lowerKeys = h => {
  const o = {};
  for (const k in h) o[k.toLowerCase()] = h[k];
  return o;
};

const isStatic = uri => cfg.static_regex.test(uri || "");
const shouldSample = () => Math.random() < cfg.sample_rate;


function decideSampling(r) {
  if (isStatic(r.variables.request_uri)) {
    r.variables.log_transaction = "0";              // never log static assets
  } else {
    r.variables.log_transaction = shouldSample() ? "1" : "0";  // coin-flip once
  }
}

function responseBodyFilter(r, data, flags) {
  if (data === undefined) data = "";
  r.sendBuffer(data, flags);             

 
  if (r.variables.log_transaction === "1" && !r.internal && data.length) {
    if (!r.variables.resp_body_buffer) r.variables.resp_body_buffer = "";
    const room = 5120 - r.variables.resp_body_buffer.length;
    if (room > 0) r.variables.resp_body_buffer += data.slice(0, room);
  }

  /* exit early unless: last chunk AND original request and we chose to sample */
  if (!flags.last || r.internal || r.variables.log_transaction !== "1") return;

  const now = Date.now();  // ms

  const original_host = r.headersIn.host || r.variables.host;
  const scheme = r.variables.scheme || "http";
  const original_url = scheme + "://" + original_host + r.variables.request_uri;

  const rec = {

    method: r.method,
    url:    original_url,
    client_ip: r.remoteAddress,

    req_headers: lowerKeys(r.headersIn),
    request_timestamp:  now,
    req_payload: Buffer.from((r.requestText || "").slice(0, 5120)).toString('base64'),

    rsp_status:  r.status,
    rsp_headers: lowerKeys(r.headersOut),
    response_timestamp: now,
    rsp_payload: Buffer.from((r.variables.resp_body_buffer || "").slice(0, 5120)).toString('base64'),
    
    req_id: r.variables.request_id || "",
    dst:    r.variables.upstream_addr || "",
    rsp_code_details: String(r.status),
  };

  r.log("LOG-PAYLOAD: " + JSON.stringify(rec));
  
  r.log("LOG-Header: " + r.variables.token);

  r.subrequest("/send_log_F5", {
    method: "POST",
    body:   JSON.stringify(rec),
    headers: {
      "x-custom-header": r.variables.token || ""
    },
    detached: true
  });
}


export default {
  header_filter: decideSampling,   // will run once per response
  body_filter:   responseBodyFilter
};
