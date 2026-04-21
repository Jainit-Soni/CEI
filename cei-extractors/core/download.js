const path = require("path");
const { fetchUrl } = require("./http");
const { safeName, sha256Buffer, writeBuffer } = require("./io");

function pickExtension(contentType, url) {
  const ct = String(contentType || "").toLowerCase();
  const u = String(url || "").toLowerCase();

  if (u.endsWith(".pdf") || ct.includes("pdf")) return "pdf";
  if (u.endsWith(".json") || ct.includes("json")) return "json";
  if (u.endsWith(".csv") || ct.includes("csv")) return "csv";
  if (u.endsWith(".xlsx") || ct.includes("spreadsheetml")) return "xlsx";
  if (u.endsWith(".xls") || ct.includes("ms-excel")) return "xls";
  if (u.endsWith(".html") || ct.includes("html")) return "html";
  if (u.endsWith(".txt") || ct.includes("text/plain")) return "txt";
  return "bin";
}

async function downloadToRaw(url, rawDir, baseName = "") {
  const res = await fetchUrl(url);
  const contentType = res.headers["content-type"] || "";
  const ext = pickExtension(contentType, url);

  const finalBase =
    safeName(baseName) ||
    safeName(url.split("/").pop() || "file");

  const fileName = `${finalBase}.${ext}`;
  const filePath = path.join(rawDir, fileName);

  writeBuffer(filePath, res.buffer);

  return {
    url,
    statusCode: res.statusCode,
    contentType,
    filePath,
    sha256: sha256Buffer(res.buffer),
    sizeBytes: res.buffer.length,
  };
}

module.exports = {
  downloadToRaw,
  pickExtension,
};