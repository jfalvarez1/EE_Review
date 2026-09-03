/**
 * BoardViewer - an interactive, net-labelled PCB figure.
 *
 * A plotted board image tells you nothing about which copper belongs to which
 * net: every trace is an anonymous line, and a reader looking at a layout
 * cannot answer the first question they have, which is "what is that?".
 *
 * This draws the board from tools/board-to-json.js output, where every track,
 * via and pad carries its net name. Hovering any copper names its net;
 * hovering or clicking a net in the legend highlights it across every layer at
 * once, which is the only way to see that a net changes layers.
 *
 * One panel per copper layer, always. Overlaying layers draws traces crossing
 * each other that never touch, and that reads as a board full of shorts.
 *
 *   BoardViewer.mount('#host', 'docs/data/boards/buck.json', {
 *       theme: 'acid', layers: ['F.Cu','B.Cu'], height: 320
 *   });
 */
(function () {
    'use strict';

    // The autorouter's own GUI palettes, so a figure here and its GUI match.
    var THEMES = {
        acid:      { mask: '#2B4426', silk: '#D8F0D8', edge: '#9DB89D',
                     top: '#39FF14', bottom: '#00BFFF', inner: '#FFB000',
                     pad: '#E8E4C9', drill: '#111411', hi: '#FFFFFF' },
        electric:  { mask: '#102E5E', silk: '#E0E8F5', edge: '#8FA6C4',
                     top: '#00A6FF', bottom: '#A020F0', inner: '#FFC24B',
                     pad: '#E6ECF5', drill: '#0A0E17', hi: '#FFFFFF' },
        plasma:    { mask: '#06302A', silk: '#DFFFF6', edge: '#7FB8AC',
                     top: '#00FFC8', bottom: '#FFC24B', inner: '#FF6BD6',
                     pad: '#DFF7F0', drill: '#040A0C', hi: '#FFFFFF' },
        synthwave: { mask: '#3B1F63', silk: '#EAE6FF', edge: '#A594C7',
                     top: '#00FFFF', bottom: '#FF007F', inner: '#FFD166',
                     pad: '#EDE8FF', drill: '#0F0B1E', hi: '#FFFFFF' }
    };

    function layerColour(t, layer) {
        if (/^F\./.test(layer)) return t.top;
        if (/^B\./.test(layer)) return t.bottom;
        if (/^In/.test(layer))  return t.inner;
        return t.top;
    }

    var NS = 'http://www.w3.org/2000/svg';
    function el(name, attrs) {
        var n = document.createElementNS(NS, name);
        if (attrs) Object.keys(attrs).forEach(function (k) {
            n.setAttribute(k, attrs[k]);
        });
        return n;
    }

    // A net name safe to use in an attribute selector and a CSS class.
    function slug(name) {
        return 'n' + String(name).replace(/[^A-Za-z0-9]+/g, '_');
    }

    function render(host, board, opts) {
        var theme = THEMES[opts.theme || 'acid'] || THEMES.acid;
        var wanted = opts.layers && opts.layers.length ? opts.layers : board.layers;
        var panelH = opts.height || 300;

        host.innerHTML = '';
        host.className = (host.className || '') + ' board-viewer';

        // ---- the net legend -------------------------------------------------
        var legend = document.createElement('div');
        legend.className = 'bv-legend';

        var lead = document.createElement('span');
        lead.className = 'bv-legend-lead';
        lead.textContent = 'Nets, longest first:';
        legend.appendChild(lead);

        var shown = board.nets.filter(function (n) { return n.name && n.name !== '(none)'; });
        shown.forEach(function (n) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'bv-net';
            b.setAttribute('data-net', n.name);
            b.innerHTML = '<span class="bv-net-name"></span>' +
                          '<span class="bv-net-len"></span>';
            b.querySelector('.bv-net-name').textContent = n.name;
            b.querySelector('.bv-net-len').textContent =
                n.len ? n.len.toFixed(1) + ' mm' : 'pads only';
            legend.appendChild(b);
        });
        host.appendChild(legend);

        // ---- a readout that names whatever is under the pointer -------------
        var readout = document.createElement('div');
        readout.className = 'bv-readout';
        readout.textContent = 'Hover any copper to name its net. Click a net to pin it.';
        host.appendChild(readout);

        // ---- one panel per layer -------------------------------------------
        var grid = document.createElement('div');
        grid.className = 'bv-grid';
        if (wanted.length <= 2) grid.classList.add('bv-2up');
        host.appendChild(grid);

        var bb = board.bbox;
        var pad = Math.max(bb.w, bb.h) * 0.03;

        wanted.forEach(function (layer) {
            var panel = document.createElement('figure');
            panel.className = 'bv-panel';

            var svg = el('svg', {
                viewBox: (bb.x - pad) + ' ' + (bb.y - pad) + ' ' +
                         (bb.w + 2 * pad) + ' ' + (bb.h + 2 * pad),
                preserveAspectRatio: 'xMidYMid meet',
                role: 'img',
                'aria-label': board.name + ', layer ' + layer
            });
            // Let the viewBox drive the height rather than pinning it. A fixed
            // height on a board that is twice as wide as it is tall leaves
            // bands of dead panel above and below it.
            svg.style.width = '100%';
            svg.style.height = 'auto';
            svg.style.maxHeight = panelH + 'px';
            svg.style.display = 'block';

            // the board itself
            svg.appendChild(el('rect', {
                x: bb.x - pad, y: bb.y - pad, width: bb.w + 2 * pad, height: bb.h + 2 * pad,
                fill: theme.mask
            }));
            svg.appendChild(el('rect', {
                x: bb.x, y: bb.y, width: bb.w, height: bb.h,
                fill: 'none', stroke: theme.edge, 'stroke-width': Math.max(bb.w, bb.h) * 0.0018
            }));

            var colour = layerColour(theme, layer);

            // zones first, so copper sits on top of the pour
            var zg = el('g', { class: 'bv-zones' });
            board.zones.filter(function (z) { return z.layer === layer; })
                .forEach(function (z) {
                    z.polys.forEach(function (ring) {
                        var d = 'M' + ring.map(function (p) { return p[0] + ',' + p[1]; }).join('L') + 'Z';
                        var p = el('path', {
                            d: d, fill: colour, 'fill-opacity': '0.55',
                            stroke: colour, 'stroke-width': 0.05,
                            class: 'bv-shape ' + slug(z.net || 'none')
                        });
                        p.setAttribute('data-net', z.net || '');
                        p.setAttribute('data-kind', 'zone');
                        zg.appendChild(p);
                    });
                });
            svg.appendChild(zg);

            // tracks
            var tg = el('g', { class: 'bv-tracks' });
            board.tracks.filter(function (t) { return t.layer === layer; })
                .forEach(function (t) {
                    var ln = el('line', {
                        x1: t.x1, y1: t.y1, x2: t.x2, y2: t.y2,
                        stroke: colour, 'stroke-width': t.w,
                        'stroke-linecap': 'round',
                        class: 'bv-shape ' + slug(t.net || 'none')
                    });
                    ln.setAttribute('data-net', t.net || '');
                    ln.setAttribute('data-kind', 'track');
                    ln.setAttribute('data-w', t.w);
                    tg.appendChild(ln);
                });
            svg.appendChild(tg);

            // pads on this layer
            var pg = el('g', { class: 'bv-pads' });
            board.pads.filter(function (p) {
                return p.layer.indexOf(layer) >= 0 || p.layer.indexOf('*.Cu') >= 0;
            }).forEach(function (p) {
                var s = el('rect', {
                    x: p.x - p.w / 2, y: p.y - p.h / 2, width: p.w, height: p.h,
                    rx: p.shape === 'circle' || p.shape === 'oval' ? Math.min(p.w, p.h) / 2 : 0.1,
                    fill: theme.pad, 'fill-opacity': '0.85',
                    class: 'bv-shape ' + slug(p.net || 'none')
                });
                s.setAttribute('data-net', p.net || '');
                s.setAttribute('data-kind', 'pad ' + p.ref);
                pg.appendChild(s);
            });
            svg.appendChild(pg);

            // vias punch through every layer, so they appear on all panels
            var vg = el('g', { class: 'bv-vias' });
            board.vias.forEach(function (v) {
                var c = el('circle', {
                    cx: v.x, cy: v.y, r: v.d / 2,
                    fill: theme.pad, 'fill-opacity': '0.9',
                    class: 'bv-shape ' + slug(v.net || 'none')
                });
                c.setAttribute('data-net', v.net || '');
                c.setAttribute('data-kind', 'via');
                vg.appendChild(c);
                vg.appendChild(el('circle', {
                    cx: v.x, cy: v.y, r: v.drill / 2, fill: theme.drill,
                    'pointer-events': 'none'
                }));
            });
            svg.appendChild(vg);

            // ---- annotations: point at a feature and name it -----------------
            // A layout figure is only useful if it can say "THAT, there, is the
            // input loop". Each annotation is a labelled box in board
            // millimetres, optionally scoped to one layer.
            (opts.annotations || []).forEach(function (a) {
                if (a.layer && a.layer !== layer) return;
                var g = el('g', { class: 'bv-annot' });
                var stroke = a.colour || '#FF5C5C';
                g.appendChild(el('rect', {
                    x: a.x, y: a.y, width: a.w, height: a.h,
                    fill: 'none', stroke: stroke,
                    'stroke-width': Math.max(bb.w, bb.h) * 0.004,
                    'stroke-dasharray': (Math.max(bb.w, bb.h) * 0.012) + ' ' +
                                        (Math.max(bb.w, bb.h) * 0.008),
                    rx: Math.max(bb.w, bb.h) * 0.004
                }));
                if (a.label) {
                    var fs = Math.max(bb.h * 0.042, 1.2);
                    var above = a.y - fs * 0.5 > bb.y;
                    var tx = el('text', {
                        x: a.x, y: above ? a.y - fs * 0.45 : a.y + a.h + fs * 1.1,
                        'font-family': 'monospace', 'font-size': fs,
                        fill: stroke, 'font-weight': '700'
                    });
                    tx.textContent = a.label;
                    g.appendChild(tx);
                }
                g.setAttribute('pointer-events', 'none');
                svg.appendChild(g);
            });

            // the layer name, in the figure, so a panel is never ambiguous
            var label = el('text', {
                x: bb.x + bb.w * 0.012, y: bb.y + bb.h * 0.075,
                'font-family': 'monospace',
                'font-size': Math.max(bb.h * 0.05, 1.4),
                fill: theme.silk, opacity: '0.92', 'pointer-events': 'none'
            });
            label.textContent = layer;
            svg.appendChild(label);

            panel.appendChild(svg);

            var cap = document.createElement('figcaption');
            var nTracks = board.tracks.filter(function (t) { return t.layer === layer; }).length;
            var zoneHere = board.zones.filter(function (z) { return z.layer === layer; });
            cap.innerHTML = '<strong></strong> — <span></span>';
            cap.querySelector('strong').textContent = layer;
            cap.querySelector('span').textContent =
                nTracks + (nTracks === 1 ? ' track' : ' tracks') +
                (zoneHere.length
                    ? ', ' + zoneHere.map(function (z) { return z.net || 'unnamed'; }).join('/') + ' plane'
                    : ', no plane');
            panel.appendChild(cap);

            grid.appendChild(panel);
        });

        // ---- interaction -----------------------------------------------------
        var pinned = null;

        function highlight(net) {
            var active = net || pinned;
            host.classList.toggle('bv-focus', !!active);
            var shapes = host.querySelectorAll('.bv-shape');
            for (var i = 0; i < shapes.length; i++) {
                var s = shapes[i];
                var on = active && s.getAttribute('data-net') === active;
                s.classList.toggle('bv-on', !!on);
            }
            var btns = host.querySelectorAll('.bv-net');
            for (var j = 0; j < btns.length; j++) {
                btns[j].classList.toggle('bv-active',
                    btns[j].getAttribute('data-net') === active);
            }
        }

        function describe(net) {
            if (!net) {
                readout.textContent = pinned
                    ? 'Pinned: ' + pinned + '. Click it again to unpin.'
                    : 'Hover any copper to name its net. Click a net to pin it.';
                return;
            }
            var info = null;
            for (var i = 0; i < board.nets.length; i++) {
                if (board.nets[i].name === net) { info = board.nets[i]; break; }
            }
            readout.textContent = info
                ? net + ' — ' + info.len.toFixed(1) + ' mm of track in ' +
                  info.segs + ' segments, on ' + (info.layers.join(' + ') || 'no layer')
                : net;
        }

        grid.addEventListener('mouseover', function (e) {
            var t = e.target;
            if (!t.classList || !t.classList.contains('bv-shape')) return;
            var net = t.getAttribute('data-net');
            if (!net) return;
            highlight(net);
            describe(net);
        });
        grid.addEventListener('mouseout', function () {
            highlight(null);
            describe(null);
        });
        grid.addEventListener('click', function (e) {
            var t = e.target;
            if (!t.classList || !t.classList.contains('bv-shape')) return;
            var net = t.getAttribute('data-net');
            pinned = (pinned === net) ? null : net;
            highlight(null);
            describe(null);
        });

        legend.addEventListener('mouseover', function (e) {
            var b = e.target.closest ? e.target.closest('.bv-net') : null;
            if (!b) return;
            highlight(b.getAttribute('data-net'));
            describe(b.getAttribute('data-net'));
        });
        legend.addEventListener('mouseout', function () {
            highlight(null); describe(null);
        });
        legend.addEventListener('click', function (e) {
            var b = e.target.closest ? e.target.closest('.bv-net') : null;
            if (!b) return;
            var net = b.getAttribute('data-net');
            pinned = (pinned === net) ? null : net;
            highlight(null);
            describe(null);
        });
    }

    var BoardViewer = {
        themes: THEMES,

        mount: function (target, url, opts) {
            opts = opts || {};
            var host = typeof target === 'string'
                ? document.querySelector(target) : target;
            if (!host) return;

            host.innerHTML = '<p class="bv-loading">Loading board…</p>';

            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.onreadystatechange = function () {
                if (xhr.readyState !== 4) return;
                if (xhr.status !== 200 && xhr.status !== 0) {
                    host.innerHTML = '<p class="bv-loading">Board data unavailable (' +
                                     xhr.status + ').</p>';
                    return;
                }
                var board;
                try { board = JSON.parse(xhr.responseText); }
                catch (err) {
                    host.innerHTML = '<p class="bv-loading">Board data could not be read.</p>';
                    return;
                }
                try { render(host, board, opts); }
                catch (err) {
                    host.innerHTML = '<p class="bv-loading">Could not draw the board.</p>';
                    if (window.console) console.error('BoardViewer:', err);
                }
            };
            xhr.send();
        }
    };

    window.BoardViewer = BoardViewer;
})();
