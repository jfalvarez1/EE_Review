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

    function run(root) {
        if (!root) return;
        const svgs = root.querySelectorAll('svg.circuit-diagram, svg.circuit-svg, svg');
        svgs.forEach(svg => normalizeSvg(svg));
    }

    window.SchematicNormalizer = { run };
})();
