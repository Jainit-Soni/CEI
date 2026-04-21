#!/usr/bin/env node

/**
 * MCC UG documents manifest scraper
 *
 * Scope:
 * - Scrape official MCC UG Current Events pages
 * - Collect document title, year, page URL, view/download URL
 * - Infer doc family, round, and course bucket
 * - Write manifest NDJSON for CEI triage before any PDF downloads
 *
 * Why this exists:
 * - MCC is document-first. Do not download tons of PDFs blindly.
 * - Build a manifest first, then choose only high-value docs.
 *
 * Official source used:
 * - https://mcc.nic.in/current-events-ug/
 * - paginated pages like /page/2/, /page/3/, /page/4/
 *
 * Install:
 *   npm i playwright fs-extra minimist
 *   npx playwright install chromium
 *
 * Usage:
 *   node mcc_ug_documents_manifest.js --out=./output/mcc_ug_documents_manifest.ndjson
 *   node mcc_ug_documents_manifest.js --max-pages=4 --headful --debug
 */

const path = require('path');
const fs = require('fs-extra');
const minimist = require('minimist');
const { chromium } = require('playwright');

const argv = minimist(process.argv.slice(2), {
  boolean: ['headful', 'debug'],
  string: ['out'],
  default: {
    headful: false,
    debug: false,
    out: path.resolve(process.cwd(), 'output', 'mcc_ug_documents_manifest.ndjson'),
    'max-pages': 4,
  },
});

const BASE_URL = 'https://mcc.nic.in/current-events-ug/';
const OUTPUT_PATH = path.resolve(argv.out);
const OUTPUT_DIR = path.dirname(OUTPUT_PATH);
const META_PATH = path.join(OUTPUT_DIR, 'mcc_ug_documents_manifest.meta.json');
const MAX_PAGES = Number(argv['max-pages'] || 4);

const WAIT = {
  timeout: 45000,
  medium: 800,
};

