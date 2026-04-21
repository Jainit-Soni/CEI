const path = require("path");
const { nowIso, writeJson } = require("./io");

function createManifest(sourceId, runId, startUrl, rawDir) {
  return {
    sourceId,
    runId,
    startUrl,
    startedAt: nowIso(),
    finishedAt: null,
    rawDir,
    files: [],
    urlsVisited: [],
    notes: [],
    errors: [],
  };
}

function addVisitedUrl(manifest, url) {
  manifest.urlsVisited.push({
    url,
    time: nowIso(),
  });
}

function addFile(manifest, fileInfo) {
  manifest.files.push({
    ...fileInfo,
    time: nowIso(),
  });
}

function addNote(manifest, note) {
  manifest.notes.push({
    note,
    time: nowIso(),
  });
}

function addError(manifest, error, meta = {}) {
  manifest.errors.push({
    error: String(error),
    ...meta,
    time: nowIso(),
  });
}

function saveManifest(manifest, manifestsDir) {
  manifest.finishedAt = nowIso();
  const outPath = path.join(manifestsDir, `${manifest.runId}.json`);
  writeJson(outPath, manifest);
  return outPath;
}

module.exports = {
  createManifest,
  addVisitedUrl,
  addFile,
  addNote,
  addError,
  saveManifest,
};