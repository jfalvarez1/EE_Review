/**
 * Widget System - Interactive Components for Analog Design Learning Platform
 * Provides: Oscilloscope, Calculator, Exercise, Checklist, SpiceNetlist, BodePlot
 */

// ===== BASE WIDGET CLASS =====
class BaseWidget {
    constructor(container, options = {}) {
        this.container = typeof container === 'string'
            ? document.getElementById(container)
            : container;
        this.options = options;
        this.destroyed = false;
    }

    init() {
        // Override in subclasses
    }

    update() {
        // Override in subclasses
    }

    destroy() {
        this.destroyed = true;
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}

// ===== OSCILLOSCOPE WIDGET =====
class OscilloscopeWidget extends BaseWidget {
    constructor(container, options = {}) {
        super(container, options);
        this.canvas = null;
        this.ctx = null;
        this.traces = [];
        this.vPerDiv = options.vPerDiv || 1;
        this.tPerDiv = options.tPerDiv || 1e-3;
        this.vOffset = options.vOffset || 0;
        this.N = options.N || 1000;
        this.dt = null;
        this.updateCallback = options.onUpdate || null;
        this.init();
    }

    init() {
        // Create canvas wrapper
        this.container.innerHTML = `
            <div class="canvas-wrap">
                <canvas width="980" height="320"></canvas>
            </div>
            <div class="scope-controls controls" style="margin-top: 10px;">
                <div class="c4">
                    <label>V/div</label>
                    <input type="range" class="scope-vdiv" min="-2" max="2" step="0.1" value="0">
                    <span class="scope-vdiv-label">${AD.fmt(this.vPerDiv)}V</span>
                </div>
                <div class="c4">
                    <label>Time/div</label>
                    <input type="range" class="scope-tdiv" min="-6" max="0" step="0.1" value="-3">
                    <span class="scope-tdiv-label">${AD.fmt(this.tPerDiv)}s</span>
                </div>
                <div class="c4">
                    <label>V Offset</label>
                    <input type="range" class="scope-voff" min="-10" max="10" step="0.1" value="0">
                    <span class="scope-voff-label">0V</span>
                </div>
            </div>
        `;

        this.canvas = this.container.querySelector('canvas');
        this.ctx = this.canvas.getContext('2d');

        // Bind controls
        const vdivSlider = this.container.querySelector('.scope-vdiv');
        const tdivSlider = this.container.querySelector('.scope-tdiv');
        const voffSlider = this.container.querySelector('.scope-voff');

        vdivSlider.addEventListener('input', (e) => {
            this.vPerDiv = Math.pow(10, parseFloat(e.target.value));
            this.container.querySelector('.scope-vdiv-label').textContent = AD.fmt(this.vPerDiv) + 'V';
            this.render();
        });

        tdivSlider.addEventListener('input', (e) => {
            this.tPerDiv = Math.pow(10, parseFloat(e.target.value));
            this.container.querySelector('.scope-tdiv-label').textContent = AD.fmt(this.tPerDiv) + 's';
            this.dt = (this.tPerDiv * 10) / this.N;
            if (this.updateCallback) this.updateCallback();
            this.render();
        });

        voffSlider.addEventListener('input', (e) => {
            this.vOffset = parseFloat(e.target.value);
            this.container.querySelector('.scope-voff-label').textContent = AD.fmt(this.vOffset) + 'V';
            this.render();
        });

        // Initialize dt
        this.dt = (this.tPerDiv * 10) / this.N;
    }

    setTraces(traces) {
        // traces: [{samples, name, color}]
        this.traces = traces;
        this.render();
    }

    addTrace(samples, name = '', color = null) {
        this.traces.push({ samples, name, color });
        this.render();
    }

    clearTraces() {
        this.traces = [];
        this.render();
    }

    render() {
        if (this.destroyed || !this.ctx) return;

        const w = this.canvas.width;
        const h = this.canvas.height;

        if (this.traces.length === 0) {
            AD.drawGrid(this.ctx, w, h, 10, 8);
        } else if (this.traces.length === 1) {
            AD.plotWave(this.ctx, w, h, this.traces[0].samples, this.vPerDiv, this.vOffset, this.tPerDiv, {
                label: this.traces[0].name,
                color: this.traces[0].color
            });
        } else {
            AD.plotMultiWave(this.ctx, w, h, this.traces, this.vPerDiv, this.vOffset, this.tPerDiv);
        }
    }

    getParams() {
        return {
            N: this.N,
            dt: this.dt,
            vPerDiv: this.vPerDiv,
            tPerDiv: this.tPerDiv,
            vOffset: this.vOffset
        };
    }
}

// ===== CALCULATOR WIDGET =====
class CalculatorWidget extends BaseWidget {
    constructor(container, options = {}) {
        super(container, options);
        this.fields = options.fields || [];
        this.calculate = options.calculate || (() => ({}));
        this.resultId = options.resultId || 'calc-result';
        this.init();
    }

