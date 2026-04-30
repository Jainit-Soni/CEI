#!/usr/bin/env node

/**
 * MCC UG cutoff tuple extractor (v2)
 * Robust block collection for multi-line result rows.
 */

const fs = require('fs-extra');
const path = require('path');
const minimist = require('minimist');

const argv = minimist(process.argv.slice(2), {
  string: ['dir'],
  default: {
    dir: path.resolve(process.cwd(), 'cei-extractors/sources/output/mcc_ug_selected_docs'),
  },
});

const TEXT_DIR = path.join(argv.dir, 'parsed_results', 'text');
const OUTPUT_PATH = path.join(argv.dir, 'parsed_results', 'cutoff_tuples_v2.ndjson');

const STATUS_WORDS = [
  'Allotted', 'Reported', 'Upgraded', 'No Upgradation', 
  'Did not opt for Upgradation', 'Did not fill up fresh choices', 
  'Not Allotted', 'Seat Cancelled', 'Not Reported', 'Admitted'
];
const STATUS_REGEX = new RegExp(`(${STATUS_WORDS.join('|')})`, 'i');

const COURSE_REGEX = /\b(MBBS|BDS|B\.?\s*SC\s*\(?NURSING\)?)\b/i;

async function main() {
  if (!(await fs.pathExists(TEXT_DIR))) {
    throw new Error(`Missing ${TEXT_DIR}`);
  }

  await fs.writeFile(OUTPUT_PATH, '', 'utf8');

  const files = (await fs.readdir(TEXT_DIR)).filter(f => f.endsWith('.txt'));
  console.log(`Processing ${files.length} text dumps...`);

  let totalTuples = 0;

  for (const file of files) {
    const filePath = path.join(TEXT_DIR, file);
    const content = await fs.readFile(filePath, 'utf8');
    
    const roundMatch = file.match(/__([A-Z0-9_]+)__/);
    const round = roundMatch ? roundMatch[1] : 'UNKNOWN';

    const lines = content.split(/\n+/).map(l => l.trim()).filter(Boolean);
    const tuples = [];

    let currentBlock = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // A row starts with S.No (usually same as rank or close to it)
        // Note: Sometimes S.No and Rank are merged or separate.
        // We look for a pattern like "123 456" or just "456" at the start of a logical row.
        const isNewRow = /^\d+(\s+\d+)?\s+[A-Za-z]/.test(line);

        if (isNewRow) {
            if (currentBlock) processBlock(currentBlock, round, file, tuples);
            currentBlock = line;
        } else if (currentBlock) {
            currentBlock += ' ' + line;
            // If block ends with a status word, it might be complete
            if (STATUS_REGEX.test(line)) {
                processBlock(currentBlock, round, file, tuples);
                currentBlock = null;
            }
        }
    }
    if (currentBlock) processBlock(currentBlock, round, file, tuples);

    if (tuples.length > 0) {
      await fs.appendFile(OUTPUT_PATH, tuples.map(t => JSON.stringify(t)).join('\n') + '\n', 'utf8');
      totalTuples += tuples.length;
      console.log(`  ${file}: Extracted ${tuples.length} tuples`);
    }
  }

  console.log(`\nTotal tuples extracted: ${totalTuples}`);
}

function processBlock(block, round, file, tuples) {
    const cleaned = block.replace(/\s+/g, ' ').trim();
    
    // Extract Rank (first or second number)
    const numbers = cleaned.match(/^\d+(\s+\d+)?/);
    if (!numbers) return;
    const tokens = numbers[0].split(/\s+/);
    const rank = parseInt(tokens[tokens.length - 1]);

    // Find Course
    const courseMatch = cleaned.match(COURSE_REGEX);
    if (!courseMatch) return;

    // Find Status
    const statusMatch = cleaned.match(STATUS_REGEX);
    if (!statusMatch) return;

    const course = courseMatch[1].toUpperCase().replace(/\s/g, '');
    const status = statusMatch[1];

    // Extract Institute (text between rank and course)
    // There might be multiple courses if it's an upgrade row (R1 vs R2)
    const courseMatches = [...cleaned.matchAll(new RegExp(COURSE_REGEX, 'gi'))];
    const lastCourse = courseMatches[courseMatches.length - 1];
    
    let institute = 'Unknown';
    let quota = 'Unknown';

    // Heuristic for the "current" allotment in the block
    // If multiple courses, the LAST one is the current round's result.
    const currentCourseIdx = lastCourse.index;
    const textBeforeCurrentCourse = cleaned.slice(0, currentCourseIdx);
    
    // Find previous course or start of rank
    const prevCourse = courseMatches.length > 1 ? courseMatches[courseMatches.length - 2] : null;
    const startIdx = prevCourse ? prevCourse.index + prevCourse[0].length : tokens.join(' ').length;
    
    const middle = cleaned.slice(startIdx, currentCourseIdx).trim();
    
    // Extract Quota and Institute from middle
    const quotas = ['All India', 'Open Seat Quota', 'Delhi University Quota', 'IP University Quota', 'Aligarh Muslim University (AMU) Quota', 'Banaras Hindu University (BHU) Quota', 'Internal Quota', 'Jamia Millia Islamia Quota', 'ESIC Quota', 'Management/Paid Seats Quota', 'Foreign NRI', 'NRI Quota', 'Dufferin Quota', 'Children of Sahid'];
    
    for (const q of quotas) {
        if (middle.includes(q)) {
            quota = q;
            institute = middle.replace(q, '').replace(/^[-,\s]+|[-,\s]+$/g, '').trim();
            break;
        }
    }
    if (institute === 'Unknown' || !institute) institute = middle;

    // Category (text between course and status)
    const category = cleaned.slice(currentCourseIdx + lastCourse[0].length, cleaned.indexOf(status, currentCourseIdx)).trim();

    tuples.push({
        rank,
        quota,
        institute,
        course,
        category,
        status,
        round,
        source_file: file,
        // raw_block: cleaned // for debugging
    });
}

main().catch(console.error);
