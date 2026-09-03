#!/usr/bin/env node
/**
 * check-citations - a hard number with nothing behind it.
 *
 * Why this exists
 * ---------------
 * check-arithmetic proves a sum is self-consistent. check-constants proves a
 * remembered value matches the accepted one. Neither can tell you where a
 * lesson got "65 to 87 V for 40 to 400 ms" from, and that is the class of
 * claim this course leans on hardest: standards limits, JEDEC thresholds,
 * safety clearances, device conventions. A reader who wants to design to one
 * of those has to be able to find the document.
 *
 * The failure mode is specific and was real here. Module 18 quoted five ISO
 * 7637-2 pulses and four of them were wrong; there was no reference, so
 * nothing pointed at the discrepancy and nobody could check it without
 * already knowing the answer. A citation would not have made the numbers
 * right, but it would have made them checkable, which is the property that
 * matters in a reference work.
 *
 * So: a lesson that names a standard, or asserts a number attributed to one,
 * must carry a source. A source is a link to a standards body, a manufacturer
 * application note, or a named textbook - anything a reader can go and read.
 * The Circuit Toy link that every build section carries does not count.
 *
 * The backlog is cleared, so --gate is what the audit runs: it fails if any
 * lesson names a standard and cites nothing. There is no baseline file on
 * purpose - a baseline here would only be somewhere to hide the next one.
 *
 *   node tools/check-citations.js            summary and the worst offenders
 *   node tools/check-citations.js --list     every lesson missing a source
 *   node tools/check-citations.js --gate     exit 1 if any lesson is unsourced
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.dirname(__dirname);
const LESSONS = path.join(ROOT, 'lessons');
const LIST = process.argv.includes('--list');
const GATE = process.argv.includes('--gate');

function walk(dir, out) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p, out);
        else if (e.name.endsWith('.html')) out.push(p);
    });
    return out;
}

/**
 * A standards designation, in any of the forms the lessons use.
 *
 * "ISO" needs a separator before the digits, or the TI ISO7741 isolator reads
 * as a standard. "EN" needs four or more digits, or every enable pin in the
 * course - EN1, EN2, EN3 - does the same.
 */
const STANDARD = new RegExp(
    '\\b(?:(?:IEC|CISPR|JEDEC|JESD|IPC|UL|MIL-STD|ANSI|IEEE|NEC|FCC\\s+Part|LV\\s?148|AEC-Q)' +
    '[\\s\\u2011-]?\\d[\\w.\\u2011-]*' +
    '|ISO[\\s\\u2011-]\\d[\\w.\\u2011-]*' +
    '|EN[\\s\\u2011-]?\\d{4,5}[\\w.\\u2011-]*)', 'g');

/**
 * A real source: somewhere a reader can go. The simulator link that every
 * build section carries is not one, and neither is a link back into the
 * course itself.
 */
const SOURCE_HOST = /href="https?:\/\/(?!github\.com\/jfalvarez1)[^"]+/g;

/** A textbook cited by author and title, which needs no URL to be findable. */
const TEXTBOOK = /\b(?:Horowitz\s*(?:&|and)\s*Hill|Art of Electronics|Sedra\s*(?:&|and)\s*Smith|Razavi|Gray\s*(?:&|and)\s*Meyer|Johnson\s*(?:&|and)\s*Graham|Bogatin|Ott\b|Paul\b|McLyman|Pressman|Erickson\s*(?:&|and)\s*Maksimovi|Ridley|Pozar|Gonzalez|Motchenbacher|Van der Ziel|Tietze\s*(?:&|and)\s*Schenk|Williams,?\s*Jim|Pease|Kester|Zumbahlen)\b/i;

const files = walk(LESSONS, []).sort();
const rows = [];
const standardCount = new Map();

files.forEach(f => {
    const src = fs.readFileSync(f, 'utf8');
    const rel = path.relative(ROOT, f).replace(/\\/g, '/');
    const body = src.replace(/<script[\s\S]*?<\/script>/gi, ' ');

    const named = [...new Set((body.match(STANDARD) || [])
        .map(s => s.replace(/\s+/g, ' ').trim()))];
    if (!named.length) return;
    named.forEach(s => standardCount.set(s, (standardCount.get(s) || 0) + 1));

    const sources = (body.match(SOURCE_HOST) || []).length;
    const books = TEXTBOOK.test(body) ? 1 : 0;
    // An explicit sources block counts on its own: a standard cited by
    // designation and clause needs no URL to be findable, and inventing one
    // that 404s is worse than giving none.
    const block = /class="sources"/.test(body) ? 1 : 0;

    const m = /module-(\d+)[\\/]lesson-(\d+)/.exec(rel);
    const t = /<h2>([^<]{1,70})<\/h2>/.exec(src);
    rows.push({
        rel, id: m ? 'M' + (+m[1]) + '-' + (+m[2]) : rel,
        title: t ? t[1].replace(/&[a-z]+;/g, ' ').trim() : '',
        standards: named.length, named, sources, books, block,
        sourced: sources > 0 || books > 0 || block > 0
    });
});

const unsourced = rows.filter(r => !r.sourced);
unsourced.sort((a, b) => b.standards - a.standards);

console.log('CLAIMS AGAINST SOURCES\n');
console.log('  lessons naming a standard          ' + String(rows.length).padStart(4));
console.log('  ...with a source a reader can read ' + String(rows.length - unsourced.length).padStart(4) +
            '   ' + Math.round(((rows.length - unsourced.length) / rows.length) * 100) + '%');
console.log('  ...with nothing behind them        ' + String(unsourced.length).padStart(4));
console.log('');

console.log('MOST STANDARDS NAMED, NOTHING CITED\n');
(LIST ? unsourced : unsourced.slice(0, 20)).forEach(r => {
    console.log('  ' + String(r.standards).padStart(3) + '  ' + r.id.padEnd(8) +
                r.title.slice(0, 40).padEnd(42) + r.named.slice(0, 4).join(', ').slice(0, 60));
});
console.log('');

if (!LIST) {
    console.log('MOST-NAMED STANDARDS\n');
    [...standardCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)
        .forEach(([k, n]) => console.log('  ' + String(n).padStart(3) + '  ' + k));
    console.log('');
}

if (!GATE) {
    console.log('Advisory without --gate.');
    process.exit(0);
}

/*
 * Gating, with no baseline, because the backlog is cleared: every lesson in
 * the course that names a standard now carries a source. A baseline would only
 * be a place to hide the next one that does not.
 */
if (unsourced.length) {
    console.log('FAIL - these lessons name a standard and cite nothing:');
    unsourced.forEach(r => console.log('    ' + r.id + '  ' + r.title +
                                       '   [' + r.named.slice(0, 3).join(', ') + ']'));
    console.log('');
    console.log('    Add a <div class="sources"> block, or a link to the publisher.');
    console.log('    Cite only what you can vouch for: a designation and title with no');
    console.log('    URL beats a plausible link that 404s.');
    process.exit(1);
}
console.log('PASS - every lesson that names a standard cites a source for it.');
