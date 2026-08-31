/**
 * AD Framework - Analog Design Learning Platform Core
 * Provides: numeric parsing, signal generation, canvas plotting, state management
 */

const AD = (() => {
    // ===== STORAGE NAMESPACE =====
    const STORAGE_PREFIX = 'AD_course_v1.';

    function ns(key) {
        return STORAGE_PREFIX + key;
    }

    // ===== COMPLETION TRACKING =====
    function getProgress() {
        try {
            const raw = localStorage.getItem(ns('progress'));
            if (!raw) return { lessons: {}, exercises: {}, checklists: {} };
            return JSON.parse(raw);
        } catch (e) {
            return { lessons: {}, exercises: {}, checklists: {} };
        }
    }

    function saveProgress(progress) {
        localStorage.setItem(ns('progress'), JSON.stringify(progress));
    }

    function isLessonDone(moduleId, lessonId) {
        const key = `m${moduleId}l${lessonId}`;
        return getProgress().lessons[key] === true;
    }

    function toggleLessonDone(moduleId, lessonId) {
        const key = `m${moduleId}l${lessonId}`;
        const progress = getProgress();
        progress.lessons[key] = !progress.lessons[key];
        saveProgress(progress);
        return progress.lessons[key];
    }

    function getExerciseState(exerciseId) {
        const progress = getProgress();
        return progress.exercises[exerciseId] || { solved: false, attempts: 0 };
    }

    function setExerciseSolved(exerciseId) {
        const progress = getProgress();
        if (!progress.exercises[exerciseId]) {
            progress.exercises[exerciseId] = { solved: false, attempts: 0 };
        }
        progress.exercises[exerciseId].solved = true;
        saveProgress(progress);
    }

    function incrementExerciseAttempts(exerciseId) {
        const progress = getProgress();
        if (!progress.exercises[exerciseId]) {
            progress.exercises[exerciseId] = { solved: false, attempts: 0 };
        }
        progress.exercises[exerciseId].attempts++;
        saveProgress(progress);
        return progress.exercises[exerciseId].attempts;
    }

    function isChecklistItemDone(lessonKey, itemKey) {
        const key = `${lessonKey}-${itemKey}`;
        const progress = getProgress();
        return progress.checklists[key] === true;
    }

    function toggleChecklistItem(lessonKey, itemKey) {
        const key = `${lessonKey}-${itemKey}`;
        const progress = getProgress();
        progress.checklists[key] = !progress.checklists[key];
        saveProgress(progress);
        return progress.checklists[key];
    }

    function getLastVisited() {
        return localStorage.getItem(ns('lastVisited')) || null;
    }

    function setLastVisited(path) {
        localStorage.setItem(ns('lastVisited'), path);
    }

    // ===== TEKTRONIX OSCILLOSCOPE COLORS =====
    // Based on Tektronix MSO series color scheme
    const TEK_COLORS = {
        ch1: '#FFD700',      // Yellow (Channel 1) - Amber/Gold
        ch2: '#00BFFF',      // Cyan/Deep Sky Blue (Channel 2)
        ch3: '#FF69B4',      // Hot Pink/Magenta (Channel 3)
        ch4: '#32CD32',      // Lime Green (Channel 4)
        ref: '#FF6B6B',      // Reference/Error signals
        math: '#FF8C00',     // Math channel (Dark Orange)
        ideal: 'rgba(255, 255, 255, 0.3)',  // Ideal/expected waveforms
        grid: 'rgba(255, 255, 255, 0.08)',  // Grid lines
        gridBright: 'rgba(255, 255, 255, 0.25)',  // Center crosshairs
        text: 'rgba(255, 255, 255, 0.8)'    // Text labels
    };

    // Array of channel colors for multi-trace plots
    const TEK_CHANNEL_COLORS = [
        TEK_COLORS.ch1,   // CH1 - Yellow
        TEK_COLORS.ch2,   // CH2 - Cyan
        TEK_COLORS.ch3,   // CH3 - Pink
        TEK_COLORS.ch4,   // CH4 - Green
        TEK_COLORS.math,  // Math - Orange
        TEK_COLORS.ref    // Ref - Red
    ];

    // ===== NUMERIC PARSING =====
    const SUFFIX_MULTIPLIERS = {
        'T': 1e12, 't': 1e12,
        'G': 1e9, 'g': 1e9,
        'M': 1e6,
        'k': 1e3, 'K': 1e3,
        '': 1,
        'm': 1e-3,
        'u': 1e-6, 'U': 1e-6, 'µ': 1e-6,
        'n': 1e-9, 'N': 1e-9,
        'p': 1e-12, 'P': 1e-12,
        'f': 1e-15, 'F': 1e-15
    };

    function parseNumValue(raw) {
        raw = (raw ?? '').toString().trim();
        if (!raw) return NaN;

        // Handle scientific notation directly
        const sciMatch = raw.match(/^[-+]?(\d+(\.\d*)?|\.\d+)(e[-+]?\d+)?$/i);
        if (sciMatch) return Number(raw);

        // Handle engineering suffix
        const engMatch = raw.match(/^([-+]?[\d.]+)\s*([TtGgMkKmµuUnNpPfF]?)\s*$/);
        if (!engMatch) return Number(raw);

        const num = Number(engMatch[1]);
        const suffix = engMatch[2];
        const mult = SUFFIX_MULTIPLIERS[suffix] ?? 1;
        return num * mult;
    }

    /**
     * Read a numeric input by element id.
     *
     * Lesson calculators overwhelmingly do `AD.num('x').toFixed(2)`, so any
     * NaN escaping this function surfaces to the reader as a literal "NaN"
     * in the results panel. Two guards prevent that:
     *
     *   1. A blank or unparseable field falls back to the value the lesson
     *      shipped with (the HTML `value` attribute), then to `min`. Clearing
     *      a box therefore shows the default result rather than NaN.
     *   2. The result is clamped to the field's declared min/max. Typing a
     *      negative resistance no longer produces an infinite gain, and a
     *      slider dragged to an endpoint stays inside the modelled range.
     *
     * Both are deliberate: this is a study guide, so a plausible in-range
     * number teaches more than an error string. Callers that genuinely need
     * to detect an empty field should read `.value` themselves.
     */
    function num(id) {
        const el = document.getElementById(id);
        if (!el) return NaN;

        let v = parseNumValue(el.value);
        if (!isFinite(v)) v = parseNumValue(el.defaultValue);
        if (!isFinite(v)) v = parseNumValue(el.getAttribute('min'));
        if (!isFinite(v)) return NaN;

        const lo = parseNumValue(el.getAttribute('min'));
        const hi = parseNumValue(el.getAttribute('max'));
        if (isFinite(lo) && v < lo) v = lo;
        if (isFinite(hi) && v > hi) v = hi;
        return v;
    }

    function clamp(x, a, b) {
        return Math.max(a, Math.min(b, x));
    }

    function fmt(x, digits = 3) {
        if (!isFinite(x)) return '—';
        const a = Math.abs(x);
        if (a === 0) return '0';

        // Choose appropriate suffix
        if (a >= 1e12) return (x / 1e12).toFixed(digits) + 'T';
        if (a >= 1e9) return (x / 1e9).toFixed(digits) + 'G';
        if (a >= 1e6) return (x / 1e6).toFixed(digits) + 'M';
        if (a >= 1e3) return (x / 1e3).toFixed(digits) + 'k';
        if (a >= 1) return x.toFixed(digits);
        if (a >= 1e-3) return (x * 1e3).toFixed(digits) + 'm';
        if (a >= 1e-6) return (x * 1e6).toFixed(digits) + 'µ';
        if (a >= 1e-9) return (x * 1e9).toFixed(digits) + 'n';
        if (a >= 1e-12) return (x * 1e12).toFixed(digits) + 'p';
        return x.toExponential(digits);
    }

    function fmtUnit(x, unit, digits = 3) {
        return fmt(x, digits) + unit;
    }

    // Backwards-compatible helper used by many lessons.
    // Signature: formatValue(value, unit, digits?)
    function formatValue(x, unit = '', digits = 3) {
        if (unit === undefined || unit === null) unit = '';
        return unit ? fmtUnit(x, unit, digits) : fmt(x, digits);
    }

    // ===== VALIDATION =====
    function checkRange(value, lo, hi) {
        if (!isFinite(value)) return { ok: false, msg: 'Enter a number' };
        if (value < lo) return { ok: false, msg: `Too low (min ${fmt(lo)})` };
        if (value > hi) return { ok: false, msg: `Too high (max ${fmt(hi)})` };
        return { ok: true, msg: 'OK' };
    }

    function checkTolerance(value, expected, tolerancePct = 0.05) {
        if (!isFinite(value)) return { ok: false, msg: 'Enter a number' };
        const margin = Math.abs(expected * tolerancePct);
        const diff = Math.abs(value - expected);
        if (diff <= margin) {
            return { ok: true, msg: 'Correct!' };
        }
        const pctOff = ((value - expected) / expected * 100).toFixed(1);
        return { ok: false, msg: `Off by ${pctOff}%` };
    }

    // ===== UI HELPERS =====
    function setStatus(id, ok, text) {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = text;
        el.className = ok ? 'status-ok' : 'status-bad';
        el.style.color = ok ? 'var(--ok)' : 'var(--bad)';
    }

    function setText(id, txt) {
        const el = document.getElementById(id);
        if (el) el.textContent = txt;
    }

    function setHtml(id, html) {
        const el = document.getElementById(id);
        if (el) el.innerHTML = html;
    }

    async function copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (e) {
            // Fallback for older browsers
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            try {
                document.execCommand('copy');
                return true;
            } catch (e2) {
                return false;
            } finally {
                document.body.removeChild(ta);
            }
        }
    }

    // ===== WAVEFORM GENERATORS =====
    function genSine({ N, dt, f, amp = 1, off = 0, phase = 0 }) {
        const out = new Array(N);
        for (let i = 0; i < N; i++) {
            const t = i * dt;
            out[i] = off + amp * Math.sin(2 * Math.PI * f * t + phase);
        }
        return out;
    }

    function genStep({ N, t0 = 0, dt, lo = 0, hi = 1 }) {
        const out = new Array(N);
        for (let i = 0; i < N; i++) {
            const t = i * dt;
            out[i] = (t < t0) ? lo : hi;
        }
        return out;
    }

    function genSquare({ N, dt, f, amp = 1, off = 0, duty = 0.5 }) {
        const out = new Array(N);
        const period = 1 / f;
        for (let i = 0; i < N; i++) {
            const t = i * dt;
            const phase = (t % period) / period;
            out[i] = off + (phase < duty ? amp : -amp);
        }
        return out;
    }

    function genTriangle({ N, dt, f, amp = 1, off = 0 }) {
        const out = new Array(N);
        const period = 1 / f;
        for (let i = 0; i < N; i++) {
            const t = i * dt;
            const phase = (t % period) / period;
            // Triangle: rise from -1 to 1 in first half, fall in second
            const tri = phase < 0.5
                ? 4 * phase - 1
                : 3 - 4 * phase;
            out[i] = off + amp * tri;
        }
        return out;
    }

    function genSawtooth({ N, dt, f, amp = 1, off = 0 }) {
        const out = new Array(N);
        const period = 1 / f;
        for (let i = 0; i < N; i++) {
            const t = i * dt;
            const phase = (t % period) / period;
            out[i] = off + amp * (2 * phase - 1);
        }
        return out;
    }

    function genPulse({ N, dt, tStart, tWidth, lo = 0, hi = 1 }) {
        const out = new Array(N);
        for (let i = 0; i < N; i++) {
            const t = i * dt;
            out[i] = (t >= tStart && t < tStart + tWidth) ? hi : lo;
        }
        return out;
    }

    function genNoise({ N, vrms = 1 }) {
        const out = new Array(N);
        for (let i = 0; i < N; i++) {
            // Box-Muller transform for Gaussian
            const u = Math.max(1e-12, Math.random());
            const v = Math.random();
            const n = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
            out[i] = n * vrms;
        }
        return out;
    }

    // ===== SIGNAL PROCESSING =====
    function rcLowpass(x, dt, tau) {
        const a = dt / (tau + dt);
        const y = new Array(x.length);
        let acc = x[0];
        for (let i = 0; i < x.length; i++) {
            acc = acc + a * (x[i] - acc);
            y[i] = acc;
        }
        return y;
    }

    function rcHighpass(x, dt, tau) {
        const lp = rcLowpass(x, dt, tau);
        const y = new Array(x.length);
        for (let i = 0; i < x.length; i++) {
            y[i] = x[i] - lp[i];
        }
        return y;
    }

    function applySlew(samples, dt, slewRate) {
        const out = new Array(samples.length);
        out[0] = samples[0];
        const maxDy = slewRate * dt;
        for (let i = 1; i < samples.length; i++) {
            const dy = samples[i] - out[i - 1];
            out[i] = out[i - 1] + clamp(dy, -maxDy, maxDy);
        }
        return out;
    }

    function applyClip(samples, lo, hi) {
        return samples.map(v => clamp(v, lo, hi));
    }

    function addNoise(samples, vrms) {
        const noise = genNoise({ N: samples.length, vrms });
        return samples.map((v, i) => v + noise[i]);
    }

    function addOffset(samples, offset) {
        return samples.map(v => v + offset);
    }

    function scale(samples, gain) {
        return samples.map(v => v * gain);
    }

    function invert(samples) {
        return samples.map(v => -v);
    }

    function differentiate(samples, dt) {
        const out = new Array(samples.length);
        out[0] = 0;
        for (let i = 1; i < samples.length; i++) {
            out[i] = (samples[i] - samples[i - 1]) / dt;
        }
        return out;
    }

    function integrate(samples, dt, initial = 0) {
        const out = new Array(samples.length);
        out[0] = initial;
        for (let i = 1; i < samples.length; i++) {
            out[i] = out[i - 1] + samples[i] * dt;
        }
        return out;
    }

    // ===== CANVAS PLOTTING =====
    function drawGrid(ctx, w, h, divX = 10, divY = 8, bgColor = '#0d1117') {
        // Clear and fill with dark background
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, w, h);
        ctx.save();

        // Minor grid lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;

        for (let i = 0; i <= divX; i++) {
            const x = Math.floor(i * w / divX) + 0.5;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }

        for (let j = 0; j <= divY; j++) {
            const y = Math.floor(j * h / divY) + 0.5;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }

        // Center crosshairs (brighter)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.beginPath();
        ctx.moveTo(w / 2, 0);
        ctx.lineTo(w / 2, h);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        ctx.stroke();

        ctx.restore();
    }

    // ===== CANVAS DIAGRAM HELPERS =====
    // For drawing block diagrams, flowcharts, timing diagrams

    /**
     * Draw a rounded rectangle
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} x - Top-left x
     * @param {number} y - Top-left y
     * @param {number} w - Width
     * @param {number} h - Height
     * @param {number} r - Corner radius
     * @param {Object} options - Style options
     */
    function roundRect(ctx, x, y, w, h, r = 6, options = {}) {
        const { fill = null, stroke = null, lineWidth = 2 } = options;
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
        if (fill) {
            ctx.fillStyle = fill;
            ctx.fill();
        }
        if (stroke) {
            ctx.strokeStyle = stroke;
            ctx.lineWidth = lineWidth;
            ctx.stroke();
        }
    }

    /**
     * Draw an arrow from (x1,y1) to (x2,y2)
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} x1 - Start x
     * @param {number} y1 - Start y
     * @param {number} x2 - End x
     * @param {number} y2 - End y
     * @param {Object} options - Style options
     */
    function drawArrow(ctx, x1, y1, x2, y2, options = {}) {
        const { color = '#fff', lineWidth = 2, headSize = 10 } = options;
        const angle = Math.atan2(y2 - y1, x2 - x1);

        ctx.save();
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = lineWidth;

        // Line
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        // Arrowhead
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - headSize * Math.cos(angle - Math.PI / 6), y2 - headSize * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(x2 - headSize * Math.cos(angle + Math.PI / 6), y2 - headSize * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    /**
     * Draw a diamond (for flowchart decisions)
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} cx - Center x
     * @param {number} cy - Center y
     * @param {number} size - Diamond size (corner to corner)
     * @param {Object} options - Style options
     */
    function drawDiamond(ctx, cx, cy, size, options = {}) {
        const { fill = null, stroke = null, lineWidth = 2 } = options;
        const half = size / 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy - half);
        ctx.lineTo(cx + half, cy);
        ctx.lineTo(cx, cy + half);
        ctx.lineTo(cx - half, cy);
        ctx.closePath();
        if (fill) {
            ctx.fillStyle = fill;
            ctx.fill();
        }
        if (stroke) {
            ctx.strokeStyle = stroke;
            ctx.lineWidth = lineWidth;
            ctx.stroke();
        }
    }

    /**
     * Draw a digital signal waveform (for timing diagrams)
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} x - Start x
     * @param {number} y - Baseline y (low level)
     * @param {Array} data - Array of 0/1 values
     * @param {Object} options - Style options
     */
    function drawDigitalSignal(ctx, x, y, data, options = {}) {
        const { bitWidth = 40, highOffset = -30, color = '#00FFFF', lineWidth = 2 } = options;
        const highY = y + highOffset;
        const lowY = y;

        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();

        let currentY = data[0] ? highY : lowY;
        ctx.moveTo(x, currentY);

        data.forEach((bit, i) => {
            const xPos = x + i * bitWidth;
            const targetY = bit ? highY : lowY;

            // Vertical transition if level changed
            if (targetY !== currentY) {
                ctx.lineTo(xPos, targetY);
                currentY = targetY;
            }
            // Horizontal to next bit
            ctx.lineTo(xPos + bitWidth, currentY);
        });

        ctx.stroke();
        ctx.restore();
    }

    /**
     * Draw a block diagram box with label
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} x - Top-left x
     * @param {number} y - Top-left y
     * @param {number} w - Width
     * @param {number} h - Height
     * @param {string} label - Text label
     * @param {Object} options - Style options
     */
    function drawBlock(ctx, x, y, w, h, label, options = {}) {
        const {
            fill = 'rgba(30, 40, 50, 0.9)',
            stroke = '#00FFFF',
            textColor = '#fff',
            fontSize = 12,
            radius = 6,
            lineWidth = 2
        } = options;

        roundRect(ctx, x, y, w, h, radius, { fill, stroke, lineWidth });

        ctx.save();
        ctx.fillStyle = textColor;
        ctx.font = `${fontSize}px ui-sans-serif, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, x + w / 2, y + h / 2);
        ctx.restore();
    }

    /**
     * Draw labeled axes with timing marks and units
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} w - Canvas width
     * @param {number} h - Canvas height
     * @param {Object} options - Axis configuration
     */
    function drawAxes(ctx, w, h, options = {}) {
        const {
            xMin = 0,
            xMax = 1,
            yMin = -1,
            yMax = 1,
            xLabel = 'Time',
            yLabel = 'Voltage',
            xUnit = 's',
            yUnit = 'V',
            xDivs = 10,
            yDivs = 8,
            margin = { left: 60, right: 20, top: 20, bottom: 35 }
        } = options;

        const plotW = w - margin.left - margin.right;
        const plotH = h - margin.top - margin.bottom;

        ctx.clearRect(0, 0, w, h);
        ctx.save();

        // Background for plot area
        ctx.fillStyle = 'rgba(0, 20, 0, 0.3)';
        ctx.fillRect(margin.left, margin.top, plotW, plotH);

        // Grid lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;

        // Vertical grid lines
        for (let i = 0; i <= xDivs; i++) {
            const x = margin.left + (i / xDivs) * plotW;
            ctx.beginPath();
            ctx.moveTo(x, margin.top);
            ctx.lineTo(x, h - margin.bottom);
            ctx.stroke();
        }

        // Horizontal grid lines
        for (let j = 0; j <= yDivs; j++) {
            const y = margin.top + (j / yDivs) * plotH;
            ctx.beginPath();
            ctx.moveTo(margin.left, y);
            ctx.lineTo(w - margin.right, y);
            ctx.stroke();
        }

        // Axes
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1;

        // Y-axis
        ctx.beginPath();
        ctx.moveTo(margin.left, margin.top);
        ctx.lineTo(margin.left, h - margin.bottom);
        ctx.stroke();

        // X-axis
        ctx.beginPath();
        ctx.moveTo(margin.left, h - margin.bottom);
        ctx.lineTo(w - margin.right, h - margin.bottom);
        ctx.stroke();

        // Zero line if in range
        if (yMin < 0 && yMax > 0) {
            const y0 = margin.top + ((yMax - 0) / (yMax - yMin)) * plotH;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
            ctx.beginPath();
            ctx.moveTo(margin.left, y0);
            ctx.lineTo(w - margin.right, y0);
            ctx.stroke();
        }

        // Axis labels and tick marks
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '11px ui-sans-serif, system-ui, sans-serif';

        // X-axis ticks and labels
        for (let i = 0; i <= xDivs; i += 2) {
            const x = margin.left + (i / xDivs) * plotW;
            const val = xMin + (i / xDivs) * (xMax - xMin);
            const label = fmtUnit(val, xUnit, 2);

            ctx.textAlign = 'center';
            ctx.fillText(label, x, h - margin.bottom + 15);

            // Tick mark
            ctx.beginPath();
            ctx.moveTo(x, h - margin.bottom);
            ctx.lineTo(x, h - margin.bottom + 5);
            ctx.stroke();
        }

        // Y-axis ticks and labels
        for (let j = 0; j <= yDivs; j += 2) {
            const y = margin.top + (j / yDivs) * plotH;
            const val = yMax - (j / yDivs) * (yMax - yMin);
            const label = fmtUnit(val, yUnit, 2);

            ctx.textAlign = 'right';
            ctx.fillText(label, margin.left - 8, y + 4);

            // Tick mark
            ctx.beginPath();
            ctx.moveTo(margin.left - 5, y);
            ctx.lineTo(margin.left, y);
            ctx.stroke();
        }

        // Axis titles
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = '12px ui-sans-serif, system-ui, sans-serif';

        // X-axis title
        ctx.textAlign = 'center';
        ctx.fillText(xLabel + ' (' + xUnit + ')', margin.left + plotW / 2, h - 5);

        // Y-axis title (rotated)
        ctx.save();
        ctx.translate(15, margin.top + plotH / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.fillText(yLabel + ' (' + yUnit + ')', 0, 0);
        ctx.restore();

        ctx.restore();

        // Return plot area bounds for drawing data
        return {
            left: margin.left,
            top: margin.top,
            width: plotW,
            height: plotH,
            xMin, xMax, yMin, yMax,
            // Helper to convert data coordinates to canvas coordinates
            toCanvas: (x, y) => ({
                x: margin.left + ((x - xMin) / (xMax - xMin)) * plotW,
                y: margin.top + ((yMax - y) / (yMax - yMin)) * plotH
            })
        };
    }

    /**
     * Plot data on axes created by drawAxes
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {Object} axes - Return value from drawAxes
     * @param {Array} xData - X values
     * @param {Array} yData - Y values
     * @param {Object} options - Line options
     */
    function plotData(ctx, axes, xData, yData, options = {}) {
        const {
            color = TEK_COLORS.ch1,  // Tektronix Yellow
            lineWidth = 2,
            label = ''
        } = options;

        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();

        for (let i = 0; i < xData.length; i++) {
            const pt = axes.toCanvas(xData[i], yData[i]);
            if (i === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
        ctx.restore();

        return { color, label };
    }

    /**
     * Draw legend for multiple traces
     */
    function drawLegend(ctx, x, y, traces) {
        ctx.save();
        ctx.font = '11px ui-sans-serif, system-ui, sans-serif';

        traces.forEach((trace, i) => {
            ctx.fillStyle = trace.color;
            ctx.fillRect(x, y + i * 18 - 8, 15, 10);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.fillText(trace.label, x + 20, y + i * 18);
        });

        ctx.restore();
    }

    /**
     * Calculate autoscale range for waveform data
     * Returns { min, max, vPerDiv } for optimal display
     */
    function autoScale(samples, targetDivs = 8, marginPct = 0.1) {
        if (!samples || samples.length === 0) {
            return { min: -1, max: 1, vPerDiv: 0.25, offset: 0 };
        }

        let min = samples[0], max = samples[0];
        for (let i = 1; i < samples.length; i++) {
            if (samples[i] < min) min = samples[i];
            if (samples[i] > max) max = samples[i];
        }

        // Add margin
        const range = max - min;
        const margin = range * marginPct;
        min -= margin;
        max += margin;

        // Calculate nice vPerDiv
        const span = max - min;
        const rawPerDiv = span / targetDivs;

        // Snap to nice values: 1, 2, 5 sequence
        const magnitude = Math.pow(10, Math.floor(Math.log10(rawPerDiv)));
        const normalized = rawPerDiv / magnitude;
        let nice;
        if (normalized <= 1) nice = 1;
        else if (normalized <= 2) nice = 2;
        else if (normalized <= 5) nice = 5;
        else nice = 10;

        const vPerDiv = nice * magnitude;
        const center = (min + max) / 2;

        return {
            min,
            max,
            vPerDiv,
            offset: center,
            span: vPerDiv * targetDivs
        };
    }

    /**
     * Draw legend box in corner (non-overlapping)
     */
    function drawLegendBox(ctx, w, h, traces, position = 'top-right') {
        ctx.save();
        ctx.font = '11px ui-sans-serif, system-ui, sans-serif';

        const lineHeight = 16;
        const padding = 8;
        const boxWidth = 80;
        const boxHeight = traces.length * lineHeight + padding * 2;

        let x, y;
        switch (position) {
            case 'top-left':
                x = 10; y = 10;
                break;
            case 'top-right':
                x = w - boxWidth - 10; y = 10;
                break;
            case 'bottom-left':
                x = 10; y = h - boxHeight - 10;
                break;
            case 'bottom-right':
            default:
                x = w - boxWidth - 10; y = h - boxHeight - 10;
        }

        // Draw semi-transparent background
        ctx.fillStyle = 'rgba(15, 22, 34, 0.85)';
        ctx.fillRect(x, y, boxWidth, boxHeight);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.strokeRect(x, y, boxWidth, boxHeight);

        // Draw legend entries
        traces.forEach((trace, i) => {
            const ly = y + padding + i * lineHeight + lineHeight / 2;
            ctx.fillStyle = trace.color || TEK_CHANNEL_COLORS[i];
            ctx.fillRect(x + padding, ly - 5, 12, 10);
            ctx.fillStyle = TEK_COLORS.text;
            ctx.fillText(trace.label || `CH${i + 1}`, x + padding + 18, ly + 3);
        });

        ctx.restore();
    }

    function plotWave(ctx, w, h, samples, vPerDiv, vOffset = 0, tPerDiv = null, options = {}) {
        // Default to Tektronix CH1 yellow color
        const {
            label = '',
            color = TEK_COLORS.ch1,
            lineWidth = 2,
            autoScale: doAutoScale = false,
            showClipIndicator = true,
            yUnit = 'V'
        } = options;

        // Auto-scale if requested or if vPerDiv is 'auto'
        let actualVPerDiv = vPerDiv;
        let actualOffset = vOffset;

        if (doAutoScale || vPerDiv === 'auto') {
            const scaled = autoScale(samples, 8, 0.1);
            actualVPerDiv = scaled.vPerDiv;
            actualOffset = scaled.offset;
        }

        drawGrid(ctx, w, h, 10, 8);

        const vSpan = 8 * actualVPerDiv;
        const vMin = actualOffset - vSpan / 2;
        const vMax = actualOffset + vSpan / 2;

        // Check for clipping
        let hasClipTop = false, hasClipBottom = false;
        for (let i = 0; i < samples.length; i++) {
            if (samples[i] > vMax) hasClipTop = true;
            if (samples[i] < vMin) hasClipBottom = true;
        }

        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();

        for (let i = 0; i < samples.length; i++) {
            const x = i * (w / (samples.length - 1));
            const yV = samples[i] - actualOffset;
            let y = h / 2 - (yV / (vSpan / 2)) * (h / 2 * 0.95);

            // Clamp to canvas bounds
            y = clamp(y, 2, h - 2);

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();

        // Draw clip indicators
        if (showClipIndicator && (hasClipTop || hasClipBottom)) {
            ctx.save();
            ctx.fillStyle = 'rgba(251, 113, 133, 0.8)';
            ctx.font = 'bold 11px ui-sans-serif';

            if (hasClipTop) {
                ctx.fillText('▲ CLIP', w - 60, 15);
            }
            if (hasClipBottom) {
                ctx.fillText('▼ CLIP', w - 60, h - 8);
            }
            ctx.restore();
        }

        // Labels
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '12px ui-sans-serif, system-ui, sans-serif';
        let info = `${fmt(actualVPerDiv, 2)}${yUnit}/div`;
        if (tPerDiv) info += `  ${fmt(tPerDiv, 2)}s/div`;
        if (doAutoScale || vPerDiv === 'auto') info += ' [AUTO]';
        ctx.fillText(info, 10, 18);
        if (label) ctx.fillText(label, 10, 36);
        ctx.restore();

        // Return the actual scale used (useful for reference)
        return { vPerDiv: actualVPerDiv, vOffset: actualOffset, clipped: hasClipTop || hasClipBottom };
    }

    /**
     * Plot waveform with automatic scaling - convenience wrapper
     */
    function plotWaveAuto(ctx, w, h, samples, tPerDiv = null, options = {}) {
        return plotWave(ctx, w, h, samples, 'auto', 0, tPerDiv, { ...options, autoScale: true });
    }

    function plotMultiWave(ctx, w, h, traces, vPerDiv, vOffset = 0, tPerDiv = null, options = {}) {
        const {
            label = '',
            autoScale: doAutoScale = false,
            showClipIndicator = true,
            yUnit = 'V'
        } = options;
        // Use Tektronix oscilloscope colors by default
        const colors = TEK_CHANNEL_COLORS;

        // Auto-scale if requested
        let actualVPerDiv = vPerDiv;
        let actualOffset = vOffset;

        if (doAutoScale || vPerDiv === 'auto') {
            // Combine all samples to find global min/max
            let allSamples = [];
            traces.forEach(t => {
                if (t.samples) allSamples = allSamples.concat(Array.from(t.samples));
            });
            const scaled = autoScale(allSamples, 8, 0.1);
            actualVPerDiv = scaled.vPerDiv;
            actualOffset = scaled.offset;
        }

        drawGrid(ctx, w, h, 10, 8);

        const vSpan = 8 * actualVPerDiv;
        const vMin = actualOffset - vSpan / 2;
        const vMax = actualOffset + vSpan / 2;

        let hasClip = false;

        traces.forEach((trace, ti) => {
            const samples = trace.samples;
            ctx.save();
            ctx.strokeStyle = trace.color || colors[ti % colors.length];
            ctx.lineWidth = trace.lineWidth || 2;
            ctx.beginPath();

            for (let i = 0; i < samples.length; i++) {
                const x = i * (w / (samples.length - 1));
                const yV = samples[i] - actualOffset;
                let y = h / 2 - (yV / (vSpan / 2)) * (h / 2 * 0.95);

                // Check for clipping
                if (samples[i] > vMax || samples[i] < vMin) hasClip = true;

                // Clamp to canvas bounds
                y = clamp(y, 2, h - 2);

                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
            ctx.restore();
        });

        // Clip indicator
        if (showClipIndicator && hasClip) {
            ctx.save();
            ctx.fillStyle = 'rgba(251, 113, 133, 0.8)';
            ctx.font = 'bold 11px ui-sans-serif';
            ctx.fillText('⚠ CLIP', w - 55, 15);
            ctx.restore();
        }

        // Scale info
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '12px ui-sans-serif, system-ui, sans-serif';
        let info = `${fmt(actualVPerDiv, 2)}${yUnit}/div`;
        if (tPerDiv) info += `  ${fmt(tPerDiv, 2)}s/div`;
        if (doAutoScale || vPerDiv === 'auto') info += ' [AUTO]';
        ctx.fillText(info, 10, 18);
        if (label) ctx.fillText(label, 10, 36);

        // Legend
        traces.forEach((trace, ti) => {
            ctx.fillStyle = trace.color || colors[ti % colors.length];
            ctx.fillText(trace.name || `CH${ti + 1}`, 10, 56 + 16 * ti);
        });
        ctx.restore();

        return { vPerDiv: actualVPerDiv, vOffset: actualOffset, clipped: hasClip };
    }

    /**
     * Plot multiple waveforms with automatic scaling - convenience wrapper
     */
    function plotMultiWaveAuto(ctx, w, h, traces, tPerDiv = null, options = {}) {
        return plotMultiWave(ctx, w, h, traces, 'auto', 0, tPerDiv, { ...options, autoScale: true });
    }

    // Bode plot (magnitude)
    function plotBode(ctx, w, h, fData, magData, options = {}) {
        const { fMin = 1, fMax = 1e6, magMin = -60, magMax = 20, label = '' } = options;

        ctx.clearRect(0, 0, w, h);

        // Grid
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;

        // Vertical grid (log frequency)
        const decades = Math.log10(fMax / fMin);
        for (let d = 0; d <= decades; d++) {
            const f = fMin * Math.pow(10, d);
            const x = (Math.log10(f / fMin) / decades) * w;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }

        // Horizontal grid (dB)
        const dbRange = magMax - magMin;
        const dbStep = 20;
        for (let db = magMin; db <= magMax; db += dbStep) {
            const y = h - ((db - magMin) / dbRange) * h;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }

        // 0 dB line
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        const y0db = h - ((0 - magMin) / dbRange) * h;
        ctx.beginPath();
        ctx.moveTo(0, y0db);
        ctx.lineTo(w, y0db);
        ctx.stroke();

        ctx.restore();

        // Plot data
        ctx.save();
        ctx.strokeStyle = TEK_COLORS.ch1;  // Tektronix Yellow
        ctx.lineWidth = 2;
        ctx.beginPath();

        for (let i = 0; i < fData.length; i++) {
            const f = fData[i];
            const mag = magData[i];
            if (f < fMin || f > fMax) continue;

            const x = (Math.log10(f / fMin) / Math.log10(fMax / fMin)) * w;
            const y = h - ((mag - magMin) / dbRange) * h;

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();

        // Labels
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '12px ui-sans-serif, system-ui, sans-serif';
        ctx.fillText(`${fmt(fMin)}Hz - ${fmt(fMax)}Hz`, 10, 18);
        ctx.fillText(`${magMin}dB to ${magMax}dB`, 10, 36);
        if (label) ctx.fillText(label, 10, 54);
        ctx.restore();
    }

    // Simple DFT for spectrum visualization
    function dftMag(samples, dt, nBins = 256) {
        const N = samples.length;
        const fs = 1 / dt;
        const outF = [], outM = [];
        const mean = samples.reduce((a, b) => a + b, 0) / N;

        for (let k = 0; k < nBins; k++) {
            let re = 0, im = 0;
            for (let n = 0; n < N; n++) {
                const x = samples[n] - mean;
                const ang = 2 * Math.PI * k * n / N;
                re += x * Math.cos(ang);
                im -= x * Math.sin(ang);
            }
            const mag = Math.sqrt(re * re + im * im) / N;
            outF.push(k * fs / N);
            outM.push(mag);
        }
        return { f: outF, m: outM, fs };
    }

    function plotSpectrum(ctx, w, h, f, m, options = {}) {
        const { label = '', logScale = true } = options;

        ctx.clearRect(0, 0, w, h);

        // Grid
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        for (let i = 0; i <= 10; i++) {
            const x = i * w / 10;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }
        for (let j = 0; j <= 8; j++) {
            const y = j * h / 8;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }
        ctx.restore();

        const fMin = Math.max(1, f[1] || 1);
        const fMax = f[f.length - 1] || 1;
        const maxM = Math.max(...m.slice(1));

        ctx.save();
        ctx.strokeStyle = TEK_COLORS.ch1;  // Tektronix Yellow
        ctx.lineWidth = 2;
        ctx.beginPath();

        for (let i = 1; i < f.length; i++) {
            let x;
            if (logScale && f[i] > 0) {
                x = (Math.log10(f[i]) - Math.log10(fMin)) / (Math.log10(fMax) - Math.log10(fMin));
            } else {
                x = (f[i] - fMin) / (fMax - fMin);
            }
            const y = m[i] / maxM;
            const px = x * w;
            const py = h - y * (h * 0.92) - h * 0.04;

            if (i === 1) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.restore();

        // Labels
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '12px ui-sans-serif, system-ui, sans-serif';
        if (label) ctx.fillText(label, 10, 18);
        ctx.fillText(`${fmt(fMin, 2)} - ${fmt(fMax, 2)} Hz`, 10, 36);
        ctx.restore();
    }

    // ===== CIRCUIT CALCULATIONS =====
    const Calc = {
        // Resistor divider
        divider(vin, r1, r2) {
            return vin * r2 / (r1 + r2);
        },

        // Parallel resistance
        parallel(...resistors) {
            const sum = resistors.reduce((acc, r) => acc + 1 / r, 0);
            return 1 / sum;
        },

        // RC time constant
        tau(r, c) {
            return r * c;
        },

        // RC cutoff frequency
        fcRC(r, c) {
            return 1 / (2 * Math.PI * r * c);
        },

        // Capacitive reactance
        Xc(f, c) {
            return 1 / (2 * Math.PI * f * c);
        },

        // Inductive reactance
        Xl(f, l) {
            return 2 * Math.PI * f * l;
        },

        // Impedance magnitude (R + jX)
        Zmag(r, x) {
            return Math.sqrt(r * r + x * x);
        },

        // dB conversion
        toDb(ratio) {
            return 20 * Math.log10(ratio);
        },

        fromDb(db) {
            return Math.pow(10, db / 20);
        },

        // Op-amp gain calculations
        invertingGain(rf, rin) {
            return -rf / rin;
        },

        nonInvertingGain(rf, rin) {
            return 1 + rf / rin;
        },

        // Transistor calculations
        icFromIb(ib, beta) {
            return ib * beta;
        },

        vceSat: 0.2, // typical saturation voltage
        vbeOn: 0.7,  // typical forward Vbe

        // Current through LED
        ledCurrent(vs, vf, r) {
            return (vs - vf) / r;
        },

        // Power calculations
        power(v, i) {
            return v * i;
        },

        powerR(i, r) {
            return i * i * r;
        },

        // LC resonance
        fResonance(l, c) {
            return 1 / (2 * Math.PI * Math.sqrt(l * c));
        },

        // Q factor
        qFactor(f0, bw) {
            return f0 / bw;
        }
    };

    // ===== PUBLIC API =====
    return {
        // Storage
        ns,
        getProgress,
        saveProgress,
        isLessonDone,
        toggleLessonDone,
        getExerciseState,
        setExerciseSolved,
        incrementExerciseAttempts,
        isChecklistItemDone,
        toggleChecklistItem,
        getLastVisited,
        setLastVisited,

        // Parsing
        parseNumValue,
        parseValue: parseNumValue,  // Alias for compatibility
        num,
        clamp,
        fmt,
        fmtUnit,
        formatValue,

        // Validation
        checkRange,
        checkTolerance,

        // UI
        setStatus,
        setText,
        setHtml,
        copyToClipboard,

        // Waveforms
        genSine,
        genStep,
        genSquare,
        genTriangle,
        genSawtooth,
        genPulse,
        genNoise,

        // Signal processing
        rcLowpass,
        rcHighpass,
        applySlew,
        applyClip,
        addNoise,
        addOffset,
        scale,
        invert,
        differentiate,
        integrate,

        // Plotting
        drawGrid,
        drawAxes,
        plotData,
        drawLegend,
        drawLegendBox,
        autoScale,
        plotWave,
        plotWaveAuto,
        plotMultiWave,
        plotMultiWaveAuto,
        plotBode,
        dftMag,
        plotSpectrum,

        // Diagram helpers (block diagrams, flowcharts, timing)
        roundRect,
        drawArrow,
        drawDiamond,
        drawDigitalSignal,
        drawBlock,

        // Calculations
        Calc,

        // Tektronix scope colors
        TEK_COLORS,
        TEK_CHANNEL_COLORS
    };
})();

// Expose globally
window.AD = AD;