    init() {
        // Build field HTML
        let fieldsHtml = '<div class="controls">';
        this.fields.forEach(field => {
            const colClass = field.col || 'c4';
            fieldsHtml += `
                <div class="${colClass}">
                    <label for="${field.id}">${field.label}${field.unit ? ` (${field.unit})` : ''}</label>
                    <input type="text" id="${field.id}" value="${field.default || ''}" placeholder="${field.placeholder || ''}">
                </div>
            `;
        });
        fieldsHtml += `
            <div class="c4" style="display:flex; align-items:flex-end;">
                <button class="calc-btn primary" style="width:100%">Calculate</button>
            </div>
        </div>
        <div id="${this.resultId}" class="calc-result card" style="margin-top:10px; padding:12px;">
            <span class="muted">Enter values and click Calculate</span>
        </div>`;

        this.container.innerHTML = fieldsHtml;

        // Bind calculate button
        const btn = this.container.querySelector('.calc-btn');
        btn.addEventListener('click', () => this.runCalculation());

        // Allow Enter key in inputs
        this.fields.forEach(field => {
            const input = document.getElementById(field.id);
            if (input) {
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') this.runCalculation();
                });
            }
        });
    }

    runCalculation() {
        const values = {};
        this.fields.forEach(field => {
            values[field.id] = AD.num(field.id);
        });

        try {
            const result = this.calculate(values);
            this.displayResult(result);
        } catch (e) {
            document.getElementById(this.resultId).innerHTML =
                `<span style="color:var(--bad)">Error: ${e.message}</span>`;
        }
    }

    displayResult(result) {
        const el = document.getElementById(this.resultId);
        if (typeof result === 'string') {
            el.innerHTML = result;
        } else if (typeof result === 'object') {
            let html = '<div class="kv">';
            for (const [key, val] of Object.entries(result)) {
                if (val.value !== undefined) {
                    html += `
                        <div class="box">
                            <div class="k">${val.label || key}</div>
                            <div class="v">${AD.fmtUnit(val.value, val.unit || '')}</div>
                        </div>
                    `;
                } else {
                    html += `
                        <div class="box">
                            <div class="k">${key}</div>
                            <div class="v">${val}</div>
                        </div>
                    `;
                }
            }
            html += '</div>';
            el.innerHTML = html;
        }
    }
}

// ===== EXERCISE WIDGET =====
class ExerciseWidget extends BaseWidget {
    constructor(container, options = {}) {
        super(container, options);
        this.exerciseId = options.id || 'ex-' + Math.random().toString(36).substr(2, 9);
        this.type = options.type || 'numeric'; // 'numeric' or 'choice'
        this.question = options.question || '';
        this.expected = options.expected; // For numeric
        this.tolerance = options.tolerance || 0.05;
        this.unit = options.unit || '';
        this.choices = options.choices || []; // For multiple choice
        this.hint = options.hint || '';
        this.solution = options.solution || '';
        this.explanation = options.explanation || '';
        this.init();
    }

    init() {
        const state = AD.getExerciseState(this.exerciseId);

        let inputHtml;
        if (this.type === 'numeric') {
            inputHtml = `
                <div class="exercise-input">
                    <input type="text" id="${this.exerciseId}-answer" placeholder="Enter your answer${this.unit ? ' (' + this.unit + ')' : ''}">
                    <button class="exercise-check primary">Check</button>
                </div>
            `;
        } else {
            inputHtml = '<div class="exercise-choices">';
            this.choices.forEach((choice, i) => {
                const id = `${this.exerciseId}-choice-${i}`;
                inputHtml += `
                    <label class="exercise-choice">
                        <input type="radio" name="${this.exerciseId}-choice" value="${i}" id="${id}">
                        <span>${choice.text}</span>
                    </label>
                `;
            });
            inputHtml += `<button class="exercise-check primary" style="margin-top:10px;">Check</button></div>`;
        }

        this.container.innerHTML = `
            <div class="exercise ${state.solved ? 'solved' : ''}" data-id="${this.exerciseId}">
                <div class="exercise-question">${this.question}</div>
                ${inputHtml}
                <div class="exercise-feedback" id="${this.exerciseId}-feedback"></div>
                <div class="exercise-actions" style="margin-top:10px; display:${state.solved ? 'block' : 'none'}">
                    <button class="exercise-hint" style="${this.hint ? '' : 'display:none'}">Show Hint</button>
                    <button class="exercise-solution" style="${this.solution ? '' : 'display:none'}">Show Solution</button>
                </div>
                <div class="exercise-hint-text" id="${this.exerciseId}-hint" style="display:none">
                    ${this.hint}
                </div>
                <div class="exercise-solution-text" id="${this.exerciseId}-solution" style="display:none">
                    <strong>Solution:</strong> ${this.solution}
                    ${this.explanation ? `<br><em>${this.explanation}</em>` : ''}
                </div>
            </div>
        `;

        // Bind events
        const checkBtn = this.container.querySelector('.exercise-check');
        checkBtn.addEventListener('click', () => this.checkAnswer());

        const hintBtn = this.container.querySelector('.exercise-hint');
        if (hintBtn) {
            hintBtn.addEventListener('click', () => {
                const el = document.getElementById(`${this.exerciseId}-hint`);
                el.style.display = el.style.display === 'none' ? 'block' : 'none';
            });
        }

        const solBtn = this.container.querySelector('.exercise-solution');
        if (solBtn) {
            solBtn.addEventListener('click', () => {
                const el = document.getElementById(`${this.exerciseId}-solution`);
                el.style.display = el.style.display === 'none' ? 'block' : 'none';
            });
        }

        // If already solved, show the state
        if (state.solved) {
            this.showSolvedState();
        }
    }

