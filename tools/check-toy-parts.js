#!/usr/bin/env node
/**
 * check-toy-parts - a build table may only name parts Circuit Toy has.
 *
 * Why this exists.
 *
 * A reader following "Simulator Lab 5: Source Follower" ended up with a J1 in
 * their schematic and asked whether it was supposed to be a MOSFET. It was
 * not: J is Circuit Toy's refdes for a JFET, and they had placed an N-JFET.
 *
 * They were not being careless. The build table told them to use a part called
 * NMOS_ENH, which is a SPICE model name left over from when these tables were
 * netlists - Circuit Toy has no such part. Searching the palette for it finds
 * nothing, and N-JFET sits next to NMOS in the FET category. The lesson sent
 * them to the wrong component.
 *
 * So this checks two things against the real catalogue:
 *
 *   1. Every part name in a build table's Value column exists in Circuit Toy.
 *   2. The refdes in the Part column matches the prefix Circuit Toy assigns to
 *      that part, so a row can never say "M1 ... N-JFET" or "J1 ... MOSFET".
 *
 * The catalogue below is transcribed from circuit_toy's src/component.c, where
 * each entry is {display name, refdes prefix, pin count}. It is duplicated
 * here rather than fetched because this check has to run offline in CI; when
 * Circuit Toy adds parts, add them here too.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.dirname(__dirname);

// name -> refdes prefix, from circuit_toy/src/component.c
const CATALOGUE = {
    'Ground': 'GND', 'DC Voltage': 'V', 'Arb Source': 'ARB', 'DC Current': 'I',
    'Resistor': 'R', 'HP Load': 'R', 'Capacitor': 'C', 'Inductor': 'L',
    'Diode': 'D', 'Zener Diode': 'DZ', 'Schottky Diode': 'DS', 'LED': 'LED',
    'NPN BJT': 'Q', 'PNP BJT': 'Q', 'NMOS': 'M', 'PMOS': 'M',
    'Op-Amp': 'U', 'OpAmp(flipped)': 'U', 'Square Wave': 'SQ',
    'Triangle Wave': 'TRI', 'Sawtooth Wave': 'SAW', 'Noise Source': 'N',
    'Text': 'T', 'SPST Switch': 'SW', 'SPDT Switch': 'SW', 'Push Button': 'PB',
    'Transformer': 'T', 'Transformer CT': 'T', 'Potentiometer': 'POT',
    'Photoresistor': 'LDR', 'Thermistor': 'TH', 'Memristor': 'MR', 'Fuse': 'F',
    'Crystal': 'Y', 'Spark Gap': 'SG', 'Delay Line': 'TD',
    'Transmission Line': 'TL', '3-Phase Source': 'G', 'Toroid': 'TL',
    'Clock': 'CLK', 'Variable DC': 'VDC', 'AM Source': 'AM', 'FM Source': 'FM',
    'Battery': 'BAT', 'Pulse Source': 'PLS', 'PWM Source': 'PWM',
    'PWL Source': 'PWL', 'Varactor': 'DV', 'Tunnel Diode': 'DT',
    'Photodiode': 'PD', 'NPN Darlington': 'QD', 'PNP Darlington': 'QD',
    'N-JFET': 'J', 'P-JFET': 'J', 'SCR': 'SCR', 'DIAC': 'DC', 'TRIAC': 'TR',
    'UJT': 'UJT', 'Real Op-Amp': 'U', 'OTA': 'OTA', 'VCVS': 'E', 'VCCS': 'G',
    'CCVS': 'H', 'CCCS': 'F', 'DPDT Switch': 'SW', 'Relay': 'K',
    'Programmable Block': 'MCU', 'Analog Switch': 'ASW', 'Logic Input': 'IN',
    'Logic Output': 'OUT', 'NOT Gate': 'NOT', 'AND Gate': 'AND',
    'OR Gate': 'OR', 'NOR Gate': 'NOR', 'XOR Gate': 'XOR', 'Buffer': 'BUF',
    'Tri-State Buf': 'TRI', 'D Flip-Flop': 'DFF', 'T Flip-Flop': 'TFF',
    'SR Latch': 'SR', 'Counter': 'CNT', 'Shift Register': 'SR', '2:1 Mux': 'MUX',
    'Decoder': 'DEC', 'Half Adder': 'HA', 'Full Adder': 'FA', 'DAC': 'DAC',
    'ADC': 'ADC', 'VCO': 'VCO', 'PLL': 'PLL', 'Optocoupler': 'OC', 'Lamp': 'LP',
    'LED Array': 'BAR', 'LED Matrix 8x8': 'DOT', 'DC Motor': 'M',
    'Antenna TX': 'TX', 'Antenna RX': 'RX', 'Bus': 'BUS', 'Bus Tap': 'TAP',
    'Pin Marker': 'P', 'Sub-Circuit': 'IC', 'Voltmeter': 'VM', 'Ammeter': 'AM',
    'Wattmeter': 'WM', 'Test Point': 'TP', 'Label': 'LBL'
};

const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

const BY_NORM = new Map();
Object.keys(CATALOGUE).forEach(k => BY_NORM.set(norm(k), k));

const PREFIX_OF = name => CATALOGUE[name];

/**
 * Refdes prefix -> the kinds of part Circuit Toy gives that prefix to.
 *
 * Used to catch the case that actually misleads a reader: a row whose refdes
 * says one device and whose description says another. A refdes that is merely
 * UNCONVENTIONAL - "X1" for an op-amp, which is the SPICE subcircuit habit -
 * points at nothing in the catalogue and cannot send anyone to the wrong part,
 * so it is left alone. "J1" for a MOSFET can and does.
 */
