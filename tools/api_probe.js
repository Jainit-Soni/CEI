const BASE_URL = process.env.CEI_API_BASE || "http://localhost:4000";

const path = process.argv[2];

if (!path) {
  console.error("Usage: node tools/api_probe.js <apiPath>");
  console.error('Example: node tools/api_probe.js "/api/colleges?page=1&limit=2"');
  process.exit(1);
}

async function main() {
  const url = path.startsWith("http") ? path : BASE_URL + path;

  const res = await fetch(url);
  const text = await res.text();

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  console.log(JSON.stringify({
    url,
    status: res.status,
    ok: res.ok,
    body
  }, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});