#!/usr/bin/env node
/**
 * fix-toy-parts - rename leftover SPICE model names to Circuit Toy parts.
 *
 * These tables were SPICE netlists once. The de-SPICE pass turned the
 * structure into a build table and left the MODEL NAMES alone, so rows still
 * said things like NMOS_ENH and OPAMP_IDEAL - names that exist in no palette.
 * A reader looking for NMOS_ENH finds nothing, and N-JFET is the nearest thing
 * in the FET category, which is how a source-follower lab ended up with a J1
 * in it.
 *
 * Every mapping below is to a part Circuit Toy actually has. Where the old
 * name carried information the new one does not - NMOS_SW meant "a switching
 * MOSFET, low Rds(on)" - that information belongs in the What column as prose,
 * not in a name nobody can look up.
 *
 * Run: node tools/fix-toy-parts.js [--dry]
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.dirname(__dirname);
const DRY = process.argv.includes('--dry');

const MAP = {
    // FETs. Circuit Toy has exactly two: NMOS and PMOS.
    NMOS_ENH: 'NMOS', NMOS_SW: 'NMOS', NMOS_POWER: 'NMOS', NMOS_HS: 'NMOS',
    NMOS_LS: 'NMOS', NFET: 'NMOS', COMP_NMOS: 'NMOS',
    PMOS_SW: 'PMOS', PMOS_REG: 'PMOS', PFET: 'PMOS',

    // Bipolars.
    NPN: 'NPN BJT', NPN_LOG: 'NPN BJT', BJT_HF: 'NPN BJT', POWER_BJT: 'NPN BJT',
    PNP: 'PNP BJT',

    // Op-amps. The ideal one is "Op-Amp"; anything whose point is a real
    // limitation - bandwidth, DC error, PSRR, supply current - is "Real Op-Amp",
    // because an ideal model cannot demonstrate the effect being taught.
    OPAMP_IDEAL: 'Op-Amp',
    OPAMP_BW: 'Real Op-Amp', OPAMP_DC: 'Real Op-Amp', OPAMP_LP: 'Real Op-Amp',
    OPAMP_STD: 'Real Op-Amp', OPA_PSRR: 'Real Op-Amp', DEBUG_OPAMP: 'Real Op-Amp',
    AUDIO_OPA: 'Real Op-Amp',

    // Diodes. Circuit Toy separates plain, Schottky and Zener.
    DSCHOTTKY: 'Schottky Diode', SCHOTTKY: 'Schottky Diode',
    DFAST: 'Diode', DBRIDGE: 'Diode', DBODY: 'Diode', DCLAMP: 'Diode',
    D_ideal: 'Diode',
    ZENER: 'Zener Diode',
    // No TVS or MOV part exists. A zener is the right stand-in for a clamp
    // that conducts above a threshold, and the lesson text says what the real
    // part would be.
    DTVS: 'Zener Diode', TVS: 'Zener Diode', DMOV: 'Zener Diode',

    LEDMODEL: 'LED',
    SOLARCELL: 'Photodiode',
    XTAL: 'Crystal',
    SHIFTREG: 'Shift Register',

    // Generic names with a digit appended - the same leftover-model-name
    // problem wearing a different suffix. A reader cannot find NPN1 either.
    NPN1: 'NPN BJT', PNP1: 'PNP BJT', NMOS1: 'NMOS', PMOS1: 'PMOS',
    D1: 'Diode',
    // TVS24 reads like a part number but is not one: it was a SPICE model for
    // a 24 V transient suppressor. Circuit Toy has no TVS, and a zener is the
    // right stand-in for a clamp that conducts above a threshold.
    TVS24: 'Zener Diode', TVS5V: 'Zener Diode', SMBJ24A: 'Zener Diode',

    // Behavioural blocks with no discrete equivalent. Circuit Toy's
    // Sub-Circuit is the intended placeholder; the What column already names
    // what it stands for.
    LDO: 'Sub-Circuit', CAN_XCVR: 'Sub-Circuit', OD_DRIVER: 'Sub-Circuit',
    DRIVER: 'Sub-Circuit', LVDS_TX: 'Sub-Circuit', LVDS_RX: 'Sub-Circuit',
    BOOST_PFC: 'Sub-Circuit', PFC_CTRL: 'Sub-Circuit', LLC: 'Sub-Circuit',
    RS485_TX: 'Sub-Circuit', RS485_RX: 'Sub-Circuit',
    reg_model: 'Sub-Circuit', ldo_model: 'Sub-Circuit', ldo_clim: 'Sub-Circuit',
    ldo_ulp: 'Sub-Circuit', buck_simple: 'Sub-Circuit', sw_ideal: 'Sub-Circuit',
    sw_pwm: 'Sub-Circuit', prot_ic: 'Sub-Circuit', mux_4to1: 'Sub-Circuit',
    SH: 'Sub-Circuit', INA1: 'Sub-Circuit', 'TPGD=0.5m': 'Sub-Circuit'
};

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

let files = 0, edits = 0;
const perName = {};

lessonFiles().forEach(file => {
    let src = fs.readFileSync(file, 'utf8');
    const before = src;

    Object.keys(MAP).forEach(oldName => {
        // Only inside a mono span, so prose mentioning the old name is left
        // alone and nothing is replaced by accident.
        const re = new RegExp('(<span class="mono">)' +
                              oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
                              '(</span>)', 'g');
        const hits = (src.match(re) || []).length;
        if (!hits) return;
        // A function replacer: $ in a replacement string is a substitution.
        src = src.replace(re, (m, a, b) => a + MAP[oldName] + b);
        perName[oldName] = (perName[oldName] || 0) + hits;
        edits += hits;
    });

    if (src !== before) {
        files++;
        if (!DRY) fs.writeFileSync(file, src);
    }
});

Object.keys(perName).sort().forEach(k => {
    console.log(`  ${k.padEnd(14)} -> ${MAP[k].padEnd(16)} ${perName[k]}`);
});
console.log(`\n${edits} replacements across ${files} files${DRY ? ' (dry run)' : ''}`);

// Anything in the map that never matched is either already fixed or was a
// guess; say so rather than leaving it silently unused.
const unused = Object.keys(MAP).filter(k => !perName[k]);
if (unused.length) console.log('not found (already fixed?): ' + unused.join(', '));
