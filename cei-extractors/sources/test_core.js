const {
  makeRunDirs,
  writeText,
} = require("../core/io");

const {
  createManifest,
  addNote,
  addFile,
  saveManifest,
} = require("../core/manifest");

function main() {
  const sourceId = "core_test";
  const startUrl = "https://example.com";

  const dirs = makeRunDirs(sourceId);
  const manifest = createManifest(sourceId, dirs.runId, startUrl, dirs.rawDir);

  const samplePath = `${dirs.rawDir}\\hello.txt`;
  writeText(samplePath, "core test ok");

  addFile(manifest, {
    type: "text",
    filePath: samplePath,
  });

  addNote(manifest, "Core smoke test completed.");

  const manifestPath = saveManifest(manifest, dirs.manifestsDir);

  console.log("CORE TEST OK");
  console.log("Run ID:", dirs.runId);
  console.log("Raw Dir:", dirs.rawDir);
  console.log("Manifest:", manifestPath);
}

main();