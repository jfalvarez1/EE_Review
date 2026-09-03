#!/usr/bin/env node
/**
 * render-board-figures - turn kicad-cli layer plots into lesson figures.
 *
 * Two problems with the raw exports this fixes.
 *
 * 1. NO SOLDERMASK. kicad-cli plots on a transparent ground in KiCad's screen
 *    palette, so a figure is coloured lines floating on whatever is behind it.
 *    A real board has a mask colour, and a reader recognises a PCB by it.
 *
 * 2. LAYERS LOOK SHORTED. Plotting F.Cu and B.Cu into one image draws both in
 *    similar colours crossing each other, which reads as one layer full of
 *    shorts. Copper on different layers must be visibly different, and the
 *    layer has to be named on the figure.
 *
 * So each figure is ONE copper layer, on a mask-coloured board, in that
 * layer's own colour, with the layer name burned into the image.
 *
 * Palettes are the autorouter's own GUI themes (docs/THEME_PALETTES.md in
 * kicad_auto_router_LLM_powered), so a board figure here and the router's GUI
 * look like the same tool.
 *
 * Usage:
 *   node tools/render-board-figures.js <board.kicad_pcb> <outdir> <stem> [theme]
 *     theme: acid (default) | electric | plasma | synthwave
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// ---- the palettes, lifted from the router's kThemes[] and kMask[] ---------
const THEMES = {
    // Tactical Acid: matte OD green mask, acid green and deep sky blue accents
    acid: {
        mask: '#2B4426', silk: '#D8F0D8', edge: '#9DB89D',
        top: '#39FF14', bottom: '#00BFFF', inner: '#FFB000', drill: '#111411'
    },
    // Quantum Blue & Electric Violet: the router's default
    electric: {
        mask: '#102E5E', silk: '#E0E8F5', edge: '#8FA6C4',
        top: '#00A6FF', bottom: '#A020F0', inner: '#FFC24B', drill: '#0A0E17'
    },
    plasma: {
        mask: '#06302A', silk: '#DFFFF6', edge: '#7FB8AC',
        top: '#00FFC8', bottom: '#FFC24B', inner: '#FF6BD6', drill: '#040A0C'
    },
    synthwave: {
        mask: '#3B1F63', silk: '#EAE6FF', edge: '#A594C7',
        top: '#00FFFF', bottom: '#FF007F', inner: '#FFD166', drill: '#0F0B1E'
    }
};

// Which accent a layer gets.
function layerColour(theme, layer) {
    if (/^F\./.test(layer)) return theme.top;
    if (/^B\./.test(layer)) return theme.bottom;
    if (/^In\d/.test(layer)) return theme.inner;
    return theme.top;
}

// KiCad's own plot colours, so we know what to replace.
const KICAD = {
    'F.Cu':  '#C83434',
    'B.Cu':  '#4D7FC4',
    'In1.Cu': '#7FC87F',
    'In2.Cu': '#CE7D2C',
    'In3.Cu': '#4FFBF3',
    'In4.Cu': '#DD9BEE',
    silk:   '#F2EDA1',
    edge:   '#D0D2CD',
    hole:   '#FFFFFF'
};

function cliFor(file) {
    // KiCad 10 boards will not load in the 9.0 CLI, and vice versa is fine, so
    // try 10 first and fall back.
    const candidates = [
        'C:/Program Files/KiCad/10.0/bin/kicad-cli.exe',
        'C:/Program Files/KiCad/9.0/bin/kicad-cli.exe',
        'kicad-cli'
    ];
    return candidates.filter(c => c === 'kicad-cli' || fs.existsSync(c));
}

function plot(board, layers, outFile) {
    const args = ['pcb', 'export', 'svg', '--mode-single', '--fit-page-to-board',
                  '--exclude-drawing-sheet', '--page-size-mode', '2',
                  '--drill-shape-opt', '1',
                  '-l', layers, '-o', outFile, board];
    let lastErr = null;
    for (const cli of cliFor(board)) {
        try {
            execFileSync(cli, args, { stdio: 'pipe' });
            if (fs.existsSync(outFile) && fs.statSync(outFile).size > 500) return true;
        } catch (e) { lastErr = e; }
    }
    if (lastErr) console.error('    plot failed: ' + (lastErr.message || '').split('\n')[0]);
    return false;
}

/** Give the SVG a mask-coloured board and recolour the copper. */
function dress(file, theme, copperLayer, caption) {
    let src = fs.readFileSync(file, 'utf8');

    // Recolour: copper to the layer's accent, silk and edge to the theme's.
    const map = {};
    Object.keys(KICAD).forEach(k => {
        if (k.endsWith('.Cu')) map[KICAD[k]] = layerColour(theme, k);
    });
    map[KICAD.silk] = theme.silk;
    map[KICAD.edge] = theme.edge;
    map[KICAD.hole] = theme.drill;

    Object.keys(map).forEach(from => {
        src = src.replace(new RegExp(from, 'gi'), map[from]);
    });

    // A board-coloured ground, inserted immediately after the opening <svg ...>
    // so everything else draws on top of it.
    const m = /<svg\b[^>]*viewBox="([\d.\-\s]+)"[^>]*>/i.exec(src);
    if (m) {
        const [, vb] = m;
        const [vx, vy, vw, vh] = vb.trim().split(/\s+/).map(Number);
        const pad = Math.max(vw, vh) * 0.02;
        const ground =
            `\n<rect x="${vx - pad}" y="${vy - pad}" width="${vw + 2 * pad}" ` +
            `height="${vh + 2 * pad}" fill="${theme.mask}"/>`;
        // A layer label, sized relative to the board so it reads at any zoom.
        const fs2 = Math.max(vh * 0.055, 1.6);
        const label = caption
            ? `\n<text x="${vx + vw * 0.012}" y="${vy + fs2 * 1.15}" ` +
              `font-family="monospace" font-size="${fs2}" fill="${theme.silk}" ` +
              `opacity="0.92">${caption}</text>`
            : '';
        src = src.replace(m[0], m[0] + ground);
        if (label) src = src.replace('</svg>', label + '\n</svg>');
    }

    fs.writeFileSync(file, src);
}