const BY_PREFIX = new Map();
Object.entries(CATALOGUE).forEach(([name, pfx]) => {
    const k = pfx.toUpperCase();
    if (!BY_PREFIX.has(k)) BY_PREFIX.set(k, []);
    BY_PREFIX.get(k).push(name);
});

/** Longest catalogue prefix that this refdes starts with, or null. */
function prefixOfRefdes(refdes) {
    const up = refdes.toUpperCase();
    let best = null;
    BY_PREFIX.forEach((_, pfx) => {
        if (up.startsWith(pfx) && (!best || pfx.length > best.length)) best = pfx;
    });
    return best;
}

/**
 * Tokens in a Value column that are NOT part names: engineering values,
 * expressions, and net names. The What column decides whether the Value is
 * even supposed to be a part - a "Voltage source" row's value is a magnitude
 * or a waveform, never a catalogue entry.
 */
const NET_NAMES = new Set(['VDD', 'VCC', 'VEE', 'VSS', 'VIN', 'VOUT', 'VDC',
                           'VEX', 'VREF', 'GND', 'OUT', 'IN', 'BUS', 'REF',
                           'TEMP', 'INPUT', 'VGS', 'VGATE', 'BAT']);

/**
 * A manufacturer part number is a legitimate Value: the reader places the
 * generic Circuit Toy part and sets its parameters to match. 2N3904, LM311,
 * MBR1060, INA128, SMBJ24A all qualify.
 *
 * A generic name with a digit stuck on the end - NMOS1, NPN1, INA1 - does not.
 * It is a leftover model name, and it is the same defect as NMOS_ENH: not in
 * the palette, so the reader has to guess. The test that separates them is
 * whether the token has two or more digits, or a digit that is not simply
 * appended to an alphabetic stem.
 */
function isPartNumber(tok) {
    if (!/\d/.test(tok)) return false;
    const trailingOnly = /^[A-Za-z_]+\d{1,2}$/.test(tok);
    return !trailingOnly;
}

function looksLikeAValue(tok) {
    return isPartNumber(tok)                    // 2N3904, LM311, MBR1060
        || /^[a-z]/.test(tok)                   // lower-case: a node name
        || /[*/+()]/.test(tok)                  // NLEDS*VLED: an expression
        || NET_NAMES.has(tok.toUpperCase())
        || tok.length < 2;
}

/** Rows whose Value column is a magnitude rather than a part name. */
function valueIsNotAPart(what) {
    return /source|supply|rail|resistor|capacitor|inductor|load|winding/i.test(what);
}

function lessonFiles() {
    const out = [];
    const base = path.join(ROOT, 'lessons');
    fs.readdirSync(base).forEach(dir => {
        const d = path.join(base, dir);
        if (!fs.statSync(d).isDirectory()) return;
        fs.readdirSync(d).forEach(f => {
            if (f.endsWith('.html')) out.push(path.join(d, f));
        });
    });
    return out;
}

