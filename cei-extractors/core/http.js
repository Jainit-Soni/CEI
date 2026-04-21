const { request } = require("undici");

const DEFAULT_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.9,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
};

async function fetchUrl(url, options = {}) {
  const response = await request(url, {
    method: options.method || "GET",
    headers: {
      ...DEFAULT_HEADERS,
      ...(options.headers || {}),
    },
    body: options.body || undefined,
    maxRedirections: options.maxRedirections ?? 5,
  });

  const buffer = Buffer.from(await response.body.arrayBuffer());

  return {
    url,
    statusCode: response.statusCode,
    headers: response.headers,
    buffer,
    text: () => buffer.toString("utf8"),
  };
}

module.exports = {
  fetchUrl,
};