const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function nowIso() {
  return new Date().toISOString();
}

function nowStamp() {
  return nowIso().replace(/[:.]/g, "-");
}

function safeName(name) {
  return String(name || "file")
    .replace(/[<>:"/\\|?*\x00-\x1F]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 180);
}

function sha256Buffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function writeText(filePath, text) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, text, "utf8");
}

function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function writeBuffer(filePath, buffer) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, buffer);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function listFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  return fs.readdirSync(dirPath);
}

function makeRunDirs(sourceId) {
  const root = process.cwd();
  const runId = `${sourceId}_${nowStamp()}`;

  const baseOutputDir = path.join(root, "cei-extractors", "output");
  const rawDir = path.join(baseOutputDir, "raw", runId);
  const logsDir = path.join(baseOutputDir, "logs");
  const manifestsDir = path.join(baseOutputDir, "manifests");

  ensureDir(rawDir);
  ensureDir(logsDir);
  ensureDir(manifestsDir);

  return {
    runId,
    baseOutputDir,
    rawDir,
    logsDir,
    manifestsDir,
  };
}

module.exports = {
  ensureDir,
  nowIso,
  nowStamp,
  safeName,
  sha256Buffer,
  writeText,
  writeJson,
  writeBuffer,
  readJson,
  listFiles,
  makeRunDirs,
};