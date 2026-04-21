#!/usr/bin/env node

/**
 * MCC UG seat-matrix PDF parser (v2, enhanced + debugged)
 *
 * Purpose:
 * - Parse ONLY the selected MCC UG seat-matrix PDFs
 * - Robustly resolve pdf-parse export shape
 * - Extract raw text from each PDF
 * - Save one text dump per PDF
 * - Emit row-candidate NDJSON lines for later normalization
 * - Emit detailed file-level parse meta for debugging and QA
 *
 * Install:
 *   npm i fs-extra minimist pdf-parse
 *
 * Usage:
 *   node mcc_ug_parse_seat_matrix_pdfs_v2.js --dir=./output/mcc_ug_selected_docs
 */

const fs = require('fs-extra');
const path = require('path');
const minimist = require('minimist');

const argv = minimist(process.argv.slice(2), {
  string: ['dir'],
  default: {
    dir: path.resolve(process.cwd(), 'output', 'mcc_ug_selected_docs'),
  },
});

const TARGET_DIR = path.resolve(argv.dir);
const DOWNLOAD_META_PATH = path.join(TARGET_DIR, 'download_meta.json');
const PARSED_DIR = path.join(TARGET_DIR, 'parsed_seat_matrix');
const TEXT_DIR = path.join(PARSED_DIR, 'text');
const CANDIDATES_PATH = path.join(PARSED_DIR, 'seat_matrix_row_candidates.ndjson');
const FILE_META_PATH = path.join(PARSED_DIR, 'seat_matrix_files_meta.json');

function resolvePdfParse() {
  const mod = require('pdf-parse');

  if (typeof mod === 'function') return mod;
  if (mod && typeof mod.default === 'function') return mod.default;
  if (mod && typeof mod.pdf === 'function') return mod.pdf;
  if (mod && typeof mod.PDF === 'function') return mod.PDF;

  const keys = mod && typeof mod === 'object' ? Object.keys(mod) : [];
  throw new Error(`Could not resolve pdf-parse callable export. Available keys: ${keys.join(', ') || '(none)'}`);
}

async function main() {
  if (!(await fs.pathExists(DOWNLOAD_META_PATH))) {
    throw new Error(`Missing ${DOWNLOAD_META_PATH}`);
  }

  const pdfParse = resolvePdfParse();

  await fs.ensureDir(TEXT_DIR);
  await fs.writeFile(CANDIDATES_PATH, '', 'utf8');

  const downloadMeta = await fs.readJson(DOWNLOAD_META_PATH);
  const items = Array.isArray(downloadMeta.items) ? downloadMeta.items : [];
  const seatMatrixItems = items.filter((x) => {
    const okStatus = x.status === 'downloaded' || x.status === 'skipped_existing';
    return okStatus && x.doc_family === 'seat_matrix' && x.file_path;
  });

  const summary = {
    target_dir: TARGET_DIR,
    generated_at: new Date().toISOString(),
    pdf_parse_resolved: true,
    files_considered: seatMatrixItems.length,
    files_parsed: 0,
    files_failed: 0,
    files_empty_text: 0,
    total_candidate_lines: 0,
    candidate_types: {},
    per_file: [],
  };

  for (let i = 0; i < seatMatrixItems.length; i += 1) {
    const item = seatMatrixItems[i];
    const fileMeta = {
      index: i + 1,
      document_title: item.document_title || null,
      round_inferred: item.round_inferred || null,
      course_bucket_inferred: item.course_bucket_inferred || null,
      source_url: item.source_url || null,
      file_path: item.file_path,
      parse_status: null,
      num_pages: null,
      info: null,
      metadata: null,
      text_chars: 0,
      total_lines: 0,
      candidate_lines: 0,
      text_dump_path: null,
      first_lines_preview: [],
      error: null,
    };

    try {
      const buffer = await fs.readFile(item.file_path);
      const parsed = await pdfParse(buffer);
      const text = normalizePdfText(parsed && parsed.text ? parsed.text : '');
      const lines = splitUsefulLines(text);
      const candidates = extractRowCandidates(lines, item);

      const textDumpPath = path.join(TEXT_DIR, `${safeBaseName(item, i + 1)}.txt`);
      await fs.writeFile(textDumpPath, text, 'utf8');
      await appendNdjson(CANDIDATES_PATH, candidates);

      fileMeta.parse_status = text ? 'parsed' : 'parsed_empty_text';
      fileMeta.num_pages = Number.isFinite(parsed?.numpages) ? parsed.numpages : null;
      fileMeta.info = sanitizeJson(parsed?.info);
      fileMeta.metadata = sanitizeJson(parsed?.metadata);
      fileMeta.text_chars = text.length;
      fileMeta.total_lines = lines.length;
      fileMeta.candidate_lines = candidates.length;
      fileMeta.text_dump_path = textDumpPath;
      fileMeta.first_lines_preview = lines.slice(0, 25);

      if (!text) {
        summary.files_empty_text += 1;
      } else {
        summary.files_parsed += 1;
      }

      summary.total_candidate_lines += candidates.length;
      for (const candidate of candidates) {
        inc(summary.candidate_types, candidate.candidate_type || 'unknown');
      }
    } catch (error) {
      fileMeta.parse_status = 'failed';
      fileMeta.error = formatError(error);
      summary.files_failed += 1;
    }

    summary.per_file.push(fileMeta);
  }

  await fs.writeJson(FILE_META_PATH, summary, { spaces: 2 });
  console.log('Seat-matrix PDF parse complete');
  console.log(JSON.stringify({
    files_considered: summary.files_considered,
    files_parsed: summary.files_parsed,
    files_empty_text: summary.files_empty_text,
    files_failed: summary.files_failed,
    total_candidate_lines: summary.total_candidate_lines,
    parsed_dir: PARSED_DIR,
  }, null, 2));
}