    checkAnswer() {
        const feedback = document.getElementById(`${this.exerciseId}-feedback`);
        let correct = false;

        if (this.type === 'numeric') {
            const answer = AD.num(`${this.exerciseId}-answer`);
            const result = AD.checkTolerance(answer, this.expected, this.tolerance);
            correct = result.ok;

            if (correct) {
                feedback.innerHTML = `<span style="color:var(--ok)">✓ Correct! ${this.explanation || ''}</span>`;
            } else {
                const attempts = AD.incrementExerciseAttempts(this.exerciseId);
                feedback.innerHTML = `<span style="color:var(--bad)">✗ ${result.msg}</span>`;

                // Show hint after 2 attempts
                if (attempts >= 2 && this.hint) {
                    document.getElementById(`${this.exerciseId}-hint`).style.display = 'block';
                }
                // Show solution after 3 attempts
                if (attempts >= 3 && this.solution) {
                    this.container.querySelector('.exercise-actions').style.display = 'block';
                }
            }
        } else {
            const selected = this.container.querySelector(`input[name="${this.exerciseId}-choice"]:checked`);
            if (!selected) {
                feedback.innerHTML = `<span style="color:var(--warn)">Please select an answer</span>`;
                return;
            }

            const choiceIdx = parseInt(selected.value);
            correct = this.choices[choiceIdx].correct === true;

            if (correct) {
                feedback.innerHTML = `<span style="color:var(--ok)">✓ Correct! ${this.choices[choiceIdx].explanation || this.explanation || ''}</span>`;
            } else {
                const attempts = AD.incrementExerciseAttempts(this.exerciseId);
                const wrongExpl = this.choices[choiceIdx].explanation || 'Try again.';
                feedback.innerHTML = `<span style="color:var(--bad)">✗ ${wrongExpl}</span>`;

                if (attempts >= 2) {
                    this.container.querySelector('.exercise-actions').style.display = 'block';
                }
            }
        }

        if (correct) {
            AD.setExerciseSolved(this.exerciseId);
            this.showSolvedState();
        }
    }

    showSolvedState() {
        this.container.querySelector('.exercise').classList.add('solved');
        this.container.querySelector('.exercise-actions').style.display = 'block';
    }
}

// ===== CHECKLIST WIDGET =====
class ChecklistWidget extends BaseWidget {
    constructor(container, options = {}) {
        super(container, options);
        this.lessonKey = options.lessonKey || 'default';
        this.items = options.items || [];
        this.init();
    }

    init() {
        let html = '<div class="checklist">';
        this.items.forEach((item, i) => {
            const key = `item-${i}`;
            const checked = AD.isChecklistItemDone(this.lessonKey, key);
            html += `
                <label class="checklist-item">
                    <input type="checkbox" data-key="${key}" ${checked ? 'checked' : ''}>
                    <span>${item}</span>
                </label>
            `;
        });
        html += '</div>';
        html += `<div class="checklist-progress" style="margin-top:8px; font-size:12px; color:var(--muted);">
            <span class="checklist-count">0</span> of ${this.items.length} complete
        </div>`;

        this.container.innerHTML = html;

        // Bind checkboxes
        const checkboxes = this.container.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => {
            cb.addEventListener('change', () => {
                AD.toggleChecklistItem(this.lessonKey, cb.dataset.key);
                this.updateProgress();
            });
        });

        this.updateProgress();
    }

    updateProgress() {
        const checkboxes = this.container.querySelectorAll('input[type="checkbox"]');
        const checked = Array.from(checkboxes).filter(cb => cb.checked).length;
        this.container.querySelector('.checklist-count').textContent = checked;
    }
}

