/**
 * Diagram geometry auditor - development tool, not shipped with a lesson.
 *
 * Load it into the running app and call __auditPage(). It checks the rendered
 * SVG in #lesson-content against the block-diagram rules:
 *
 *   DIAGONAL       a wire segment that is neither horizontal nor vertical
 *   OFF-GRID       a wire vertex off the 5 px grid, so it cannot meet a pin
 *   WIRE-OVERLAP   two segments running collinear on top of one another
 *   FLOATING-END   a wire end that lands on nothing
 *   TEXT-OVERLAP   two labels whose boxes partially intersect
 *   TEXT-ON-WIRE   a label sitting on top of a conductor
 *
 * The coordinate trap this exists to avoid: getBBox() on a transformed <g>
 * returns LOCAL coordinates. Every box is pushed through the element's CTM,
 * relative to the root svg, before anything is compared. The root inverse is
 * computed once per SVG - taking it per element forces a layout flush each
 * time and turns the audit into a multi-minute job.
 */
(function () {
    'use strict';

    var GRID = 5;

    function near(a, b, t) {
        return Math.abs(a - b) <= (t === undefined ? 2.5 : t);
    }

    function auditSvg(svg, tag) {
        var out = [];
        var rootCTM = svg.getCTM();
        var rootInv = rootCTM ? rootCTM.inverse() : null;
        var pt = svg.createSVGPoint();

        function rectOf(el) {
            var b;
            try { b = el.getBBox(); } catch (e) { return null; }
            if (!b || (!b.width && !b.height)) return null;
            var m = el.getCTM();
            if (rootInv && m) m = rootInv.multiply(m);
            var cs = [[b.x, b.y], [b.x + b.width, b.y],
                      [b.x, b.y + b.height], [b.x + b.width, b.y + b.height]];
            var xs = [], ys = [];
            for (var i = 0; i < cs.length; i++) {
                pt.x = cs[i][0]; pt.y = cs[i][1];
                var q = m ? pt.matrixTransform(m) : pt;
                xs.push(q.x); ys.push(q.y);
            }
            return { x: Math.min.apply(null, xs), y: Math.min.apply(null, ys),
                     X: Math.max.apply(null, xs), Y: Math.max.apply(null, ys) };
        }

        // A text bbox is an em-box: it includes ascender and descender space
        // that is empty for most labels. Two stacked lines routinely share a
        // pixel of that whitespace without a mark of ink touching, so require
        // a real intrusion on BOTH axes before calling it an overlap.
        var INK = 1.5;
        function ovl(a, b) {
            return (Math.min(a.X, b.X) - Math.max(a.x, b.x)) > INK &&
                   (Math.min(a.Y, b.Y) - Math.max(a.y, b.y)) > INK;
        }
        function has(a, b) { return a.x <= b.x + 0.5 && a.y <= b.y + 0.5 && a.X >= b.X - 0.5 && a.Y >= b.Y - 0.5; }

        // ---- wires: straight-line paths only; curves are symbol art, not conductors
        var segs = [], ends = [], verts = [];
        var paths = svg.querySelectorAll('path');
        for (var pi = 0; pi < paths.length; pi++) {
            var d = paths[pi].getAttribute('d') || '';
            if (d.charAt(0) !== 'M') continue;
            if (paths[pi].getAttribute('fill') !== 'none') continue;
            if (/[CQAScqas]/.test(d)) continue;
            var nums = (d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
            var pts = [];
            for (var i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
            for (var k = 0; k < pts.length; k++) {
                verts.push(pts[k]);
                if (pts[k][0] % GRID || pts[k][1] % GRID) {
                    out.push({ rule: 'OFF-GRID', at: String(pts[k]) });
                }
            }
            if (pts.length) { ends.push(pts[0]); ends.push(pts[pts.length - 1]); }
            for (var s = 0; s + 1 < pts.length; s++) {
                var a = pts[s], b = pts[s + 1];
                if (!near(a[0], b[0], 0.6) && !near(a[1], b[1], 0.6)) {
                    out.push({ rule: 'DIAGONAL', at: a + ' -> ' + b });
                }
                segs.push([a, b]);
            }
        }

        // ---- collinear overlap
        for (var x = 0; x < segs.length; x++) {
            for (var y = x + 1; y < segs.length; y++) {
                var a1 = segs[x][0], a2 = segs[x][1], b1 = segs[y][0], b2 = segs[y][1];
                if (near(a1[1], a2[1], 0.6) && near(b1[1], b2[1], 0.6) && near(a1[1], b1[1], 0.6)) {
                    var lo = Math.max(Math.min(a1[0], a2[0]), Math.min(b1[0], b2[0]));
                    var hi = Math.min(Math.max(a1[0], a2[0]), Math.max(b1[0], b2[0]));
                    if (hi - lo > 3) out.push({ rule: 'WIRE-OVERLAP', at: 'y=' + a1[1] + '  x ' + lo + '..' + hi });
                }
                if (near(a1[0], a2[0], 0.6) && near(b1[0], b2[0], 0.6) && near(a1[0], b1[0], 0.6)) {
                    var lo2 = Math.max(Math.min(a1[1], a2[1]), Math.min(b1[1], b2[1]));
                    var hi2 = Math.min(Math.max(a1[1], a2[1]), Math.max(b1[1], b2[1]));
                    if (hi2 - lo2 > 3) out.push({ rule: 'WIRE-OVERLAP', at: 'x=' + a1[0] + '  y ' + lo2 + '..' + hi2 });
                }
            }
        }

        // ---- anchors a wire end may legitimately land on
        var boxes = [];
        var shapes = svg.querySelectorAll('g,rect');
        for (var bi = 0; bi < shapes.length; bi++) {
            var r = rectOf(shapes[bi]);
            if (r) boxes.push(r);
        }
        var dots = [];
        var circles = svg.querySelectorAll('circle');
        for (var ci = 0; ci < circles.length; ci++) {
            dots.push([+circles[ci].getAttribute('cx'), +circles[ci].getAttribute('cy')]);
        }

        for (var ei = 0; ei < ends.length; ei++) {
            var e = ends[ei], hits = 0, ok = false;
            for (var vi = 0; vi < verts.length; vi++) {
                if (near(verts[vi][0], e[0]) && near(verts[vi][1], e[1])) hits++;
            }
            if (hits > 1) continue;
            for (var di = 0; di < dots.length && !ok; di++) {
                if (near(dots[di][0], e[0], 4) && near(dots[di][1], e[1], 4)) ok = true;
            }
            for (var bj = 0; bj < boxes.length && !ok; bj++) {
                var bx = boxes[bj];
                if (e[0] >= bx.x - 6 && e[0] <= bx.X + 6 && e[1] >= bx.y - 6 && e[1] <= bx.Y + 6) ok = true;
            }
            for (var sj = 0; sj < segs.length && !ok; sj++) {
                var p = segs[sj][0], q = segs[sj][1];
                if (near(p[1], q[1], 0.6) && near(e[1], p[1], 1.5) &&
                    e[0] > Math.min(p[0], q[0]) - 1 && e[0] < Math.max(p[0], q[0]) + 1) ok = true;
                if (near(p[0], q[0], 0.6) && near(e[0], p[0], 1.5) &&
                    e[1] > Math.min(p[1], q[1]) - 1 && e[1] < Math.max(p[1], q[1]) + 1) ok = true;
            }
            if (!ok) out.push({ rule: 'FLOATING-END', at: String(e) });
        }

        // ---- text
        var trs = [];
        var texts = svg.querySelectorAll('text');
        for (var ti = 0; ti < texts.length; ti++) {
            var tr = rectOf(texts[ti]);
            // Keep the element itself. trs is FILTERED - a text with no
            // measurable box is skipped - so trs[i] and texts[i] stop being
            // the same element as soon as one is dropped, and indexing back
            // into `texts` compares the wrong pair.
            if (tr) trs.push({ r: tr, s: (texts[ti].textContent || '').trim(), el: texts[ti] });
        }
        for (var m1 = 0; m1 < trs.length; m1++) {
            for (var m2 = m1 + 1; m2 < trs.length; m2++) {
                if (ovl(trs[m1].r, trs[m2].r) && !has(trs[m1].r, trs[m2].r) && !has(trs[m2].r, trs[m1].r)) {
                    out.push({ rule: 'TEXT-OVERLAP', at: '"' + trs[m1].s + '" x "' + trs[m2].s + '"' });
                }
            }
        }
        // ---- text sitting on a SYMBOL
        // Text-vs-text and text-vs-wire were checked above, which left the
        // obvious third case unchecked: a caption laid across a ground symbol
        // or a transistor body. Symbols are <g> groups, so neither of the other
        // two rules could ever see them.
        for (var ti2 = 0; ti2 < trs.length; ti2++) {
            for (var gi = 0; gi < shapes.length; gi++) {
                if (shapes[gi].tagName.toLowerCase() !== 'g') continue;
                // Only groups that hold ARTWORK count. Labels are wrapped in
                // their own <g>, so a text always shares a box with the group
                // around it - and comparing those reported every label in the
                // drawing as overlapping a symbol. What the rule means is
                // "is this text sitting on top of drawn lines", so require the
                // group to contain some.
                if (!shapes[gi].querySelector('path,line,circle,polygon,polyline,rect')) continue;
                if (shapes[gi].contains(trs[ti2].el)) continue;
                var gb = rectOf(shapes[gi]);
                if (!gb) continue;
                var tb = trs[ti2].r;
                if ((Math.min(tb.X, gb.X) - Math.max(tb.x, gb.x)) > INK &&
                    (Math.min(tb.Y, gb.Y) - Math.max(tb.y, gb.y)) > INK) {
                    out.push({ rule: 'TEXT-ON-SYMBOL', at: '"' + trs[ti2].s + '"' });
                    break;
                }
            }
        }

        for (var tj = 0; tj < trs.length; tj++) {
            for (var sk = 0; sk < segs.length; sk++) {
                var u = segs[sk][0], v = segs[sk][1], t = trs[tj];
                var onH = near(u[1], v[1], 0.6) && t.r.y < u[1] && t.r.Y > u[1] &&
                    Math.min(t.r.X, Math.max(u[0], v[0])) - Math.max(t.r.x, Math.min(u[0], v[0])) > 3;
                var onV = near(u[0], v[0], 0.6) && t.r.x < u[0] && t.r.X > u[0] &&
                    Math.min(t.r.Y, Math.max(u[1], v[1])) - Math.max(t.r.y, Math.min(u[1], v[1])) > 3;
                if (onH || onV) { out.push({ rule: 'TEXT-ON-WIRE', at: '"' + t.s + '"' }); break; }
            }
        }

        for (var oi = 0; oi < out.length; oi++) out[oi].tag = tag;
        return out;
    }

    window.__auditSvg = auditSvg;

    /**
     * Audit the schematics rendered in the lesson pane.
     *
     * Only svg.circuit-diagram[role="img"] is checked by default. The class
     * alone is not enough: hand-written plots in the lessons wear it too. The
     * role plus aria-label pair is what ComponentModels.diagram() stamps, and
     * only generated schematics carry both. The rules are about
     * conductors and symbols, and applying them to a plot is meaningless: a
     * Bode curve or a gate-charge trace is nothing but diagonals with two
     * loose ends, and reporting those as defects is how an audit stops being
     * worth reading. Pass all=true to sweep every SVG anyway.
     */
    window.__auditPage = function (label, all) {
        var sel = all ? '#lesson-content svg'
                      : '#lesson-content svg.circuit-diagram[role="img"]';
        var svgs = document.querySelectorAll(sel);
        var found = [];
        for (var i = 0; i < svgs.length; i++) {
            found = found.concat(auditSvg(svgs[i], (label || location.hash) + '#svg' + i));
        }
        return {
            audited: svgs.length,
            total: document.querySelectorAll('#lesson-content svg').length,
            count: found.length,
            findings: found
        };
    };
})();
