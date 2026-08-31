// Normalize manual SVG schematics so they follow supply-rail conventions
// (e.g., VCC/VDD/VEE/VSS use flat-bar symbols).
(function() {
    const SVG_NS = 'http://www.w3.org/2000/svg';

    const POSITIVE_LABEL = /^(?:\+?VCC|\+?VDD|V\+|\+V)(?:\b|[^\w])/i;
    const NEGATIVE_LABEL = /^(?:VEE|VSS|V-|\-VEE|\-VSS)(?:\b|[^\w])/i;

    function getNum(el, attr) {
        const raw = el.getAttribute(attr);
        const val = raw == null ? NaN : Number(raw);
        return Number.isFinite(val) ? val : NaN;
    }

    function isVertical(line) {
        const x1 = getNum(line, 'x1');
        const x2 = getNum(line, 'x2');
        const y1 = getNum(line, 'y1');
        const y2 = getNum(line, 'y2');
        if (![x1, x2, y1, y2].every(Number.isFinite)) return false;
        return Math.abs(x1 - x2) <= 0.5 && Math.abs(y2 - y1) >= 6;
    }

    function barExists(svg, cx, y, tol = 0.5) {
        const lines = svg.querySelectorAll('line');
        for (const line of lines) {
            const x1 = getNum(line, 'x1');
            const x2 = getNum(line, 'x2');
            const y1 = getNum(line, 'y1');
            const y2 = getNum(line, 'y2');
            if (![x1, x2, y1, y2].every(Number.isFinite)) continue;
            if (Math.abs(y1 - y2) > tol) continue;
            if (Math.abs(y1 - y) > tol) continue;
            const minX = Math.min(x1, x2);
            const maxX = Math.max(x1, x2);
            if (cx >= minX - 1 && cx <= maxX + 1) return true;
        }
        return false;
    }

    function addBar(svg, line, direction) {
        const x = getNum(line, 'x1');
        const y1 = getNum(line, 'y1');
        const y2 = getNum(line, 'y2');
        if (![x, y1, y2].every(Number.isFinite)) return;

        const y = direction === 'down' ? Math.max(y1, y2) : Math.min(y1, y2);
        if (barExists(svg, x, y)) return;

        const bar = document.createElementNS(SVG_NS, 'line');
        bar.setAttribute('x1', String(x - 8));
        bar.setAttribute('x2', String(x + 8));
        bar.setAttribute('y1', String(y));
        bar.setAttribute('y2', String(y));

        const cls = line.getAttribute('class');
        if (cls) bar.setAttribute('class', cls);
        const stroke = line.getAttribute('stroke');
        if (stroke) bar.setAttribute('stroke', stroke);
        const strokeWidth = line.getAttribute('stroke-width');
        if (strokeWidth) bar.setAttribute('stroke-width', strokeWidth);

        bar.setAttribute('data-auto', 'rail-bar');
        line.parentNode.insertBefore(bar, line.nextSibling);
    }

    function normalizeSvg(svg) {
        const texts = svg.querySelectorAll('text');
        const lines = Array.from(svg.querySelectorAll('line')).filter(isVertical);

        texts.forEach(text => {
            const raw = (text.textContent || '').trim();
            if (!raw) return;
            const token = raw.split(/\s|\(/)[0];
            const isPositive = POSITIVE_LABEL.test(token);
            const isNegative = NEGATIVE_LABEL.test(token);
            if (!isPositive && !isNegative) return;

            const tx = getNum(text, 'x');
            const ty = getNum(text, 'y');
            if (!Number.isFinite(tx) || !Number.isFinite(ty)) return;

            let best = null;
            let bestDx = Infinity;
            for (const line of lines) {
                const x = getNum(line, 'x1');
                const y1 = getNum(line, 'y1');
                const y2 = getNum(line, 'y2');
                if (![x, y1, y2].every(Number.isFinite)) continue;
                const dx = Math.abs(x - tx);
                if (dx > 12) continue;
                const topY = Math.min(y1, y2);
                const botY = Math.max(y1, y2);
                if (isPositive && ty > botY + 25) continue;
                if (isNegative && ty < topY - 5) continue;
                if (dx < bestDx) {
                    best = line;
                    bestDx = dx;
                }
            }

            if (best) {
                addBar(svg, best, isNegative ? 'down' : 'up');
            }
        });
    }

    // ===== CONTRAST NORMALISATION =====
    //
    // Many lesson diagrams were authored against a white page and stroke their
    // geometry in #333. On this app's #0b0f16 background that is a contrast
    // ratio of 1.5:1 - the outlines simply are not there, and a MOSFET reduces
    // to a couple of faint rectangles. 106 lesson files were affected.
    //
    // Rather than rewrite thousands of attributes in place, remap them at load:
    // keep the author's hue and saturation, raise lightness until the stroke is
    // legible. Shape fills are left alone - a dark fill is usually a deliberate
    // panel, and lightening it would wreck the design.

    const PAGE_BG = [0x0b, 0x0f, 0x16];
    const MIN_CONTRAST = 3.2;
    const NEUTRAL_INK = '#c8d4e0';   // for greys, which have no hue to preserve

    function hexToRgb(hex) {
        if (typeof hex !== 'string') return null;
        const h = hex.trim().replace(/^#/, '');
        if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(h)) return null;
        const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
        return [parseInt(full.slice(0, 2), 16),
                parseInt(full.slice(2, 4), 16),
                parseInt(full.slice(4, 6), 16)];
    }

    function relLum(rgb) {
        const f = v => {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
    }

    const BG_LUM = relLum(PAGE_BG);

    function contrastVsBg(rgb) {
        const l = relLum(rgb);
        const hi = Math.max(l, BG_LUM), lo = Math.min(l, BG_LUM);
        return (hi + 0.05) / (lo + 0.05);
    }

    function rgbToHsl(rgb) {
        const r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        const l = (max + min) / 2;
        if (max === min) return [0, 0, l];
        const d = max - min;
        const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        let h;
        if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        else if (max === g) h = ((b - r) / d + 2) / 6;
        else h = ((r - g) / d + 4) / 6;
        return [h, s, l];
    }

    function hslToRgb(h, s, l) {
        if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        return [Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
                Math.round(hue2rgb(p, q, h) * 255),
                Math.round(hue2rgb(p, q, h - 1 / 3) * 255)];
    }

    function toHex(rgb) {
        return '#' + rgb.map(v => Math.max(0, Math.min(255, v))
                                    .toString(16).padStart(2, '0')).join('');
    }

    const brightenCache = Object.create(null);

    function brighten(hex) {
        if (hex in brightenCache) return brightenCache[hex];
        const rgb = hexToRgb(hex);
        let out = null;
        if (rgb && contrastVsBg(rgb) < MIN_CONTRAST) {
            const hsl = rgbToHsl(rgb);
            if (hsl[1] < 0.15) {
                out = NEUTRAL_INK;               // grey: no hue worth keeping
            } else {
                let l = hsl[2];
                let candidate = null;
                for (let i = 0; i < 40 && l < 0.92; i++) {
                    l += 0.02;
                    const c = hslToRgb(hsl[0], Math.min(1, hsl[1] * 1.15), l);
                    if (contrastVsBg(c) >= MIN_CONTRAST) { candidate = c; break; }
                }
                out = candidate ? toHex(candidate) : NEUTRAL_INK;
            }
        }
        brightenCache[hex] = out;
        return out;
    }

    // True when a text element is drawn on top of a light-filled shape, in
    // which case the author's dark ink is correct and must be left alone.
    function sitsOnLightPanel(svg, textEl) {
        let tb;
        try { tb = textEl.getBBox(); } catch (e) { return false; }
        if (!tb || !tb.width) return false;
        const cx = tb.x + tb.width / 2;
        const cy = tb.y + tb.height / 2;
        const shapes = svg.querySelectorAll('rect, circle, ellipse, polygon, path');
        for (const s of shapes) {
            const f = s.getAttribute('fill');
            if (!f || f === 'none') continue;
            const rgb = hexToRgb(f);
            if (!rgb) continue;
            if (relLum(rgb) < 0.35) continue;          // not a light panel
            let b;
            try { b = s.getBBox(); } catch (e) { continue; }
            if (cx >= b.x && cx <= b.x + b.width &&
                cy >= b.y && cy <= b.y + b.height) return true;
        }
        return false;
    }

    function normalizeContrast(svg) {
        const nodes = svg.querySelectorAll('*');
        for (const el of nodes) {
            const tag = el.tagName;

            const stroke = el.getAttribute && el.getAttribute('stroke');
            if (stroke && stroke !== 'none') {
                const fixed = brighten(stroke);
                if (fixed) {
                    el.setAttribute('stroke', fixed);
                    el.setAttribute('data-contrast-fixed', stroke);
                }
            }

            // Text is ink, so its fill gets the same treatment. Shape fills do
            // not - those are usually intentional panels.
            //
            // But dark text sitting on a LIGHT panel is already legible, and
            // lightening it makes it disappear. Check what the text is actually
            // drawn on before touching it.
            if (tag === 'text' || tag === 'tspan') {
                const fill = el.getAttribute('fill');
                if (fill && fill !== 'none' && !sitsOnLightPanel(svg, el)) {
                    const fixed = brighten(fill);
                    if (fixed) {
                        el.setAttribute('fill', fixed);
                        el.setAttribute('data-contrast-fixed', fill);
                    }
                }
            }
        }
    }

    function run(root) {
        if (!root) return;
        const svgs = root.querySelectorAll('svg.circuit-diagram, svg.circuit-svg, svg');
        svgs.forEach(svg => {
            normalizeSvg(svg);
            normalizeContrast(svg);
        });
    }

    window.SchematicNormalizer = { run, normalizeContrast, brighten };
})();