// ===== SPICE NETLIST WIDGET =====
class SpiceNetlistWidget extends BaseWidget {
    constructor(container, options = {}) {
        super(container, options);
        this.netlist = options.netlist || '';
        this.title = options.title || 'SPICE Netlist';
        this.init();
    }

    init() {
        this.container.innerHTML = `
            <div class="spice-widget">
                <div class="spice-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <span class="spice-title" style="font-weight:600;">${this.title}</span>
                    <button class="spice-copy">Copy to Clipboard</button>
                </div>
                <textarea class="spice-netlist mono" readonly>${this.netlist}</textarea>
            </div>
        `;

        const copyBtn = this.container.querySelector('.spice-copy');
        copyBtn.addEventListener('click', async () => {
            const success = await AD.copyToClipboard(this.netlist);
            copyBtn.textContent = success ? 'Copied!' : 'Failed';
            setTimeout(() => { copyBtn.textContent = 'Copy to Clipboard'; }, 2000);
        });
    }

    setNetlist(netlist) {
        this.netlist = netlist;
        this.container.querySelector('.spice-netlist').value = netlist;
    }
}

// ===== CIRCUIT WITH SPICE WIDGET =====
// Shows circuit schematic side-by-side with SPICE netlist
class CircuitWithSpiceWidget extends BaseWidget {
    constructor(container, options = {}) {
        super(container, options);
        this.circuit = options.circuit || null;  // Circuit name from AD.Schematic
        this.circuitOptions = options.circuitOptions || {};  // Options passed to circuit function
        this.netlist = options.netlist || '';
        this.title = options.title || 'Circuit & SPICE';
        this.circuitTitle = options.circuitTitle || 'Schematic';
        this.spiceTitle = options.spiceTitle || 'SPICE Netlist';
        this.init();
    }

    init() {
        this.container.innerHTML = `
            <div class="circuit-spice-widget">
                <div class="circuit-spice-grid">
                    <div class="circuit-panel">
                        <div class="panel-header">${this.circuitTitle}</div>
                        <div class="circuit-container" id="${this.container.id}-circuit"></div>
                    </div>
                    <div class="spice-panel">
                        <div class="panel-header">
                            <span>${this.spiceTitle}</span>
                            <button class="spice-copy-btn">Copy</button>
                        </div>
                        <pre class="spice-code">${this.escapeHtml(this.netlist)}</pre>
                    </div>
                </div>
            </div>
        `;

        // Render the circuit if specified
        if (this.circuit && AD.Schematic && AD.Schematic[this.circuit]) {
            const circuitContainer = this.container.querySelector('.circuit-container');
            const defaultSize = { width: 380, height: 280 };
            AD.Schematic[this.circuit](circuitContainer, { ...defaultSize, ...this.circuitOptions });
        }

        // Copy button handler
        const copyBtn = this.container.querySelector('.spice-copy-btn');
        copyBtn.addEventListener('click', async () => {
            const success = await AD.copyToClipboard(this.netlist);
            copyBtn.textContent = success ? 'Copied!' : 'Failed';
            setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
        });
    }

    escapeHtml(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    setCircuit(circuitName, options = {}) {
        this.circuit = circuitName;
        this.circuitOptions = options;
        const circuitContainer = this.container.querySelector('.circuit-container');
        circuitContainer.innerHTML = '';
        if (AD.Schematic && AD.Schematic[circuitName]) {
            AD.Schematic[circuitName](circuitContainer, { width: 380, height: 280, ...options });
        }
    }

    setNetlist(netlist) {
        this.netlist = netlist;
        this.container.querySelector('.spice-code').textContent = netlist;
    }
}

// ===== BODE PLOT WIDGET =====
class BodePlotWidget extends BaseWidget {
    constructor(container, options = {}) {
        super(container, options);
        this.fMin = options.fMin || 1;
        this.fMax = options.fMax || 1e6;
        this.magMin = options.magMin || -60;
        this.magMax = options.magMax || 20;
        this.transferFn = options.transferFn || ((f) => ({ mag: 0, phase: 0 }));
        this.init();
    }

    init() {
        this.container.innerHTML = `
            <div class="bode-widget">
                <div class="canvas-wrap">
                    <canvas class="bode-mag" width="980" height="240"></canvas>
                </div>
                <div class="canvas-wrap" style="margin-top:10px;">
                    <canvas class="bode-phase" width="980" height="160"></canvas>
                </div>
                <div class="bode-controls controls" style="margin-top:10px;">
                    <div class="c3">
                        <label>f min</label>
                        <input type="text" class="bode-fmin" value="${this.fMin}">
                    </div>
                    <div class="c3">
                        <label>f max</label>
                        <input type="text" class="bode-fmax" value="${this.fMax}">
                    </div>
                    <div class="c3">
                        <button class="bode-update primary">Update</button>
                    </div>
                </div>
            </div>
        `;

        this.magCanvas = this.container.querySelector('.bode-mag');
        this.phaseCanvas = this.container.querySelector('.bode-phase');
        this.magCtx = this.magCanvas.getContext('2d');
        this.phaseCtx = this.phaseCanvas.getContext('2d');

        const updateBtn = this.container.querySelector('.bode-update');
        updateBtn.addEventListener('click', () => {
            this.fMin = AD.parseNumValue(this.container.querySelector('.bode-fmin').value);
            this.fMax = AD.parseNumValue(this.container.querySelector('.bode-fmax').value);
            this.render();
        });

        this.render();
    }

