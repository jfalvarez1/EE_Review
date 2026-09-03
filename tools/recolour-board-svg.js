#!/usr/bin/env node
/**
 * recolour-board-svg - make kicad-cli SVG exports legible as figures.
 *
 * kicad-cli plots in KiCad's screen palette, which is chosen to read on the
 * editor's dark canvas. Two of those colours are nearly invisible on the light
 * plate a printed figure uses:
 *
 *   #F2EDA1  pale yellow  silkscreen
 *   #D0D2CD  light grey   board outline / edge cuts
 *
 * This remaps the palette to one that reads on white, without touching the
 * geometry. Copper stays a strong colour because it is the subject of the
 * figure; everything else becomes supporting grey.
 *
 * Usage: node tools/recolour-board-svg.js <file.svg> [more.svg ...]
 */

const fs = require('fs');

// from -> to.  Keys are matched case-insensitively.
const MAP = {
    '#F2EDA1': '#8a7a1f',   // silkscreen: pale yellow -> a legible olive
    '#D0D2CD': '#555555',   // edge cuts: near-white -> mid grey
    '#FFFFFF': '#e8e8e0',   // pad holes drawn white -> just off the plate
    '#C83434': '#b3261e',   // F.Cu: keep it red, a little deeper for print
    '#4D7FC4': '#1f5fa8',   // B.Cu: KiCad blue, deepened
    '#F2EDA1FF': '#8a7a1f'
};

let changed = 0;
process.argv.slice(2).forEach(file => {
    if (!fs.existsSync(file)) { console.error('missing: ' + file); return; }
    let src = fs.readFileSync(file, 'utf8');
    const before = src;
    Object.keys(MAP).forEach(from => {
        const re = new RegExp(from.replace('#', '#'), 'gi');
        src = src.replace(re, MAP[from]);
    });
    if (src !== before) {
        fs.writeFileSync(file, src);
        changed++;
        console.log('  recoloured ' + file);
    } else {
        console.log('  unchanged  ' + file);
    }
});
console.log(changed + ' file(s) recoloured');