const unknownParts = [];
const prefixMismatch = [];

lessonFiles().forEach(file => {
    const src = fs.readFileSync(file, 'utf8');
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    const lines = src.split(/\r?\n/);

    lines.forEach((line, i) => {
        // A build-table row: <td class="mono">REF</td><td>What</td><td>Value</td>...
        const m = line.match(
            /<td class="mono">([A-Za-z][\w]*)<\/td>\s*<td>([^<]*)<\/td>\s*<td>(.*?)<\/td>/);
        if (!m) return;

        const refdes = m[1];
        const what = m[2];
        const valueCell = m[3];

        // ---- 0. behavioural blocks -------------------------------------
        // "Block (LDO)" stands for something with no discrete equivalent. Its
        // Value may be:
        //   - a real catalogue part, when one exists (Block (XTAL) -> Crystal),
        //     which is strictly better than a placeholder;
        //   - a manufacturer part number, which tells the reader what it models;
        //   - Sub-Circuit, the placeholder for everything else.
        // What it must NOT be is the block's own invented name repeated, which
        // gives the reader a second thing to fail to find in the palette.
        if (/^Block \(/i.test(what.trim())) {
            const v = (valueCell.match(/<span class="mono">([^<]+)<\/span>/) || [])[1];
            if (!v) return;
            const tok = v.trim();
            if (BY_NORM.has(norm(tok))) return;          // a real part
            if (isPartNumber(tok)) return;               // LM311, INA128
            unknownParts.push({ rel, line: i + 1, refdes, what, tok });
            return;
        }

        // ---- 1. part names in the Value column -------------------------
        if (!valueIsNotAPart(what)) {
            const tokens = [...valueCell.matchAll(/<span class="mono">([^<]+)<\/span>/g)]
                .map(x => x[1].trim());
            tokens.forEach(tok => {
                if (looksLikeAValue(tok)) return;
                if (BY_NORM.has(norm(tok))) return;
                unknownParts.push({ rel, line: i + 1, refdes, what, tok });
            });
        }

        // ---- 2. a refdes that names a DIFFERENT device than the text ----
        let named = null;
        if (/\bMOSFET\b/i.test(what) || /\bNMOS\b/i.test(what) || /\bPMOS\b/i.test(what)) named = 'NMOS';
        else if (/\bJFET\b/i.test(what)) named = 'N-JFET';
        else if (/\bBJT\b/i.test(what)) named = 'NPN BJT';
        else if (/\bop-?amp\b/i.test(what)) named = 'Op-Amp';
        if (!named) return;

        const want = PREFIX_OF(named).toUpperCase();
        const got = prefixOfRefdes(refdes);
        // No catalogue prefix at all is unconventional, not misleading.
        if (got === null || got === want) return;

        prefixMismatch.push({
            rel, line: i + 1, refdes, what, want,
            says: BY_PREFIX.get(got).join(' / ')
        });
    });
});

let failed = false;

if (unknownParts.length) {
    failed = true;
    console.log('PART NOT IN CIRCUIT TOY - a reader searching the palette finds nothing\n');
    const byTok = new Map();
    unknownParts.forEach(f => {
        if (!byTok.has(f.tok)) byTok.set(f.tok, []);
        byTok.get(f.tok).push(f);
    });
    [...byTok.entries()]
        .sort((a, b) => b[1].length - a[1].length)
        .forEach(([tok, list]) => {
            console.log(`  ${tok}  (${list.length} row${list.length > 1 ? 's' : ''}) — e.g. ` +
                        `${list[0].rel}:${list[0].line}, described as "${list[0].what}"`);
        });
    console.log('\nCircuit Toy has 105 parts; the name in the Value column must be one of them.');
}

if (prefixMismatch.length) {
    failed = true;
    console.log('\nREFDES NAMES A DIFFERENT DEVICE - this is how a MOSFET becomes a J1\n');
    prefixMismatch.forEach(f => {
        console.log(`  ${f.rel}:${f.line}  "${f.refdes}" describes "${f.what}" ` +
                    `but that prefix means ${f.says} — should start with ${f.want}`);
    });
}

if (!failed) {
    console.log('PASS - every build table names a part Circuit Toy actually has.');
    process.exit(0);
}
process.exit(1);