// ---- main ---------------------------------------------------------------
const [board, outDir, stem, themeName] = process.argv.slice(2);
if (!board || !outDir || !stem) {
    console.error('usage: render-board-figures.js <board.kicad_pcb> <outdir> <stem> [theme]');
    process.exit(2);
}
const theme = THEMES[themeName || 'acid'];
if (!theme) {
    console.error('unknown theme. one of: ' + Object.keys(THEMES).join(', '));
    process.exit(2);
}
fs.mkdirSync(outDir, { recursive: true });

// Which copper layers does this board actually have?
const src = fs.readFileSync(board, 'utf8');
const copper = [];
['F.Cu', 'In1.Cu', 'In2.Cu', 'In3.Cu', 'In4.Cu', 'B.Cu'].forEach(l => {
    if (new RegExp('"' + l.replace('.', '\\.') + '"').test(src)) copper.push(l);
});

console.log(board.split(/[\\/]/).pop() + '  ->  ' + copper.join(', ') +
            '   theme: ' + (themeName || 'acid'));

copper.forEach(layer => {
    const short = layer.replace('.Cu', '').toLowerCase();
    const out = path.join(outDir, stem + '_' + short + '.svg');
    // Silkscreen only on the outer layers, where it exists.
    const withSilk = layer === 'F.Cu' ? layer + ',Edge.Cuts,F.SilkS'
                   : layer === 'B.Cu' ? layer + ',Edge.Cuts'
                   : layer + ',Edge.Cuts';
    if (plot(board, withSilk, out)) {
        dress(out, theme, layer, layer);
        console.log('  ok  ' + path.basename(out) + '  ' + fs.statSync(out).size + ' bytes');
    } else {
        console.log('  FAIL ' + path.basename(out));
    }
});