    setTransferFn(fn) {
        this.transferFn = fn;
        this.render();
    }

    render() {
        const nPoints = 500;
        const fData = [];
        const magData = [];
        const phaseData = [];

        for (let i = 0; i < nPoints; i++) {
            const f = this.fMin * Math.pow(this.fMax / this.fMin, i / (nPoints - 1));
            fData.push(f);
            const { mag, phase } = this.transferFn(f);
            magData.push(mag);
            phaseData.push(phase);
        }

        // Magnitude plot
        AD.plotBode(this.magCtx, this.magCanvas.width, this.magCanvas.height, fData, magData, {
            fMin: this.fMin,
            fMax: this.fMax,
            magMin: this.magMin,
            magMax: this.magMax,
            label: 'Magnitude (dB)'
        });

        // Phase plot
        this.plotPhase(fData, phaseData);
    }

    plotPhase(fData, phaseData) {
        const ctx = this.phaseCtx;
        const w = this.phaseCanvas.width;
        const h = this.phaseCanvas.height;

        ctx.clearRect(0, 0, w, h);

        // Grid
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;

        const decades = Math.log10(this.fMax / this.fMin);
        for (let d = 0; d <= decades; d++) {
            const x = (d / decades) * w;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }

        for (let i = 0; i <= 4; i++) {
            const y = (i / 4) * h;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }
        ctx.restore();

        // Phase curve
        ctx.save();
        ctx.strokeStyle = 'rgba(52, 211, 153, 0.95)';
        ctx.lineWidth = 2;
        ctx.beginPath();

        for (let i = 0; i < fData.length; i++) {
            const x = (Math.log10(fData[i] / this.fMin) / Math.log10(this.fMax / this.fMin)) * w;
            const y = h / 2 - (phaseData[i] / 180) * (h / 2);

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();

        // Labels
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '12px ui-sans-serif, system-ui, sans-serif';
        ctx.fillText('Phase (degrees)', 10, 18);
        ctx.fillText('+180°', w - 50, 14);
        ctx.fillText('0°', w - 30, h / 2 + 4);
        ctx.fillText('-180°', w - 50, h - 4);
        ctx.restore();
    }
}

// ===== CIRCUIT EXERCISE WIDGET =====
// Displays a circuit schematic with questions about component values or waveforms
class CircuitExerciseWidget extends BaseWidget {
    constructor(container, options = {}) {
        super(container, options);
        this.exerciseId = options.id || 'cex-' + Math.random().toString(36).substr(2, 9);
        this.circuit = options.circuit || null;
        this.circuitOptions = options.circuitOptions || {};
        this.type = options.type || 'numeric';
        this.question = options.question || '';
        this.inputDescription = options.inputDescription || '';
        this.expected = options.expected;
        this.tolerance = options.tolerance || 0.05;
        this.unit = options.unit || '';
        this.hint = options.hint || '';
        this.solution = options.solution || '';
        this.explanation = options.explanation || '';
        this.waveformChoices = options.waveformChoices || [];
        this.choices = options.choices || [];
        this.init();
    }

