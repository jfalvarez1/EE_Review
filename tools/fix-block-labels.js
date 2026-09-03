#!/usr/bin/env node
/**
 * fix-block-labels - make "Block (...)" read as English.
 *
 * The Value column of these rows is already correct (Sub-Circuit, or a real
 * part), so nothing here can send a reader to the wrong component. What is
 * left is the DESCRIPTION, which still carries SPICE subcircuit names -
 * "Block (sw_ideal)", "Block (ldo_clim)", "Block (OPA_PSRR)". Those told a
 * netlist which .subckt to instantiate. They tell a person nothing.
 *
 * Manufacturer part numbers are kept: "Block (INA128)" is genuinely useful,
 * because it says which device the block stands in for.
 *
 * Run: node tools/fix-block-labels.js [--dry]
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.dirname(__dirname);
const DRY = process.argv.includes('--dry');

const LABEL = {
    AUDIO_OPA: 'audio op-amp',
    BOOST_PFC: 'boost PFC stage',
    CAN_XCVR: 'CAN transceiver',
    DRIVER: 'line driver',
    INA1: 'instrumentation amplifier',
    LDO: 'LDO regulator',
    LLC: 'LLC resonant converter',
    LVDS_RX: 'LVDS receiver',
    LVDS_TX: 'LVDS driver',
    OD_DRIVER: 'open-drain driver',
    OPA_PSRR: 'op-amp, PSRR modelled',
    PFC_CTRL: 'PFC controller',
    RS485_RX: 'RS-485 receiver',
    RS485_TX: 'RS-485 driver',
    SH: 'sample and hold',
    SHIFTREG: 'shift register',
    XTAL: 'crystal',
    buck_simple: 'buck regulator',
    ldo_clim: 'LDO with current limit',
    ldo_model: 'LDO regulator',
    ldo_ulp: 'ultra-low-power LDO',
    mux_4to1: '4:1 multiplexer',
    prot_ic: 'protection IC',
    reg_model: 'regulator',
    sw_ideal: 'ideal switch',
    sw_pwm: 'PWM-driven switch'
    // INA128, LM311, XTR117 are part numbers and are left alone.
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

let total = 0, files = 0;
const counts = {};

lessonFiles().forEach(file => {
    let src = fs.readFileSync(file, 'utf8');
    const before = src;

    Object.keys(LABEL).forEach(k => {
        const needle = '<td>Block (' + k + ')</td>';
        const n = src.split(needle).length - 1;
        if (!n) return;
        src = src.split(needle).join('<td>Block (' + LABEL[k] + ')</td>');
        counts[k] = (counts[k] || 0) + n;
        total += n;
    });

    if (src !== before) {
        files++;
        if (!DRY) fs.writeFileSync(file, src);
    }
});

Object.keys(counts).sort().forEach(k =>
    console.log(`  ${k.padEnd(12)} -> ${LABEL[k].padEnd(28)} ${counts[k]}`));
console.log(`\n${total} labels across ${files} files${DRY ? ' (dry run)' : ''}`);