function normalizePdfText(text) {
  return String(text || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\r/g, '')
    .replace(/[\t ]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitUsefulLines(text) {
  return String(text || '')
    .split(/\n+/)
    .map((line) => line.replace(/[ ]+/g, ' ').trim())
    .filter(Boolean);
}

function extractRowCandidates(lines, item) {
  const out = [];

  for (let idx = 0; idx < lines.length; idx += 1) {
    const line = lines[idx];
    if (!line) continue;
    if (shouldSkipLine(line)) continue;

    const numericTokens = line.match(/\b\d+\b/g) || [];
    const hasMedicalWords = /mbbs|bds|nursing|medical|dental|college|institute|quota|all india|seat|category|gen|sc|st|obc|ews/i.test(line);
    const hasRowShape = numericTokens.length >= 3;

    if (!hasMedicalWords && !hasRowShape) continue;

    const nextLine = idx + 1 < lines.length ? lines[idx + 1] : null;
    const prevLine = idx - 1 >= 0 ? lines[idx - 1] : null;

    out.push({
      source: 'mcc_ug_seat_matrix_pdf_candidate',
      extracted_at: new Date().toISOString(),
      document_title: item.document_title || null,
      round_inferred: item.round_inferred || null,
      course_bucket_inferred: item.course_bucket_inferred || null,
      source_url: item.source_url || null,
      file_path: item.file_path,
      line_index: idx,
      raw_line: line,
      numeric_token_count: numericTokens.length,
      previous_line: prevLine,
      next_line: nextLine,
      candidate_type: inferCandidateType(line, numericTokens.length),
    });
  }

  return out;
}

function shouldSkipLine(line) {
  const t = String(line || '').toLowerCase();
  if (!t) return true;

  const weakPatterns = [
    /^page \d+/,
    /^medical counselling committee/,
    /^directorate general of health services/,
    /^ministry of health/,
    /^government of india/,
    /^mcc\b/,
    /^www\./,
    /^https?:\/\//,
    /^seat matrix$/,
    /^ug counselling$/,
    /^neet ug counselling$/,
    /^terms and conditions$/,
    /^hyperlink policy$/,
    /^privacy policy$/,
    /^copyright policy$/,
    /^disclaimer$/,
  ];

  if (weakPatterns.some((rx) => rx.test(t))) return true;
  if (t.length < 6) return true;
  return false;
}

function inferCandidateType(line, numericTokenCount) {
  const t = String(line || '').toLowerCase();
  if (/total/.test(t)) return 'total_like';
  if (/mbbs|bds|nursing/.test(t) && numericTokenCount >= 2) return 'course_row_like';
  if (/all india|state|quota|category/.test(t) && numericTokenCount >= 2) return 'quota_row_like';
  if (/college|institute/.test(t) && numericTokenCount >= 2) return 'institution_row_like';
  if (numericTokenCount >= 6) return 'dense_numeric_row_like';
  return 'other_candidate';
}

async function appendNdjson(filePath, rows) {
  if (!rows.length) return;
  const payload = rows.map((r) => JSON.stringify(r)).join('\n') + '\n';
  await fs.appendFile(filePath, payload, 'utf8');
}

function safeBaseName(item, index) {
  const title = String(item.document_title || `seat_matrix_${index}`)
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 90);

  return [String(index).padStart(2, '0'), item.round_inferred || 'UNSPECIFIED', title].join('__');
}

function sanitizeJson(value) {
  if (value == null) return null;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return String(value);
  }
}

function formatError(error) {
  if (!error) return 'Unknown error';
  const msg = error.stack || error.message || String(error);
  return String(msg).split('\n').slice(0, 8).join('\n');
}

function inc(obj, key) {
  obj[key] = (obj[key] || 0) + 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});