    init() {
        const state = AD.getExerciseState ? AD.getExerciseState(this.exerciseId) : { solved: false };

        // Build the circuit schematic section
        let schematicHtml = '';
        if (this.circuit && typeof AD.Schematic !== 'undefined' && AD.Schematic[this.circuit]) {
            schematicHtml = `
                <div class="circuit-schematic" id="${this.exerciseId}-schematic"
                     style="background: rgba(0,0,0,0.2); border-radius: 6px; padding: 10px; margin-bottom: 15px;">
                </div>
            `;
        }

        // Build input section based on exercise type
        let inputHtml;
        if (this.type === 'circuit_waveform' || this.waveformChoices.length > 0) {
            // Waveform multiple choice with visual waveform previews
            inputHtml = this.buildWaveformChoices();
        } else if (this.type === 'choice' || this.choices.length > 0) {
            // Standard multiple choice
            inputHtml = '<div class="exercise-choices">';
            const choiceList = this.choices.length > 0 ? this.choices : [];
            choiceList.forEach((choice, i) => {
                const id = `${this.exerciseId}-choice-${i}`;
                inputHtml += `
                    <label class="exercise-choice">
                        <input type="radio" name="${this.exerciseId}-choice" value="${i}" id="${id}">
                        <span>${choice.text}</span>
                    </label>
                `;
            });
            inputHtml += `<button class="exercise-check primary" style="margin-top:10px;">Check</button></div>`;
        } else {
            // Numeric input
            inputHtml = `
                <div class="exercise-input">
                    <input type="text" id="${this.exerciseId}-answer" placeholder="Enter your answer${this.unit ? ' (' + this.unit + ')' : ''}">
                    <button class="exercise-check primary">Check</button>
                </div>
            `;
        }

        // Input description (for waveform questions)
        let inputDescHtml = '';
        if (this.inputDescription) {
            inputDescHtml = `<div class="input-description" style="background: rgba(110,231,255,0.1); padding: 8px 12px; border-radius: 4px; margin-bottom: 12px; font-size: 13px;">
                <strong>Input signal:</strong> ${this.inputDescription}
            </div>`;
        }

        this.container.innerHTML = `
            <div class="circuit-exercise ${state.solved ? 'solved' : ''}" data-id="${this.exerciseId}">
                ${schematicHtml}
                <div class="exercise-question" style="font-size: 15px; margin-bottom: 12px;">${this.question}</div>
                ${inputDescHtml}
                ${inputHtml}
                <div class="exercise-feedback" id="${this.exerciseId}-feedback" style="margin-top: 10px;"></div>
                <div class="exercise-actions" style="margin-top:10px; display:${state.solved ? 'block' : 'none'}">
                    <button class="exercise-hint" style="${this.hint ? '' : 'display:none'}">Show Hint</button>
                    <button class="exercise-solution" style="${this.solution ? '' : 'display:none'}">Show Solution</button>
                </div>
                <div class="exercise-hint-text" id="${this.exerciseId}-hint" style="display:none; background: rgba(251,191,36,0.1); padding: 10px; border-radius: 4px; margin-top: 8px;">
                    <strong>Hint:</strong> ${this.hint}
                </div>
                <div class="exercise-solution-text" id="${this.exerciseId}-solution" style="display:none; background: rgba(52,211,153,0.1); padding: 10px; border-radius: 4px; margin-top: 8px;">
                    <strong>Solution:</strong> ${this.solution}
                    ${this.explanation ? `<br><em style="color: var(--muted);">${this.explanation}</em>` : ''}
                </div>
            </div>
        `;

        // Render the circuit schematic
        if (this.circuit && typeof AD.Schematic !== 'undefined' && AD.Schematic[this.circuit]) {
            const schematicContainer = document.getElementById(`${this.exerciseId}-schematic`);
            if (schematicContainer) {
                AD.Schematic[this.circuit](schematicContainer, this.circuitOptions);
            }
        }

        // Render waveform previews
        if (this.type === 'circuit_waveform' || this.waveformChoices.length > 0) {
            this.renderWaveformPreviews();
        }

        // Bind events
        this.bindEvents(state);
    }

    buildWaveformChoices() {
        let html = '<div class="waveform-choices" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">';

        this.waveformChoices.forEach((choice, i) => {
            const id = `${this.exerciseId}-wf-${i}`;
            html += `
                <label class="waveform-choice" style="display: block; cursor: pointer; background: rgba(0,0,0,0.2); border: 2px solid transparent; border-radius: 6px; padding: 10px; transition: border-color 0.2s;">
                    <div style="display: flex; align-items: center; margin-bottom: 8px;">
                        <input type="radio" name="${this.exerciseId}-wf" value="${i}" id="${id}" style="margin-right: 8px;">
                        <span style="font-size: 13px;">${choice.label}</span>
                    </div>
                    <div class="waveform-preview" id="${id}-preview" style="height: 60px; background: rgba(0,0,0,0.3); border-radius: 4px;">
                    </div>
                </label>
            `;
        });

        html += '</div>';
        html += `<button class="exercise-check primary" style="margin-top: 15px; width: 100%;">Check Answer</button>`;

        return html;
    }

