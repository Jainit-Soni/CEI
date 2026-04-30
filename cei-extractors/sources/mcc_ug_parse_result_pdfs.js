#!/usr/bin/env node

/**
 * MCC UG result PDF parser (v1, adapted from seat-matrix v3)
 */

const fs = require('fs-extra');
const path = require('path');
const minimist = require('minimist');
const { PDFParse } = require('pdf-parse');

const argv = minimist(process.argv.slice(2), {
  string: ['dir'],
  default: {
    dir: path.resolve(process.cwd(), 'output', 'mcc_ug_selected_docs'),
  },
});

const TARGET_DIR = path.resolve(argv.dir);
const DOWNLOAD_META_PATH = path.join(TARGET_DIR, 'download_meta.json');
const PARSED_DIR = path.join(TARGET_DIR, 'parsed_results');
const TEXT_DIR = path.join(PARSED_DIR, 'text');
const CANDIDATES_PATH = path.join(PARSED_DIR, 'result_row_candidates.ndjson');
const FILE_META_PATH = path.join(PARSED_DIR, 'result_files_meta.json');

async function main() {
  if (!(await fs.pathExists(DOWNLOAD_META_PATH))) {
    throw new Error(`Missing ${DOWNLOAD_META_PATH}`);
  }

  await fs.ensureDir(TEXT_DIR);
  await fs.writeFile(CANDIDATES_PATH, '', 'utf8');

  const downloadMeta = await fs.readJson(DOWNLOAD_META_PATH);
  const items = Array.isArray(downloadMeta.items) ? downloadMeta.items : [];
  const resultItems = items.filter((x) => {
    const okStatus = x.status === 'downloaded' || x.status === 'skipped_existing';
    return okStatus && x.doc_family === 'result' && x.file_path;
  });

  const summary = {
    target_dir: TARGET_DIR,
    generated_at: new Date().toISOString(),
    files_considered: resultItems.length,
    files_parsed: 0,
    files_failed: 0,
    total_candidate_lines: 0,
    per_file: [],
  };

  for (let i = 0; i < resultItems.length; i += 1) {
    const item = resultItems[i];
    const fileMeta = {
      index: i + 1,
      document_title: item.document_title || null,
      round_inferred: item.round_inferred || null,
      file_path: item.file_path,
      parse_status: null,
      candidate_lines: 0,
    };

    let parser = null;
    try {
      const buffer = await fs.readFile(item.file_path);
      parser = new PDFParse({ data: buffer });
      const textResult = await parser.getText();
      const text = String(textResult && textResult.text ? textResult.text : '');
      
      const textDumpPath = path.join(TEXT_DIR, `${safeBaseName(item, i + 1)}.txt`);
      await fs.writeFile(textDumpPath, text, 'utf8');

      const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);
      const candidates = extractResultCandidates(lines, item);
      await appendNdjson(CANDIDATES_PATH, candidates);

      fileMeta.parse_status = 'parsed';
      fileMeta.candidate_lines = candidates.length;
      summary.files_parsed += 1;
      summary.total_candidate_lines += candidates.length;
    } catch (error) {
      fileMeta.parse_status = 'failed';
      fileMeta.error = error.message;
      summary.files_failed += 1;
    } finally {
      if (parser) await parser.destroy().catch(() => {});
    }
    summary.per_file.push(fileMeta);
  }

  await fs.writeJson(FILE_META_PATH, summary, { spaces: 2 });
  console.log('Result PDF parse complete');
}

function extractResultCandidates(lines, item) {
  const out = [];
  for (let idx = 0; idx < lines.length; idx += 1) {
    const line = lines[idx];
    // MCC result rows usually start with a rank (number)
    // Example: "1 123 AIQ ..." or "12345 56789 ..."
    const tokens = line.split(/\s+/);
    if (tokens.length < 5) continue;
    
    const rankCandidate = tokens[0];
    if (!/^\d+$/.test(rankCandidate)) continue;

    out.push({
      source: 'mcc_ug_result_pdf_candidate',
      document_title: item.document_title,
      round_inferred: item.round_inferred,
      raw_line: line,
      line_index: idx
    });
  }
  return out;
}

async function appendNdjson(filePath, rows) {
  if (!rows.length) return;
  const payload = rows.map((r) => JSON.stringify(r)).join('\n') + '\n';
  await fs.appendFile(filePath, payload, 'utf8');
}

function safeBaseName(item, index) {
  return [String(index).padStart(2, '0'), item.round_inferred || 'UNSPECIFIED', (item.document_title || 'result').replace(/[^a-zA-Z0-9]+/g, '_')].join('__').slice(0, 100);
}

main().catch(console.error);