async function main() {
  await fs.ensureDir(OUTPUT_DIR);
  await fs.writeFile(OUTPUT_PATH, '', 'utf8');

  const browser = await chromium.launch({
    headless: !argv.headful,
    slowMo: argv.debug ? 250 : 0,
  });

  const context = await browser.newContext({
    viewport: { width: 1600, height: 1200 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();
  page.setDefaultTimeout(WAIT.timeout);

  const meta = {
    base_url: BASE_URL,
    output_path: OUTPUT_PATH,
    started_at: new Date().toISOString(),
    pages_requested: MAX_PAGES,
    pages_visited: 0,
    rows_written: 0,
    unique_view_urls: 0,
    by_doc_family: {},
    by_round: {},
    by_course_bucket: {},
  };

  const seen = new Set();

  try {
    for (let pageNo = 1; pageNo <= MAX_PAGES; pageNo += 1) {
      const url = pageNo === 1 ? BASE_URL : `${BASE_URL}page/${pageNo}/`;
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => null);
      await page.waitForTimeout(WAIT.medium);

      const rows = await extractRows(page, url, pageNo);
      meta.pages_visited += 1;

      const deduped = [];
      for (const row of rows) {
        const key = row.view_url || row.document_title;
        if (!key || seen.has(key)) continue;
        seen.add(key);
        deduped.push(row);
      }

      if (deduped.length) {
        await appendNdjson(OUTPUT_PATH, deduped);
        meta.rows_written += deduped.length;
        for (const row of deduped) {
          inc(meta.by_doc_family, row.doc_family || 'unknown');
          inc(meta.by_round, row.round_inferred || 'unknown');
          inc(meta.by_course_bucket, row.course_bucket_inferred || 'unknown');
        }
      }
    }
  } finally {
    await browser.close();
  }

  meta.unique_view_urls = seen.size;
  meta.finished_at = new Date().toISOString();
  await fs.writeJson(META_PATH, meta, { spaces: 2 });

  console.log(`DONE: wrote ${meta.rows_written} rows to ${OUTPUT_PATH}`);
  console.log(JSON.stringify(meta, null, 2));
}

async function extractRows(page, pageUrl, pageNo) {
  return page.evaluate((meta) => {
    const clean = (s) => (s || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
    const abs = (href) => {
      try {
        return new URL(href, window.location.href).toString();
      } catch {
        return href || null;
      }
    };

    function inferDocFamily(title) {
      const t = title.toLowerCase();
      if (t.includes('seat matrix')) return 'seat_matrix';
      if (t.includes('vacancy')) return 'vacancy';
      if (t.includes('schedule')) return 'schedule';
      if (t.includes('result') || t.includes('allotment')) return 'result';
      if (t.includes('admitted') || t.includes('joined candidates')) return 'admitted_candidates';
      return 'notice';
    }

    function inferRound(title) {
      const t = title.toLowerCase();
      if (t.includes('special stray')) return 'SPECIAL_STRAY';
      if (t.includes('stray')) return 'STRAY';
      const m = t.match(/round\s*[- ]?([ivx]+|\d+)/i);
      if (m) return `ROUND_${String(m[1]).toUpperCase()}`;
      return 'UNSPECIFIED';
    }

    function inferCourseBucket(title) {
      const t = title.toLowerCase();
      const hasMbbs = /\bmbbs\b/.test(t);
      const hasBds = /\bbds\b/.test(t);
      const hasNursing = /b\.?\s*sc\s*\(?nursing\)?|bsc nursing/.test(t);

      const picks = [];
      if (hasMbbs) picks.push('MBBS');
      if (hasBds) picks.push('BDS');
      if (hasNursing) picks.push('BSC_NURSING');

      if (!picks.length) return 'MIXED_OR_UNSPECIFIED';
      if (picks.length === 1) return picks[0];
      return picks.join('_PLUS_');
    }

    function inferYear(title, yearText) {
      const combined = `${title} ${yearText}`;
      const matches = combined.match(/\b20\d{2}\b/g) || [];
      return matches.length ? Number(matches[matches.length - 1]) : null;
    }

    function getRowsFromTable(table) {
      const trs = Array.from(table.querySelectorAll('tr'));
      const rows = [];

      for (const tr of trs) {
        const tds = Array.from(tr.querySelectorAll('td'));
        if (tds.length < 3) continue;

        const title = clean(tds[0]?.textContent || '');
        const yearText = clean(tds[1]?.textContent || '');
        const links = Array.from(tds[2]?.querySelectorAll('a[href]') || []).map((a) => ({
          text: clean(a.textContent),
          href: abs(a.getAttribute('href')),
        })).filter((x) => x.href);

        if (!title || !links.length) continue;

        const viewLink = links.find((x) => /view/i.test(x.text)) || links[0];
        const downloadLink = links.find((x) => /download/i.test(x.text)) || null;

        rows.push({
          source: 'mcc_ug_current_events_manifest',
          source_page_url: meta.pageUrl,
          extracted_at: new Date().toISOString(),
          source_page_number: meta.pageNo,
          document_title: title,
          page_year_text: yearText || null,
          inferred_year: inferYear(title, yearText),
          view_url: viewLink ? viewLink.href : null,
          download_url: downloadLink ? downloadLink.href : null,
          all_links: links,
          doc_family: inferDocFamily(title),
          round_inferred: inferRound(title),
          course_bucket_inferred: inferCourseBucket(title),
        });
      }

      return rows;
    }

    const tables = Array.from(document.querySelectorAll('table'));
    let bestTable = null;
    let bestScore = -1;

    for (const table of tables) {
      const text = clean(table.textContent).toLowerCase();
      let score = 0;
      if (text.includes('current events')) score += 3;
      if (text.includes('view / download')) score += 3;
      if (text.includes('title')) score += 2;
      if (text.includes('year')) score += 2;
      if (text.includes('accessible version')) score += 1;
      if (score > bestScore) {
        bestScore = score;
        bestTable = table;
      }
    }

    if (!bestTable) return [];
    return getRowsFromTable(bestTable);
  }, { pageUrl, pageNo });
}

async function appendNdjson(filePath, rows) {
  if (!rows.length) return;
  const payload = rows.map((r) => JSON.stringify(r)).join('\n') + '\n';
  await fs.appendFile(filePath, payload, 'utf8');
}

function inc(obj, key) {
  obj[key] = (obj[key] || 0) + 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