    renderWaveformPreviews() {
        this.waveformChoices.forEach((choice, i) => {
            const previewId = `${this.exerciseId}-wf-${i}-preview`;
            const previewEl = document.getElementById(previewId);
            if (!previewEl) return;

            const canvas = document.createElement('canvas');
            canvas.width = previewEl.offsetWidth || 180;
            canvas.height = 60;
            canvas.style.width = '100%';
            canvas.style.height = '60px';
            previewEl.appendChild(canvas);

            const ctx = canvas.getContext('2d');
            this.drawWaveform(ctx, canvas.width, canvas.height, choice.waveform);
        });

        // Add hover/selection styling
        const choices = this.container.querySelectorAll('.waveform-choice');
        choices.forEach(choice => {
            const radio = choice.querySelector('input[type="radio"]');
            radio.addEventListener('change', () => {
                choices.forEach(c => c.style.borderColor = 'transparent');
                if (radio.checked) {
                    choice.style.borderColor = '#6ee7ff';
                }
            });
            choice.addEventListener('mouseenter', () => {
                if (!radio.checked) choice.style.borderColor = 'rgba(110,231,255,0.4)';
            });
            choice.addEventListener('mouseleave', () => {
                if (!radio.checked) choice.style.borderColor = 'transparent';
            });
        });
    }

    drawWaveform(ctx, w, h, waveform) {
        const { type, freq, amp, phase } = waveform || {};

        ctx.fillStyle = 'rgba(0,0,0,0)';
        ctx.clearRect(0, 0, w, h);

        // Draw grid
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        ctx.stroke();

        // Draw waveform
        ctx.strokeStyle = '#6ee7ff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();

        const periods = 2;
        const samples = w;
        const phaseRad = ((phase || 0) * Math.PI) / 180;

        for (let i = 0; i < samples; i++) {
            const t = (i / samples) * periods * 2 * Math.PI;
            let y;

            switch (type) {
                case 'sine':
                    y = Math.sin(t + phaseRad);
                    break;
                case 'square':
                    y = Math.sin(t) >= 0 ? 1 : -1;
                    break;
                case 'triangle':
                    y = (2 / Math.PI) * Math.asin(Math.sin(t));
                    break;
                case 'dc':
                    y = amp || 0;
                    break;
                case 'spikes':
                    // Spikes at transitions
                    const pos = (t % (2 * Math.PI)) / (2 * Math.PI);
                    if (pos < 0.05 || (pos > 0.5 && pos < 0.55)) {
                        y = pos < 0.05 ? 1 : -1;
                    } else {
                        y = 0;
                    }
                    break;
                case 'rc_filtered_square':
                case 'differentiated_square':
                    // Approximate exponential charge/discharge
                    const halfPeriod = Math.PI;
                    const posInHalf = (t % halfPeriod) / halfPeriod;
                    const isHigh = Math.floor(t / halfPeriod) % 2 === 0;
                    if (type === 'rc_filtered_square') {
                        // Charging/discharging exponential
                        const tau = 0.4;
                        y = isHigh ? (1 - Math.exp(-posInHalf / tau)) * 0.8 : Math.exp(-posInHalf / tau) * 0.8 - 0.1;
                    } else {
                        // Spike then decay
                        y = isHigh ? Math.exp(-posInHalf * 4) : -Math.exp(-posInHalf * 4);
                    }
                    break;
                case 'crossover_distorted':
                    // Sine with flat spots near zero
                    const rawSine = Math.sin(t);
                    if (Math.abs(rawSine) < 0.1) {
                        y = 0;
                    } else {
                        y = rawSine;
                    }
                    break;
                case 'clipped_sine':
                    // Clipped top and bottom
                    y = Math.max(-0.7, Math.min(0.7, Math.sin(t)));
                    break;
                default:
                    y = Math.sin(t);
            }

            const px = i;
            const py = h / 2 - y * (h / 2 - 5);

            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.stroke();

        // Type label
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '9px sans-serif';
        ctx.fillText(type || 'sine', 4, 10);
    }

    bindEvents(state) {
        const checkBtn = this.container.querySelector('.exercise-check');
        if (checkBtn) {
            checkBtn.addEventListener('click', () => this.checkAnswer());
        }

        const hintBtn = this.container.querySelector('.exercise-hint');
        if (hintBtn) {
            hintBtn.addEventListener('click', () => {
                const el = document.getElementById(`${this.exerciseId}-hint`);
                el.style.display = el.style.display === 'none' ? 'block' : 'none';
            });
        }

        const solBtn = this.container.querySelector('.exercise-solution');
        if (solBtn) {
            solBtn.addEventListener('click', () => {
                const el = document.getElementById(`${this.exerciseId}-solution`);
                el.style.display = el.style.display === 'none' ? 'block' : 'none';
            });
        }

        if (state.solved) {
            this.showSolvedState();
        }
    }

    checkAnswer() {
        const feedback = document.getElementById(`${this.exerciseId}-feedback`);
        let correct = false;

        if (this.type === 'circuit_waveform' || this.waveformChoices.length > 0) {
            // Waveform multiple choice
            const selected = this.container.querySelector(`input[name="${this.exerciseId}-wf"]:checked`);
            if (!selected) {
                feedback.innerHTML = `<span style="color:var(--warn)">Please select a waveform</span>`;
                return;
            }

            const choiceIdx = parseInt(selected.value);
            const choice = this.waveformChoices[choiceIdx];
            correct = choice.correct === true;

            if (correct) {
                feedback.innerHTML = `<span style="color:var(--ok)">✓ Correct! ${choice.explanation || ''}</span>`;
            } else {
                feedback.innerHTML = `<span style="color:var(--bad)">✗ ${choice.explanation || 'Not quite. Try again.'}</span>`;
                if (AD.incrementExerciseAttempts) AD.incrementExerciseAttempts(this.exerciseId);
            }
        } else if (this.type === 'choice' || this.choices.length > 0) {
            // Standard multiple choice
            const selected = this.container.querySelector(`input[name="${this.exerciseId}-choice"]:checked`);
            if (!selected) {
                feedback.innerHTML = `<span style="color:var(--warn)">Please select an answer</span>`;
                return;
            }

            const choiceIdx = parseInt(selected.value);
            const choice = this.choices[choiceIdx];
            correct = choice.correct === true;

            if (correct) {
                feedback.innerHTML = `<span style="color:var(--ok)">✓ Correct! ${choice.explanation || ''}</span>`;
            } else {
                feedback.innerHTML = `<span style="color:var(--bad)">✗ ${choice.explanation || 'Try again.'}</span>`;
                if (AD.incrementExerciseAttempts) AD.incrementExerciseAttempts(this.exerciseId);
            }
        } else {
            // Numeric
            const answerEl = document.getElementById(`${this.exerciseId}-answer`);
            if (!answerEl) return;

            let answer;
            if (typeof AD.num === 'function') {
                answer = AD.num(`${this.exerciseId}-answer`);
            } else {
                answer = parseFloat(answerEl.value);
            }

            const tolerance = this.tolerance * Math.abs(this.expected);
            correct = Math.abs(answer - this.expected) <= tolerance;

            if (correct) {
                feedback.innerHTML = `<span style="color:var(--ok)">✓ Correct! ${this.explanation || ''}</span>`;
            } else {
                feedback.innerHTML = `<span style="color:var(--bad)">✗ Not quite. Expected: ${this.expected}${this.unit}</span>`;
                if (AD.incrementExerciseAttempts) AD.incrementExerciseAttempts(this.exerciseId);
            }
        }

        if (correct) {
            if (AD.setExerciseSolved) AD.setExerciseSolved(this.exerciseId);
            this.showSolvedState();
        } else {
            // Show hint after wrong answer
            this.container.querySelector('.exercise-actions').style.display = 'block';
        }
    }

    showSolvedState() {
        const exerciseEl = this.container.querySelector('.circuit-exercise');
        if (exerciseEl) exerciseEl.classList.add('solved');
        const actionsEl = this.container.querySelector('.exercise-actions');
        if (actionsEl) actionsEl.style.display = 'block';
    }
}

// ===== WIDGET FACTORY =====
const WidgetFactory = {
    widgets: new Map(),

    create(type, containerId, options = {}) {
        let widget;
        switch (type) {
            case 'oscilloscope':
                widget = new OscilloscopeWidget(containerId, options);
                break;
            case 'calculator':
                widget = new CalculatorWidget(containerId, options);
                break;
            case 'exercise':
                widget = new ExerciseWidget(containerId, options);
                break;
            case 'checklist':
                widget = new ChecklistWidget(containerId, options);
                break;
            case 'spice':
                widget = new SpiceNetlistWidget(containerId, options);
                break;
            case 'circuit_spice':
                widget = new CircuitWithSpiceWidget(containerId, options);
                break;
            case 'bode':
                widget = new BodePlotWidget(containerId, options);
                break;
            case 'circuit':
            case 'circuit_exercise':
                widget = new CircuitExerciseWidget(containerId, options);
                break;
            default:
                console.warn(`Unknown widget type: ${type}`);
                return null;
        }

        const id = options.id || containerId;
        this.widgets.set(id, widget);
        return widget;
    },

    get(id) {
        return this.widgets.get(id);
    },

    destroyAll() {
        this.widgets.forEach(widget => widget.destroy());
        this.widgets.clear();
    },

    destroy(id) {
        const widget = this.widgets.get(id);
        if (widget) {
            widget.destroy();
            this.widgets.delete(id);
        }
    }
};

// Expose classes globally
window.OscilloscopeWidget = OscilloscopeWidget;
window.CalculatorWidget = CalculatorWidget;
window.ExerciseWidget = ExerciseWidget;
window.ChecklistWidget = ChecklistWidget;
window.SpiceNetlistWidget = SpiceNetlistWidget;
window.CircuitWithSpiceWidget = CircuitWithSpiceWidget;
window.BodePlotWidget = BodePlotWidget;
window.CircuitExerciseWidget = CircuitExerciseWidget;
window.WidgetFactory = WidgetFactory;
