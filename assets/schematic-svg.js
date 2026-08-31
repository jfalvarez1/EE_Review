/**
 * Schematic SVG Library - Inline Circuit Diagrams for HTML5
 *
 * Creates publication-quality circuit schematics using inline SVG.
 * Based on IEEE Std 315-1975 and Art of Electronics conventions.
 *
 * Usage:
 *   const sch = AD.Schematic.create(containerEl, { width: 400, height: 300 });
 *   sch.resistor(50, 100, 'horizontal', { label: 'R1', value: '10k' });
 *   sch.npn(150, 100, { label: 'Q1' });
 *   sch.wire([[50, 100], [150, 100]]);
 *
 * Or use pre-built circuits:
 *   AD.Schematic.ceAmplifier(containerEl, { rc: '4.7k', re: '1k' });
 */

const SchematicLib = (() => {
    // ===== CONSTANTS =====
    const GRID = 5;           // Base grid unit (5px) - per methodology v2.2
    const COMP_LENGTH = 50;   // Standard component length
    const LINE_WIDTH = 1.5;   // Default line width
    const WIRE_WIDTH = 1.5;   // Wire line width
    const DOT_RADIUS = 3;     // Junction dot radius

    // Colors matching the dark theme
    const COLORS = {
        component: '#6ee7ff',      // Cyan accent
        wire: '#e6edf3',           // Light gray
        label: '#e6edf3',          // Text color
        value: '#9fb0c0',          // Muted color
        ground: '#9fb0c0',
        vcc: '#34d399',            // Green for power
        signal: '#fbbf24',         // Yellow for signals
        highlight: '#ff6b6b',      // Red for emphasis
        annotation: '#9fb0c0',
        arrow: '#e6edf3'
    };

    // ===== NODE REGISTRY (Prevents Floating Nodes) =====
    /**
     * Centralized coordinate management - tracks all wire endpoints, dots, and labels.
     *
     * IMPORTANT: Does NOT snap visual coordinates! Elements are drawn at exact positions.
     * The registry uses exact coordinates with tolerance-based comparison for validation.
     * This preserves alignment with component terminals that use 5px increments.
     */
    class NodeRegistry {
        constructor(tolerance = 3) {
            this.nodes = new Map();  // "x,y" -> { x, y, degree, nets: Set, types: Set }
            this.tolerance = tolerance;  // For "close enough" comparisons
        }

        // Create a key from exact coordinates (rounded to avoid floating point issues)
        key(x, y) {
            return `${Math.round(x)},${Math.round(y)}`;
        }

        // Register a node at exact coordinates
        register(x, y, netId = null, type = 'wire') {
            const rx = Math.round(x);
            const ry = Math.round(y);
            const k = this.key(rx, ry);

            if (!this.nodes.has(k)) {
                this.nodes.set(k, {
                    x: rx, y: ry,
                    degree: 0,
                    nets: new Set(),
                    types: new Set()
                });
            }
            const node = this.nodes.get(k);
            if (netId) node.nets.add(netId);
            node.types.add(type);
            return node;
        }

        incrementDegree(x, y) {
            const node = this.register(x, y);
            node.degree++;
            return node;
        }

        get(x, y) {
            return this.nodes.get(this.key(x, y));
        }

        exists(x, y) {
            return this.nodes.has(this.key(x, y));
        }

        // Find nearest node within tolerance (for validation)
        findNearest(x, y, maxDistance = 30, filter = null) {
            let nearest = null;
            let minDist = maxDistance;

            for (const [key, node] of this.nodes) {
                if (filter && !filter(node)) continue;
                const dist = Math.hypot(node.x - x, node.y - y);
                if (dist < minDist) {
                    minDist = dist;
                    nearest = node;
                }
            }
            return nearest;
        }

        // Check if a node exists within tolerance of given coordinates
        existsNear(x, y, tolerance = this.tolerance) {
            for (const [key, node] of this.nodes) {
                if (Math.abs(node.x - x) <= tolerance && Math.abs(node.y - y) <= tolerance) {
                    return node;
                }
            }
            return null;
        }
    }

    // ===== SEGMENT REGISTRY (Deduplication & Short Detection) =====
    /**
     * Tracks all wire segments to prevent duplicates and detect shorts.
     */
    class SegmentRegistry {
        constructor() {
            this.segments = new Map();  // "x1,y1-x2,y2" -> { netId, drawn }
        }

        normalizeKey(x1, y1, x2, y2) {
            // Round to avoid floating point comparison issues
            x1 = Math.round(x1); y1 = Math.round(y1);
            x2 = Math.round(x2); y2 = Math.round(y2);
            if (x1 > x2 || (x1 === x2 && y1 > y2)) {
                [x1, y1, x2, y2] = [x2, y2, x1, y1];
            }
            return `${x1},${y1}-${x2},${y2}`;
        }

        register(x1, y1, x2, y2, netId = 'default') {
            const key = this.normalizeKey(x1, y1, x2, y2);

            if (this.segments.has(key)) {
                const existing = this.segments.get(key);
                // Same net = duplicate (ok), different net = short (warn)
                if (existing.netId !== netId && existing.netId !== 'default' && netId !== 'default') {
                    console.warn(`Segment ${key} already on net ${existing.netId}, adding to ${netId}`);
                }
                return { duplicate: true, segment: existing };
            }

            const segment = { x1, y1, x2, y2, netId, drawn: false };
            this.segments.set(key, segment);
            return { duplicate: false, segment };
        }

        isDuplicate(x1, y1, x2, y2) {
            return this.segments.has(this.normalizeKey(x1, y1, x2, y2));
        }
    }

    // ===== BOUNDS ACCUMULATOR (Auto-fit ViewBox) =====
    /**
     * Tracks bounding box of all elements to auto-calculate viewBox.
     * Prevents vertical clipping by including all components, wires, and labels.
     */
    class BoundsAccumulator {
        constructor(padding = 15) {
            this.minX = Infinity;
            this.minY = Infinity;
            this.maxX = -Infinity;
            this.maxY = -Infinity;
            this.padding = padding;
        }

        addPoint(x, y) {
            this.minX = Math.min(this.minX, x);
            this.minY = Math.min(this.minY, y);
            this.maxX = Math.max(this.maxX, x);
            this.maxY = Math.max(this.maxY, y);
        }

        addRect(x, y, width, height) {
            this.addPoint(x, y);
            this.addPoint(x + width, y + height);
        }

        addLabel(x, y, text, fontSize = 11, anchor = 'middle') {
            const approxWidth = text.length * fontSize * 0.6;
            const approxHeight = fontSize * 1.4;
            let offsetX = 0;
            if (anchor === 'start') offsetX = 0;
            else if (anchor === 'end') offsetX = -approxWidth;
            else offsetX = -approxWidth / 2;
            this.addRect(x + offsetX, y - approxHeight / 2, approxWidth, approxHeight);
        }

        addComponent(x, y, width, height) {
            this.addRect(x, y, width, height);
        }

        getViewBox(requestedWidth = 0, requestedHeight = 0) {
            if (this.minX === Infinity) {
                return { x: 0, y: 0, width: requestedWidth || 400, height: requestedHeight || 300 };
            }

            const computedWidth = (this.maxX - this.minX) + 2 * this.padding;
            const computedHeight = (this.maxY - this.minY) + 2 * this.padding;

            return {
                x: this.minX - this.padding,
                y: this.minY - this.padding,
                width: Math.max(requestedWidth, computedWidth),
                height: Math.max(requestedHeight, computedHeight)
            };
        }

        isValid() {
            return this.minX !== Infinity;
        }
    }

    // ===== SVG HELPERS =====
    function createSVG(width, height) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', width);
        svg.setAttribute('height', height);
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.setAttribute('class', 'schematic-svg');
        svg.style.background = 'transparent';
        return svg;
    }

    function elem(tag, attrs = {}) {
        const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
        for (const [k, v] of Object.entries(attrs)) {
            if (v !== undefined && v !== null) {
                el.setAttribute(k.replace(/([A-Z])/g, '-$1').toLowerCase(), v);
            }
        }
        return el;
    }

    function group(attrs = {}) {
        return elem('g', attrs);
    }

    // ===== SCHEMATIC CLASS =====
    class Schematic {
        constructor(container, options = {}) {
            this.width = options.width || 400;
            this.height = options.height || 300;
            this.svg = createSVG(this.width, this.height);
            this.defs = elem('defs');
            this.svg.appendChild(this.defs);

            // NEW: Initialize registries for graph-driven geometry
            this.nodeRegistry = new NodeRegistry(3);  // 3px tolerance for validation
            this.segmentRegistry = new SegmentRegistry();
            this.boundsAccumulator = new BoundsAccumulator(options.padding || 15);
            this.textBounds = [];
            this.keepouts = [];

            // Create layered groups in correct order (back to front)
            this.wireGroup = group({ id: 'wires' });
            this.junctionGroup = group({ id: 'junctions' });
            // Use round caps/joins for components to avoid "hairline gaps" where
            // a wire meets a component lead (different SVG renderers can show
            // seams when two collinear strokes meet at an endpoint).
            this.componentGroup = group({ id: 'components', strokeLinecap: 'round', strokeLinejoin: 'round' });
            this.labelGroup = group({ id: 'labels' });

            // Main group contains all layers
            this.mainGroup = group();
            this.svg.appendChild(this.mainGroup);
            this.mainGroup.appendChild(this.wireGroup);
            this.mainGroup.appendChild(this.junctionGroup);
            this.mainGroup.appendChild(this.componentGroup);
            this.mainGroup.appendChild(this.labelGroup);

            // Add standard markers FIRST (before any use)
            this._addMarkers();

            // Clear container and add SVG
            if (typeof container === 'string') {
                container = document.getElementById(container);
            }
            if (container) {
                container.innerHTML = '';
                container.appendChild(this.svg);
            }

            this.components = [];
            this.wires = [];
        }

        addKeepout(keepout) {
            if (!keepout || !keepout.bounds) return;
            this.keepouts.push(keepout);
        }

        _addMarkers() {
            // === CANONICAL MARKER DEFINITIONS ===
            // These use currentColor and strokeWidth scaling for maximum compatibility

            // Filled arrow for current flow - points in direction of path
            const arrowFilled = elem('marker', {
                id: 'arrowFilled',
                viewBox: '0 0 10 10',
                refX: 9,
                refY: 5,
                markerWidth: 8,
                markerHeight: 8,
                markerUnits: 'strokeWidth',
                orient: 'auto-start-reverse'
            });
            arrowFilled.appendChild(elem('path', {
                d: 'M 0 0 L 10 5 L 0 10 L 3 5 Z',
                fill: 'currentColor',
                stroke: 'none'
            }));
            this.defs.appendChild(arrowFilled);

            // Open arrow for signal flow
            const arrowOpen = elem('marker', {
                id: 'arrowOpen',
                viewBox: '0 0 10 10',
                refX: 9,
                refY: 5,
                markerWidth: 8,
                markerHeight: 8,
                markerUnits: 'strokeWidth',
                orient: 'auto-start-reverse'
            });
            arrowOpen.appendChild(elem('path', {
                d: 'M 0 0 L 10 5 L 0 10',
                fill: 'none',
                stroke: 'currentColor',
                strokeWidth: 1.5,
                strokeLinecap: 'round',
                strokeLinejoin: 'round'
            }));
            this.defs.appendChild(arrowOpen);

            // ===== ANNOTATION ARROW MARKER =====
            // Compact filled triangle arrow for current direction annotations
            //
            // GEOMETRY: Symmetric triangle centered on path
            // - viewBox: '-3 -2 6 4' centers origin at triangle centroid
            // - Triangle: vertices at (-3,-2), (3,0), (-3,2) - tip at (3,0)
            // - refX=3: tip x-coordinate (placed at path endpoint)
            // - refY=0: center of marker (on path axis)
            //
            // With centered viewBox, refY=0 places marker symmetrically
            // regardless of rotation direction
            const arrowAnnoFilled = elem('marker', {
                id: 'arrowAnnoFilled',
                viewBox: '-3 -2 6 4',
                refX: 3,
                refY: 0,
                markerWidth: 6,
                markerHeight: 4,
                markerUnits: 'userSpaceOnUse',
                orient: 'auto',
                overflow: 'visible'
            });
            arrowAnnoFilled.appendChild(elem('path', {
                d: 'M -3 -2 L 3 0 L -3 2 z',
                fill: COLORS.signal,
                stroke: 'none'
            }));
            this.defs.appendChild(arrowAnnoFilled);

            // Alias markers for backwards compatibility (same centered geometry)
            const arrowCurrent = elem('marker', {
                id: 'arrowCurrent',
                viewBox: '-3 -2 6 4',
                refX: 3,
                refY: 0,
                markerWidth: 6,
                markerHeight: 4,
                markerUnits: 'userSpaceOnUse',
                orient: 'auto',
                overflow: 'visible'
            });
            arrowCurrent.appendChild(elem('path', {
                d: 'M -3 -2 L 3 0 L -3 2 z',
                fill: COLORS.signal,
                stroke: 'none'
            }));
            this.defs.appendChild(arrowCurrent);

            const arrow = elem('marker', {
                id: 'arrow',
                viewBox: '-3 -2 6 4',
                refX: 3,
                refY: 0,
                markerWidth: 6,
                markerHeight: 4,
                markerUnits: 'userSpaceOnUse',
                orient: 'auto',
                overflow: 'visible'
            });
            arrow.appendChild(elem('path', {
                d: 'M -3 -2 L 3 0 L -3 2 z',
                fill: COLORS.signal,
                stroke: 'none'
            }));
            this.defs.appendChild(arrow);

            // Ground symbol marker
            const gnd = elem('marker', {
                id: 'ground',
                viewBox: '0 0 20 12',
                refX: 10,
                refY: 0,
                markerWidth: 20,
                markerHeight: 12
            });
            const gndG = group({ stroke: COLORS.ground, strokeWidth: 1.5, fill: 'none' });
            gndG.appendChild(elem('line', { x1: 0, y1: 0, x2: 20, y2: 0 }));
            gndG.appendChild(elem('line', { x1: 4, y1: 4, x2: 16, y2: 4 }));
            gndG.appendChild(elem('line', { x1: 8, y1: 8, x2: 12, y2: 8 }));
            gnd.appendChild(gndG);
            this.defs.appendChild(gnd);
        }

        // ===== BASIC DRAWING =====

        /**
         * Draw a wire (polyline) with registry tracking.
         * Draws at EXACT coordinates (no snapping) to preserve alignment with component terminals.
         * @param {Array} points - Array of [x, y] coordinate pairs
         * @param {Object} options - { color, width, dashed, netId, arrow }
         */
        wire(points, options = {}) {
            const {
                color = COLORS.wire,
                width = WIRE_WIDTH,
                dashed = false,
                netId = 'default',
                arrow = null  // 'start', 'end', 'both', or null
            } = options;

            // Register nodes at EXACT coordinates (no snapping!)
            // Degree is tracked per-segment endpoint so interior polyline corners are not treated as "dangling".
            for (let i = 0; i < points.length; i++) {
                const [x, y] = points[i];
                this.nodeRegistry.register(x, y, netId, 'wire');
                this.boundsAccumulator.addPoint(x, y);
            }

            // Register each segment and increment endpoint degrees.
            for (let i = 1; i < points.length; i++) {
                const [x1, y1] = points[i - 1];
                const [x2, y2] = points[i];

                // Skip degenerate segments
                if (Math.round(x1) === Math.round(x2) && Math.round(y1) === Math.round(y2)) continue;

                const n1 = this.nodeRegistry.register(x1, y1, netId, 'wire');
                const n2 = this.nodeRegistry.register(x2, y2, netId, 'wire');
                n1.degree++;
                n2.degree++;

                const result = this.segmentRegistry.register(x1, y1, x2, y2, netId);
                if (result.duplicate) {
                    console.warn(`Duplicate segment: (${x1},${y1})-(${x2},${y2})`);
                }
            }

            // Draw at exact coordinates
            const pointsStr = points.map(p => p.join(',')).join(' ');
            const line = elem('polyline', {
                points: pointsStr,
                stroke: color,
                strokeWidth: width,
                fill: 'none',
                strokeLinejoin: 'round',
                strokeLinecap: 'round'
            });

            if (dashed) {
                line.setAttribute('stroke-dasharray', '4,3');
            }

            // Add arrowheads using canonical markers
            if (arrow === 'end' || arrow === 'both') {
                line.setAttribute('marker-end', 'url(#arrowFilled)');
            }
            if (arrow === 'start' || arrow === 'both') {
                line.setAttribute('marker-start', 'url(#arrowFilled)');
            }

            // Append to wire layer (not mainGroup) for proper z-ordering
            this.wireGroup.appendChild(line);
            this.wires.push(line);
            return this;
        }

        /**
         * Draw a single straight wire segment (legacy alias for wire).
         * @param {number} x1
         * @param {number} y1
         * @param {number} x2
         * @param {number} y2
         * @param {Object} options - passed to wire()
         */
        line(x1, y1, x2, y2, options = {}) {
            return this.wire([[x1, y1], [x2, y2]], options);
        }

        /**
         * Draw a junction dot (connection point) with registry validation.
         * Draws at EXACT coordinates (no snapping) to preserve alignment.
         * @param {number} x - X coordinate
         * @param {number} y - Y coordinate
         * @param {Object} options - { color, radius, netId }
         */
        dot(x, y, options = {}) {
            const { color = COLORS.wire, radius = DOT_RADIUS, netId = 'default' } = options;

            // Register at exact coordinates (no snapping!)
            this.nodeRegistry.register(x, y, netId, 'junction');
            this.boundsAccumulator.addPoint(x, y);

            // Draw at exact coordinates
            const circle = elem('circle', {
                cx: x,
                cy: y,
                r: radius,
                fill: color
            });
            // Append to junction layer for proper z-ordering
            this.junctionGroup.appendChild(circle);
            return this;
        }

        /**
         * Backwards-compatible alias for junction dots.
         * Many lesson files call `sch.junction(...)` from the older builder API.
         */
        junction(x, y, options = {}) {
            return this.dot(x, y, options);
        }

        /**
         * Draw text label with bounds tracking for auto-fit viewBox.
         * @param {number} x - X coordinate
         * @param {number} y - Y coordinate
         * @param {string} labelText - The text content
         * @param {Object} options - { color, size, anchor, baseline, bold }
         */
        text(x, y, labelText, options = {}) {
            const {
                color = COLORS.label,
                size = 12,
                anchor = 'middle',
                baseline = 'middle',
                bold = false,
                internal = false,
                skipValidation = false
            } = options;

            // Track label bounds for auto-fit viewBox
            this.boundsAccumulator.addLabel(x, y, labelText, size, anchor);
            // Track label bounds for validation (approximate)
            if (labelText !== null && labelText !== undefined) {
                const textStr = String(labelText);
                if (textStr.trim().length > 0) {
                    const approxWidth = textStr.length * size * 0.6;
                    const approxHeight = size * 1.2;
                    let xMin = x;
                    if (anchor === 'start') xMin = x;
                    else if (anchor === 'end') xMin = x - approxWidth;
                    else xMin = x - approxWidth / 2;
                    let yMin = y - approxHeight / 2;
                    if (baseline === 'hanging' || baseline === 'top') yMin = y;
                    else if (baseline === 'bottom' || baseline === 'ideographic') yMin = y - approxHeight;
                    this.textBounds.push({
                        xMin,
                        xMax: xMin + approxWidth,
                        yMin,
                        yMax: yMin + approxHeight,
                        text: textStr,
                        skipValidation: internal || skipValidation
                    });
                }
            }

            const txt = elem('text', {
                x: x,
                y: y,
                fill: color,
                fontSize: size,
                fontFamily: 'ui-sans-serif, system-ui, sans-serif',
                textAnchor: anchor,
                dominantBaseline: baseline,
                fontWeight: bold ? '600' : '400'
            });
            txt.textContent = labelText;
            // Append to label layer for proper z-ordering
            this.labelGroup.appendChild(txt);
            return this;
        }

        /**
         * Draw a rectangle (for block diagrams, etc.)
         * @param {number} x - X position (top-left)
         * @param {number} y - Y position (top-left)
         * @param {number} width - Rectangle width
         * @param {number} height - Rectangle height
         * @param {Object} options - { fill, stroke, strokeWidth, strokeDasharray }
         */
        rect(x, y, width, height, options = {}) {
            const {
                fill = 'none',
                stroke = COLORS.component,
                strokeWidth = LINE_WIDTH,
                strokeDasharray = null
            } = options;

            const rectEl = elem('rect', {
                x: x,
                y: y,
                width: width,
                height: height,
                fill: fill,
                stroke: stroke,
                strokeWidth: strokeWidth
            });

            if (strokeDasharray) {
                rectEl.setAttribute('stroke-dasharray', strokeDasharray);
            }

            // Track bounds for auto-fit viewBox
            this.boundsAccumulator.addRect(x, y, width, height);

            // Append to component layer
            this.componentGroup.appendChild(rectEl);
            return this;
        }

        // ===== PASSIVE COMPONENTS =====

        /**
         * Draw a resistor (zig-zag style) with bounds tracking.
         * @param {number} x - X position (left terminal)
         * @param {number} y - Y position (center)
         * @param {string} orient - 'horizontal' or 'vertical'
         * @param {object} options - { label, value, color }
         * @returns {Object} Terminal positions { pin1: {x,y}, pin2: {x,y} }
         */
        resistor(x, y, orient = 'horizontal', options = {}) {
            const { label, value, color = COLORS.component } = options;
            const g = group({ stroke: color, strokeWidth: LINE_WIDTH, fill: 'none' });

            let terminals;
            if (orient === 'horizontal') {
                // Zig-zag pattern: 50px total length
                const path = `M ${x} ${y}
                    l 10 0 l 3 -8 l 6 16 l 6 -16 l 6 16 l 6 -16 l 3 8 l 10 0`;
                g.appendChild(elem('path', { d: path }));
                terminals = { pin1: { x, y }, pin2: { x: x + 50, y } };
                this.boundsAccumulator.addRect(x, y - 10, 50, 20);

                // Labels
                if (label) this.text(x + 25, y - 22, label, { size: 11, bold: true });
                if (value) this.text(x + 25, y + 22, value, { size: 10, color: COLORS.value });
            } else {
                // Vertical
                const path = `M ${x} ${y}
                    l 0 10 l -8 3 l 16 6 l -16 6 l 16 6 l -16 6 l 8 3 l 0 10`;
                g.appendChild(elem('path', { d: path }));
                terminals = { pin1: { x, y }, pin2: { x, y: y + 50 } };
                this.boundsAccumulator.addRect(x - 10, y, 20, 50);

                if (label) this.text(x + 15, y + 25, label, { size: 11, anchor: 'start', bold: true });
                if (value) this.text(x + 15, y + 38, value, { size: 10, anchor: 'start', color: COLORS.value });
            }

            // Register terminal pins for connectivity
            this.nodeRegistry.register(terminals.pin1.x, terminals.pin1.y, null, 'pin');
            this.nodeRegistry.register(terminals.pin2.x, terminals.pin2.y, null, 'pin');

            this.componentGroup.appendChild(g);
            this.components.push({ type: 'resistor', x, y, orient, label, terminals });

            // Keepout: body region (exclude end leads)
            {
                const m = 3;
                if (orient === 'horizontal') {
                    this.addKeepout({
                        type: 'rectangle',
                        bounds: { xMin: x + 10 - m, xMax: x + 40 + m, yMin: y - 8 - m, yMax: y + 8 + m },
                        meta: { type: 'resistor', label }
                    });
                } else {
                    this.addKeepout({
                        type: 'rectangle',
                        bounds: { xMin: x - 8 - m, xMax: x + 8 + m, yMin: y + 10 - m, yMax: y + 40 + m },
                        meta: { type: 'resistor', label }
                    });
                }
            }
            return terminals;
        }

        /**
         * Draw a capacitor (non-polarized) with bounds tracking.
         * @returns {Object} Terminal positions { pin1: {x,y}, pin2: {x,y} }
         */
        capacitor(x, y, orient = 'horizontal', options = {}) {
            const { label, value, color = COLORS.component } = options;
            const g = group({ stroke: color, strokeWidth: LINE_WIDTH, fill: 'none' });

            let terminals;
            if (orient === 'horizontal') {
                // Two parallel lines with gap
                g.appendChild(elem('line', { x1: x, y1: y, x2: x + 22, y2: y }));
                g.appendChild(elem('line', { x1: x + 22, y1: y - 12, x2: x + 22, y2: y + 12 }));
                g.appendChild(elem('line', { x1: x + 28, y1: y - 12, x2: x + 28, y2: y + 12 }));
                g.appendChild(elem('line', { x1: x + 28, y1: y, x2: x + 50, y2: y }));
                terminals = { pin1: { x, y }, pin2: { x: x + 50, y } };
                this.boundsAccumulator.addRect(x, y - 14, 50, 28);

                if (label) this.text(x + 25, y - 30, label, { size: 11, bold: true });
                if (value) this.text(x + 25, y + 30, value, { size: 10, color: COLORS.value });
            } else {
                g.appendChild(elem('line', { x1: x, y1: y, x2: x, y2: y + 22 }));
                g.appendChild(elem('line', { x1: x - 12, y1: y + 22, x2: x + 12, y2: y + 22 }));
                g.appendChild(elem('line', { x1: x - 12, y1: y + 28, x2: x + 12, y2: y + 28 }));
                g.appendChild(elem('line', { x1: x, y1: y + 28, x2: x, y2: y + 50 }));
                terminals = { pin1: { x, y }, pin2: { x, y: y + 50 } };
                this.boundsAccumulator.addRect(x - 14, y, 28, 50);

                if (label) this.text(x + 18, y + 25, label, { size: 11, anchor: 'start', bold: true });
                if (value) this.text(x + 18, y + 38, value, { size: 10, anchor: 'start', color: COLORS.value });
            }

            // Register terminal pins
            this.nodeRegistry.register(terminals.pin1.x, terminals.pin1.y, null, 'pin');
            this.nodeRegistry.register(terminals.pin2.x, terminals.pin2.y, null, 'pin');

            this.componentGroup.appendChild(g);
            this.components.push({ type: 'capacitor', x, y, orient, label, terminals });

            // Keepout: plate region (exclude end leads)
            {
                const m = 3;
                if (orient === 'horizontal') {
                    this.addKeepout({
                        type: 'rectangle',
                        bounds: { xMin: x + 22 - m, xMax: x + 28 + m, yMin: y - 12 - m, yMax: y + 12 + m },
                        meta: { type: 'capacitor', label }
                    });
                } else {
                    this.addKeepout({
                        type: 'rectangle',
                        bounds: { xMin: x - 12 - m, xMax: x + 12 + m, yMin: y + 22 - m, yMax: y + 28 + m },
                        meta: { type: 'capacitor', label }
                    });
                }
            }
            return terminals;
        }

        /**
         * Draw a polarized capacitor (electrolytic)
         */
        capacitorPol(x, y, orient = 'horizontal', options = {}) {
            const { label, value, color = COLORS.component } = options;
            const g = group({ stroke: color, strokeWidth: LINE_WIDTH, fill: 'none' });

            const terminals = (orient === 'vertical')
                ? ({ pin1: { x, y }, pin2: { x, y: y + 50 } })
                : ({ pin1: { x, y }, pin2: { x: x + 50, y } });

            if (orient === 'horizontal') {
                // Straight line + curved line
                g.appendChild(elem('line', { x1: x, y1: y, x2: x + 22, y2: y }));
                g.appendChild(elem('line', { x1: x + 22, y1: y - 12, x2: x + 22, y2: y + 12 }));
                // Curved plate (positive side)
                g.appendChild(elem('path', {
                    d: `M ${x + 28} ${y - 12} Q ${x + 32} ${y} ${x + 28} ${y + 12}`
                }));
                g.appendChild(elem('line', { x1: x + 28, y1: y, x2: x + 50, y2: y }));
                // Plus sign
                this.text(x + 40, y - 10, '+', { size: 10, color: COLORS.value, internal: true });

                if (label) this.text(x + 25, y - 18, label, { size: 11, bold: true });
                if (value) this.text(x + 25, y + 18, value, { size: 10, color: COLORS.value });
            } else {
                g.appendChild(elem('line', { x1: x, y1: y, x2: x, y2: y + 22 }));
                g.appendChild(elem('line', { x1: x - 12, y1: y + 22, x2: x + 12, y2: y + 22 }));
                g.appendChild(elem('path', {
                    d: `M ${x - 12} ${y + 28} Q ${x} ${y + 32} ${x + 12} ${y + 28}`
                }));
                g.appendChild(elem('line', { x1: x, y1: y + 28, x2: x, y2: y + 50 }));
                this.text(x + 15, y + 18, '+', { size: 10, color: COLORS.value, internal: true });

                if (label) this.text(x + 18, y + 25, label, { size: 11, anchor: 'start', bold: true });
                if (value) this.text(x + 18, y + 38, value, { size: 10, anchor: 'start', color: COLORS.value });
            }

            // Register terminal pins
            this.nodeRegistry.register(terminals.pin1.x, terminals.pin1.y, null, 'pin');
            this.nodeRegistry.register(terminals.pin2.x, terminals.pin2.y, null, 'pin');

            // Keepout: plate region (exclude end leads)
            {
                const m = 3;
                if (orient === 'horizontal') {
                    this.addKeepout({
                        type: 'rectangle',
                        bounds: { xMin: x + 22 - m, xMax: x + 32 + m, yMin: y - 12 - m, yMax: y + 12 + m },
                        meta: { type: 'capacitorPol', label }
                    });
                } else {
                    this.addKeepout({
                        type: 'rectangle',
                        bounds: { xMin: x - 12 - m, xMax: x + 12 + m, yMin: y + 22 - m, yMax: y + 32 + m },
                        meta: { type: 'capacitorPol', label }
                    });
                }
            }

            this.componentGroup.appendChild(g);
            return this;
        }

        /**
         * Draw an inductor
         */
        inductor(x, y, orient = 'horizontal', options = {}) {
            const { label, value, color = COLORS.component } = options;
            const g = group({ stroke: color, strokeWidth: LINE_WIDTH, fill: 'none' });

            const terminals = (orient === 'vertical')
                ? ({ pin1: { x, y }, pin2: { x, y: y + 50 } })
                : ({ pin1: { x, y }, pin2: { x: x + 50, y } });

            if (orient === 'horizontal') {
                // Series of bumps
                const path = `M ${x} ${y} l 8 0
                    a 5 5 0 0 1 10 0
                    a 5 5 0 0 1 10 0
                    a 5 5 0 0 1 10 0
                    l 12 0`;
                g.appendChild(elem('path', { d: path }));

                if (label) this.text(x + 25, y - 15, label, { size: 11, bold: true });
                if (value) this.text(x + 25, y + 15, value, { size: 10, color: COLORS.value });
            } else {
                const path = `M ${x} ${y} l 0 8
                    a 5 5 0 0 0 0 10
                    a 5 5 0 0 0 0 10
                    a 5 5 0 0 0 0 10
                    l 0 12`;
                g.appendChild(elem('path', { d: path }));

                if (label) this.text(x + 15, y + 25, label, { size: 11, anchor: 'start', bold: true });
                if (value) this.text(x + 15, y + 38, value, { size: 10, anchor: 'start', color: COLORS.value });
            }

            // Register terminal pins
            this.nodeRegistry.register(terminals.pin1.x, terminals.pin1.y, null, 'pin');
            this.nodeRegistry.register(terminals.pin2.x, terminals.pin2.y, null, 'pin');

            // Keepout: coil region (exclude end leads)
            {
                const m = 3;
                if (orient === 'horizontal') {
                    this.addKeepout({
                        type: 'rectangle',
                        bounds: { xMin: x + 8 - m, xMax: x + 38 + m, yMin: y - 6 - m, yMax: y + 6 + m },
                        meta: { type: 'inductor', label }
                    });
                } else {
                    this.addKeepout({
                        type: 'rectangle',
                        bounds: { xMin: x - 6 - m, xMax: x + 6 + m, yMin: y + 8 - m, yMax: y + 38 + m },
                        meta: { type: 'inductor', label }
                    });
                }
            }

            this.componentGroup.appendChild(g);
            return this;
        }

        /**
         * Draw a quartz crystal / resonator symbol.
         * Keeps the same 50px terminal-to-terminal spacing as other passives.
         * @returns {Object} Terminal positions { pin1: {x,y}, pin2: {x,y} }
         */
        crystal(x, y, orient = 'horizontal', options = {}) {
            const { label, value, color = COLORS.component } = options;
            const g = group({ stroke: color, strokeWidth: LINE_WIDTH, fill: 'none' });

            const terminals = (orient === 'vertical')
                ? ({ pin1: { x, y }, pin2: { x, y: y + 50 } })
                : ({ pin1: { x, y }, pin2: { x: x + 50, y } });

            if (orient === 'horizontal') {
                // Leads
                g.appendChild(elem('line', { x1: x, y1: y, x2: x + 12, y2: y }));
                g.appendChild(elem('line', { x1: x + 38, y1: y, x2: x + 50, y2: y }));

                // Plates + crystal body
                g.appendChild(elem('line', { x1: x + 12, y1: y - 12, x2: x + 12, y2: y + 12 }));
                g.appendChild(elem('rect', { x: x + 18, y: y - 12, width: 14, height: 24, fill: 'none' }));
                g.appendChild(elem('line', { x1: x + 38, y1: y - 12, x2: x + 38, y2: y + 12 }));

                this.boundsAccumulator.addRect(x, y - 14, 50, 28);
                if (label) this.text(x + 25, y - 18, label, { size: 11, bold: true });
                if (value) this.text(x + 25, y + 18, value, { size: 10, color: COLORS.value });

                // Keepout: crystal body region (exclude end leads)
                {
                    const m = 3;
                    this.addKeepout({
                        type: 'rectangle',
                        bounds: { xMin: x + 12 - m, xMax: x + 38 + m, yMin: y - 12 - m, yMax: y + 12 + m },
                        meta: { type: 'crystal', label }
                    });
                }
            } else {
                // Leads
                g.appendChild(elem('line', { x1: x, y1: y, x2: x, y2: y + 12 }));
                g.appendChild(elem('line', { x1: x, y1: y + 38, x2: x, y2: y + 50 }));

                // Plates + crystal body
                g.appendChild(elem('line', { x1: x - 12, y1: y + 12, x2: x + 12, y2: y + 12 }));
                g.appendChild(elem('rect', { x: x - 12, y: y + 18, width: 24, height: 14, fill: 'none' }));
                g.appendChild(elem('line', { x1: x - 12, y1: y + 38, x2: x + 12, y2: y + 38 }));

                this.boundsAccumulator.addRect(x - 14, y, 28, 50);
                if (label) this.text(x + 18, y + 20, label, { size: 11, anchor: 'start', bold: true });
                if (value) this.text(x + 18, y + 33, value, { size: 10, anchor: 'start', color: COLORS.value });

                // Keepout: crystal body region (exclude end leads)
                {
                    const m = 3;
                    this.addKeepout({
                        type: 'rectangle',
                        bounds: { xMin: x - 12 - m, xMax: x + 12 + m, yMin: y + 12 - m, yMax: y + 38 + m },
                        meta: { type: 'crystal', label }
                    });
                }
            }

            // Register terminal pins
            this.nodeRegistry.register(terminals.pin1.x, terminals.pin1.y, null, 'pin');
            this.nodeRegistry.register(terminals.pin2.x, terminals.pin2.y, null, 'pin');

            this.componentGroup.appendChild(g);
            return terminals;
        }

        // ===== SEMICONDUCTORS =====

        /**
         * Get terminal positions for NPN transistor
         * Returns { base, collector, emitter } with {x, y} for each
         */
        static npnTerminals(x, y, flip = false) {
            const dir = flip ? -1 : 1;
            return {
                base: { x: x - 15 * dir, y: y },
                collector: { x: x + 20 * dir, y: y - 30 },
                emitter: { x: x + 20 * dir, y: y + 30 }
            };
        }

        /**
         * Get terminal positions for PNP transistor
         */
        static pnpTerminals(x, y, flip = false) {
            const dir = flip ? -1 : 1;
            return {
                base: { x: x - 15 * dir, y: y },
                emitter: { x: x + 20 * dir, y: y - 30 },
                collector: { x: x + 20 * dir, y: y + 30 }
            };
        }

        /**
         * Get terminal positions for op-amp
         */
        static opampTerminals(x, y) {
            return {
                invInput: { x: x - 15, y: y - 15 },    // - input
                nonInvInput: { x: x - 15, y: y + 15 }, // + input
                output: { x: x + 65, y: y }
            };
        }

        /**
         * Get terminal positions for NMOS transistor
         * NMOS: Gate on left, Drain on top, Source on bottom
         */
        static nmosTerminals(x, y, flip = false) {
            const dir = flip ? -1 : 1;
            return {
                gate: { x: x - 20 * dir, y: y },
                drain: { x: x + 20 * dir, y: y - 30 },
                source: { x: x + 20 * dir, y: y + 30 }
            };
        }

        /**
         * Get terminal positions for PMOS transistor
         * PMOS: Gate on left, Source on top, Drain on bottom
         */
        static pmosTerminals(x, y, flip = false) {
            const dir = flip ? -1 : 1;
            return {
                gate: { x: x - 20 * dir, y: y },
                source: { x: x + 20 * dir, y: y - 30 },
                drain: { x: x + 20 * dir, y: y + 30 }
            };
        }

        // ===== KEEPOUT ZONES (Phase B of Pipeline) =====

        /**
         * Get keepout zone for op-amp body.
         * Wires must NOT pass through this region except at terminal endpoints.
         * Triangle: vertices at (x, y-30), (x, y+30), (x+50, y)
         */
        static opampKeepout(x, y, margin = 5) {
            return {
                type: 'triangle',
                vertices: [
                    { x: x, y: y - 30 },      // Top-left vertex
                    { x: x, y: y + 30 },      // Bottom-left vertex
                    { x: x + 50, y: y }       // Right apex
                ],
                // Bounding box for quick rejection
                bounds: {
                    xMin: x - margin,
                    xMax: x + 50 + margin,
                    yMin: y - 30 - margin,
                    yMax: y + 30 + margin
                },
                // Terminal positions (wires CAN end here)
                terminals: Schematic.opampTerminals(x, y)
            };
        }

        /**
         * Get keepout zone for BJT transistor body.
         */
        static bjtKeepout(x, y, flip = false, margin = 5) {
            const dir = flip ? -1 : 1;
            return {
                type: 'rectangle',
                bounds: {
                    xMin: x - 5 * dir - margin,
                    xMax: x + 25 * dir + margin,
                    yMin: y - 22 - margin,
                    yMax: y + 22 + margin
                }
            };
        }

        /**
         * Get keepout zone for resistor/capacitor body.
         */
        static componentKeepout(x, y, orientation = 'horizontal', margin = 3) {
            if (orientation === 'horizontal') {
                return {
                    type: 'rectangle',
                    bounds: {
                        xMin: x - margin,
                        xMax: x + 50 + margin,
                        yMin: y - 8 - margin,
                        yMax: y + 8 + margin
                    },
                    terminals: [{ x: x, y: y }, { x: x + 50, y: y }]
                };
            } else {
                return {
                    type: 'rectangle',
                    bounds: {
                        xMin: x - 8 - margin,
                        xMax: x + 8 + margin,
                        yMin: y - margin,
                        yMax: y + 50 + margin
                    },
                    terminals: [{ x: x, y: y }, { x: x, y: y + 50 }]
                };
            }
        }

        // ===== VALIDATION (Phase F of Pipeline) =====

        /**
         * Check if a point is inside a triangle using barycentric coordinates.
         */
        static pointInTriangle(px, py, v1, v2, v3) {
            const d1 = (px - v2.x) * (v1.y - v2.y) - (v1.x - v2.x) * (py - v2.y);
            const d2 = (px - v3.x) * (v2.y - v3.y) - (v2.x - v3.x) * (py - v3.y);
            const d3 = (px - v1.x) * (v3.y - v1.y) - (v3.x - v1.x) * (py - v1.y);
            const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
            const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);
            return !(hasNeg && hasPos);
        }

        /**
         * Check if a point is inside a rectangle.
         */
        static pointInRect(px, py, bounds) {
            return px >= bounds.xMin && px <= bounds.xMax &&
                   py >= bounds.yMin && py <= bounds.yMax;
        }

        /**
         * Check if a line segment intersects a keepout zone.
         * Returns true if there's a violation (wire passes through body).
         * Endpoints that match terminal positions are allowed.
         */
        static wireViolatesKeepout(x1, y1, x2, y2, keepout, epsilon = 1) {
            // Quick bounding box rejection
            const wireMinX = Math.min(x1, x2);
            const wireMaxX = Math.max(x1, x2);
            const wireMinY = Math.min(y1, y2);
            const wireMaxY = Math.max(y1, y2);

            if (wireMaxX < keepout.bounds.xMin || wireMinX > keepout.bounds.xMax ||
                wireMaxY < keepout.bounds.yMin || wireMinY > keepout.bounds.yMax) {
                return false;  // No intersection possible
            }

            // Check if endpoints are at terminals (allowed)
            if (keepout.terminals) {
                const terms = Array.isArray(keepout.terminals)
                    ? keepout.terminals
                    : Object.values(keepout.terminals);
                for (const t of terms) {
                    if (Math.abs(x1 - t.x) < epsilon && Math.abs(y1 - t.y) < epsilon) {
                        // Only auto-allow if the terminal itself is inside the keepout.
                        // If the terminal lies outside the keepout (common for most symbols),
                        // we still need to check the segment for body crossings.
                        if (Schematic.pointInKeepout(x1, y1, keepout) && !Schematic.pointInKeepout(x2, y2, keepout)) {
                            return false;
                        }
                    }
                    if (Math.abs(x2 - t.x) < epsilon && Math.abs(y2 - t.y) < epsilon) {
                        if (Schematic.pointInKeepout(x2, y2, keepout) && !Schematic.pointInKeepout(x1, y1, keepout)) {
                            return false;
                        }
                    }
                }
            }

            // Sample points along the wire to check for violations
            const steps = 10;
            for (let i = 1; i < steps; i++) {
                const t = i / steps;
                const px = x1 + t * (x2 - x1);
                const py = y1 + t * (y2 - y1);
                if (Schematic.pointInKeepout(px, py, keepout)) {
                    return true;  // Violation found
                }
            }
            return false;
        }

        /**
         * Check if a point is inside a keepout zone.
         */
        static pointInKeepout(px, py, keepout) {
            if (keepout.type === 'triangle') {
                return Schematic.pointInTriangle(px, py,
                    keepout.vertices[0], keepout.vertices[1], keepout.vertices[2]);
            } else {
                return Schematic.pointInRect(px, py, keepout.bounds);
            }
        }

        /**
         * Validate that a wire path doesn't violate any keepout zones.
         * @param {Array} points - Array of [x, y] points forming the wire path
         * @param {Array} keepouts - Array of keepout zone objects
         * @returns {Object} { valid: boolean, violations: [{segment, keepout}] }
         */
        static validateWirePath(points, keepouts) {
            const violations = [];
            for (let i = 0; i < points.length - 1; i++) {
                const [x1, y1] = points[i];
                const [x2, y2] = points[i + 1];
                for (const keepout of keepouts) {
                    if (Schematic.wireViolatesKeepout(x1, y1, x2, y2, keepout)) {
                        violations.push({
                            segment: { from: { x: x1, y: y1 }, to: { x: x2, y: y2 } },
                            keepout: keepout
                        });
                    }
                }
            }
            return { valid: violations.length === 0, violations };
        }

        /**
         * Draw NPN BJT transistor
         * @param {number} x - X position (center of base bar)
         * @param {number} y - Y position (center)
         * @param {object} options - { label, circle, flip }
         * @returns terminals object with base, collector, emitter positions
         */
        npn(x, y, options = {}) {
            const { label, circle = true, color = COLORS.component, flip = false, showType = false } = options;
            const g = group({ stroke: color, strokeWidth: LINE_WIDTH, fill: 'none' });
            const dir = flip ? -1 : 1;

            // Base line (vertical bar)
            g.appendChild(elem('line', { x1: x, y1: y - 15, x2: x, y2: y + 15 }));
            // Lead to base
            g.appendChild(elem('line', { x1: x - 15 * dir, y1: y, x2: x, y2: y }));

            // Collector (diagonal up-right)
            g.appendChild(elem('line', { x1: x, y1: y - 8, x2: x + 20 * dir, y2: y - 20 }));
            g.appendChild(elem('line', { x1: x + 20 * dir, y1: y - 20, x2: x + 20 * dir, y2: y - 30 }));

            // Emitter (diagonal down-right with arrow)
            g.appendChild(elem('line', { x1: x, y1: y + 8, x2: x + 20 * dir, y2: y + 20 }));
            g.appendChild(elem('line', { x1: x + 20 * dir, y1: y + 20, x2: x + 20 * dir, y2: y + 30 }));

            // Arrow on emitter (pointing AWAY from base for NPN - current flows OUT)
            // LARGE clear triangular arrowhead - tip points OUTWARD toward emitter terminal
            // Arrow is positioned on the emitter diagonal line
            //
            // For non-flipped: emitter goes from (x, y+8) to (x+20, y+20), arrow points RIGHT
            // For flipped: emitter goes from (x, y+8) to (x-20, y+20), arrow points LEFT
            //
            // Triangle shape: tip at front, flat back edge
            //     ___
            //    |   \
            //    |    > tip (points outward)
            //    |___/
            //
            const tipX = x + 16 * dir;  // Tip position along emitter
            const tipY = y + 17;
            const backX = x + 6 * dir;  // Back of arrow (toward junction)
            // Large triangle: 10px long, 10px tall
            const arrowPath = flip
                ? `M ${tipX} ${tipY} L ${backX} ${tipY - 5} L ${backX} ${tipY + 5} Z`  // tip LEFT
                : `M ${tipX} ${tipY} L ${backX} ${tipY - 5} L ${backX} ${tipY + 5} Z`; // tip RIGHT
            g.appendChild(elem('path', { d: arrowPath, fill: color, stroke: 'none' }));

            // Optional circle
            if (circle) {
                g.appendChild(elem('circle', {
                    cx: x + 5 * dir,
                    cy: y,
                    r: 25,
                    strokeWidth: 1
                }));
            }

            // Label (component name like Q1)
            if (label) {
                const lx = x + 35 * dir;
                this.text(lx, y, label, { size: 11, anchor: flip ? 'end' : 'start', bold: true });
            }

            // Type label (NPN) - shown below the component
            if (showType) {
                const typeX = x + 5 * dir;
                const typeY = circle ? y + 35 : y + 25;
                this.text(typeX, typeY, 'NPN', { size: 9, color: COLORS.annotation, anchor: 'middle' });
            }

            this.componentGroup.appendChild(g);

            // Return terminal positions for wiring
            const terminals = Schematic.npnTerminals(x, y, flip);
            this.nodeRegistry.register(terminals.base.x, terminals.base.y, null, 'pin');
            this.nodeRegistry.register(terminals.collector.x, terminals.collector.y, null, 'pin');
            this.nodeRegistry.register(terminals.emitter.x, terminals.emitter.y, null, 'pin');
            this.components.push({ type: 'npn', x, y, label, terminals });

            // Keepout: transistor body (include optional circle)
            {
                const keepout = Schematic.bjtKeepout(x, y, flip);
                if (circle && keepout && keepout.bounds) {
                    const circleBounds = {
                        xMin: (x + 5 * dir) - 25,
                        xMax: (x + 5 * dir) + 25,
                        yMin: y - 25,
                        yMax: y + 25
                    };
                    keepout.bounds = {
                        xMin: Math.min(keepout.bounds.xMin, circleBounds.xMin),
                        xMax: Math.max(keepout.bounds.xMax, circleBounds.xMax),
                        yMin: Math.min(keepout.bounds.yMin, circleBounds.yMin),
                        yMax: Math.max(keepout.bounds.yMax, circleBounds.yMax)
                    };
                }
                this.addKeepout({ ...keepout, terminals, meta: { type: 'npn', label } });
            }
            return terminals;
        }

        /**
         * Draw PNP BJT transistor
         * @returns terminals object with base, collector, emitter positions
         */
        pnp(x, y, options = {}) {
            const { label, circle = true, color = COLORS.component, flip = false, showType = false } = options;
            const g = group({ stroke: color, strokeWidth: LINE_WIDTH, fill: 'none' });
            const dir = flip ? -1 : 1;

            // Base line
            g.appendChild(elem('line', { x1: x, y1: y - 15, x2: x, y2: y + 15 }));
            g.appendChild(elem('line', { x1: x - 15 * dir, y1: y, x2: x, y2: y }));

            // Collector (bottom for PNP)
            g.appendChild(elem('line', { x1: x, y1: y + 8, x2: x + 20 * dir, y2: y + 20 }));
            g.appendChild(elem('line', { x1: x + 20 * dir, y1: y + 20, x2: x + 20 * dir, y2: y + 30 }));

            // Emitter with arrow (top for PNP, pointing INTO base)
            g.appendChild(elem('line', { x1: x, y1: y - 8, x2: x + 20 * dir, y2: y - 20 }));
            g.appendChild(elem('line', { x1: x + 20 * dir, y1: y - 20, x2: x + 20 * dir, y2: y - 30 }));

            // Arrow on emitter (pointing TOWARD base for PNP - current flows IN)
            // 4-point kite shape with tip pointing toward junction
            const ax = x + 6 * dir;
            const ay = y - 10;
            const arrowPath = flip
                ? `M ${ax} ${ay} l 4 -4 l 0 6 l -6 -1 z`
                : `M ${ax} ${ay} l -4 -4 l 0 6 l 6 -1 z`;
            g.appendChild(elem('path', { d: arrowPath, fill: color, stroke: 'none' }));

            if (circle) {
                g.appendChild(elem('circle', { cx: x + 5 * dir, cy: y, r: 25, strokeWidth: 1 }));
            }

            // Label (component name like Q1)
            if (label) {
                const lx = x + 35 * dir;
                this.text(lx, y, label, { size: 11, anchor: flip ? 'end' : 'start', bold: true });
            }

            // Type label (PNP) - shown below the component
            if (showType) {
                const typeX = x + 5 * dir;
                const typeY = circle ? y + 35 : y + 25;
                this.text(typeX, typeY, 'PNP', { size: 9, color: COLORS.annotation, anchor: 'middle' });
            }

            this.componentGroup.appendChild(g);

            const terminals = Schematic.pnpTerminals(x, y, flip);
            this.nodeRegistry.register(terminals.base.x, terminals.base.y, null, 'pin');
            this.nodeRegistry.register(terminals.collector.x, terminals.collector.y, null, 'pin');
            this.nodeRegistry.register(terminals.emitter.x, terminals.emitter.y, null, 'pin');
            this.components.push({ type: 'pnp', x, y, label, terminals });

            // Keepout: transistor body (include optional circle)
            {
                const keepout = Schematic.bjtKeepout(x, y, flip);
                if (circle && keepout && keepout.bounds) {
                    const circleBounds = {
                        xMin: (x + 5 * dir) - 25,
                        xMax: (x + 5 * dir) + 25,
                        yMin: y - 25,
                        yMax: y + 25
                    };
                    keepout.bounds = {
                        xMin: Math.min(keepout.bounds.xMin, circleBounds.xMin),
                        xMax: Math.max(keepout.bounds.xMax, circleBounds.xMax),
                        yMin: Math.min(keepout.bounds.yMin, circleBounds.yMin),
                        yMax: Math.max(keepout.bounds.yMax, circleBounds.yMax)
                    };
                }
                this.addKeepout({ ...keepout, terminals, meta: { type: 'pnp', label } });
            }
            return terminals;
        }

        /**
         * Draw N-channel MOSFET (enhancement mode)
         * Terminals: Gate (left), Drain (top), Source (bottom)
         */
        nmos(x, y, options = {}) {
            const { label, color = COLORS.component, flip = false, showType = false, showTerminals = false } = options;
            const g = group({ stroke: color, strokeWidth: LINE_WIDTH, fill: 'none' });
            const dir = flip ? -1 : 1;

            // Gate line (vertical)
            g.appendChild(elem('line', { x1: x, y1: y - 18, x2: x, y2: y + 18 }));
            // Gate lead
            g.appendChild(elem('line', { x1: x - 20 * dir, y1: y, x2: x - 6 * dir, y2: y }));
            g.appendChild(elem('line', { x1: x - 6 * dir, y1: y - 15, x2: x - 6 * dir, y2: y + 15 }));

            // Channel (dashed for enhancement)
            g.appendChild(elem('line', {
                x1: x + 6 * dir, y1: y - 18,
                x2: x + 6 * dir, y2: y - 8,
                strokeDasharray: '3,2'
            }));
            g.appendChild(elem('line', {
                x1: x + 6 * dir, y1: y - 4,
                x2: x + 6 * dir, y2: y + 4,
                strokeDasharray: '3,2'
            }));
            g.appendChild(elem('line', {
                x1: x + 6 * dir, y1: y + 8,
                x2: x + 6 * dir, y2: y + 18,
                strokeDasharray: '3,2'
            }));

            // Drain (top)
            g.appendChild(elem('line', { x1: x + 6 * dir, y1: y - 18, x2: x + 20 * dir, y2: y - 18 }));
            g.appendChild(elem('line', { x1: x + 20 * dir, y1: y - 18, x2: x + 20 * dir, y2: y - 30 }));

            // Source (bottom)
            g.appendChild(elem('line', { x1: x + 6 * dir, y1: y + 18, x2: x + 20 * dir, y2: y + 18 }));
            g.appendChild(elem('line', { x1: x + 20 * dir, y1: y + 18, x2: x + 20 * dir, y2: y + 30 }));

            // Body connection to source
            g.appendChild(elem('line', { x1: x + 6 * dir, y1: y, x2: x + 20 * dir, y2: y }));
            g.appendChild(elem('line', { x1: x + 20 * dir, y1: y, x2: x + 20 * dir, y2: y + 18 }));

            // Arrow (pointing INTO channel for N-channel - current flows in)
            const arrowPath = flip
                ? `M ${x + 12 * dir} ${y} l 6 -4 l 0 8 z`
                : `M ${x + 12} ${y} l -6 -4 l 0 8 z`;
            g.appendChild(elem('path', { d: arrowPath, fill: color, stroke: 'none' }));

            // Label (component name like M1)
            if (label) {
                this.text(x + 32 * dir, y - 12, label, { size: 11, anchor: flip ? 'end' : 'start', bold: true });
            }

            // Terminal labels (G, D, S)
            if (showTerminals) {
                const t = Schematic.nmosTerminals(x, y, flip);
                // Gate label - offset from gate terminal
                this.text(t.gate.x - 8 * dir, t.gate.y - 10, 'G', { size: 9, color: COLORS.annotation, anchor: flip ? 'start' : 'end' });
                // Drain label - next to drain
                this.text(t.drain.x + 24 * dir, t.drain.y, 'D', { size: 9, color: COLORS.annotation, anchor: flip ? 'end' : 'start' });
                // Source label - next to source
                this.text(t.source.x + 10 * dir, t.source.y + 10, 'S', { size: 9, color: COLORS.annotation, anchor: flip ? 'end' : 'start' });
            }

            // Type label (NMOS) - shown below the component
            if (showType) {
                this.text(x + 40 * dir, y + 18, 'NMOS', { size: 9, color: COLORS.annotation, anchor: flip ? 'end' : 'start' });
            }

            // Register terminal pins for connectivity validation
            {
                const t = Schematic.nmosTerminals(x, y, flip);
                this.nodeRegistry.register(t.gate.x, t.gate.y, null, 'pin');
                this.nodeRegistry.register(t.drain.x, t.drain.y, null, 'pin');
                this.nodeRegistry.register(t.source.x, t.source.y, null, 'pin');
            }

            this.componentGroup.appendChild(g);
            return this;
        }

        /**
         * Draw P-channel MOSFET (enhancement mode)
         */
        pmos(x, y, options = {}) {
            const { label, color = COLORS.component, flip = false, showType = false, showTerminals = false } = options;
            const g = group({ stroke: color, strokeWidth: LINE_WIDTH, fill: 'none' });
            const dir = flip ? -1 : 1;

            // Gate line (vertical)
            g.appendChild(elem('line', { x1: x, y1: y - 18, x2: x, y2: y + 18 }));
            // Gate lead
            g.appendChild(elem('line', { x1: x - 20 * dir, y1: y, x2: x - 6 * dir, y2: y }));
            g.appendChild(elem('line', { x1: x - 6 * dir, y1: y - 15, x2: x - 6 * dir, y2: y + 15 }));

            // Channel (dashed for enhancement)
            g.appendChild(elem('line', {
                x1: x + 6 * dir, y1: y - 18,
                x2: x + 6 * dir, y2: y - 8,
                strokeDasharray: '3,2'
            }));
            g.appendChild(elem('line', {
                x1: x + 6 * dir, y1: y - 4,
                x2: x + 6 * dir, y2: y + 4,
                strokeDasharray: '3,2'
            }));
            g.appendChild(elem('line', {
                x1: x + 6 * dir, y1: y + 8,
                x2: x + 6 * dir, y2: y + 18,
                strokeDasharray: '3,2'
            }));

            // Source (top for PMOS)
            g.appendChild(elem('line', { x1: x + 6 * dir, y1: y - 18, x2: x + 20 * dir, y2: y - 18 }));
            g.appendChild(elem('line', { x1: x + 20 * dir, y1: y - 18, x2: x + 20 * dir, y2: y - 30 }));

            // Drain (bottom for PMOS)
            g.appendChild(elem('line', { x1: x + 6 * dir, y1: y + 18, x2: x + 20 * dir, y2: y + 18 }));
            g.appendChild(elem('line', { x1: x + 20 * dir, y1: y + 18, x2: x + 20 * dir, y2: y + 30 }));

            // Body connection to source (top)
            g.appendChild(elem('line', { x1: x + 6 * dir, y1: y, x2: x + 20 * dir, y2: y }));
            g.appendChild(elem('line', { x1: x + 20 * dir, y1: y, x2: x + 20 * dir, y2: y - 18 }));

            // Arrow (pointing OUT of channel for P-channel - current flows out)
            const arrowPath = flip
                ? `M ${x + 12 * dir} ${y} l -6 -4 l 0 8 z`  // pointing right for flipped
                : `M ${x + 12} ${y} l 6 -4 l 0 8 z`;        // pointing left for non-flipped
            g.appendChild(elem('path', { d: arrowPath, fill: color, stroke: 'none' }));

            // Bubble on gate to indicate P-type
            g.appendChild(elem('circle', {
                cx: x - 3 * dir,
                cy: y,
                r: 3,
                fill: '#0b0f16',
                stroke: color,
                strokeWidth: LINE_WIDTH
            }));

            // Label (component name like M1)
            if (label) {
                this.text(x + 32 * dir, y - 12, label, { size: 11, anchor: flip ? 'end' : 'start', bold: true });
            }

            // Terminal labels (G, S, D) - Note: PMOS has source on top, drain on bottom
            if (showTerminals) {
                const t = Schematic.pmosTerminals(x, y, flip);
                // Gate label - offset from gate terminal
                this.text(t.gate.x - 8 * dir, t.gate.y - 10, 'G', { size: 9, color: COLORS.annotation, anchor: flip ? 'start' : 'end' });
                // Source label - next to source (top)
                this.text(t.source.x + 10 * dir, t.source.y - 10, 'S', { size: 9, color: COLORS.annotation, anchor: flip ? 'end' : 'start' });
                // Drain label - next to drain (bottom)
                this.text(t.drain.x + 24 * dir, t.drain.y, 'D', { size: 9, color: COLORS.annotation, anchor: flip ? 'end' : 'start' });
            }

            // Type label (PMOS) - shown below the component
            if (showType) {
                this.text(x + 40 * dir, y + 18, 'PMOS', { size: 9, color: COLORS.annotation, anchor: flip ? 'end' : 'start' });
            }

            // Register terminal pins for connectivity validation
            {
                const t = Schematic.pmosTerminals(x, y, flip);
                this.nodeRegistry.register(t.gate.x, t.gate.y, null, 'pin');
                this.nodeRegistry.register(t.source.x, t.source.y, null, 'pin');
                this.nodeRegistry.register(t.drain.x, t.drain.y, null, 'pin');
            }

            this.componentGroup.appendChild(g);
            return this;
        }

        /**
         * Draw a diode
         */
        diode(x, y, orient = 'horizontal', options = {}) {
            const { label, color = COLORS.component } = options;
            const g = group({ stroke: color, strokeWidth: LINE_WIDTH, fill: 'none' });

            const terminals = (orient === 'vertical')
                ? ({ pin1: { x, y }, pin2: { x, y: y + 50 } })
                : ({ pin1: { x, y }, pin2: { x: x + 50, y } });

            if (orient === 'horizontal') {
                // Leads
                g.appendChild(elem('line', { x1: x, y1: y, x2: x + 15, y2: y }));
                g.appendChild(elem('line', { x1: x + 35, y1: y, x2: x + 50, y2: y }));
                // Triangle (anode)
                g.appendChild(elem('path', {
                    d: `M ${x + 15} ${y - 10} L ${x + 15} ${y + 10} L ${x + 30} ${y} Z`,
                    fill: 'none'
                }));
                // Cathode bar
                g.appendChild(elem('line', { x1: x + 30, y1: y - 10, x2: x + 30, y2: y + 10 }));
                g.appendChild(elem('line', { x1: x + 30, y1: y, x2: x + 35, y2: y }));

                if (label) this.text(x + 25, y - 16, label, { size: 11, bold: true });
            } else {
                g.appendChild(elem('line', { x1: x, y1: y, x2: x, y2: y + 15 }));
                g.appendChild(elem('line', { x1: x, y1: y + 35, x2: x, y2: y + 50 }));
                g.appendChild(elem('path', {
                    d: `M ${x - 10} ${y + 15} L ${x + 10} ${y + 15} L ${x} ${y + 30} Z`,
                    fill: 'none'
                }));
                g.appendChild(elem('line', { x1: x - 10, y1: y + 30, x2: x + 10, y2: y + 30 }));

                if (label) this.text(x + 16, y + 25, label, { size: 11, anchor: 'start', bold: true });
            }

            // Register terminal pins
            this.nodeRegistry.register(terminals.pin1.x, terminals.pin1.y, null, 'pin');
            this.nodeRegistry.register(terminals.pin2.x, terminals.pin2.y, null, 'pin');

            // Keepout: diode body region (exclude end leads)
            {
                const m = 3;
                if (orient === 'horizontal') {
                    this.addKeepout({
                        type: 'rectangle',
                        bounds: { xMin: x + 15 - m, xMax: x + 35 + m, yMin: y - 10 - m, yMax: y + 10 + m },
                        meta: { type: 'diode', label }
                    });
                } else {
                    this.addKeepout({
                        type: 'rectangle',
                        bounds: { xMin: x - 10 - m, xMax: x + 10 + m, yMin: y + 15 - m, yMax: y + 35 + m },
                        meta: { type: 'diode', label }
                    });
                }
            }

            this.componentGroup.appendChild(g);
            return this;
        }

        /**
         * Draw a Zener diode
         */
        zener(x, y, orient = 'horizontal', options = {}) {
            const { label, value, color = COLORS.component } = options;
            const g = group({ stroke: color, strokeWidth: LINE_WIDTH, fill: 'none' });

            const terminals = (orient === 'vertical')
                ? ({ pin1: { x, y }, pin2: { x, y: y + 50 } })
                : ({ pin1: { x, y }, pin2: { x: x + 50, y } });

            if (orient === 'horizontal') {
                g.appendChild(elem('line', { x1: x, y1: y, x2: x + 15, y2: y }));
                g.appendChild(elem('line', { x1: x + 35, y1: y, x2: x + 50, y2: y }));
                g.appendChild(elem('path', {
                    d: `M ${x + 15} ${y - 10} L ${x + 15} ${y + 10} L ${x + 30} ${y} Z`,
                    fill: 'none'
                }));
                // Zener cathode (bent ends)
                g.appendChild(elem('path', {
                    d: `M ${x + 27} ${y - 12} L ${x + 30} ${y - 10} L ${x + 30} ${y + 10} L ${x + 33} ${y + 12}`
                }));

                if (label) this.text(x + 25, y - 18, label, { size: 11, bold: true });
                if (value) this.text(x + 25, y + 18, value, { size: 10, color: COLORS.value });
            } else {
                // Vertical zener - 50px total height like other components
                // Lead from top
                g.appendChild(elem('line', { x1: x, y1: y, x2: x, y2: y + 15 }));
                // Lead to bottom
                g.appendChild(elem('line', { x1: x, y1: y + 35, x2: x, y2: y + 50 }));
                // Triangle (anode pointing down)
                g.appendChild(elem('path', {
                    d: `M ${x - 10} ${y + 15} L ${x + 10} ${y + 15} L ${x} ${y + 30} Z`,
                    fill: 'none'
                }));
                // Zener cathode bar with bent ends
                g.appendChild(elem('path', {
                    d: `M ${x - 12} ${y + 27} L ${x - 10} ${y + 30} L ${x + 10} ${y + 30} L ${x + 12} ${y + 33}`
                }));

                if (label) this.text(x + 18, y + 20, label, { size: 11, anchor: 'start', bold: true });
                if (value) this.text(x + 18, y + 33, value, { size: 10, anchor: 'start', color: COLORS.value });
            }

            // Register terminal pins
            this.nodeRegistry.register(terminals.pin1.x, terminals.pin1.y, null, 'pin');
            this.nodeRegistry.register(terminals.pin2.x, terminals.pin2.y, null, 'pin');

            // Keepout: zener body region (exclude end leads)
            {
                const m = 3;
                if (orient === 'horizontal') {
                    this.addKeepout({
                        type: 'rectangle',
                        bounds: { xMin: x + 15 - m, xMax: x + 35 + m, yMin: y - 12 - m, yMax: y + 12 + m },
                        meta: { type: 'zener', label }
                    });
                } else {
                    this.addKeepout({
                        type: 'rectangle',
                        bounds: { xMin: x - 12 - m, xMax: x + 12 + m, yMin: y + 15 - m, yMax: y + 35 + m },
                        meta: { type: 'zener', label }
                    });
                }
            }

            this.componentGroup.appendChild(g);
            return this;
        }

        /**
         * Draw an LED
         */
        led(x, y, orient = 'horizontal', options = {}) {
            const { label, color = COLORS.component } = options;
            // Draw diode first
            this.diode(x, y, orient, { color });

            const g = group({ stroke: color, strokeWidth: 1, fill: 'none' });

            // Add arrows indicating light emission
            if (orient === 'horizontal') {
                g.appendChild(elem('line', { x1: x + 22, y1: y - 15, x2: x + 28, y2: y - 22 }));
                g.appendChild(elem('path', { d: `M ${x + 28} ${y - 22} l -3 1 l 1 3 z`, fill: color }));
                g.appendChild(elem('line', { x1: x + 28, y1: y - 13, x2: x + 34, y2: y - 20 }));
                g.appendChild(elem('path', { d: `M ${x + 34} ${y - 20} l -3 1 l 1 3 z`, fill: color }));
            }

            if (label) this.text(x + 25, y + 18, label, { size: 11, color: COLORS.value });

            this.componentGroup.appendChild(g);
            return this;
        }

        // ===== OP-AMP =====

        /**
         * Draw an op-amp (triangle symbol)
         * @param {number} x - X position (left edge)
         * @param {number} y - Y position (center)
         */
        opamp(x, y, options = {}) {
            const { label, color = COLORS.component, showPins = true } = options;
            const g = group({ stroke: color, strokeWidth: LINE_WIDTH, fill: 'none' });

            // Triangle body
            g.appendChild(elem('path', {
                d: `M ${x} ${y - 30} L ${x} ${y + 30} L ${x + 50} ${y} Z`
            }));

            // Input pins
            if (showPins) {
                // Inverting input (-)
                g.appendChild(elem('line', { x1: x - 15, y1: y - 15, x2: x, y2: y - 15 }));
                this.text(x + 8, y - 15, '-', { size: 14, color, bold: true, internal: true });

                // Non-inverting input (+)
                g.appendChild(elem('line', { x1: x - 15, y1: y + 15, x2: x, y2: y + 15 }));
                this.text(x + 8, y + 15, '+', { size: 14, color, bold: true, internal: true });

                // Output
                g.appendChild(elem('line', { x1: x + 50, y1: y, x2: x + 65, y2: y }));
            }

            // Register pins for connectivity validation (if pins are shown)
            if (showPins) {
                const t = Schematic.opampTerminals(x, y);
                this.nodeRegistry.register(t.invInput.x, t.invInput.y, null, 'pin');
                this.nodeRegistry.register(t.nonInvInput.x, t.nonInvInput.y, null, 'pin');
                this.nodeRegistry.register(t.output.x, t.output.y, null, 'pin');
            }

            if (label) {
                this.text(x + 70, y - 20, label, { size: 11, bold: true, anchor: 'start' });
            }

            // Keepout: op-amp body (triangle)
            this.addKeepout({ ...Schematic.opampKeepout(x, y), meta: { type: 'opamp', label } });

            this.componentGroup.appendChild(g);
            return this;
        }

        // ===== POWER & GROUND =====

        /**
         * Draw a ground symbol
         */
        ground(x, y, options = {}) {
            const { color = COLORS.ground, type = 'earth' } = options;
            const g = group({ stroke: color, strokeWidth: LINE_WIDTH, fill: 'none' });

            // Treat ground symbols as connection nodes (often used like net labels).
            this.nodeRegistry.register(x, y, null, 'pin');
            this.nodeRegistry.register(x, y, null, 'label');

            if (type === 'earth') {
                // Bounds: include the earth ground symbol below the node
                this.boundsAccumulator.addRect(x - 10, y, 20, 16);
                g.appendChild(elem('line', { x1: x, y1: y, x2: x, y2: y + 5 }));
                g.appendChild(elem('line', { x1: x - 10, y1: y + 5, x2: x + 10, y2: y + 5 }));
                g.appendChild(elem('line', { x1: x - 6, y1: y + 9, x2: x + 6, y2: y + 9 }));
                g.appendChild(elem('line', { x1: x - 2, y1: y + 13, x2: x + 2, y2: y + 13 }));
            } else if (type === 'chassis') {
                // Bounds: include chassis ground symbol below the node
                this.boundsAccumulator.addRect(x - 15, y, 30, 16);
                g.appendChild(elem('line', { x1: x, y1: y, x2: x, y2: y + 5 }));
                g.appendChild(elem('line', { x1: x - 10, y1: y + 5, x2: x + 10, y2: y + 5 }));
                g.appendChild(elem('line', { x1: x - 10, y1: y + 5, x2: x - 15, y2: y + 12 }));
                g.appendChild(elem('line', { x1: x, y1: y + 5, x2: x - 5, y2: y + 12 }));
                g.appendChild(elem('line', { x1: x + 10, y1: y + 5, x2: x + 5, y2: y + 12 }));
            }

            this.componentGroup.appendChild(g);
            return this;
        }

        /**
         * Draw a VCC/VDD power rail symbol
         */
        vcc(x, y, options = {}) {
            const { label = 'VCC', color = COLORS.vcc } = options;
            const g = group({ stroke: color, strokeWidth: LINE_WIDTH, fill: 'none' });

            // Treat supply rails as connection nodes (often used like net labels).
            this.nodeRegistry.register(x, y, null, 'pin');
            this.nodeRegistry.register(x, y, null, 'label');

            // Bounds: include the VCC tick above the node (label bounds are tracked by text())
            this.boundsAccumulator.addRect(x - 10, y - 20, 20, 20);
            g.appendChild(elem('line', { x1: x, y1: y, x2: x, y2: y - 5 }));
            g.appendChild(elem('line', { x1: x - 8, y1: y - 5, x2: x + 8, y2: y - 5 }));

            this.text(x, y - 15, label, { size: 10, color, bold: true });

            this.componentGroup.appendChild(g);
            return this;
        }

        /**
         * Draw a VEE/VSS power rail symbol (negative supply)
         */
        vee(x, y, options = {}) {
            const { label = 'VEE', color = COLORS.vcc } = options;
            const g = group({ stroke: color, strokeWidth: LINE_WIDTH, fill: 'none' });

            // Treat supply rails as connection nodes (often used like net labels).
            this.nodeRegistry.register(x, y, null, 'pin');
            this.nodeRegistry.register(x, y, null, 'label');

            // Bounds: include the VEE tick below the node (label bounds are tracked by text())
            this.boundsAccumulator.addRect(x - 10, y, 20, 20);
            g.appendChild(elem('line', { x1: x, y1: y, x2: x, y2: y + 5 }));
            g.appendChild(elem('line', { x1: x - 8, y1: y + 5, x2: x + 8, y2: y + 5 }));

            this.text(x, y + 15, label, { size: 10, color, bold: true });

            this.componentGroup.appendChild(g);
            return this;
        }

        // ===== SOURCES =====

        /**
         * Draw a voltage source
         */
        voltageSource(x, y, orient = 'vertical', options = {}) {
            const { label, value, color = COLORS.component } = options;
            const g = group({ stroke: color, strokeWidth: LINE_WIDTH, fill: 'none' });

            const terminals = (orient === 'vertical')
                ? ({ pin1: { x, y }, pin2: { x, y: y + 50 } })
                : ({ pin1: { x, y }, pin2: { x: x + 50, y } });

            if (orient === 'vertical') {
                // Circle
                g.appendChild(elem('circle', { cx: x, cy: y + 25, r: 15 }));
                // Plus/minus
                this.text(x, y + 20, '+', { size: 12, color, internal: true });
                this.text(x, y + 32, '-', { size: 14, color, internal: true });
                // Leads
                g.appendChild(elem('line', { x1: x, y1: y, x2: x, y2: y + 10 }));
                g.appendChild(elem('line', { x1: x, y1: y + 40, x2: x, y2: y + 50 }));

                if (label) this.text(x + 28, y + 18, label, { size: 11, anchor: 'start', bold: true });
                if (value) this.text(x + 28, y + 32, value, { size: 10, anchor: 'start', color: COLORS.value });
            } else {
                g.appendChild(elem('circle', { cx: x + 25, cy: y, r: 15 }));
                this.text(x + 20, y, '+', { size: 12, color, internal: true });
                this.text(x + 32, y, '-', { size: 14, color, internal: true });
                g.appendChild(elem('line', { x1: x, y1: y, x2: x + 10, y2: y }));
                g.appendChild(elem('line', { x1: x + 40, y1: y, x2: x + 50, y2: y }));

                if (label) this.text(x + 25, y - 20, label, { size: 11, bold: true });
                if (value) this.text(x + 25, y + 25, value, { size: 10, color: COLORS.value });
            }

            this.nodeRegistry.register(terminals.pin1.x, terminals.pin1.y, null, 'pin');
            this.nodeRegistry.register(terminals.pin2.x, terminals.pin2.y, null, 'pin');

            // Keepout: source body (exclude terminal leads)
            {
                const m = 3;
                if (orient === 'vertical') {
                    this.addKeepout({
                        type: 'rectangle',
                        bounds: { xMin: x - 15 - m, xMax: x + 15 + m, yMin: y + 10 - m, yMax: y + 40 + m },
                        meta: { type: 'voltageSource', label }
                    });
                } else {
                    this.addKeepout({
                        type: 'rectangle',
                        bounds: { xMin: x + 10 - m, xMax: x + 40 + m, yMin: y - 15 - m, yMax: y + 15 + m },
                        meta: { type: 'voltageSource', label }
                    });
                }
            }

            this.componentGroup.appendChild(g);
            return this;
        }

        /**
         * Draw a current source
         */
        currentSource(x, y, orient = 'vertical', options = {}) {
            const { label, value, color = COLORS.component } = options;
            const g = group({ stroke: color, strokeWidth: LINE_WIDTH, fill: 'none' });

            const terminals = (orient === 'vertical')
                ? ({ pin1: { x, y }, pin2: { x, y: y + 50 } })
                : ({ pin1: { x, y }, pin2: { x: x + 50, y } });

            if (orient === 'vertical') {
                // Bounds: circle + leads (labels already tracked via text())
                this.boundsAccumulator.addRect(x - 16, y, 32, 50);
                g.appendChild(elem('circle', { cx: x, cy: y + 25, r: 15 }));
                // Arrow pointing up
                g.appendChild(elem('line', { x1: x, y1: y + 35, x2: x, y2: y + 15 }));
                g.appendChild(elem('path', { d: `M ${x} ${y + 15} l -4 6 l 8 0 z`, fill: color }));
                // Leads
                g.appendChild(elem('line', { x1: x, y1: y, x2: x, y2: y + 10 }));
                g.appendChild(elem('line', { x1: x, y1: y + 40, x2: x, y2: y + 50 }));

                if (label) this.text(x + 28, y + 25, label, { size: 11, anchor: 'start', bold: true });
                if (value) this.text(x + 28, y + 38, value, { size: 10, anchor: 'start', color: COLORS.value });
            }

            this.nodeRegistry.register(terminals.pin1.x, terminals.pin1.y, null, 'pin');
            this.nodeRegistry.register(terminals.pin2.x, terminals.pin2.y, null, 'pin');

            // Keepout: source body (exclude terminal leads)
            {
                const m = 3;
                this.addKeepout({
                    type: 'rectangle',
                    bounds: { xMin: x - 15 - m, xMax: x + 15 + m, yMin: y + 10 - m, yMax: y + 40 + m },
                    meta: { type: 'currentSource', label }
                });
            }

            this.componentGroup.appendChild(g);
            return this;
        }

        /**
         * Draw an AC source (sine wave inside circle)
         */
        acSource(x, y, orient = 'vertical', options = {}) {
            const { label, value, color = COLORS.component } = options;
            const g = group({ stroke: color, strokeWidth: LINE_WIDTH, fill: 'none' });

            const terminals = (orient === 'vertical')
                ? ({ pin1: { x, y }, pin2: { x, y: y + 50 } })
                : ({ pin1: { x, y }, pin2: { x: x + 50, y } });

            if (orient === 'vertical') {
                g.appendChild(elem('circle', { cx: x, cy: y + 25, r: 15 }));
                // Sine wave inside
                g.appendChild(elem('path', {
                    d: `M ${x - 8} ${y + 25} q 4 -8 8 0 q 4 8 8 0`,
                    strokeWidth: 1.2
                }));
                // Leads
                g.appendChild(elem('line', { x1: x, y1: y, x2: x, y2: y + 10 }));
                g.appendChild(elem('line', { x1: x, y1: y + 40, x2: x, y2: y + 50 }));

                if (label) this.text(x + 20, y + 20, label, { size: 11, anchor: 'start', bold: true });
                if (value) this.text(x + 20, y + 32, value, { size: 10, anchor: 'start', color: COLORS.value });
            }

            this.nodeRegistry.register(terminals.pin1.x, terminals.pin1.y, null, 'pin');
            this.nodeRegistry.register(terminals.pin2.x, terminals.pin2.y, null, 'pin');

            // Keepout: source body (exclude terminal leads)
            {
                const m = 3;
                this.addKeepout({
                    type: 'rectangle',
                    bounds: { xMin: x - 15 - m, xMax: x + 15 + m, yMin: y + 10 - m, yMax: y + 40 + m },
                    meta: { type: 'acSource', label }
                });
            }

            this.componentGroup.appendChild(g);
            return this;
        }

        // ===== ANNOTATIONS =====

        /**
         * Validate and repair arrow path for proper marker orientation.
         * Returns { x1, y1, x2, y2, valid, repaired, debug }
         *
         * Rules enforced:
         * - Minimum segment length of MIN_ARROW_SEG (20 units)
         * - No duplicate endpoints (dx=0 and dy=0)
         * - For Manhattan arrows, ensures axis-aligned
         */
        static validateArrowPath(x1, y1, x2, y2, options = {}) {
            const MIN_ARROW_SEG = 20;
            const EPS = 0.5;
            const { manhattan = true } = options;

            let dx = x2 - x1;
            let dy = y2 - y1;
            const length = Math.sqrt(dx * dx + dy * dy);

            const debug = {
                original: { x1, y1, x2, y2 },
                dx, dy, length,
                issues: []
            };

            // Check for duplicate points (zero-length segment)
            if (Math.abs(dx) < EPS && Math.abs(dy) < EPS) {
                debug.issues.push('zero-length segment (duplicate points)');
                // Cannot repair - return invalid
                return { x1, y1, x2, y2, valid: false, repaired: false, debug };
            }

            // Check minimum segment length
            let repaired = false;
            if (length < MIN_ARROW_SEG) {
                debug.issues.push(`segment too short: ${length.toFixed(1)} < ${MIN_ARROW_SEG}`);
                // Extend the segment in the same direction
                const scale = MIN_ARROW_SEG / length;
                x2 = x1 + dx * scale;
                y2 = y1 + dy * scale;
                dx = x2 - x1;
                dy = y2 - y1;
                repaired = true;
                debug.repaired = { x2, y2 };
            }

            // For Manhattan arrows, snap to axis-aligned if close
            if (manhattan) {
                const absDx = Math.abs(dx);
                const absDy = Math.abs(dy);
                if (absDx > EPS && absDy > EPS) {
                    // Not axis-aligned - snap to dominant direction
                    if (absDx > absDy) {
                        y2 = y1;  // Make horizontal
                        debug.issues.push('snapped to horizontal');
                    } else {
                        x2 = x1;  // Make vertical
                        debug.issues.push('snapped to vertical');
                    }
                    repaired = true;
                }
            }

            debug.final = { x1, y1, x2, y2 };
            return { x1, y1, x2, y2, valid: true, repaired, debug };
        }

        /**
         * Draw a current arrow annotation.
         *
         * CRITICAL: Arrow is emitted as a single-segment <path> for predictable
         * marker orientation. Uses #arrowAnnoFilled marker with currentColor.
         *
         * @param {number} x1 - Start X (arrow base)
         * @param {number} y1 - Start Y (arrow base)
         * @param {number} x2 - End X (arrow tip)
         * @param {number} y2 - End Y (arrow tip)
         * @param {Object} options - { label, color, debug }
         */
        currentArrow(x1, y1, x2, y2, options = {}) {
            const { label, color = COLORS.signal, debug: showDebug = false } = options;

            // Validate and repair the arrow path
            const validated = Schematic.validateArrowPath(x1, y1, x2, y2, { manhattan: true });

            if (!validated.valid) {
                console.warn('currentArrow: Invalid arrow path', validated.debug);
                return this;
            }

            if (showDebug && validated.repaired) {
                console.log('currentArrow: Path repaired', validated.debug);
            }

            // Use validated coordinates
            const { x1: vx1, y1: vy1, x2: vx2, y2: vy2 } = validated;

            // Emit as single-segment <path> for predictable marker orientation
            // - stroke-linecap: butt ensures stroke doesn't extend past endpoint
            // - marker uses explicit COLORS.signal (yellow) fill
            const arrowPath = elem('path', {
                d: `M ${vx1} ${vy1} L ${vx2} ${vy2}`,
                fill: 'none',
                stroke: color,
                strokeWidth: 2,
                strokeLinecap: 'butt',
                markerEnd: 'url(#arrowAnnoFilled)',
                'data-annotation': 'current-arrow'
            });

            this.componentGroup.appendChild(arrowPath);

            // Add label if specified
            if (label) {
                const mx = (vx1 + vx2) / 2;
                const my = (vy1 + vy2) / 2;
                const dx = vx2 - vx1;
                const dy = vy2 - vy1;
                const isVertical = Math.abs(dy) > Math.abs(dx);
                const labelX = isVertical ? mx + 15 : mx;
                const labelY = isVertical ? my : my - 12;
                this.text(labelX, labelY, label, { size: 11, color, bold: true });
            }

            return this;
        }

        /**
         * Draw a voltage annotation (with + and -)
         */
        voltageAnnotation(x1, y1, x2, y2, options = {}) {
            const { label, color = COLORS.signal } = options;
            const g = group({ stroke: color, strokeWidth: 1, fill: 'none', strokeDasharray: '3,2' });

            g.appendChild(elem('line', { x1, y1, x2, y2 }));

            // Plus at start, minus at end
            this.text(x1 - 8, y1, '+', { size: 12, color });
            this.text(x2 - 8, y2, '-', { size: 14, color });

            if (label) {
                const mx = (x1 + x2) / 2 - 15;
                const my = (y1 + y2) / 2;
                this.text(mx, my, label, { size: 10, color, anchor: 'end' });
            }

            this.componentGroup.appendChild(g);
            return this;
        }

        /**
         * Draw a node label at exact coordinates (no snapping).
         * Places a dot and label text at the specified position.
         */
        nodeLabel(x, y, label, options = {}) {
            const {
                color = COLORS.annotation,
                size = 10,
                dx = 0,
                dy = -12,
                anchor = 'middle'
            } = options;

            // Register at exact coordinates (no snapping!)
            this.nodeRegistry.register(x, y, null, 'label');

            this.dot(x, y, { color: COLORS.wire });
            this.text(x + dx, y + dy, label, { color, size, anchor, bold: true });
            return this;
        }

        /**
         * Finalize the schematic - auto-fit viewBox and run validation.
         * Call this after all components and wires are drawn.
         * @param {Object} options - { autoFit: true, validate: true }
         * @returns {Object} Validation report { warnings: [], errors: [] }
         */
        finalize(options = {}) {
            const {
                autoFit = true,
                validate = true,
                throwOnError = false,  // Set true for fail-fast mode
                annotateErrors = true  // Show red markers on errors
            } = options;
            const report = { warnings: [], errors: [], valid: true };

            // === AUTO-FIT VIEWBOX ===
            if (autoFit && this.boundsAccumulator.isValid()) {
                const vb = this.boundsAccumulator.getViewBox(this.width, this.height);
                this.svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.width} ${vb.height}`);
                // Also update width/height to match computed bounds if larger
                if (vb.width > this.width) {
                    this.svg.setAttribute('width', vb.width);
                }
                if (vb.height > this.height) {
                    this.svg.setAttribute('height', vb.height);
                }
            }

            // === VALIDATE CONNECTIVITY ===
            if (validate) {
                // === IMPLICIT CONNECTIONS (Pins/Junctions sitting on rails) ===
                // Many schematics place symbols (VCC/ground, etc.) directly on a long wire segment
                // without adding an explicit polyline vertex at the symbol coordinate.
                // Visually this is connected, but the registry only counts explicit wire points.
                //
                // Fix: if a registered pin/junction/label lies exactly on a registered wire segment,
                // treat it as connected to that segment's net (and give it a non-zero degree) so we
                // don't emit false "unconnected_pin" errors.
                const segments = Array.from(this.segmentRegistry.segments.values()).map((s) => ({
                    x1: Math.round(s.x1),
                    y1: Math.round(s.y1),
                    x2: Math.round(s.x2),
                    y2: Math.round(s.y2),
                    netId: s.netId || 'default'
                }));

                for (const node of this.nodeRegistry.nodes.values()) {
                    // Only "help" nodes that appear to be dangling ends (degree 0 or 1).
                    if (node.degree >= 2) continue;

                    // Only consider nodes that represent real connection points.
                    // - pin: component terminals
                    // - junction: explicit dots
                    // - label: net labels / external IO markers
                    // - wire: endpoints that should connect into a rail without an explicit vertex
                    if (!node.types.has('pin') && !node.types.has('junction') && !node.types.has('label') && !node.types.has('wire')) continue;

                    for (const seg of segments) {
                        // Skip degenerate segments
                        if (seg.x1 === seg.x2 && seg.y1 === seg.y2) continue;

                        // Only treat as an implicit connection when the node lies on the *interior*
                        // of a segment. If it's already an endpoint, degree accounting already handled it.
                        const isEndpoint =
                            (node.x === seg.x1 && node.y === seg.y1) ||
                            (node.x === seg.x2 && node.y === seg.y2);
                        if (isEndpoint) continue;

                        // Horizontal segment
                        if (seg.y1 === seg.y2) {
                            if (node.y !== seg.y1) continue;
                            const minX = Math.min(seg.x1, seg.x2);
                            const maxX = Math.max(seg.x1, seg.x2);
                            if (node.x < minX || node.x > maxX) continue;
                            // Vertical segment
                        } else if (seg.x1 === seg.x2) {
                            if (node.x !== seg.x1) continue;
                            const minY = Math.min(seg.y1, seg.y2);
                            const maxY = Math.max(seg.y1, seg.y2);
                            if (node.y < minY || node.y > maxY) continue;
                        } else {
                            continue;
                        }

                        node.nets.add(seg.netId);
                        // Splitting a straight segment at this point would create two segment endpoints here.
                        node.degree += 2;
                        break;
                    }
                }

                // Check for floating labels (nodeLabel dots placed off-net).
                // If you want a "free" annotation, use text(); nodeLabel() implies an electrical node.
                for (const node of this.nodeRegistry.nodes.values()) {
                    if (!node.types.has('label')) continue;
                    if (node.types.has('pin')) continue; // supply symbols may legitimately be standalone
                    if (node.degree !== 0) continue;
                    report.warnings.push({
                        type: 'floating_label',
                        message: `Label node at (${node.x}, ${node.y}) is not connected to any wire`,
                        position: { x: node.x, y: node.y }
                    });
                }

                // Check for floating nodes (degree 1 that aren't labeled pins)
                for (const [key, node] of this.nodeRegistry.nodes) {
                    if (node.degree === 1 && !node.types.has('pin') && !node.types.has('label')) {
                        report.warnings.push({
                            type: 'floating_node',
                            message: `Node at (${node.x}, ${node.y}) has degree 1 - may be floating`,
                            position: { x: node.x, y: node.y }
                        });
                    }
                }

                // Check for unconnected component pins
                for (const [key, node] of this.nodeRegistry.nodes) {
                    // Allow explicitly labeled pins to be "external" nodes (inputs/outputs) without wires.
                    if (node.types.has('pin') && node.degree === 0 && !node.types.has('label')) {
                        report.errors.push({
                            type: 'unconnected_pin',
                            message: `Component pin at (${node.x}, ${node.y}) has no wire connections`,
                            position: { x: node.x, y: node.y }
                        });
                    }
                }

                // Check for node-level shorts (multiple nets on same node without NetTie)
                for (const [key, node] of this.nodeRegistry.nodes) {
                    if (node.nets.size > 1 && !node.types.has('nettie')) {
                        report.errors.push({
                            type: 'node_short',
                            message: `Node at (${node.x}, ${node.y}) has multiple nets: ${Array.from(node.nets).join(', ')}`,
                            position: { x: node.x, y: node.y }
                        });
                    }
                }

                // Check for wires crossing through component bodies (keepout zones).
                // This catches "looks disconnected" visuals caused by routing rails through symbols.
                if (this.keepouts && this.keepouts.length > 0) {
                    const seen = new Set();
                    let keepoutIndex = 0;
                    for (const [segKey, seg] of this.segmentRegistry.segments) {
                        // Skip degenerate segments
                        if (Math.round(seg.x1) === Math.round(seg.x2) && Math.round(seg.y1) === Math.round(seg.y2)) continue;

                        keepoutIndex = 0;
                        for (const keepout of this.keepouts) {
                            const vKey = `${segKey}|${keepoutIndex++}`;
                            if (seen.has(vKey)) continue;

                            if (Schematic.wireViolatesKeepout(seg.x1, seg.y1, seg.x2, seg.y2, keepout)) {
                                seen.add(vKey);
                                const mx = (seg.x1 + seg.x2) / 2;
                                const my = (seg.y1 + seg.y2) / 2;
                                const meta = keepout.meta || {};
                                const name = meta.label ? `${meta.type || 'component'} ${meta.label}` : (meta.type || 'component');
                                report.errors.push({
                                    type: 'keepout_violation',
                                    message: `Wire segment (${seg.x1}, ${seg.y1})-(${seg.x2}, ${seg.y2}) crosses ${name} body`,
                                    position: { x: mx, y: my }
                                });
                            }
                        }
                    }
                }

                // Text overlap checks (labels vs wires/keepouts/pins/junctions).
                if (this.textBounds && this.textBounds.length > 0) {
                    const textClearance = 0.5 * GRID;
                    const expandRect = (rect, margin) => ({
                        xMin: rect.xMin - margin,
                        xMax: rect.xMax + margin,
                        yMin: rect.yMin - margin,
                        yMax: rect.yMax + margin
                    });
                    const rectOverlaps = (a, b) => !(a.xMax <= b.xMin || b.xMax <= a.xMin || a.yMax <= b.yMin || b.yMax <= a.yMin);
                    const segIntersectsRect = (seg, rect) => {
                        const x1 = seg.x1, y1 = seg.y1, x2 = seg.x2, y2 = seg.y2;
                        if (x1 === x2) {
                            const minY = Math.min(y1, y2);
                            const maxY = Math.max(y1, y2);
                            return x1 >= rect.xMin && x1 <= rect.xMax && maxY >= rect.yMin && minY <= rect.yMax;
                        }
                        if (y1 === y2) {
                            const minX = Math.min(x1, x2);
                            const maxX = Math.max(x1, x2);
                            return y1 >= rect.yMin && y1 <= rect.yMax && maxX >= rect.xMin && minX <= rect.xMax;
                        }
                        const segRect = {
                            xMin: Math.min(x1, x2),
                            xMax: Math.max(x1, x2),
                            yMin: Math.min(y1, y2),
                            yMax: Math.max(y1, y2)
                        };
                        return rectOverlaps(segRect, rect);
                    };

                    const textSeen = new Set();
                    this.textBounds.forEach((tb, idx) => {
                        if (tb.skipValidation) return;
                        const expanded = expandRect(tb, textClearance);
                        const textKey = `${tb.text}:${idx}`;

                        // Text vs keepouts
                        if (this.keepouts && this.keepouts.length > 0) {
                            for (const keepout of this.keepouts) {
                                if (!keepout || !keepout.bounds) continue;
                                if (rectOverlaps(expanded, keepout.bounds)) {
                                    if (!textSeen.has(`keepout:${textKey}`)) {
                                        textSeen.add(`keepout:${textKey}`);
                                        report.errors.push({
                                            type: 'text_overlap_keepout',
                                            message: `Text "${tb.text}" overlaps component keepout`,
                                            position: {
                                                x: (tb.xMin + tb.xMax) / 2,
                                                y: (tb.yMin + tb.yMax) / 2
                                            }
                                        });
                                    }
                                    break;
                                }
                            }
                        }

                        // Text vs wires
                        for (const seg of this.segmentRegistry.segments.values()) {
                            if (segIntersectsRect(seg, expanded)) {
                                if (!textSeen.has(`wire:${textKey}`)) {
                                    textSeen.add(`wire:${textKey}`);
                                    report.errors.push({
                                        type: 'text_overlap_wire',
                                        message: `Text "${tb.text}" overlaps a wire segment`,
                                        position: {
                                            x: (tb.xMin + tb.xMax) / 2,
                                            y: (tb.yMin + tb.yMax) / 2
                                        }
                                    });
                                }
                                break;
                            }
                        }

                        // Text vs pins/junctions
                        for (const node of this.nodeRegistry.nodes.values()) {
                            if (!node.types.has('pin') && !node.types.has('junction')) continue;
                            if (node.x >= expanded.xMin && node.x <= expanded.xMax && node.y >= expanded.yMin && node.y <= expanded.yMax) {
                                if (!textSeen.has(`node:${textKey}`)) {
                                    textSeen.add(`node:${textKey}`);
                                    report.errors.push({
                                        type: 'text_overlap_node',
                                        message: `Text "${tb.text}" overlaps a pin/junction`,
                                        position: { x: node.x, y: node.y }
                                    });
                                }
                                break;
                            }
                        }
                    });

                    // Text vs text (readability warning)
                    for (let i = 0; i < this.textBounds.length; i++) {
                        const a = this.textBounds[i];
                        if (a.skipValidation) continue;
                        for (let j = i + 1; j < this.textBounds.length; j++) {
                            const b = this.textBounds[j];
                            if (b.skipValidation) continue;
                            if (rectOverlaps(a, b)) {
                                report.warnings.push({
                                    type: 'text_overlap',
                                    message: `Text "${a.text}" overlaps "${b.text}"`,
                                    position: {
                                        x: (Math.max(a.xMin, b.xMin) + Math.min(a.xMax, b.xMax)) / 2,
                                        y: (Math.max(a.yMin, b.yMin) + Math.min(a.yMax, b.yMax)) / 2
                                    }
                                });
                            }
                        }
                    }
                }

                // Basic component overlap + clearance check (keepout vs keepout).
                // Enforce minimum body-to-body clearance (>= 2 grid units).
                if (this.keepouts && this.keepouts.length > 1) {
                    const clearance = 2 * GRID;
                    const expandBounds = (bounds, margin) => ({
                        xMin: bounds.xMin - margin,
                        xMax: bounds.xMax + margin,
                        yMin: bounds.yMin - margin,
                        yMax: bounds.yMax + margin
                    });
                    for (let i = 0; i < this.keepouts.length; i++) {
                        const a = this.keepouts[i];
                        if (!a || !a.bounds) continue;
                        for (let j = i + 1; j < this.keepouts.length; j++) {
                            const b = this.keepouts[j];
                            if (!b || !b.bounds) continue;

                            const ax1 = a.bounds.xMin;
                            const ax2 = a.bounds.xMax;
                            const ay1 = a.bounds.yMin;
                            const ay2 = a.bounds.yMax;
                            const bx1 = b.bounds.xMin;
                            const bx2 = b.bounds.xMax;
                            const by1 = b.bounds.yMin;
                            const by2 = b.bounds.yMax;

                            const overlaps = !(ax2 <= bx1 || bx2 <= ax1 || ay2 <= by1 || by2 <= ay1);
                            const aExpanded = expandBounds(a.bounds, clearance / 2);
                            const bExpanded = expandBounds(b.bounds, clearance / 2);
                            const clearanceOverlap = !(aExpanded.xMax <= bExpanded.xMin || bExpanded.xMax <= aExpanded.xMin ||
                                aExpanded.yMax <= bExpanded.yMin || bExpanded.yMax <= aExpanded.yMin);
                            if (!clearanceOverlap) continue;

                            const overlapX1 = Math.max(aExpanded.xMin, bExpanded.xMin);
                            const overlapX2 = Math.min(aExpanded.xMax, bExpanded.xMax);
                            const overlapY1 = Math.max(aExpanded.yMin, bExpanded.yMin);
                            const overlapY2 = Math.min(aExpanded.yMax, bExpanded.yMax);
                            const cx = (overlapX1 + overlapX2) / 2;
                            const cy = (overlapY1 + overlapY2) / 2;

                            const aLabel = a.meta && a.meta.label ? ` ${a.meta.label}` : '';
                            const bLabel = b.meta && b.meta.label ? ` ${b.meta.label}` : '';
                            const aType = a.meta && a.meta.type ? a.meta.type : 'component';
                            const bType = b.meta && b.meta.type ? b.meta.type : 'component';
                            const clearanceGu = (clearance / GRID).toFixed(0);
                            const message = overlaps
                                ? `Keepout overlap between ${aType}${aLabel} and ${bType}${bLabel}`
                                : `Keepout clearance < ${clearanceGu} GU between ${aType}${aLabel} and ${bType}${bLabel}`;

                            report.errors.push({
                                type: 'component_overlap',
                                message,
                                position: { x: cx, y: cy }
                            });
                        }
                    }
                }

                // Mark as invalid if there are errors
                if (report.errors.length > 0) {
                    report.valid = false;
                }

                // Log validation results to console
                if (report.warnings.length > 0 || report.errors.length > 0) {
                    console.group('Schematic Validation Report');
                    report.errors.forEach(e => console.error(`[ERROR] ${e.message}`));
                    report.warnings.forEach(w => console.warn(`[WARN] ${w.message}`));
                    console.groupEnd();
                }

                // Annotate errors with red markers in SVG
                if (annotateErrors && report.errors.length > 0) {
                    this._annotateErrors(report.errors);
                }

                // Throw if fail-fast mode enabled
                if (throwOnError && !report.valid) {
                    throw new Error(`Schematic invalid:\n- ${report.errors.map(e => e.message).join('\n- ')}`);
                }
            }

            return report;
        }

        /**
         * Add red error markers to SVG for visual debugging
         */
        _annotateErrors(errors) {
            const SVG_NS = 'http://www.w3.org/2000/svg';
            const g = document.createElementNS(SVG_NS, 'g');
            g.setAttribute('id', 'error-overlay');

            errors.forEach((err, i) => {
                if (err.position) {
                    // Red X marker at error position
                    const size = 8;
                    const x = err.position.x;
                    const y = err.position.y;

                    // Draw X
                    const line1 = document.createElementNS(SVG_NS, 'line');
                    line1.setAttribute('x1', x - size);
                    line1.setAttribute('y1', y - size);
                    line1.setAttribute('x2', x + size);
                    line1.setAttribute('y2', y + size);
                    line1.setAttribute('stroke', '#ff4d4f');
                    line1.setAttribute('stroke-width', '3');
                    g.appendChild(line1);

                    const line2 = document.createElementNS(SVG_NS, 'line');
                    line2.setAttribute('x1', x + size);
                    line2.setAttribute('y1', y - size);
                    line2.setAttribute('x2', x - size);
                    line2.setAttribute('y2', y + size);
                    line2.setAttribute('stroke', '#ff4d4f');
                    line2.setAttribute('stroke-width', '3');
                    g.appendChild(line2);

                    // Red circle around error
                    const circle = document.createElementNS(SVG_NS, 'circle');
                    circle.setAttribute('cx', x);
                    circle.setAttribute('cy', y);
                    circle.setAttribute('r', size + 4);
                    circle.setAttribute('fill', 'none');
                    circle.setAttribute('stroke', '#ff4d4f');
                    circle.setAttribute('stroke-width', '2');
                    g.appendChild(circle);
                }
            });

            // Add error text at top
            if (errors.length > 0) {
                const text = document.createElementNS(SVG_NS, 'text');
                text.setAttribute('x', '10');
                text.setAttribute('y', '15');
                text.setAttribute('font-size', '11');
                text.setAttribute('fill', '#ff4d4f');
                text.setAttribute('font-weight', 'bold');
                text.textContent = `SCHEMATIC ERROR: ${errors.length} issue(s) found`;
                g.appendChild(text);
            }

            this.svg.appendChild(g);
        }

        /**
         * Get debug info about registered nodes.
         * Useful for debugging connectivity issues.
         */
        getNodeInfo() {
            const nodes = [];
            for (const [key, node] of this.nodeRegistry.nodes) {
                nodes.push({
                    position: `(${node.x}, ${node.y})`,
                    degree: node.degree,
                    types: Array.from(node.types),
                    nets: Array.from(node.nets)
                });
            }
            return nodes;
        }
    }

    // ===== PRE-BUILT CIRCUIT GENERATORS =====

    /**
     * ==========================================
     * SCHEMATIC WIRING METHODOLOGY
     * ==========================================
     *
     * Follow these rules to prevent floating wires, gaps, and connection issues:
     *
     * 1. TERMINAL HELPERS - Always use static terminal methods:
     *    - Schematic.npnTerminals(x, y, flip)
     *    - Schematic.pnpTerminals(x, y, flip)
     *    - Schematic.opampTerminals(x, y)
     *    Wire TO and FROM these exact positions, never guess coordinates.
     *
     * 2. NODE = WIRE ENDPOINT - When placing a nodeLabel(x, y, 'label'):
     *    - The wire MUST start or end at exactly (x, y)
     *    - Never place label at x=25 but start wire at x=30
     *
     * 3. COMPONENT TERMINALS - Use named constants, DO THE MATH:
     *    - Horizontal resistor/capacitor: starts at (x, y), ends at (x+50, y)
     *    - Vertical resistor/capacitor: starts at (x, y), ends at (x, y+50)
     *    - Calculate end positions: const rEnd = rStart + 50;
     *    - WRONG: R1 ends at y+65, node at y+75 (10px gap!)
     *    - RIGHT: Use const r1EndY = r1StartY + 50; const nodeY = r1EndY;
     *
     * 4. JUNCTION DOTS - Add sch.dot(x, y) at every:
     *    - T-junction where wires meet
     *    - Wire tapping off a rail
     *    - Multiple components connecting to same node
     *
     * 5. NO OVERLAPPING WIRES - Each wire segment drawn only once:
     *    - Plan rail routing first
     *    - Don't redraw the same segment from different functions
     *
     * 6. ARROW DIRECTION (BJT):
     *    - NPN: Arrow points OUTWARD (away from base) - current flows OUT
     *    - PNP: Arrow points INWARD (toward base) - current flows IN
     *    - Use 4-point kite shape for clear directionality
     *
     * 7. ARROW DIRECTION (MOSFET):
     *    - NMOS: Arrow points INTO channel
     *    - PMOS: Arrow points OUT of channel + bubble on gate
     *
     * 8. DEBUG WITH GRID - Use test page with grid overlay to verify alignment
     *
     * 9. USE NAMED VARIABLES - Avoid magic numbers in positions:
     *    WRONG: sch.resistor(fbX, outRailY + 75, ...);
     *    RIGHT: const r1StartY = outRailY + 10;
     *           sch.resistor(fbX, r1StartY, 'vertical', ...);
     *           const r1EndY = r1StartY + 50;  // Calculate end position!
     *
     * 10. DOTS AT ALL JUNCTIONS - Add sch.dot() where wires meet:
     *    - Where vertical wire meets horizontal rail
     *    - Where component chain meets ground rail
     *    - At every T-junction, even if coordinates match
     *    WRONG: Wire ends at ground rail without dot
     *    RIGHT: sch.dot(fbX, gndY); // Mark the junction explicitly
     *
     * 11. VERIFY COMPONENT IMPLEMENTATIONS - Check all orientations:
     *    - Vertical AND horizontal versions must both exist
     *    - Test each orientation in the test page
     *    - Components like zener, diode must work in both directions
     *
     * 12. ARROW DESIGN - Make arrows LARGE and OBVIOUS:
     *    - Use 10px+ dimensions for arrowheads
     *    - Simple triangle: tip at front, flat back edge
     *    - Tip should clearly stick out in direction of flow
     *    - For BJTs: Arrow is ON the emitter diagonal line
     *
     * 13. LABEL POSITION = COMPONENT START - For input labels with resistors:
     *    - nodeLabel must be placed exactly where the resistor starts
     *    - WRONG: nodeLabel at x=30, resistor starts at x=40 (10px gap!)
     *    - RIGHT: const resStartX = 40;
     *            sch.nodeLabel(resStartX, y, 'V1');  // Label AT resistor start
     *            sch.resistor(resStartX, y, 'horizontal', {...});
     *    - Same for output: wire endpoint = nodeLabel position
     *
     * 14. RESISTOR WIRING - Wires connect to TERMINALS, not through:
     *    - Resistor is 50px. If you place it at y=40, terminals are at y=40 and y=90
     *    - WRONG: Wire from y=80 to y=45 (goes THROUGH resistor body!)
     *    - RIGHT: Wire connects to y=40 (top terminal) or y=90 (bottom terminal)
     *    - Always define: const resEndY = resStartY + 50;
     *    - Then wire FROM resEndY to next component
     *
     * 15. SVG MARKER ARROWS (for current flow annotations):
     *    - Use large marker size: markerWidth/Height >= 16px for visibility
     *    - Use markerUnits: 'userSpaceOnUse' for absolute (not stroke-relative) sizing
     *    - Use high-contrast color (yellow/signal) with black outline for contrast
     *    - Use ASYMMETRIC shape (notched back) so direction is obvious
     *    - orient: 'auto' rotates arrow with line direction
     *    - Arrow points from (x1,y1) to (x2,y2) - end point is tip
     *    - For downward current: y2 > y1 (arrow points down)
     *    - For rightward current: x2 > x1 (arrow points right)
     *    - Place arrow NEXT TO wire, not ON it (offset by 10-15px)
     *    - Set stroke explicitly on line element (not just group) for marker to work
     *
     * 16. SVG ATTRIBUTE NAMING - elem() auto-converts camelCase to kebab-case:
     *    - markerEnd → marker-end (correct in SVG)
     *    - strokeWidth → stroke-width (correct in SVG)
     *    - markerUnits → marker-units (correct in SVG)
     *    - This conversion happens automatically in the elem() function
     *
     * 17. NODE LABELS MUST HAVE WIRES REACHING THEM:
     *    - nodeLabel position must be at wire endpoint, not floating in space
     *    - WRONG: Capacitor ends at x+70, nodeLabel at x+80 (10px gap - floating!)
     *    - RIGHT: Define output position, wire to it, place label at same position:
     *            const voutX = capEndX + 15;
     *            sch.wire([[capEndX, y], [voutX, y]]);
     *            sch.nodeLabel(voutX, y, 'Vout');
     *    - This prevents "floating" labels that appear disconnected
     *
     * 18. OP-AMP INPUTS AT SAME X - Route with different offsets:
     *    - Both op-amp inputs are at same X (left side of triangle)
     *    - If wiring both from above/below, vertical wires would overlap
     *    - Use DIFFERENT X offsets for each input wire's vertical segment:
     *            const invWireX = op.invInput.x - 10;   // Closer to input
     *            const nonInvWireX = op.nonInvInput.x - 25;  // Further left
     *    - Route: horizontal → vertical (at offset X) → horizontal to actual input
     *    - This creates visual separation between the two connections
     *
     * 19. EXPLICIT INPUT TERMINAL DOTS:
     *    - Add sch.dot() at actual op-amp/transistor input terminals
     *    - Makes connection points crystal clear, especially when:
     *      - Multiple wires approach same component
     *      - Wires route through complex paths
     *    - Example: sch.dot(op.invInput.x, op.invInput.y);
     *
     * Pattern for resistor dividers with ground connection:
     *    const r1Start = railY + 10;
     *    sch.wire([[fbX, railY], [fbX, r1Start]]);
     *    sch.resistor(fbX, r1Start, 'vertical', { label: 'R1' });
     *    const r1End = r1Start + 50;  // CALCULATE end position
     *    sch.dot(fbX, r1End);  // Node between R1 and R2
     *    const r2Start = r1End + 10;
     *    sch.wire([[fbX, r1End], [fbX, r2Start]]);
     *    sch.resistor(fbX, r2Start, 'vertical', { label: 'R2' });
     *    const r2End = r2Start + 50;  // CALCULATE end position
     *    sch.wire([[fbX, r2End], [fbX, gndY]]);
     *    sch.dot(fbX, gndY);  // DOT where wire meets ground rail
     *
     * 20. NO WIRES THROUGH RESISTORS/COMPONENTS:
     *    - Wires must ONLY connect to component terminals, never pass through bodies
     *    - WRONG: Wire from A to B passing through resistor R1's body (visual overlap)
     *    - RIGHT: Route wire AROUND component using 90° turns:
     *            const bypassX = componentX + 30;  // Right of component
     *            sch.wire([[startX, startY], [bypassX, startY]]);  // Go right
     *            sch.wire([[bypassX, startY], [bypassX, endY]]);   // Go down (around)
     *            sch.wire([[bypassX, endY], [endX, endY]]);        // Continue to destination
     *    - Offset components horizontally/vertically if needed to create routing space
     *    - Applies to all components: resistors, capacitors, transistors, diodes
     *    - Use Manhattan routing (only horizontal and vertical segments)
     *
     * ==========================================
     */

    /**
     * Common Emitter Amplifier
     */
    function ceAmplifier(container, options = {}) {
        const {
            rc = '4.7k', re = '1k', r1 = '47k', r2 = '10k',
            c1 = '10µ', c2 = '10µ', ce = '100µ',
            width = 400, height = 340
        } = options;

        const sch = new Schematic(container, { width, height });

        // Layout constants
        const vccY = 30;
        const qY = 160;      // Transistor center Y
        const qX = 200;      // Transistor X (base bar position)
        const gndY = 310;

        // Get transistor terminal positions FIRST
        const q1 = Schematic.npnTerminals(qX, qY, false);
        // q1.collector = {x: 220, y: 130}
        // q1.emitter = {x: 220, y: 190}
        // q1.base = {x: 185, y: 160}

        // === VCC RAIL ===
        sch.vcc(q1.collector.x, vccY, { label: 'VCC' });

        // === RC (collector resistor) ===
        // Resistor is 50px tall. Top at vccY+5, bottom at vccY+55
        const rcTopY = vccY + 5;
        const rcBotY = rcTopY + 50;
        sch.wire([[q1.collector.x, vccY], [q1.collector.x, rcTopY]]);
        sch.resistor(q1.collector.x, rcTopY, 'vertical', { label: 'RC' });
        sch.text(q1.collector.x + 55, rcTopY + 10, rc, { size: 10, color: COLORS.value });
        // Wire from RC bottom to collector terminal
        sch.wire([[q1.collector.x, rcBotY], [q1.collector.x, q1.collector.y]]);
        // Output node is at RC bottom
        const outNodeY = rcBotY;

        // === TRANSISTOR ===
        sch.npn(qX, qY, { label: 'Q1', circle: false });

        // === RE (emitter resistor) ===
        // Starts just below emitter terminal
        const reTopY = q1.emitter.y + 10;
        const reBotY = reTopY + 50;
        sch.wire([[q1.emitter.x, q1.emitter.y], [q1.emitter.x, reTopY]]);
        sch.resistor(q1.emitter.x, reTopY, 'vertical');
        sch.text(q1.emitter.x + 80, reTopY + 8, 'RE', { size: 11, bold: true, anchor: 'start' });
        sch.text(q1.emitter.x + 80, reTopY + 22, re, { size: 10, color: COLORS.value, anchor: 'start' });
        // Wire from RE bottom to ground
        sch.wire([[q1.emitter.x, reBotY], [q1.emitter.x, gndY]]);
        sch.ground(q1.emitter.x, gndY);

        // === BIAS DIVIDER ===
        const biasX = 90;
        // R1: from VCC rail to bias node
        const r1TopY = vccY + 5;
        const r1BotY = r1TopY + 50;
        sch.wire([[biasX, vccY], [q1.collector.x, vccY]]);  // VCC rail
        sch.wire([[biasX, vccY], [biasX, r1TopY]]);
        sch.resistor(biasX, r1TopY, 'vertical', { label: 'R1', value: r1 });

        // Bias node (between R1 and R2)
        const biasNodeY = r1BotY;
        sch.dot(biasX, biasNodeY);

        // R2: from bias node to ground
        const r2TopY = biasNodeY + 5;
        const r2BotY = r2TopY + 50;
        sch.wire([[biasX, biasNodeY], [biasX, r2TopY]]);
        sch.resistor(biasX, r2TopY, 'vertical', { label: 'R2', value: r2 });
        sch.wire([[biasX, r2BotY], [biasX, gndY]]);
        // Ground rail connection
        sch.wire([[biasX, gndY], [q1.emitter.x, gndY]]);

        // === BIAS TO BASE CONNECTION ===
        sch.wire([[biasX, biasNodeY], [q1.base.x, biasNodeY]]);
        sch.wire([[q1.base.x, biasNodeY], [q1.base.x, q1.base.y]]);

        // === INPUT COUPLING CAPACITOR ===
        const vinX = 15;
        const c1StartX = vinX + 10;
        const c1EndX = c1StartX + 50;
        sch.nodeLabel(vinX, biasNodeY, 'Vin');
        sch.wire([[vinX, biasNodeY], [c1StartX, biasNodeY]]);
        sch.capacitor(c1StartX, biasNodeY, 'horizontal', { label: 'C1', value: c1 });
        sch.wire([[c1EndX, biasNodeY], [biasX, biasNodeY]]);

        // === OUTPUT COUPLING CAPACITOR ===
        sch.dot(q1.collector.x, outNodeY);
        const c2StartX = q1.collector.x + 10;
        const c2EndX = c2StartX + 50;
        sch.wire([[q1.collector.x, outNodeY], [c2StartX, outNodeY]]);
        sch.capacitor(c2StartX, outNodeY, 'horizontal', { label: 'C2', value: c2 });
        const voutX = c2EndX + 10;
        sch.wire([[c2EndX, outNodeY], [voutX, outNodeY]]);
        sch.nodeLabel(voutX, outNodeY, 'Vout');

        // === BYPASS CAPACITOR (optional) ===
        if (ce) {
            const ceX = q1.emitter.x + 45;
            // Connect from emitter node (just below emitter terminal)
            const ceNodeY = q1.emitter.y + 10;
            sch.dot(q1.emitter.x, ceNodeY);
            sch.wire([[q1.emitter.x, ceNodeY], [ceX, ceNodeY]]);
            sch.capacitorPol(ceX, ceNodeY, 'vertical', { label: 'CE', value: ce });
            // CE bottom to ground
            sch.wire([[ceX, ceNodeY + 50], [ceX, gndY]]);
            sch.wire([[ceX, gndY], [q1.emitter.x, gndY]]);
        }

        sch.finalize();
        return sch;
    }

    /**
     * Two-stage CE-CE Amplifier (from Art of Electronics)
     */
    function twoStageCE(container, options = {}) {
        const {
            width = 600, height = 400,
            rc1 = '10k', re1 = '2.2k', rc2 = '10k', re2 = '2.2k'
        } = options;

        const sch = new Schematic(container, { width, height });

        // Title
        sch.text(300, 12, 'Two-Stage CE Amplifier (Art of Electronics Ch.2)',
            { size: 14, bold: true });

        // Layout constants
        const vccY = 45;
        const gndY = 320;
        const q1X = 120;   // Stage 1 transistor position
        const q2X = 380;   // Stage 2 transistor position
        const qY = 170;    // Both transistors at same Y

        // Get terminal positions
        const q1 = Schematic.npnTerminals(q1X, qY, false);
        const q2 = Schematic.npnTerminals(q2X, qY, false);

        // VCC rail
        sch.vcc(250, vccY, { label: 'VCC = 12V' });
        sch.wire([[q1.collector.x, vccY], [q2.collector.x, vccY]]);

        // Stage 1: RC1 (collector resistor)
        const rc1Top = vccY + 10;
        sch.resistor(q1.collector.x, rc1Top, 'vertical', { label: 'RC1', value: rc1 });
        sch.wire([[q1.collector.x, vccY], [q1.collector.x, rc1Top]]);
        sch.wire([[q1.collector.x, rc1Top + 50], [q1.collector.x, q1.collector.y]]);
        const q1CollectorNode = rc1Top + 50;

        // Stage 1: Q1 transistor
        sch.npn(q1X, qY, { label: 'Q1', circle: false });

        // Stage 1: RE1 (emitter resistor)
        const re1Top = q1.emitter.y + 10;
        sch.resistor(q1.emitter.x, re1Top, 'vertical', { label: 'RE1', value: re1 });
        sch.wire([[q1.emitter.x, q1.emitter.y], [q1.emitter.x, re1Top]]);
        sch.wire([[q1.emitter.x, re1Top + 50], [q1.emitter.x, gndY]]);

        // Stage 2: RC2 (collector resistor)
        sch.resistor(q2.collector.x, rc1Top, 'vertical', { label: 'RC2', value: rc2 });
        sch.wire([[q2.collector.x, vccY], [q2.collector.x, rc1Top]]);
        sch.wire([[q2.collector.x, rc1Top + 50], [q2.collector.x, q2.collector.y]]);
        const q2CollectorNode = rc1Top + 50;

        // Stage 2: Q2 transistor
        sch.npn(q2X, qY, { label: 'Q2', circle: false });

        // Stage 2: RE2 (emitter resistor)
        sch.resistor(q2.emitter.x, re1Top, 'vertical', { label: 'RE2', value: re2 });
        sch.wire([[q2.emitter.x, q2.emitter.y], [q2.emitter.x, re1Top]]);
        sch.wire([[q2.emitter.x, re1Top + 50], [q2.emitter.x, gndY]]);

        // Interstage coupling capacitor (Q1 collector to Q2 base)
        const couplingY = q1CollectorNode;
        sch.dot(q1.collector.x, couplingY);
        sch.capacitor(q1.collector.x + 30, couplingY, 'horizontal', { label: 'C', value: '1µ' });
        sch.wire([[q1.collector.x, couplingY], [q1.collector.x + 30, couplingY]]);

        // Bias resistor RB for Q2 (from VCC)
        const rbX = (q1.collector.x + q2.base.x) / 2 + 30;
        sch.resistor(rbX, vccY + 15, 'vertical', { label: 'RB', value: '100k' });
        sch.wire([[rbX, vccY], [rbX, vccY + 15]]);

        // RB bottom connects to Q2 base node
        const biasNodeY = vccY + 65;
        sch.wire([[rbX, biasNodeY], [rbX, q2.base.y]]);
        sch.wire([[rbX, q2.base.y], [q2.base.x, q2.base.y]]);
        sch.dot(rbX, q2.base.y);

        // Coupling capacitor output to Q2 base via the bias node
        sch.wire([[q1.collector.x + 80, couplingY], [rbX, couplingY]]);
        sch.wire([[rbX, couplingY], [rbX, q2.base.y]]);

        // Input - wire connects from label (no gap!)
        const vinX = q1.base.x - 50;
        sch.nodeLabel(vinX, q1.base.y, 'Vin');
        sch.wire([[vinX, q1.base.y], [q1.base.x, q1.base.y]]);

        // Output capacitor
        sch.dot(q2.collector.x, q2CollectorNode);
        sch.capacitor(q2.collector.x + 30, q2CollectorNode, 'horizontal', { label: 'Cout', value: '10µ' });
        sch.wire([[q2.collector.x, q2CollectorNode], [q2.collector.x + 30, q2CollectorNode]]);
        // Wire from capacitor output (x+80) to Vout label
        const coutEndX = q2.collector.x + 80;
        const voutX = q2.collector.x + 95;
        sch.wire([[coutEndX, q2CollectorNode], [voutX, q2CollectorNode]]);
        sch.nodeLabel(voutX, q2CollectorNode, 'Vout');

        // Ground rail
        sch.wire([[q1.emitter.x, gndY], [q2.emitter.x, gndY]]);
        sch.ground((q1.emitter.x + q2.emitter.x) / 2, gndY);

        // Annotations
        sch.text(250, gndY + 35, 'Gain ≈ (RC1/RE1) × (RC2/RE2)', { size: 11, color: COLORS.annotation });

        sch.finalize();
        return sch;
    }

    /**
     * Non-inverting Op-Amp Amplifier
     */
    function nonInvertingAmp(container, options = {}) {
        const { rf = '10k', rin = '1k', width = 350, height = 250 } = options;

        const sch = new Schematic(container, { width, height });

        // Op-amp position
        const opX = 120, opY = 120;
        const op = Schematic.opampTerminals(opX, opY);
        sch.opamp(opX, opY);

        // Input to + terminal (non-inverting) - wire connects from label
        const vinX = 40;
        sch.nodeLabel(vinX, op.nonInvInput.y, 'Vin');
        sch.wire([[vinX, op.nonInvInput.y], [op.nonInvInput.x, op.nonInvInput.y]]);

        // Output - wire connects to label
        const outX = op.output.x + 60;
        sch.wire([[op.output.x, op.output.y], [outX, op.output.y]]);
        sch.dot(outX, op.output.y);
        sch.nodeLabel(outX, op.output.y, 'Vout');

        // Feedback network (Rf and Rin voltage divider)
        // Junction point between Rf and Rin
        const fbJunctionX = op.invInput.x - 20;
        const fbJunctionY = op.output.y + 60;

        // Wire from inverting input down to junction
        sch.wire([[op.invInput.x, op.invInput.y], [fbJunctionX, op.invInput.y]]);
        sch.wire([[fbJunctionX, op.invInput.y], [fbJunctionX, fbJunctionY]]);
        sch.dot(fbJunctionX, fbJunctionY);

        // Rf: from junction to output
        sch.resistor(fbJunctionX + 20, fbJunctionY, 'horizontal');
        sch.text(fbJunctionX - 35, fbJunctionY + 25, 'Rf', { size: 11, bold: true, anchor: 'end' });
        sch.text(fbJunctionX - 35, fbJunctionY + 38, rf, { size: 10, color: COLORS.value, anchor: 'end' });
        sch.wire([[fbJunctionX, fbJunctionY], [fbJunctionX + 20, fbJunctionY]]);
        sch.wire([[fbJunctionX + 70, fbJunctionY], [outX, fbJunctionY], [outX, op.output.y]]);

        // Rin: from junction to ground
        sch.resistor(fbJunctionX, fbJunctionY + 10, 'vertical', { label: 'Rin', value: rin });
        sch.wire([[fbJunctionX, fbJunctionY], [fbJunctionX, fbJunctionY + 10]]);
        sch.wire([[fbJunctionX, fbJunctionY + 60], [fbJunctionX, fbJunctionY + 80]]);
        sch.ground(fbJunctionX, fbJunctionY + 80);

        // Formula
        sch.text(175, 25, `Gain = 1 + Rf/Rin = 1 + ${rf}/${rin}`,
            { size: 11, color: COLORS.annotation });

        sch.finalize();
        return sch;
    }

    /**
     * Inverting Op-Amp Amplifier
     */
    function invertingAmp(container, options = {}) {
        const { rf = '10k', rin = '1k', width = 380, height = 250 } = options;

        const sch = new Schematic(container, { width, height });

        // Op-amp position
        const opX = 160, opY = 120;
        const op = Schematic.opampTerminals(opX, opY);
        sch.opamp(opX, opY);

        // Input resistor Rin (to inverting input) - wire connects from label
        const rinStartX = 50;
        const vinX = 25;
        sch.nodeLabel(vinX, op.invInput.y, 'Vin');
        sch.wire([[vinX, op.invInput.y], [rinStartX, op.invInput.y]]);  // Vin to Rin
        sch.resistor(rinStartX, op.invInput.y, 'horizontal', { label: 'Rin' });
        sch.text(rinStartX + 25, op.invInput.y + 30, rin, { size: 10, color: COLORS.value });
        sch.wire([[rinStartX + 50, op.invInput.y], [op.invInput.x, op.invInput.y]]);  // Rin to inv input
        sch.dot(op.invInput.x, op.invInput.y);

        // Feedback resistor Rf (above, parallel to Rin)
        const rfY = op.invInput.y - 50;
        sch.resistor(op.invInput.x, rfY, 'horizontal');
        sch.text(op.invInput.x + 25, rfY - 30, 'Rf', { size: 11, bold: true });
        sch.text(op.invInput.x + 25, rfY - 44, rf, { size: 10, color: COLORS.value });
        sch.wire([[op.invInput.x, op.invInput.y], [op.invInput.x, rfY]]);

        // Rf connects to output
        const outX = op.output.x + 50;
        sch.wire([[op.invInput.x + 50, rfY], [outX, rfY], [outX, op.output.y]]);
        sch.dot(outX, op.output.y);

        // Non-inverting input to ground
        const gndX = op.nonInvInput.x - 20;
        sch.wire([[op.nonInvInput.x, op.nonInvInput.y], [gndX, op.nonInvInput.y]]);
        sch.wire([[gndX, op.nonInvInput.y], [gndX, op.nonInvInput.y + 30]]);
        sch.ground(gndX, op.nonInvInput.y + 30);

        // Output - wire connects to label
        const voutX = outX + 25;
        sch.wire([[op.output.x, op.output.y], [voutX, op.output.y]]);
        sch.nodeLabel(voutX, op.output.y, 'Vout');

        // Virtual ground annotation at the inverting input node
        sch.text(op.invInput.x - 30, op.invInput.y - 28, 'V≈0', { size: 9, color: COLORS.annotation, anchor: 'end' });

        // Formula
        sch.text(200, 210, `Gain = -Rf/Rin = -${rf}/${rin}`,
            { size: 11, color: COLORS.annotation });

        sch.finalize();
        return sch;
    }

    /**
     * Differential Pair with Active Load
     * Uses terminal-first methodology per SCHEMATIC_METHODOLOGY.md v2.2
     */
    function diffPairActiveLoad(container, options = {}) {
        const { width = 500, height = 420 } = options;

        const sch = new Schematic(container, { width, height });

        const isCompact = width <= 380 || height <= 320;

        // Layout (responsive to small vs large embeds)
        const centerX = Math.round(width / 2);
        const deltaX = Math.round(width * 0.2);
        const leftX = centerX - deltaX;
        const rightX = centerX + deltaX;

        const vccY = Math.round(height * 0.12);
        const pnpY = vccY + 50;                 // PNP center
        const npnY = pnpY + Math.round(height * 0.29); // NPN center

        // Title (skip for compact embeds where an outer caption already exists)
        if (!isCompact) {
            sch.text(centerX, 20, 'Differential Pair with Active Load', { size: 14, bold: true });
        }

        // === GET ALL TERMINAL POSITIONS FIRST (before drawing any components) ===
        const q3 = Schematic.pnpTerminals(leftX, pnpY, false);   // Q3 - left PNP (not flipped)
        const q4 = Schematic.pnpTerminals(rightX, pnpY, true);   // Q4 - right PNP (flipped)
        const q1 = Schematic.npnTerminals(leftX, npnY, false);   // Q1 - left NPN (not flipped)
        const q2 = Schematic.npnTerminals(rightX, npnY, true);   // Q2 - right NPN (flipped)

        // === VCC RAIL ===
        sch.vcc(centerX, vccY, { label: 'VCC' });

        // === PNP CURRENT MIRROR (Active Load) ===
        // Draw transistors
        sch.pnp(leftX, pnpY, { label: 'Q3', circle: false });
        sch.pnp(rightX, pnpY, { label: 'Q4', circle: false, flip: true });

        // VCC to PNP emitters - horizontal rail at vccY+5
        const emitterRailY = vccY + 5;
        sch.wire([[centerX, vccY], [centerX, emitterRailY]]);
        sch.wire([[q3.emitter.x, emitterRailY], [q4.emitter.x, emitterRailY]]);
        sch.wire([[q3.emitter.x, emitterRailY], [q3.emitter.x, q3.emitter.y]]);
        sch.wire([[q4.emitter.x, emitterRailY], [q4.emitter.x, q4.emitter.y]]);
        sch.dot(centerX, emitterRailY);
        sch.dot(q3.emitter.x, emitterRailY);
        sch.dot(q4.emitter.x, emitterRailY);

        // Current mirror base connection (Q3 base-collector tied, drives Q4 base)
        // Wire from Q3 base goes left, down to collector level, then to collector
        const mirrorWireX = q3.base.x - 10;
        sch.wire([[q3.base.x, q3.base.y], [mirrorWireX, q3.base.y]]);
        sch.wire([[mirrorWireX, q3.base.y], [mirrorWireX, q3.collector.y]]);
        sch.wire([[mirrorWireX, q3.collector.y], [q3.collector.x, q3.collector.y]]);
        sch.dot(mirrorWireX, q3.base.y);

        // Connect Q3 base to Q4 base (go up, across, down)
        const mirrorTopY = pnpY - 40;
        const q4WireX = q4.base.x + 10;
        sch.wire([[mirrorWireX, q3.base.y], [mirrorWireX, mirrorTopY]]);
        sch.wire([[mirrorWireX, mirrorTopY], [q4WireX, mirrorTopY]]);
        sch.wire([[q4WireX, mirrorTopY], [q4WireX, q4.base.y]]);
        sch.wire([[q4WireX, q4.base.y], [q4.base.x, q4.base.y]]);

        // === NPN DIFFERENTIAL PAIR ===
        // Draw transistors
        sch.npn(leftX, npnY, { label: 'Q1', circle: false });
        sch.npn(rightX, npnY, { label: 'Q2', circle: false, flip: true });

        // Connect PNP collectors to NPN collectors
        // Calculate the midpoint Y for the connection nodes
        const nodeLeftY = Math.round((q3.collector.y + q1.collector.y) / 2);
        const nodeRightY = Math.round((q4.collector.y + q2.collector.y) / 2);

        // Left side: Q3 collector down to node, Q1 collector up to node
        sch.wire([[q3.collector.x, q3.collector.y], [q3.collector.x, nodeLeftY]]);
        sch.wire([[q1.collector.x, q1.collector.y], [q1.collector.x, nodeLeftY]]);
        sch.dot(q1.collector.x, nodeLeftY);

        // Right side: Q4 collector down to node, Q2 collector up to node
        sch.wire([[q4.collector.x, q4.collector.y], [q4.collector.x, nodeRightY]]);
        sch.wire([[q2.collector.x, q2.collector.y], [q2.collector.x, nodeRightY]]);
        sch.dot(q2.collector.x, nodeRightY);

        // === TAIL CURRENT SOURCE ===
        // NOTE: currentSource(x, y, 'vertical') uses y as the TOP lead coordinate.
        const tailTopY = Math.min(height - 70, npnY + Math.round(height * 0.18));
        sch.currentSource(centerX, tailTopY, 'vertical', { label: 'IEE', value: '1mA' });

        // NPN emitters to tail current source (top lead)
        const emitterNodeY = tailTopY;
        sch.wire([[q1.emitter.x, q1.emitter.y], [q1.emitter.x, emitterNodeY]]);
        sch.wire([[q2.emitter.x, q2.emitter.y], [q2.emitter.x, emitterNodeY]]);
        sch.wire([[q1.emitter.x, emitterNodeY], [centerX, emitterNodeY]]);
        sch.wire([[q2.emitter.x, emitterNodeY], [centerX, emitterNodeY]]);
        sch.dot(centerX, emitterNodeY);
        sch.dot(q1.emitter.x, emitterNodeY);
        sch.dot(q2.emitter.x, emitterNodeY);

        // Ground (current source is 50px tall: bottom lead at tailTopY + 50)
        const csBottomY = tailTopY + 50;
        const gndY = Math.min(height - 30, csBottomY + 20);
        sch.wire([[centerX, csBottomY], [centerX, gndY]]);
        sch.ground(centerX, gndY);

        // === INPUTS ===
        const vPlusX = q1.base.x - 35;
        sch.wire([[q1.base.x, q1.base.y], [vPlusX, q1.base.y]]);
        sch.nodeLabel(vPlusX, q1.base.y, 'V+');

        const vMinusX = q2.base.x + 35;
        sch.wire([[q2.base.x, q2.base.y], [vMinusX, q2.base.y]]);
        sch.nodeLabel(vMinusX, q2.base.y, 'V-');

        // === OUTPUT (from Q4/Q2 collector node) ===
        const voutX = q2.collector.x + 55;
        sch.wire([[q2.collector.x, nodeRightY], [voutX, nodeRightY]]);
        sch.nodeLabel(voutX, nodeRightY, 'Vout');

        // Annotation (skip for compact embeds)
        if (!isCompact) {
            sch.text(centerX, height - 25, 'High gain, high CMRR differential amplifier',
                { size: 11, color: COLORS.annotation });
        }

        sch.finalize();
        return sch;
    }

    /**
     * Emitter Follower (Common Collector) - Unity gain buffer
     * Fundamental audio output stage building block
     */
    function emitterFollower(container, options = {}) {
        const { width = 300, height = 280, re = '1k', rl = '8Ω' } = options;

        const sch = new Schematic(container, { width, height });

        // Layout
        const vccY = 30;
        const qX = 150, qY = 100;
        const gndY = 250;

        // Get terminal positions
        const q1 = Schematic.npnTerminals(qX, qY, false);

        // VCC rail
        sch.vcc(q1.collector.x, vccY, { label: 'VCC' });
        sch.wire([[q1.collector.x, vccY], [q1.collector.x, q1.collector.y]]);

        // Transistor
        sch.npn(qX, qY, { label: 'Q1', circle: false });

        // RE (emitter resistor)
        const reY = q1.emitter.y + 15;
        sch.resistor(q1.emitter.x, reY, 'vertical', { label: 'RE', value: re });
        sch.wire([[q1.emitter.x, q1.emitter.y], [q1.emitter.x, reY]]);
        sch.wire([[q1.emitter.x, reY + 50], [q1.emitter.x, gndY]]);
        sch.ground(q1.emitter.x, gndY);

        // Input - wire connects from label (no gap!)
        const vinX = 50;
        sch.nodeLabel(vinX, q1.base.y, 'Vin');
        sch.wire([[vinX, q1.base.y], [q1.base.x, q1.base.y]]);

        // Output (from emitter)
        const emitterNodeY = q1.emitter.y + 10;
        const voutX = q1.emitter.x + 75;
        sch.dot(q1.emitter.x, emitterNodeY);
        sch.wire([[q1.emitter.x, emitterNodeY], [voutX, emitterNodeY]]);
        sch.nodeLabel(voutX, emitterNodeY, 'Vout');

        // Load resistor (optional, shown to right)
        if (rl) {
            const rlX = q1.emitter.x + 60;
            sch.resistor(rlX, emitterNodeY + 20, 'vertical', { label: 'RL', value: rl });
            sch.wire([[rlX, emitterNodeY], [rlX, emitterNodeY + 20]]);
            sch.wire([[rlX, emitterNodeY + 70], [rlX, gndY], [q1.emitter.x, gndY]]);
        }

        // Annotations
        sch.text(150, height - 15, 'Gain ≈ 1, Low output impedance',
            { size: 10, color: COLORS.annotation });

        sch.finalize();
        return sch;
    }

    /**
     * Push-Pull Class AB Output Stage
     * Complementary pair for audio power amplifiers
     */
    function pushPullOutput(container, options = {}) {
        const { width = 350, height = 350, rl = '8Ω' } = options;

        const sch = new Schematic(container, { width, height });

        // Layout
        const vccY = 40;
        const veeY = 310;
        const centerX = 175;
        const qY_upper = 120;  // NPN position
        const qY_lower = 230;  // PNP position

        // Get terminal positions
        const qNPN = Schematic.npnTerminals(centerX - 20, qY_upper, false);
        const qPNP = Schematic.pnpTerminals(centerX - 20, qY_lower, false);

        // Power rails
        sch.vcc(qNPN.collector.x, vccY, { label: '+VCC' });
        sch.wire([[qNPN.collector.x, vccY], [qNPN.collector.x, qNPN.collector.y]]);

        // VEE (negative rail)
        sch.vee(qPNP.collector.x, veeY, { label: '-VEE' });
        sch.wire([[qPNP.collector.x, qPNP.collector.y], [qPNP.collector.x, veeY]]);

        // Draw transistors
        sch.npn(centerX - 20, qY_upper, { label: 'Q1 (NPN)', circle: false });
        sch.pnp(centerX - 20, qY_lower, { label: null, circle: false });

        // Bias diodes (represented as voltage drops)
        const biasY = (qNPN.base.y + qPNP.base.y) / 2;
        const diodeX = qNPN.base.x - 30;
        sch.diode(diodeX, qNPN.base.y + 10, 'vertical');
        sch.diode(diodeX, biasY + 5, 'vertical');

        // Input connection - wire connects from label
        const vinX = 40;
        const vinY = biasY;
        sch.nodeLabel(vinX, vinY, 'Vin');
        sch.wire([[vinX, vinY], [diodeX, vinY]]);
        sch.dot(diodeX, vinY);
        // Connect input node to the diode stack junction (avoid "floating" diode pins)
        sch.wire([[diodeX, vinY], [diodeX, biasY + 5]]);

        // Bias to bases
        sch.wire([[diodeX, qNPN.base.y + 10], [diodeX, qNPN.base.y]]);
        sch.wire([[diodeX, qNPN.base.y], [qNPN.base.x, qNPN.base.y]]);
        sch.wire([[diodeX, biasY + 55], [diodeX, qPNP.base.y]]);
        sch.wire([[diodeX, qPNP.base.y], [qPNP.base.x, qPNP.base.y]]);

        // Emitters joined at output
        const outNodeY = (qNPN.emitter.y + qPNP.emitter.y) / 2;
        sch.wire([[qNPN.emitter.x, qNPN.emitter.y], [qNPN.emitter.x, outNodeY]]);
        sch.wire([[qPNP.emitter.x, qPNP.emitter.y], [qPNP.emitter.x, outNodeY]]);
        sch.dot(qNPN.emitter.x, outNodeY);

        // Output and load - wire connects to label
        const voutX = qNPN.emitter.x + 90;
        sch.wire([[qNPN.emitter.x, outNodeY], [voutX, outNodeY]]);
        sch.nodeLabel(voutX, outNodeY, 'Vout');

        // PNP label (manual placement to avoid keepout overlap)
        sch.text(qPNP.collector.x + 45, qPNP.collector.y + 10, 'Q2 (PNP)',
            { size: 11, bold: true, anchor: 'start' });

        // Load resistor
        const rlX = qNPN.emitter.x + 80;
        sch.resistor(rlX, outNodeY + 15, 'vertical', { label: 'RL', value: rl });
        sch.wire([[rlX, outNodeY], [rlX, outNodeY + 15]]);
        sch.wire([[rlX, outNodeY + 65], [rlX, outNodeY + 85]]);
        sch.ground(rlX, outNodeY + 85);

        // Annotations
        sch.text(175, height - 10, 'Class AB: Low crossover distortion',
            { size: 10, color: COLORS.annotation });

        sch.finalize();
        return sch;
    }

    /**
     * Current Mirror - Fundamental analog building block
     */
    function currentMirror(container, options = {}) {
        const { width = 300, height = 280, iref = '1mA' } = options;

        const sch = new Schematic(container, { width, height });

        // Layout - position transistors lower to make room for Rref
        const vccY = 30;
        const qY = 150;  // Lower for proper Rref spacing
        const gndY = 250;
        const leftX = 100;
        const rightX = 200;

        // Get terminal positions
        const q1 = Schematic.npnTerminals(leftX, qY, false);
        const q2 = Schematic.npnTerminals(rightX, qY, false);

        // Reference side (Q1 - diode connected)
        sch.npn(leftX, qY, { label: 'Q1', circle: false });

        // Mirror side (Q2)
        sch.npn(rightX, qY, { label: 'Q2', circle: false });

        // Rref resistor: connects VCC to Q1 collector
        // Leave clearance between Rref body and Q1 body (>= 2 GU).
        const rrefBottomY = q1.collector.y - 20;
        const rrefTopY = rrefBottomY - 50;
        sch.resistor(q1.collector.x, rrefTopY, 'vertical', { label: 'Rref' });

        // Wire from VCC to Rref top
        sch.wire([[q1.collector.x, vccY], [q1.collector.x, rrefTopY]]);
        // Wire from Rref bottom to Q1 collector
        sch.wire([[q1.collector.x, rrefBottomY], [q1.collector.x, q1.collector.y]]);

        // Diode connection: Q1 collector to base via left-side routing
        const diodeJctX = q1.base.x - 15;
        sch.wire([[q1.collector.x, q1.collector.y], [diodeJctX, q1.collector.y]]);
        sch.wire([[diodeJctX, q1.collector.y], [diodeJctX, q1.base.y]]);
        sch.wire([[diodeJctX, q1.base.y], [q1.base.x, q1.base.y]]);
        sch.dot(diodeJctX, q1.base.y);

        // Connect Q1 base to Q2 base (horizontal run below transistors)
        const baseWireY = qY + 45;
        sch.wire([[diodeJctX, q1.base.y], [diodeJctX, baseWireY]]);
        sch.wire([[diodeJctX, baseWireY], [q2.base.x - 15, baseWireY]]);
        sch.wire([[q2.base.x - 15, baseWireY], [q2.base.x - 15, q2.base.y]]);
        sch.wire([[q2.base.x - 15, q2.base.y], [q2.base.x, q2.base.y]]);

        // VCC rail
        sch.vcc(150, vccY, { label: 'VCC' });
        sch.wire([[q1.collector.x, vccY], [q2.collector.x, vccY]]);
        sch.dot(q1.collector.x, vccY);

        // Q2 collector to VCC
        sch.wire([[q2.collector.x, q2.collector.y], [q2.collector.x, vccY]]);

        // Current arrow showing Iout direction (downward)
        sch.currentArrow(q2.collector.x + 15, q2.collector.y - 30, q2.collector.x + 15, q2.collector.y + 10, { label: 'Iout' });

        // Emitters to ground
        sch.wire([[q1.emitter.x, q1.emitter.y], [q1.emitter.x, gndY]]);
        sch.wire([[q2.emitter.x, q2.emitter.y], [q2.emitter.x, gndY]]);
        sch.wire([[q1.emitter.x, gndY], [q2.emitter.x, gndY]]);
        sch.ground((q1.emitter.x + q2.emitter.x) / 2, gndY);

        // Annotations
        sch.text(150, height - 10, 'Iout ≈ Iref (matched transistors)',
            { size: 10, color: COLORS.annotation });

        sch.finalize();
        return sch;
    }

    /**
     * Sallen-Key Lowpass Filter - 2nd order active filter
     */
    function sallenKeyLowpass(container, options = {}) {
        const { width = 420, height = 280, r = '10k', c = '10n' } = options;

        const sch = new Schematic(container, { width, height });

        // Op-amp position
        const opX = 220, opY = 140;
        const op = Schematic.opampTerminals(opX, opY);
        sch.opamp(opX, opY);

        // Input - wire connects label to resistor (no gap!)
        const vinX = 30;
        const vinY = op.nonInvInput.y;
        sch.nodeLabel(vinX, vinY, 'Vin');

        // R1 (input to node between R1/R2)
        const r1StartX = vinX + 15;
        sch.wire([[vinX, vinY], [r1StartX, vinY]]);  // Wire starts at nodeLabel position
        sch.resistor(r1StartX, vinY, 'horizontal', { label: 'R1', value: r });

        // Node between R1 and R2
        const nodeX = r1StartX + 50;
        sch.dot(nodeX, vinY);

        // R2 (to non-inverting input)
        sch.resistor(nodeX + 10, vinY, 'horizontal', { label: 'R2', value: r });
        sch.wire([[nodeX, vinY], [nodeX + 10, vinY]]);
        sch.wire([[nodeX + 60, vinY], [op.nonInvInput.x, op.nonInvInput.y]]);

        // C1 (from node to ground)
        const c1Y = vinY + 20;
        sch.capacitor(nodeX, c1Y, 'vertical', { label: 'C1', value: c });
        sch.wire([[nodeX, vinY], [nodeX, c1Y]]);
        sch.wire([[nodeX, c1Y + 50], [nodeX, c1Y + 70]]);
        sch.ground(nodeX, c1Y + 70);

        // C2 (from non-inv input to output - feedback)
        const outX = op.output.x + 50;
        const c2Y = opY - 60; // Route above op-amp keepout
        const c2X = outX - 50;
        sch.capacitor(c2X, c2Y, 'horizontal', { label: 'C2', value: c });
        const c2 = { start: { x: c2X, y: c2Y }, end: { x: c2X + 50, y: c2Y } };

        // Wire from non-inv input up and right (keepout-safe)
        sch.wire([[op.nonInvInput.x, op.nonInvInput.y], [op.nonInvInput.x, c2Y]]);
        sch.wire([[op.nonInvInput.x, c2Y], [c2.start.x, c2.start.y]]);
        sch.dot(op.nonInvInput.x, op.nonInvInput.y);

        // Wire from C2 to output
        sch.wire([[c2.end.x, c2.end.y], [outX, c2Y]]);
        sch.wire([[outX, c2Y], [outX, op.output.y]]);
        sch.dot(outX, op.output.y);

        // Inverting input tied to output (unity gain buffer config)
        sch.wire([[op.invInput.x, op.invInput.y], [op.invInput.x - 15, op.invInput.y]]);
        sch.wire([[op.invInput.x - 15, op.invInput.y], [op.invInput.x - 15, op.output.y + 40]]);
        sch.wire([[op.invInput.x - 15, op.output.y + 40], [outX, op.output.y + 40]]);
        sch.wire([[outX, op.output.y + 40], [outX, op.output.y]]);

        // Output - wire connects to label (no gap!)
        const voutLabelX = outX + 40;
        sch.wire([[op.output.x, op.output.y], [voutLabelX, op.output.y]]);
        sch.nodeLabel(voutLabelX, op.output.y, 'Vout');

        // Annotations
        sch.text(220, height - 15, 'fc = 1/(2πRC), Q = 0.707 (Butterworth)',
            { size: 10, color: COLORS.annotation });

        sch.finalize();
        return sch;
    }

    /**
     * Voltage Follower (Unity Gain Buffer)
     */
    function voltageFollower(container, options = {}) {
        const { width = 280, height = 200 } = options;

        const sch = new Schematic(container, { width, height });

        // Op-amp position
        const opX = 100, opY = 100;
        const op = Schematic.opampTerminals(opX, opY);
        sch.opamp(opX, opY);

        // Input to non-inverting - wire connects from label
        const vinX = 30;
        sch.nodeLabel(vinX, op.nonInvInput.y, 'Vin');
        sch.wire([[vinX, op.nonInvInput.y], [op.nonInvInput.x, op.nonInvInput.y]]);

        // Output - wire connects to label
        const outX = op.output.x + 40;
        sch.wire([[op.output.x, op.output.y], [outX, op.output.y]]);
        sch.dot(outX, op.output.y);
        sch.nodeLabel(outX, op.output.y, 'Vout');

        // Direct feedback (inverting to output)
        sch.wire([[op.invInput.x, op.invInput.y], [op.invInput.x - 20, op.invInput.y]]);
        sch.wire([[op.invInput.x - 20, op.invInput.y], [op.invInput.x - 20, op.output.y + 35]]);
        sch.wire([[op.invInput.x - 20, op.output.y + 35], [outX, op.output.y + 35]]);
        sch.wire([[outX, op.output.y + 35], [outX, op.output.y]]);

        // Annotations
        sch.text(140, height - 15, 'Gain = 1, Zin = ∞, Zout ≈ 0',
            { size: 10, color: COLORS.annotation });

        sch.finalize();
        return sch;
    }

    /**
     * Summing Amplifier (Audio Mixer)
     */
    function summingAmp(container, options = {}) {
        const { width = 400, height = 300, rf = '10k', r1 = '10k', r2 = '10k', r3 = '10k' } = options;

        const sch = new Schematic(container, { width, height });

        // Op-amp position
        const opX = 200, opY = 150;
        const op = Schematic.opampTerminals(opX, opY);
        sch.opamp(opX, opY);

        // Summing junction (virtual ground)
        const junctionX = op.invInput.x - 30;
        const junctionY = op.invInput.y;
        sch.dot(junctionX, junctionY);

        // Wire from junction to inverting input
        sch.wire([[junctionX, junctionY], [op.invInput.x, op.invInput.y]]);

        // Input resistors (3 inputs)
        // Resistor is 50px, so: nodeLabel -> resistor start -> resistor end -> junction
        const resStartX = 40;  // Where resistors start
        const resEndX = resStartX + 50;  // Where resistors end (50px later)
        const spacing = 70;

        // V1 input - nodeLabel at resistor start, wire from resistor end to junction
        const v1Y = junctionY - spacing;
        sch.nodeLabel(resStartX, v1Y, 'V1', { dx: -12, anchor: 'end' });  // Node AT resistor start
        sch.resistor(resStartX, v1Y, 'horizontal', { label: 'R1', value: r1 });
        sch.wire([[resEndX, v1Y], [junctionX, v1Y]]);  // Resistor end to vertical wire
        sch.wire([[junctionX, v1Y], [junctionX, junctionY]]);

        // V2 input (middle) - same pattern
        sch.nodeLabel(resStartX, junctionY, 'V2', { dx: -12, anchor: 'end' });
        sch.resistor(resStartX, junctionY, 'horizontal', { label: 'R2', value: r2 });
        sch.wire([[resEndX, junctionY], [junctionX, junctionY]]);

        // V3 input - same pattern
        const v3Y = junctionY + spacing;
        sch.nodeLabel(resStartX, v3Y, 'V3', { dx: -12, anchor: 'end' });
        sch.resistor(resStartX, v3Y, 'horizontal', { label: 'R3', value: r3 });
        sch.wire([[resEndX, v3Y], [junctionX, v3Y]]);
        sch.wire([[junctionX, v3Y], [junctionX, junctionY]]);

        // Feedback resistor
        const rfY = op.invInput.y - 60;
        const rfStartX = junctionX + 10;
        const rfEndX = rfStartX + 50;
        const outX = op.output.x + 50;
        sch.resistor(rfStartX, rfY, 'horizontal', { label: 'Rf', value: rf });
        sch.wire([[junctionX, junctionY], [junctionX, rfY]]);
        sch.wire([[junctionX, rfY], [rfStartX, rfY]]);  // Junction to Rf start
        sch.wire([[rfEndX, rfY], [outX, rfY]]);  // Rf end to output node
        sch.wire([[outX, rfY], [outX, op.output.y]]);
        sch.dot(outX, op.output.y);

        // Non-inverting input to ground
        sch.wire([[op.nonInvInput.x, op.nonInvInput.y], [op.nonInvInput.x - 20, op.nonInvInput.y]]);
        sch.wire([[op.nonInvInput.x - 20, op.nonInvInput.y], [op.nonInvInput.x - 20, op.nonInvInput.y + 30]]);
        sch.ground(op.nonInvInput.x - 20, op.nonInvInput.y + 30);

        // Output - wire ends exactly where nodeLabel is placed
        const voutX = outX + 30;
        sch.wire([[op.output.x, op.output.y], [voutX, op.output.y]]);
        sch.nodeLabel(voutX, op.output.y, 'Vout');  // Node AT wire end

        // Virtual ground annotation
        sch.text(junctionX - 20, junctionY - 25, 'V≈0', { size: 9, color: COLORS.annotation, anchor: 'end' });

        // Formula
        sch.text(200, height - 15, 'Vout = -Rf × (V1/R1 + V2/R2 + V3/R3)',
            { size: 10, color: COLORS.annotation });

        sch.finalize();
        return sch;
    }

    /**
     * Headphone Amplifier - Practical audio circuit
     */
    function headphoneAmp(container, options = {}) {
        const { width = 450, height = 320, gain = '11' } = options;

        const sch = new Schematic(container, { width, height });

        // Layout
        const vccY = 30;
        const gndY = 280;

        // Op-amp position
        const opX = 200, opY = 150;
        const op = Schematic.opampTerminals(opX, opY);
        sch.opamp(opX, opY);

        // Input coupling capacitor - wire connects label to capacitor (no gap!)
        const vinX = 30;
        const vinY = op.nonInvInput.y;
        sch.nodeLabel(vinX, vinY, 'Vin');
        sch.capacitor(vinX + 15, vinY, 'horizontal', { label: 'Cin', value: '10µ' });
        sch.wire([[vinX, vinY], [vinX + 15, vinY]]);  // Wire starts at nodeLabel position

        // Bias node after coupling cap
        const biasNodeX = vinX + 75;
        sch.wire([[vinX + 65, vinY], [biasNodeX, vinY]]);
        sch.dot(biasNodeX, vinY);

        // Wire from bias node to op-amp non-inv input
        // Route around the inverting-input resistor body (avoid running straight through Rin).
        const nonInvRouteY = vinY - 20;
        sch.wire([
            [biasNodeX, vinY],
            [biasNodeX, nonInvRouteY],
            [op.nonInvInput.x, nonInvRouteY],
            [op.nonInvInput.x, op.nonInvInput.y]
        ]);

        // Bias resistor to VCC/2 rail
        const biasRailY = vccY + 20;
        sch.resistor(biasNodeX, biasRailY, 'vertical', { label: 'Rb', value: '100k' });
        sch.wire([[biasNodeX, biasRailY], [biasNodeX, vccY]]);
        sch.wire([[biasNodeX, biasRailY + 50], [biasNodeX, vinY]]);
        sch.nodeLabel(biasNodeX, vccY, 'VCC/2', { color: COLORS.vcc });

        // Feedback network
        const junctionX = op.invInput.x - 25;
        const junctionY = op.invInput.y;
        sch.wire([[junctionX, junctionY], [op.invInput.x, op.invInput.y]]);
        sch.dot(junctionX, junctionY);

        // Rf (feedback resistor)
        const rfY = junctionY - 50;
        const outX = op.output.x + 50;
        sch.resistor(junctionX + 5, rfY, 'horizontal', { label: null, value: null });
        sch.text(junctionX + 30, rfY - 40, 'Rf', { size: 11, bold: true, anchor: 'middle' });
        sch.text(junctionX + 30, rfY - 26, '10k', { size: 10, color: COLORS.value, anchor: 'middle' });
        sch.wire([[junctionX, junctionY], [junctionX, rfY]]);
        sch.wire([[junctionX, rfY], [junctionX + 5, rfY]]);
        sch.wire([[junctionX + 55, rfY], [outX, rfY]]);
        sch.wire([[outX, rfY], [outX, op.output.y]]);
        sch.dot(outX, op.output.y);

        // Rin to ground (sets gain with Rf)
        sch.resistor(junctionX, junctionY + 15, 'vertical', { label: null, value: null });
        sch.text(junctionX - 18, junctionY + 40, 'Rin', { size: 11, bold: true, anchor: 'end' });
        sch.text(junctionX - 18, junctionY + 54, '1k', { size: 10, color: COLORS.value, anchor: 'end' });
        sch.wire([[junctionX, junctionY], [junctionX, junctionY + 15]]);
        sch.wire([[junctionX, junctionY + 65], [junctionX, gndY]]);
        sch.ground(junctionX, gndY);

        // Output coupling capacitor
        sch.wire([[op.output.x, op.output.y], [outX, op.output.y]]);
        sch.capacitor(outX + 15, op.output.y, 'horizontal', { label: 'Cout', value: '220µ' });
        sch.wire([[outX, op.output.y], [outX + 15, op.output.y]]);

        // Load (headphones)
        const loadX = outX + 80;
        sch.wire([[outX + 65, op.output.y], [loadX, op.output.y]]);
        sch.dot(loadX, op.output.y);
        sch.resistor(loadX, op.output.y + 15, 'vertical', { label: 'HP', value: '32Ω' });
        sch.wire([[loadX, op.output.y], [loadX, op.output.y + 15]]);
        sch.wire([[loadX, op.output.y + 65], [loadX, gndY], [junctionX, gndY]]);

        // Output label - wire must connect to label (no floating nodes!)
        const outLabelX = loadX + 40;
        sch.wire([[loadX, op.output.y], [outLabelX, op.output.y]]);
        sch.nodeLabel(outLabelX, op.output.y, 'Out');

        // Annotations
        sch.text(225, height - 15, 'Gain = 1 + Rf/Rin = ' + gain,
            { size: 10, color: COLORS.annotation });

        sch.finalize();
        return sch;
    }

    /**
     * Cascode Amplifier - High frequency/high gain stage
     */
    function cascodeAmp(container, options = {}) {
        const { width = 350, height = 380, rc = '4.7k', re = '1k' } = options;

        const sch = new Schematic(container, { width, height });

        // Layout
        const vccY = 30;
        const gndY = 360;
        const centerX = 175;
        const q1Y = 260;  // Lower transistor (CE)
        const q2Y = 150;  // Upper transistor (CB)

        // Get terminal positions
        const q1 = Schematic.npnTerminals(centerX, q1Y, false);
        const q2 = Schematic.npnTerminals(centerX, q2Y, false);

        // VCC
        sch.vcc(q2.collector.x, vccY, { label: 'VCC' });

        // RC (collector load)
        sch.resistor(q2.collector.x, vccY + 15, 'vertical', { label: 'RC', value: rc });
        sch.wire([[q2.collector.x, vccY], [q2.collector.x, vccY + 15]]);
        sch.wire([[q2.collector.x, vccY + 65], [q2.collector.x, q2.collector.y]]);
        const outNodeY = vccY + 65;
        sch.dot(q2.collector.x, outNodeY);

        // Upper transistor Q2 (common base)
        sch.npn(centerX, q2Y, { label: 'Q2 (CB)', circle: false });

        // Lower transistor Q1 (common emitter)
        sch.npn(centerX, q1Y, { label: 'Q1 (CE)', circle: false });

        // Q2 emitter connects to Q1 collector
        sch.wire([[q2.emitter.x, q2.emitter.y], [q1.collector.x, q1.collector.y]]);

        // RE (emitter degeneration)
        sch.resistor(q1.emitter.x, q1.emitter.y + 15, 'vertical', { label: 'RE', value: re });
        sch.wire([[q1.emitter.x, q1.emitter.y], [q1.emitter.x, q1.emitter.y + 15]]);
        sch.wire([[q1.emitter.x, q1.emitter.y + 65], [q1.emitter.x, gndY]]);
        sch.ground(q1.emitter.x, gndY);

        // Q2 base bias (Vbias) - wire connects to label (no gap!)
        const vb2X = q2.base.x - 50;
        sch.wire([[q2.base.x, q2.base.y], [vb2X, q2.base.y]]);
        sch.nodeLabel(vb2X, q2.base.y, 'Vb2');

        // Q1 input - wire connects to label (no gap!)
        const vinX = q1.base.x - 50;
        sch.wire([[q1.base.x, q1.base.y], [vinX, q1.base.y]]);
        sch.nodeLabel(vinX, q1.base.y, 'Vin');

        // Output - wire connects to label (no gap!)
        const voutX = q2.collector.x + 70;
        sch.wire([[q2.collector.x, outNodeY], [voutX, outNodeY]]);
        sch.nodeLabel(voutX, outNodeY, 'Vout');

        // Annotations
        sch.text(q2.collector.x + 40, height - 18, 'High gain × bandwidth product',
            { size: 10, color: COLORS.annotation, anchor: 'start' });

        sch.finalize();
        return sch;
    }

    /**
     * Voltage Regulator with pass transistor
     */
    function voltageRegulator(container, options = {}) {
        const { width = 420, height = 340, vout = '5V' } = options;

        const sch = new Schematic(container, { width, height });

        // Layout - clear grid-based positioning
        const vinRailY = 40;
        const gndY = 300;
        const opX = 120, opY = 180;
        const passX = 260, passY = 100;

        // Get terminal positions
        const op = Schematic.opampTerminals(opX, opY);
        const qPass = Schematic.npnTerminals(passX, passY, false);

        // === INPUT RAIL ===
        // Vin node and main rail - connect node directly to rail wire (no gap!)
        sch.nodeLabel(30, vinRailY, 'Vin');
        sch.wire([[30, vinRailY], [qPass.collector.x, vinRailY]]);

        // === PASS TRANSISTOR ===
        sch.npn(passX, passY, { label: 'Qpass', circle: false });
        // Collector to Vin rail
        sch.wire([[qPass.collector.x, qPass.collector.y], [qPass.collector.x, vinRailY]]);

        // === OP-AMP (Error Amplifier) ===
        sch.opamp(opX, opY);

        // Op-amp output to pass transistor base
        sch.wire([[op.output.x, op.output.y], [op.output.x + 15, op.output.y]]);
        sch.wire([[op.output.x + 15, op.output.y], [op.output.x + 15, qPass.base.y]]);
        sch.wire([[op.output.x + 15, qPass.base.y], [qPass.base.x, qPass.base.y]]);

        // === OUTPUT RAIL (from emitter) ===
        const outRailY = qPass.emitter.y + 15;
        sch.wire([[qPass.emitter.x, qPass.emitter.y], [qPass.emitter.x, outRailY]]);
        sch.dot(qPass.emitter.x, outRailY);

        // Output label - wire must reach the label position
        const regVoutX = qPass.emitter.x + 85;
        sch.wire([[qPass.emitter.x, outRailY], [regVoutX, outRailY]]);
        sch.nodeLabel(regVoutX, outRailY, 'Vout');

        // === FEEDBACK DIVIDER ===
        const fbX = qPass.emitter.x + 35;

        // R1 (top resistor of divider) - starts at outRailY+10, ends at outRailY+60
        const r1StartY = outRailY + 10;
        sch.resistor(fbX, r1StartY, 'vertical', { label: 'R1', value: '10k' });
        sch.wire([[fbX, outRailY], [fbX, r1StartY]]);  // Rail to R1 top

        // Feedback node (between R1 and R2) - MUST be at R1 bottom = r1StartY + 50
        const fbNodeY = r1StartY + 50;  // = outRailY + 60, matches R1 bottom exactly
        sch.dot(fbX, fbNodeY);

        // R2 (bottom resistor of divider) - starts at fbNodeY+10, ends at fbNodeY+60
        const r2StartY = fbNodeY + 10;
        sch.resistor(fbX, r2StartY, 'vertical', { label: 'R2', value: '10k' });
        sch.wire([[fbX, fbNodeY], [fbX, r2StartY]]);  // fbNode to R2 top
        sch.wire([[fbX, r2StartY + 50], [fbX, gndY]]);  // R2 bottom to ground

        // Feedback wire to op-amp inverting input
        // Route: horizontal from fbNode, then L-bend to inverting input
        // Use offset X to avoid overlapping with non-inverting input wire
        const invWireX = op.invInput.x - 10;  // Offset slightly left of actual input
        sch.wire([[fbX, fbNodeY], [invWireX, fbNodeY]]);  // Horizontal from fb divider
        sch.wire([[invWireX, fbNodeY], [invWireX, op.invInput.y]]);  // Down to input Y level
        sch.wire([[invWireX, op.invInput.y], [op.invInput.x, op.invInput.y]]);  // Final horizontal to input
        sch.dot(op.invInput.x, op.invInput.y);  // Mark the actual input connection

        // === VOLTAGE REFERENCE ===
        const refX = op.nonInvInput.x - 35;

        // Reference resistor taps off the Vin rail
        sch.dot(refX, vinRailY);  // Junction dot on rail
        const rrefStartY = vinRailY + 10;
        sch.resistor(refX, rrefStartY, 'vertical', { label: 'Rref', value: '1k' });
        sch.wire([[refX, vinRailY], [refX, rrefStartY]]);  // Rail to Rref top

        // Zener diode for voltage reference - starts at Rref bottom
        const rrefEndY = rrefStartY + 50;  // Rref bottom
        const zenerStartY = rrefEndY + 10;  // Small gap for clarity
        sch.zener(refX, zenerStartY, 'vertical', { label: null, value: null });
        sch.text(refX - 18, zenerStartY + 18, 'Vref', { size: 11, anchor: 'end', bold: true });
        sch.text(refX - 18, zenerStartY + 32, '2.5V', { size: 10, anchor: 'end', color: COLORS.value });
        sch.wire([[refX, rrefEndY], [refX, zenerStartY]]);  // Rref to zener
        sch.dot(refX, zenerStartY);  // Reference node

        // Connect reference node to non-inverting input
        // Route: horizontal from reference, then L-bend to non-inverting input
        // Use different offset than inverting input for visual clarity
        const nonInvWireX = op.nonInvInput.x - 15;  // Keep clear of the zener body keepout
        sch.wire([[refX, zenerStartY], [nonInvWireX, zenerStartY]]);  // Horizontal from reference
        sch.wire([[nonInvWireX, zenerStartY], [nonInvWireX, op.nonInvInput.y]]);  // Down to input Y level
        sch.wire([[nonInvWireX, op.nonInvInput.y], [op.nonInvInput.x, op.nonInvInput.y]]);  // Final horizontal to input
        sch.dot(op.nonInvInput.x, op.nonInvInput.y);  // Mark the actual input connection

        // Zener to ground - zener ends at zenerStartY + 50
        const zenerEndY = zenerStartY + 50;
        sch.wire([[refX, zenerEndY], [refX, gndY]]);
        sch.dot(refX, gndY);  // Junction dot at ground

        // === GROUND RAIL ===
        sch.wire([[refX, gndY], [fbX, gndY]]);
        sch.dot(fbX, gndY);  // Junction dot where R2 meets ground rail
        sch.ground((refX + fbX) / 2, gndY);

        // === ANNOTATIONS ===
        sch.text(210, height - 15, 'Vout = Vref × (1 + R1/R2) = ' + vout,
            { size: 10, color: COLORS.annotation });

        sch.finalize();
        return sch;
    }

    /**
     * PMOS LDO (Low Dropout Regulator) - used in Module 6
     * Typical configuration: Op-amp error amplifier driving PMOS pass transistor
     * with resistor divider feedback
     */
    function pmosLdo(container, options = {}) {
        const { width = 450, height = 350, vout = '5V', r1 = '30k', r2 = '10k', vref = '1.25V' } = options;

        const sch = new Schematic(container, { width, height });

        // Layout positioning
        const vinRailY = 50;
        const gndY = 310;
        const opX = 130, opY = 180;
        const passX = 280, passY = 90;

        // Get terminal positions
        const op = Schematic.opampTerminals(opX, opY);
        const mp = Schematic.pmosTerminals(passX, passY, false);

        // === INPUT RAIL ===
        sch.nodeLabel(35, vinRailY, 'Vin');
        sch.wire([[35, vinRailY], [mp.source.x, vinRailY]]);

        // === PMOS PASS TRANSISTOR ===
        sch.pmos(passX, passY, { label: 'M1' });
        // Source to Vin rail
        sch.wire([[mp.source.x, mp.source.y], [mp.source.x, vinRailY]]);

        // === OP-AMP (Error Amplifier) ===
        sch.opamp(opX, opY, { label: null });
        sch.text(opX + 20, opY - 55, 'U1', { size: 11, bold: true, anchor: 'start' });

        // Op-amp output to pass transistor gate
        // Route: horizontal then up to gate level, then horizontal to gate
        const gateWireX1 = op.output.x + 20;
        sch.wire([[op.output.x, op.output.y], [gateWireX1, op.output.y]]);
        sch.wire([[gateWireX1, op.output.y], [gateWireX1, mp.gate.y]]);
        sch.wire([[gateWireX1, mp.gate.y], [mp.gate.x, mp.gate.y]]);

        // === OUTPUT RAIL (from PMOS drain) ===
        const outRailY = mp.drain.y + 20;
        sch.wire([[mp.drain.x, mp.drain.y], [mp.drain.x, outRailY]]);
        sch.dot(mp.drain.x, outRailY);

        // Output label
        const voutX = mp.drain.x + 90;
        sch.wire([[mp.drain.x, outRailY], [voutX, outRailY]]);
        sch.nodeLabel(voutX, outRailY, 'Vout');

        // === FEEDBACK DIVIDER ===
        const fbX = mp.drain.x + 40;

        // R1 (top resistor of divider)
        const r1StartY = outRailY + 15;
        sch.resistor(fbX, r1StartY, 'vertical', { label: 'R1', value: r1 });
        sch.wire([[fbX, outRailY], [fbX, r1StartY]]);
        sch.dot(fbX, outRailY);

        // Feedback node (between R1 and R2)
        const fbNodeY = r1StartY + 50;
        sch.dot(fbX, fbNodeY);

        // R2 (bottom resistor of divider)
        const r2StartY = fbNodeY + 15;
        sch.resistor(fbX, r2StartY, 'vertical', { label: 'R2', value: r2 });
        sch.wire([[fbX, fbNodeY], [fbX, r2StartY]]);
        sch.wire([[fbX, r2StartY + 50], [fbX, gndY]]);

        // Feedback wire to op-amp inverting input
        // Route: horizontal from fbNode, L-bend to inverting input
        const invWireX = op.invInput.x - 15;
        sch.wire([[fbX, fbNodeY], [invWireX, fbNodeY]]);
        sch.wire([[invWireX, fbNodeY], [invWireX, op.invInput.y]]);
        sch.wire([[invWireX, op.invInput.y], [op.invInput.x, op.invInput.y]]);
        sch.dot(op.invInput.x, op.invInput.y);

        // === VOLTAGE REFERENCE ===
        // Vref source connected to the non-inverting input
        const refX = op.nonInvInput.x - 40;
        const refTopY = op.nonInvInput.y;
        const refBottomY = refTopY + 50;
        sch.wire([[refX, refTopY], [op.nonInvInput.x, refTopY]]);
        sch.voltageSource(refX, refTopY, 'vertical', { label: null, value: null });
        sch.text(refX - 26, refTopY + 18, 'Vref', { size: 11, anchor: 'end', bold: true });
        sch.text(refX - 26, refTopY + 32, vref, { size: 10, anchor: 'end', color: COLORS.value });
        sch.wire([[refX, refBottomY], [refX, gndY]]);

        // === GROUND RAIL ===
        sch.wire([[refX, gndY], [fbX, gndY]]);
        sch.dot(fbX, gndY);
        sch.dot(refX, gndY);
        sch.ground((refX + fbX) / 2, gndY);

        // === ANNOTATIONS ===
        sch.text(width / 2, height - 15, 'Vout = Vref × (1 + R1/R2) = ' + vout,
            { size: 10, color: COLORS.annotation });

        sch.finalize();
        return sch;
    }

    /**
     * Simple LC Tank Circuit - used for oscillator demos
     * Shows parallel LC with initial conditions
     */
    function lcTank(container, options = {}) {
        const { width = 280, height = 180, l = '10µH', c = '100pF' } = options;

        const sch = new Schematic(container, { width, height });

        const centerX = width / 2;
        const topY = 40;
        const botY = 140;
        const compX1 = centerX - 40;
        const compX2 = centerX + 40;

        // Top rail
        sch.wire([[compX1, topY], [compX2, topY]]);
        sch.nodeLabel(centerX, topY, 'tank', { dy: -15 });

        // Bottom rail (ground)
        sch.wire([[compX1, botY], [compX2, botY]]);
        sch.ground(centerX, botY + 15);
        sch.wire([[centerX, botY], [centerX, botY + 15]]);

        // Inductor on left - vertical
        sch.wire([[compX1, topY], [compX1, topY + 15]]);
        sch.inductor(compX1, topY + 15, 'vertical', { label: 'L', value: l });
        sch.wire([[compX1, topY + 65], [compX1, botY]]);

        // Capacitor on right - vertical
        sch.wire([[compX2, topY], [compX2, topY + 25]]);
        sch.capacitor(compX2, topY + 25, 'vertical', { label: 'C', value: c });
        sch.wire([[compX2, topY + 75], [compX2, botY]]);

        // Annotation
        sch.text(centerX, height - 10, 'f = 1/(2π√LC)',
            { size: 10, color: COLORS.annotation });

        sch.finalize();
        return sch;
    }

    /**
     * LC Tank with series resistance (for Q modeling)
     */
    function lcTankWithQ(container, options = {}) {
        const { width = 320, height = 180, l = '100µH', c = '1nF', r = '10Ω' } = options;

        const sch = new Schematic(container, { width, height });

        const centerX = width / 2;
        const topY = 40;
        const compX1 = centerX - 50;
        const compX2 = centerX + 50;

        // Layout: ensure there is enough vertical room for a C + R stack on the right leg
        // (capacitor 50px + gap + resistor 50px). This prevents the bottom rail from
        // crossing through the resistor body (a common "looks disconnected" failure).
        const capStartY = topY + 10;
        const capEndY = capStartY + 50;
        const rStartY = capEndY + 10;
        const rEndY = rStartY + 50;
        const botY = rEndY;

        // Top rail
        sch.wire([[compX1, topY], [compX2, topY]]);
        sch.nodeLabel(centerX, topY, 'tank', { dy: -15 });

        // Bottom rail (ground)
        sch.wire([[compX1, botY], [compX2, botY]]);
        sch.ground(centerX, botY + 15);
        sch.wire([[centerX, botY], [centerX, botY + 15]]);

        // Inductor on left - vertical
        sch.wire([[compX1, topY], [compX1, capStartY]]);
        sch.inductor(compX1, capStartY, 'vertical', { label: 'L', value: l });
        sch.wire([[compX1, capEndY], [compX1, botY]]);

        // Capacitor in middle (series with R)
        sch.wire([[compX2, topY], [compX2, capStartY]]);
        sch.capacitor(compX2, capStartY, 'vertical', { label: 'C', value: c });

        // Resistor below capacitor
        sch.wire([[compX2, capEndY], [compX2, rStartY]]);
        sch.resistor(compX2, rStartY, 'vertical', { label: 'R', value: r });
        sch.wire([[compX2, rEndY], [compX2, botY]]);

        // Annotation
        sch.text(width - 20, 20, 'Q = √(L/C)/R',
            { size: 10, color: COLORS.annotation, anchor: 'end' });

        sch.finalize();
        return sch;
    }

    /**
     * Simple RC Lowpass Filter
     */
    function rcLowpass(container, options = {}) {
        const { width = 280, height = 170, r = '10k', c = '10n' } = options;

        const sch = new Schematic(container, { width, height });

        const vinX = 30;
        const midY = 75;
        const voutX = 250;

        // Input - wire connects from label to resistor
        sch.nodeLabel(vinX, midY, 'Vin');
        const resStartX = vinX + 10;
        sch.wire([[vinX, midY], [resStartX, midY]]);  // Connect label to resistor

        // Resistor - starts at resStartX, ends at resStartX+50
        sch.resistor(resStartX, midY, 'horizontal', { label: 'R', value: r });
        const resEndX = resStartX + 50;

        // Junction node
        const junctionX = resEndX + 30;
        sch.wire([[resEndX, midY], [junctionX, midY]]);
        sch.dot(junctionX, midY);

        // Capacitor to ground - vertical, 50px
        const capStartY = midY;
        sch.capacitor(junctionX, capStartY, 'vertical', { label: 'C', value: c });
        const capEndY = capStartY + 50;
        sch.ground(junctionX, capEndY + 10);
        sch.wire([[junctionX, capEndY], [junctionX, capEndY + 10]]);

        // Output wire
        sch.wire([[junctionX, midY], [voutX - 20, midY]]);
        sch.nodeLabel(voutX - 20, midY, 'Vout');

        // Annotation
        sch.text(width / 2, 18, 'fc = 1/(2πRC)',
            { size: 10, color: COLORS.annotation });

        sch.finalize();
        return sch;
    }

    /**
     * Simple RC Highpass Filter
     */
    function rcHighpass(container, options = {}) {
        const { width = 280, height = 170, r = '10k', c = '10n' } = options;

        const sch = new Schematic(container, { width, height });

        const vinX = 30;
        const midY = 75;
        const voutX = 250;

        // Input - wire connects from label to capacitor
        sch.nodeLabel(vinX, midY, 'Vin');
        const capStartX = vinX + 10;
        sch.wire([[vinX, midY], [capStartX, midY]]);  // Connect label to capacitor

        // Capacitor first - starts at capStartX, horizontal, 50px
        sch.capacitor(capStartX, midY, 'horizontal', { label: 'C', value: c });
        const capEndX = capStartX + 50;

        // Junction node
        const junctionX = capEndX + 30;
        sch.wire([[capEndX, midY], [junctionX, midY]]);
        sch.dot(junctionX, midY);

        // Resistor to ground - vertical, 50px
        const resStartY = midY;
        sch.resistor(junctionX, resStartY, 'vertical', { label: 'R', value: r });
        const resEndY = resStartY + 50;
        sch.ground(junctionX, resEndY + 10);
        sch.wire([[junctionX, resEndY], [junctionX, resEndY + 10]]);

        // Output wire
        sch.wire([[junctionX, midY], [voutX - 20, midY]]);
        sch.nodeLabel(voutX - 20, midY, 'Vout');

        // Annotation
        sch.text(width / 2, 18, 'fc = 1/(2πRC)',
            { size: 10, color: COLORS.annotation });

        sch.finalize();
        return sch;
    }

    /**
     * Pi Filter (C1 - series element - C2), commonly used with a ferrite bead for EMI filtering.
     * This replaces several ASCII "pi filter" diagrams used in lessons.
     */
    function piFilter(container, options = {}) {
        const {
            width = 420,
            height = 220,
            c1 = '0.1µF',
            c2 = '1µF',
            seriesLabel = 'FB',
            seriesValue = 'Z@100MHz'
        } = options;

        const sch = new Schematic(container, { width, height });

        const midY = 80;
        const vinX = 60;
        const seriesStartX = vinX + 80;
        const seriesEndX = seriesStartX + 50;
        const voutX = seriesEndX + 80;

        // VIN node + series element + VOUT node
        sch.nodeLabel(vinX - 25, midY, 'VIN');
        sch.wire([[vinX - 25, midY], [vinX, midY]]); // Connect to label
        sch.dot(vinX, midY);

        sch.wire([[vinX, midY], [seriesStartX, midY]]);
        sch.resistor(seriesStartX, midY, 'horizontal', { label: seriesLabel, value: seriesValue });
        sch.wire([[seriesEndX, midY], [voutX, midY]]);
        sch.dot(voutX, midY);

        sch.nodeLabel(voutX + 25, midY, 'VOUT');
        sch.wire([[voutX, midY], [voutX + 25, midY]]); // Connect to label

        // Shunt capacitors to ground
        sch.capacitor(vinX, midY, 'vertical', { label: 'C1', value: c1 });
        sch.wire([[vinX, midY + 50], [vinX, midY + 60]]);
        sch.ground(vinX, midY + 60);

        sch.capacitor(voutX, midY, 'vertical', { label: 'C2', value: c2 });
        sch.wire([[voutX, midY + 50], [voutX, midY + 60]]);
        sch.ground(voutX, midY + 60);

        sch.text(width / 2, height - 10, 'Pi filter: C1 – FB – C2', { size: 10, color: COLORS.annotation });

        sch.finalize();
        return sch;
    }

    /**
     * Op-Amp Integrator
     */
    function integrator(container, options = {}) {
        const { width = 320, height = 200, r = '10k', c = '100n' } = options;

        const sch = new Schematic(container, { width, height });

        // Op-amp position
        const opX = 140, opY = 100;
        const op = Schematic.opampTerminals(opX, opY);
        sch.opamp(opX, opY);

        // Input - wire connects label to resistor (no gap!)
        const vinX = 20;
        sch.nodeLabel(vinX, op.invInput.y, 'Vin');

        // Input resistor to inverting input
        const resStartX = vinX + 15;
        sch.wire([[vinX, op.invInput.y], [resStartX, op.invInput.y]]);  // Label to resistor
        sch.resistor(resStartX, op.invInput.y, 'horizontal', { label: 'R' });
        sch.text(resStartX + 25, op.invInput.y + 30, r, { size: 10, color: COLORS.value });
        const resEndX = resStartX + 50;
        sch.wire([[resEndX, op.invInput.y], [op.invInput.x, op.invInput.y]]);

        // Non-inverting input to ground
        sch.wire([[op.nonInvInput.x, op.nonInvInput.y], [op.nonInvInput.x - 15, op.nonInvInput.y]]);
        sch.ground(op.nonInvInput.x - 15, op.nonInvInput.y + 10);
        sch.wire([[op.nonInvInput.x - 15, op.nonInvInput.y], [op.nonInvInput.x - 15, op.nonInvInput.y + 10]]);

        // Feedback capacitor (horizontal over the op-amp)
        const fbY = opY - 60;
        sch.wire([[op.invInput.x, op.invInput.y], [op.invInput.x, fbY]]);
        sch.capacitor(op.invInput.x, fbY, 'horizontal');
        sch.text(op.invInput.x + 25, fbY - 30, 'C', { size: 11, bold: true });
        sch.text(op.invInput.x + 25, fbY - 44, c, { size: 10, color: COLORS.value });
        sch.wire([[op.invInput.x + 50, fbY], [op.output.x, fbY]]);
        sch.wire([[op.output.x, fbY], [op.output.x, op.output.y]]);
        sch.dot(op.invInput.x, fbY);
        sch.dot(op.output.x, fbY);

        // Output
        const voutX = op.output.x + 40;
        sch.wire([[op.output.x, op.output.y], [voutX, op.output.y]]);
        sch.nodeLabel(voutX, op.output.y, 'Vout');

        // Annotation
        sch.text(width / 2, height - 10, 'Vout = -1/(RC) × ∫Vin dt',
            { size: 10, color: COLORS.annotation });

        sch.finalize();
        return sch;
    }

    /**
     * Op-Amp Differentiator
     */
    function differentiator(container, options = {}) {
        const { width = 320, height = 200, r = '10k', c = '100n' } = options;

        const sch = new Schematic(container, { width, height });

        // Op-amp position
        const opX = 160, opY = 100;
        const op = Schematic.opampTerminals(opX, opY);
        sch.opamp(opX, opY);

        // Input - wire connects label to capacitor (no gap!)
        const vinX = 20;
        sch.nodeLabel(vinX, op.invInput.y, 'Vin');

        // Input capacitor to inverting input
        const capStartX = vinX + 15;
        sch.wire([[vinX, op.invInput.y], [capStartX, op.invInput.y]]);  // Label to capacitor
        sch.capacitor(capStartX, op.invInput.y, 'horizontal', { label: 'C', value: c });
        const capEndX = capStartX + 50;
        sch.wire([[capEndX, op.invInput.y], [op.invInput.x, op.invInput.y]]);

        // Non-inverting input to ground
        sch.wire([[op.nonInvInput.x, op.nonInvInput.y], [op.nonInvInput.x - 15, op.nonInvInput.y]]);
        sch.ground(op.nonInvInput.x - 15, op.nonInvInput.y + 10);
        sch.wire([[op.nonInvInput.x - 15, op.nonInvInput.y], [op.nonInvInput.x - 15, op.nonInvInput.y + 10]]);

        // Feedback resistor (horizontal over the op-amp)
        const fbY = opY - 60;
        sch.wire([[op.invInput.x, op.invInput.y], [op.invInput.x, fbY]]);
        sch.resistor(op.invInput.x, fbY, 'horizontal');
        sch.text(op.invInput.x + 25, fbY - 30, 'R', { size: 11, bold: true });
        sch.text(op.invInput.x + 25, fbY - 44, r, { size: 10, color: COLORS.value });
        sch.wire([[op.invInput.x + 50, fbY], [op.output.x, fbY]]);
        sch.wire([[op.output.x, fbY], [op.output.x, op.output.y]]);
        sch.dot(op.invInput.x, fbY);
        sch.dot(op.output.x, fbY);

        // Output
        const voutX = op.output.x + 40;
        sch.wire([[op.output.x, op.output.y], [voutX, op.output.y]]);
        sch.nodeLabel(voutX, op.output.y, 'Vout');

        // Annotation
        sch.text(width / 2, height - 10, 'Vout = -RC × dVin/dt',
            { size: 10, color: COLORS.annotation });

        sch.finalize();
        return sch;
    }

    /**
     * Voltage Divider
     */
    function voltageDivider(container, options = {}) {
        const { width = 200, height = 200, r1 = '10k', r2 = '10k' } = options;

        const sch = new Schematic(container, { width, height });

        const centerX = 100;
        const vinY = 30;
        const gndY = 170;

        // Vin at top - wire connects directly from label
        const vinX = 40;
        sch.nodeLabel(vinX, vinY, 'Vin');
        sch.wire([[vinX, vinY], [centerX, vinY]]);

        // R1 from Vin rail down
        const r1StartY = vinY + 10;
        const r1EndY = r1StartY + 50;
        sch.wire([[centerX, vinY], [centerX, r1StartY]]);
        sch.resistor(centerX, r1StartY, 'vertical', { label: 'R1', value: r1 });

        // Vout node at R1/R2 junction
        const voutY = r1EndY;
        sch.dot(centerX, voutY);
        sch.wire([[centerX, voutY], [centerX + 60, voutY]]);
        sch.nodeLabel(centerX + 60, voutY, 'Vout');

        // R2 from Vout to ground
        const r2StartY = voutY + 10;
        const r2EndY = r2StartY + 50;
        sch.wire([[centerX, voutY], [centerX, r2StartY]]);
        sch.resistor(centerX, r2StartY, 'vertical', { label: 'R2', value: r2 });
        sch.wire([[centerX, r2EndY], [centerX, gndY]]);
        sch.ground(centerX, gndY);

        // Annotation
        sch.text(width / 2, height - 10, 'Vout = Vin × R2/(R1+R2)',
            { size: 10, color: COLORS.annotation });

        sch.finalize();
        return sch;
    }

    /**
     * Op-Amp Comparator
     */
    function comparator(container, options = {}) {
        const { width = 320, height = 200, vref = '2.5V' } = options;

        const sch = new Schematic(container, { width, height });

        const opX = 140, opY = 100;
        const op = Schematic.opampTerminals(opX, opY);
        sch.opamp(opX, opY);

        // Vin to non-inverting input - wire connects from label
        const vinX = 25;
        sch.nodeLabel(vinX, op.nonInvInput.y, 'Vin');
        sch.wire([[vinX, op.nonInvInput.y], [op.nonInvInput.x, op.nonInvInput.y]]);

        // Vref to inverting input - wire connects from label
        const vrefX = 25;
        sch.nodeLabel(vrefX, op.invInput.y, 'Vref');
        sch.wire([[vrefX, op.invInput.y], [op.invInput.x, op.invInput.y]]);
        sch.text(60, op.invInput.y - 12, vref, { size: 9, color: COLORS.value });

        // Output
        const voutX = op.output.x + 40;
        sch.wire([[op.output.x, op.output.y], [voutX, op.output.y]]);
        sch.nodeLabel(voutX, op.output.y, 'Vout');

        // Annotation
        sch.text(width / 2, height - 10, 'Vout = VCC if Vin > Vref, else 0',
            { size: 10, color: COLORS.annotation });

        sch.finalize();
        return sch;
    }

    /**
     * Schmitt Trigger (Inverting with Hysteresis)
     * Uses terminal-first methodology per SCHEMATIC_METHODOLOGY.md v2.2
     */
    function schmittTrigger(container, options = {}) {
        const { width = 380, height = 240, r1 = '10k', r2 = '10k' } = options;

        const sch = new Schematic(container, { width, height });

        const opX = 180, opY = 120;
        const op = Schematic.opampTerminals(opX, opY);
        sch.opamp(opX, opY);

        // Inverting-input Schmitt trigger:
        // - Vin drives the inverting input directly.
        // - Non-inverting input sets thresholds via divider from Vout to ground (R1, R2).

        // === INPUT (Vin to inverting input) ===
        const vinX = 30;
        sch.nodeLabel(vinX, op.invInput.y, 'Vin');
        sch.wire([[vinX, op.invInput.y], [op.invInput.x, op.invInput.y]]);
        sch.dot(op.invInput.x, op.invInput.y);

        // === THRESHOLD NETWORK (non-inverting input) ===
        const junctionX = op.nonInvInput.x - 25;
        const junctionY = op.nonInvInput.y;
        // Move junction left to avoid overlapping op-amp keepout.
        sch.wire([[op.nonInvInput.x, op.nonInvInput.y], [junctionX, junctionY]]);
        sch.dot(junctionX, junctionY);

        // R2: junction to ground
        const gndY = opY + 70;
        const r2StartY = junctionY + 10;
        sch.wire([[junctionX, junctionY], [junctionX, r2StartY]]);
        sch.resistor(junctionX, r2StartY, 'vertical', { label: null, value: null });
        sch.text(junctionX - 20, r2StartY + 70, 'R2', { size: 11, anchor: 'end', bold: true });
        sch.text(junctionX - 20, r2StartY + 84, r2, { size: 10, anchor: 'end', color: COLORS.value, skipValidation: true });
        sch.wire([[junctionX, r2StartY + 50], [junctionX, gndY]]);
        sch.ground(junctionX, gndY);

        // R1: Vout to junction (route above op-amp body)
        const fbY = opY - 65;
        sch.wire([[junctionX, junctionY], [junctionX, fbY]]);
        sch.wire([[op.output.x, op.output.y], [op.output.x, fbY]]);
        const r1StartX = op.output.x - 50;
        sch.wire([[junctionX, fbY], [r1StartX, fbY]]);
        sch.resistor(r1StartX, fbY, 'horizontal', { label: null, value: null });
        sch.text(r1StartX + 25, fbY - 30, 'R1', { size: 11, anchor: 'middle', bold: true });
        sch.text(r1StartX + 25, fbY - 16, r1, { size: 10, anchor: 'middle', color: COLORS.value, skipValidation: true });
        sch.dot(junctionX, fbY);
        sch.dot(op.output.x, fbY);

        // === OUTPUT ===
        const voutX = op.output.x + 60;
        sch.wire([[op.output.x, op.output.y], [voutX, op.output.y]]);
        sch.nodeLabel(voutX, op.output.y, 'Vout');

        // Annotation
        sch.text(width / 2, height - 10, 'VUT/VLT = Vref +/- Vsat * R2/(R1+R2)',
            { size: 10, color: COLORS.annotation });

        sch.finalize();
        return sch;
    }

    /**
     * Peak Detector
     */
    function peakDetector(container, options = {}) {
        const { width = 360, height = 200 } = options;

        const sch = new Schematic(container, { width, height });

        const opX = 120, opY = 100;
        const op = Schematic.opampTerminals(opX, opY);
        sch.opamp(opX, opY);

        // Vin to non-inverting input - wire connects from label
        const vinX = 25;
        sch.nodeLabel(vinX, op.nonInvInput.y, 'Vin');
        sch.wire([[vinX, op.nonInvInput.y], [op.nonInvInput.x, op.nonInvInput.y]]);

        // Diode from output
        const diodeX = op.output.x + 15;
        sch.diode(diodeX, op.output.y, 'horizontal');
        sch.wire([[op.output.x, op.output.y], [diodeX, op.output.y]]);
        const diodeEndX = diodeX + 50;

        // Hold capacitor
        const capX = diodeEndX + 20;
        sch.wire([[diodeEndX, op.output.y], [capX, op.output.y]]);
        sch.dot(capX, op.output.y);

        // Capacitor vertical - starts at signal level, goes down 50px
        const capStartY = op.output.y + 10;
        const capEndY = capStartY + 50;
        sch.wire([[capX, op.output.y], [capX, capStartY]]);
        sch.capacitor(capX, capStartY, 'vertical', { label: 'C', value: '100n' });
        sch.wire([[capX, capEndY], [capX, capEndY + 10]]);
        sch.ground(capX, capEndY + 10);

        // Feedback from capacitor node to inverting input
        const fbY = opY - 40;
        sch.wire([[capX, op.output.y], [capX, fbY]]);
        sch.wire([[capX, fbY], [op.invInput.x, fbY]]);
        sch.wire([[op.invInput.x, fbY], [op.invInput.x, op.invInput.y]]);
        sch.dot(op.invInput.x, fbY);
        sch.dot(capX, fbY);

        // Output - wire connects to label
        const voutX = capX + 35;
        sch.wire([[capX, op.output.y], [voutX, op.output.y]]);
        sch.nodeLabel(voutX, op.output.y, 'Vpeak');

        // Annotation
        sch.text(width / 2, height - 10, 'Holds peak voltage on capacitor',
            { size: 10, color: COLORS.annotation });

        sch.finalize();
        return sch;
    }

    /**
     * Active (Precision) Rectifier
     */
    function activeRectifier(container, options = {}) {
        const { width = 380, height = 240, r = '10k' } = options;

        const sch = new Schematic(container, { width, height });

        const opX = 140, opY = 130;
        const op = Schematic.opampTerminals(opX, opY);
        sch.opamp(opX, opY);

        // Vin through R to inverting input
        // Wire must connect nodeLabel directly to resistor (no gap!)
        const vinX = 20;
        sch.nodeLabel(vinX, op.invInput.y, 'Vin');
        const rStartX = vinX + 20;
        sch.wire([[vinX, op.invInput.y], [rStartX, op.invInput.y]]);  // Connect Vin to resistor
        sch.resistor(rStartX, op.invInput.y, 'horizontal', { label: null, value: null });
        sch.text(rStartX + 25, op.invInput.y - 36, 'R', { size: 11, bold: true, anchor: 'middle' });
        sch.text(rStartX + 25, op.invInput.y - 20, r, { size: 10, color: COLORS.value, anchor: 'middle' });
        const rEndX = rStartX + 50;
        sch.wire([[rEndX, op.invInput.y], [op.invInput.x, op.invInput.y]]);

        // Non-inverting to ground
        sch.wire([[op.nonInvInput.x, op.nonInvInput.y], [op.nonInvInput.x - 15, op.nonInvInput.y]]);
        sch.ground(op.nonInvInput.x - 15, op.nonInvInput.y + 10);
        sch.wire([[op.nonInvInput.x - 15, op.nonInvInput.y], [op.nonInvInput.x - 15, op.nonInvInput.y + 10]]);

        // Diode in feedback path
        const fbY = opY - 65;
        sch.wire([[op.invInput.x, op.invInput.y], [op.invInput.x, fbY]]);
        sch.diode(op.invInput.x, fbY, 'horizontal');
        sch.wire([[op.invInput.x + 50, fbY], [op.output.x, fbY]]);
        sch.wire([[op.output.x, fbY], [op.output.x, op.output.y]]);
        sch.dot(op.invInput.x, fbY);
        sch.dot(op.output.x, fbY);

        // Feedback resistor (in parallel path)
        const fb2Y = opY - 100;
        sch.wire([[op.invInput.x, fbY], [op.invInput.x, fb2Y]]);
        sch.resistor(op.invInput.x, fb2Y, 'horizontal', { label: null, value: null });
        sch.text(op.invInput.x - 12, fb2Y - 10, 'R', { size: 11, bold: true, anchor: 'end' });
        sch.text(op.invInput.x - 12, fb2Y + 4, r, { size: 10, color: COLORS.value, anchor: 'end' });
        sch.wire([[op.invInput.x + 50, fb2Y], [op.output.x + 30, fb2Y]]);
        sch.wire([[op.output.x + 30, fb2Y], [op.output.x + 30, op.output.y]]);
        sch.dot(op.invInput.x, fb2Y);

        // Output
        const voutX = op.output.x + 60;
        sch.wire([[op.output.x, op.output.y], [voutX, op.output.y]]);
        sch.dot(op.output.x + 30, op.output.y);
        sch.nodeLabel(voutX, op.output.y, 'Vout');

        // Annotation
        sch.text(width / 2, height - 10, 'Precision half-wave rectifier',
            { size: 10, color: COLORS.annotation });

        sch.finalize();
        return sch;
    }

    /**
     * Bandpass Filter (Multiple Feedback topology)
     */
    function bandpassFilter(container, options = {}) {
        const { width = 400, height = 260 } = options;

        const sch = new Schematic(container, { width, height });

        const opX = 200, opY = 140;
        const op = Schematic.opampTerminals(opX, opY);
        sch.opamp(opX, opY);

        // Input through C1 - wire connects label to capacitor (no gap!)
        const vinX = 20;
        sch.nodeLabel(vinX, op.invInput.y, 'Vin');
        const c1StartX = vinX + 20;
        sch.wire([[vinX, op.invInput.y], [c1StartX, op.invInput.y]]);  // Label to capacitor
        sch.capacitor(c1StartX, op.invInput.y, 'horizontal', { label: 'C1' });
        const c1EndX = c1StartX + 50;

        // R1 from C1 to inverting input
        const r1StartX = c1EndX + 10;
        sch.wire([[c1EndX, op.invInput.y], [r1StartX, op.invInput.y]]);
        sch.resistor(r1StartX, op.invInput.y, 'horizontal', { label: 'R1' });
        const r1EndX = r1StartX + 50;
        sch.wire([[r1EndX, op.invInput.y], [op.invInput.x, op.invInput.y]]);

        // Non-inverting to ground
        sch.wire([[op.nonInvInput.x, op.nonInvInput.y], [op.nonInvInput.x - 15, op.nonInvInput.y]]);
        sch.ground(op.nonInvInput.x - 15, op.nonInvInput.y + 10);
        sch.wire([[op.nonInvInput.x - 15, op.nonInvInput.y], [op.nonInvInput.x - 15, op.nonInvInput.y + 10]]);

        // Feedback: R2 in parallel with C2
        const fbY = opY - 70;
        sch.wire([[op.invInput.x, op.invInput.y], [op.invInput.x, fbY]]);
        sch.resistor(op.invInput.x, fbY, 'horizontal', { label: null, value: null });
        sch.text(op.invInput.x - 12, fbY + 20, 'R2', { size: 11, bold: true, anchor: 'end' });
        sch.wire([[op.invInput.x + 50, fbY], [op.output.x, fbY]]);
        sch.wire([[op.output.x, fbY], [op.output.x, op.output.y]]);
        sch.dot(op.invInput.x, fbY);
        sch.dot(op.output.x, fbY);

        // C2 below R2
        const c2Y = opY - 110;
        sch.wire([[op.invInput.x, fbY], [op.invInput.x, c2Y]]);
        sch.capacitor(op.invInput.x, c2Y, 'horizontal', { label: 'C2' });
        sch.wire([[op.invInput.x + 50, c2Y], [op.output.x, c2Y]]);
        sch.wire([[op.output.x, c2Y], [op.output.x, fbY]]);
        sch.dot(op.invInput.x, c2Y);

        // Output
        const voutX = op.output.x + 50;
        sch.wire([[op.output.x, op.output.y], [voutX, op.output.y]]);
        sch.nodeLabel(voutX, op.output.y, 'Vout');

        // Annotation
        sch.text(width / 2, height - 10, 'Multiple Feedback Bandpass',
            { size: 10, color: COLORS.annotation });

        sch.finalize();
        return sch;
    }

    /**
     * Sample and Hold Circuit
     */
    function sampleAndHold(container, options = {}) {
        const { width = 400, height = 200 } = options;

        const sch = new Schematic(container, { width, height });

        const midY = 100;
        const opX = 260, opY = 100;

        // Vin - wire connects from label
        const vinX = 25;
        sch.nodeLabel(vinX, midY, 'Vin');

        // Switch symbol (SPST, shown open)
        const swStartX = vinX + 15;
        const swEndX = swStartX + 50;

        // Treat switch terminals as component pins for validation.
        sch.nodeRegistry.register(swStartX, midY, null, 'pin');
        sch.nodeRegistry.register(swEndX, midY, null, 'pin');

        sch.wire([[vinX, midY], [swStartX, midY]]);
        sch.dot(swStartX, midY);
        // Draw the open switch arm as a *symbol* line (not an electrical wire).
        const arm = elem('line', {
            x1: swStartX,
            y1: midY,
            x2: swStartX + 35,
            y2: midY - 10,
            stroke: COLORS.component,
            strokeWidth: LINE_WIDTH,
            'stroke-linecap': 'round'
        });
        sch.componentGroup.appendChild(arm);
        sch.dot(swEndX, midY);
        sch.text(swStartX + 25, midY - 25, 'S', { size: 10, color: COLORS.label });

        // Hold capacitor
        const capX = swEndX + 40;
        sch.wire([[swEndX, midY], [capX, midY]]);
        sch.dot(capX, midY);

        // Capacitor vertical
        const capStartY = midY + 10;
        const capEndY = capStartY + 50;
        sch.wire([[capX, midY], [capX, capStartY]]);
        sch.capacitor(capX, capStartY, 'vertical', { label: 'C', value: '1n' });
        sch.wire([[capX, capEndY], [capX, capEndY + 10]]);
        sch.ground(capX, capEndY + 10);

        // Buffer op-amp
        const op = Schematic.opampTerminals(opX, opY);
        sch.opamp(opX, opY);

        // Connect cap to non-inverting - route horizontally then to input
        sch.wire([[capX, midY], [capX + 20, midY]]);
        sch.wire([[capX + 20, midY], [capX + 20, op.nonInvInput.y]]);
        sch.wire([[capX + 20, op.nonInvInput.y], [op.nonInvInput.x, op.nonInvInput.y]]);

        // Unity gain feedback
        const fbY = opY + 50;
        sch.wire([[op.invInput.x, op.invInput.y], [op.invInput.x, fbY]]);
        sch.wire([[op.invInput.x, fbY], [op.output.x, fbY]]);
        sch.wire([[op.output.x, fbY], [op.output.x, op.output.y]]);
        sch.dot(op.output.x, fbY);

        // Output - wire connects to label
        const voutX = op.output.x + 35;
        sch.wire([[op.output.x, op.output.y], [voutX, op.output.y]]);
        sch.nodeLabel(voutX, op.output.y, 'Vout');

        // Control signal annotation
        sch.text(swStartX + 25, midY + 20, 'CLK', { size: 9, color: COLORS.annotation });

        // Annotation
        sch.text(width / 2, height - 10, 'Track when S closed, Hold when S open',
            { size: 10, color: COLORS.annotation });

        sch.finalize();
        return sch;
    }

    /**
     * Level Shifter (Resistive)
     */
    function levelShifter(container, options = {}) {
        const { width = 280, height = 200, r1 = '10k', r2 = '10k' } = options;

        const sch = new Schematic(container, { width, height });

        const midY = 100;
        const gndY = 175;

        // Vin - wire connects from label
        const vinX = 25;
        sch.nodeLabel(vinX, midY, 'Vin');

        // Coupling capacitor
        const capStartX = vinX + 15;
        const capEndX = capStartX + 50;
        sch.wire([[vinX, midY], [capStartX, midY]]);
        sch.capacitor(capStartX, midY, 'horizontal', { label: 'C' });

        // Junction node
        const junctionX = capEndX + 20;
        sch.wire([[capEndX, midY], [junctionX, midY]]);
        sch.dot(junctionX, midY);

        // R1 from Vbias to junction - wire connects label horizontally (no gap!)
        const vbiasY = 25;
        const r1StartY = vbiasY + 10;
        const r1EndY = r1StartY + 50;
        const vbiasLabelX = junctionX + 15;
        sch.wire([[junctionX, vbiasY], [vbiasLabelX, vbiasY]]);  // Wire to label
        sch.nodeLabel(vbiasLabelX, vbiasY, 'Vbias');
        sch.wire([[junctionX, vbiasY], [junctionX, r1StartY]]);
        sch.resistor(junctionX, r1StartY, 'vertical', { label: 'R1', value: r1 });
        sch.wire([[junctionX, r1EndY], [junctionX, midY]]);

        // R2 from junction to ground
        const r2StartY = midY + 10;
        const r2EndY = r2StartY + 50;
        sch.wire([[junctionX, midY], [junctionX, r2StartY]]);
        sch.resistor(junctionX, r2StartY, 'vertical', { label: 'R2', value: r2 });
        sch.wire([[junctionX, r2EndY], [junctionX, gndY]]);
        sch.ground(junctionX, gndY);

        // Output - wire connects to label
        const voutX = junctionX + 60;
        sch.wire([[junctionX, midY], [voutX, midY]]);
        sch.nodeLabel(voutX, midY, 'Vout');

        // Annotation
        sch.text(width / 2, height - 10, 'DC level = Vbias × R2/(R1+R2)',
            { size: 10, color: COLORS.annotation });

        sch.finalize();
        return sch;
    }

    /**
     * Instrumentation Amplifier (3 op-amp topology)
     */
    function instrumentationAmp(container, options = {}) {
        const { width = 500, height = 340 } = options;

        const sch = new Schematic(container, { width, height });

        // Three op-amps: two input buffers, one diff amp
        const op1X = 120, op1Y = 95;
        const op2X = 120, op2Y = 260;
        const op3X = 350, op3Y = 170;

        const op1 = Schematic.opampTerminals(op1X, op1Y);
        const op2 = Schematic.opampTerminals(op2X, op2Y);
        const op3 = Schematic.opampTerminals(op3X, op3Y);

        sch.opamp(op1X, op1Y, { label: 'U1' });
        sch.opamp(op2X, op2Y, { label: 'U2' });
        sch.opamp(op3X, op3Y, { label: 'U3' });

        // V+ input - wire must connect directly from label to op-amp (no gap!)
        const vinPlusX = 25;
        sch.nodeLabel(vinPlusX, op1.nonInvInput.y, 'V+');
        sch.wire([[vinPlusX, op1.nonInvInput.y], [op1.nonInvInput.x, op1.nonInvInput.y]]);

        // V- input - wire must connect directly from label to op-amp (no gap!)
        const vinMinusX = 25;
        sch.nodeLabel(vinMinusX, op2.nonInvInput.y, 'V-');
        sch.wire([[vinMinusX, op2.nonInvInput.y], [op2.nonInvInput.x, op2.nonInvInput.y]]);

        // Gain resistor Rg between op1 and op2 outputs (through inverting inputs)
        const rgX = op1.invInput.x - 30;
        sch.wire([[op1.invInput.x, op1.invInput.y], [rgX, op1.invInput.y]]);
        sch.wire([[rgX, op1.invInput.y], [rgX, op1Y + 40]]);
        sch.resistor(rgX, op1Y + 40, 'vertical', { label: 'Rg' });
        sch.wire([[rgX, op1Y + 90], [rgX, op2Y - 40]]);
        sch.wire([[rgX, op2Y - 40], [rgX, op2.invInput.y]]);
        sch.wire([[rgX, op2.invInput.y], [op2.invInput.x, op2.invInput.y]]);

        // R resistors for feedback
        const rY1 = op1.invInput.y;
        const rY2 = op2.invInput.y;
        const r1Y = op1Y - 70;
        sch.wire([[op1.invInput.x, rY1], [op1.invInput.x, r1Y]]);
        sch.resistor(op1.invInput.x, r1Y, 'horizontal', { label: null, value: null });
        sch.text(op1.invInput.x - 24, r1Y - 28, 'R', { size: 11, anchor: 'end', bold: true });
        sch.wire([[op1.invInput.x + 50, r1Y], [op1.output.x, r1Y]]);
        sch.wire([[op1.output.x, r1Y], [op1.output.x, op1.output.y]]);
        sch.dot(op1.invInput.x, r1Y);
        sch.dot(op1.output.x, r1Y);

        // Move R further from U2 to avoid collision (increased from 35 to 50)
        const r2OffsetY = op2Y + 65;
        sch.wire([[op2.invInput.x, rY2], [op2.invInput.x, r2OffsetY]]);
        sch.resistor(op2.invInput.x, r2OffsetY, 'horizontal', { label: null, value: null });
        sch.text(op2.invInput.x - 24, r2OffsetY - 28, 'R', { size: 11, anchor: 'end', bold: true });
        sch.wire([[op2.invInput.x + 50, r2OffsetY], [op2.output.x, r2OffsetY]]);
        sch.wire([[op2.output.x, r2OffsetY], [op2.output.x, op2.output.y]]);
        sch.dot(op2.invInput.x, r2OffsetY);
        sch.dot(op2.output.x, r2OffsetY);

        // Connect to diff amp (op3)
        // Keep a wider gap from op3 input network so the vertical bus doesn't clip resistor bodies.
        const op3BusX = op3.invInput.x - 25;
        sch.wire([[op1.output.x, op1.output.y], [op1.output.x + 30, op1.output.y]]);
        sch.resistor(op1.output.x + 30, op1.output.y, 'horizontal', { label: null, value: null });
        sch.text(op1.output.x + 55, op1.output.y - 36, 'R', { size: 11, anchor: 'middle', bold: true });
        sch.wire([[op1.output.x + 80, op1.output.y], [op3BusX, op1.output.y]]);
        sch.wire([[op3BusX, op1.output.y], [op3BusX, op3.invInput.y]]);
        sch.wire([[op3BusX, op3.invInput.y], [op3.invInput.x, op3.invInput.y]]);

        sch.wire([[op2.output.x, op2.output.y], [op2.output.x + 30, op2.output.y]]);
        sch.resistor(op2.output.x + 30, op2.output.y, 'horizontal', { label: null, value: null });
        sch.text(op2.output.x + 55, op2.output.y - 36, 'R', { size: 11, anchor: 'middle', bold: true });
        sch.wire([[op2.output.x + 80, op2.output.y], [op3BusX, op2.output.y]]);
        sch.wire([[op3BusX, op2.output.y], [op3BusX, op3.nonInvInput.y]]);
        sch.wire([[op3BusX, op3.nonInvInput.y], [op3.nonInvInput.x, op3.nonInvInput.y]]);

        // Op3 feedback
        const fb3Y = op3Y - 60;
        sch.wire([[op3.invInput.x, op3.invInput.y], [op3.invInput.x, fb3Y]]);
        sch.resistor(op3.invInput.x, fb3Y, 'horizontal', { label: null, value: null });
        sch.text(op3.invInput.x - 24, fb3Y - 28, 'R', { size: 11, anchor: 'end', bold: true });
        sch.wire([[op3.invInput.x + 50, fb3Y], [op3.output.x, fb3Y]]);
        sch.wire([[op3.output.x, fb3Y], [op3.output.x, op3.output.y]]);
        sch.dot(op3.invInput.x, fb3Y);
        sch.dot(op3.output.x, fb3Y);

        // Op3 non-inv to ground through R
        const r3GroundY = op3Y + 135;
        sch.wire([[op3.nonInvInput.x, op3.nonInvInput.y], [op3.nonInvInput.x, op3Y + 65]]);
        sch.resistor(op3.nonInvInput.x, op3Y + 65, 'vertical', { label: null, value: null });
        sch.text(op3.nonInvInput.x - 50, op3Y + 105, 'R', { size: 11, anchor: 'end', bold: true });
        sch.ground(op3.nonInvInput.x, r3GroundY);
        sch.wire([[op3.nonInvInput.x, op3Y + 115], [op3.nonInvInput.x, r3GroundY]]);

        // Output
        const voutX = op3.output.x + 40;
        sch.wire([[op3.output.x, op3.output.y], [voutX, op3.output.y]]);
        sch.nodeLabel(voutX, op3.output.y, 'Vout');

        // Annotation
        sch.text(width / 2, height - 10, 'Gain = 1 + 2R/Rg',
            { size: 10, color: COLORS.annotation });

        sch.finalize();
        return sch;
    }

    /**
     * Sziklai (Complementary Feedback) Pair - NPN driver with PNP output
     * Only 1 VBE drop, faster than Darlington
     */
    function sziklaiPair(container, options = {}) {
        const { width = 280, height = 240 } = options;

        const sch = new Schematic(container, { width, height });

        const vccY = 30;
        const q1X = 100, q1Y = 90;  // NPN driver
        const q2X = 160, q2Y = 130; // PNP output

        // Q1 terminals (NPN driver)
        const q1 = Schematic.npnTerminals(q1X, q1Y, false);
        // Q2 terminals (PNP output)
        const q2 = Schematic.pnpTerminals(q2X, q2Y, false);

        // VCC rail
        sch.vcc(q2.emitter.x, vccY, { label: 'VCC' });

        // Q2 emitter (PNP) connects to VCC
        sch.wire([[q2.emitter.x, vccY], [q2.emitter.x, q2.emitter.y]]);

        // Q1 (NPN driver)
        sch.npn(q1X, q1Y, { label: null, circle: false });
        sch.text(q1.base.x - 40, q1.base.y - 28, 'Q1', { size: 11, bold: true, anchor: 'end' });

        // Q2 (PNP output)
        sch.pnp(q2X, q2Y, { label: 'Q2', circle: false });

        // Q1 collector to Q2 base (route around Q1 body)
        const q1RouteX = q1.collector.x + 20;
        sch.wire([[q1.collector.x, q1.collector.y], [q1RouteX, q1.collector.y]]);
        sch.wire([[q1RouteX, q1.collector.y], [q1RouteX, q2.base.y]]);
        sch.wire([[q1RouteX, q2.base.y], [q2.base.x, q2.base.y]]);

        // Q1 emitter and Q2 collector join at output
        const outY = 175;
        sch.wire([[q1.emitter.x, q1.emitter.y], [q1.emitter.x, outY]]);
        sch.wire([[q2.collector.x, q2.collector.y], [q2.collector.x, outY]]);
        sch.wire([[q1.emitter.x, outY], [q2.collector.x, outY]]);
        sch.dot((q1.emitter.x + q2.collector.x) / 2, outY);

        // Output
        const voutX = q2.collector.x + 50;
        sch.wire([[(q1.emitter.x + q2.collector.x) / 2, outY], [voutX, outY]]);
        sch.nodeLabel(voutX, outY, 'Vout');

        // Input
        const vinX = 30;
        sch.nodeLabel(vinX, q1.base.y, 'Vin');
        sch.wire([[vinX, q1.base.y], [q1.base.x, q1.base.y]]);

        // Annotation
        sch.text(width / 2, height - 15, 'Only 1 VBE drop!',
            { size: 10, color: COLORS.annotation });

        sch.finalize();
        return sch;
    }

    /**
     * Darlington Pair - High current gain configuration
     * Rule: No wires through components - route around with 90° turns
     */
    function darlingtonPair(container, options = {}) {
        const { width = 320, height = 300 } = options;

        const sch = new Schematic(container, { width, height });

        // Layout - offset Q2 horizontally to avoid wire-through-component issues
        const vccY = 30;
        const gndY = 270;
        const q1X = 120;   // Q1 position
        const q1Y = 90;
        const q2X = 180;   // Q2 offset to the right
        const q2Y = 170;

        // Get terminal positions
        const q1 = Schematic.npnTerminals(q1X, q1Y, false);
        const q2 = Schematic.npnTerminals(q2X, q2Y, false);

        // VCC rail - spans both collectors
        const vccRailLeft = q1.collector.x;
        const vccRailRight = q2.collector.x;
        sch.vcc((vccRailLeft + vccRailRight) / 2, vccY, { label: 'VCC' });
        sch.wire([[vccRailLeft, vccY], [vccRailRight, vccY]]);

        // Q1 collector to VCC rail
        sch.wire([[q1.collector.x, vccY], [q1.collector.x, q1.collector.y]]);

        // Q2 collector to VCC rail
        sch.wire([[q2.collector.x, vccY], [q2.collector.x, q2.collector.y]]);

        // Draw transistors
        sch.npn(q1X, q1Y, { label: 'Q1', circle: false });
        sch.npn(q2X, q2Y, { label: 'Q2', circle: false });

        // Q1 emitter to Q2 base - route AROUND Q2 (no wire through components)
        // Go from Q1 emitter DOWN, then RIGHT to Q2 base
        const connectionY = q1.emitter.y + 25;  // Below Q1 emitter, above Q2
        sch.wire([[q1.emitter.x, q1.emitter.y], [q1.emitter.x, connectionY]]);
        sch.wire([[q1.emitter.x, connectionY], [q2.base.x, connectionY]]);
        sch.wire([[q2.base.x, connectionY], [q2.base.x, q2.base.y]]);
        sch.dot(q1.emitter.x, connectionY);

        // Input to Q1 base - wire connects from label
        const vinX = 40;
        sch.nodeLabel(vinX, q1.base.y, 'Vin');
        sch.wire([[vinX, q1.base.y], [q1.base.x, q1.base.y]]);

        // Q2 emitter through RE to ground
        // Calculate RE position so it doesn't extend below ground
        const reStartY = q2.emitter.y + 10;
        const reEndY = reStartY + 50;
        sch.resistor(q2.emitter.x, reStartY, 'vertical', { label: 'RE' });
        sch.wire([[q2.emitter.x, q2.emitter.y], [q2.emitter.x, reStartY]]);
        sch.wire([[q2.emitter.x, reEndY], [q2.emitter.x, gndY]]);
        sch.ground(q2.emitter.x, gndY);

        // Output from Q2 emitter (tap before RE)
        const voutX = q2.emitter.x + 55;
        const voutY = q2.emitter.y + 10;
        sch.dot(q2.emitter.x, voutY);
        sch.wire([[q2.emitter.x, voutY], [voutX, voutY]]);
        sch.nodeLabel(voutX, voutY, 'Vout');

        // Annotation
        sch.text(width / 2, height - 10, 'β_total ≈ β1 × β2',
            { size: 10, color: COLORS.annotation });

        sch.finalize();
        return sch;
    }

    /**
     * Wilson Current Mirror - Improved current mirror with better output impedance
     * Rule: No wires through resistors - connect only to terminals
     */
    function wilsonMirror(container, options = {}) {
        const { width = 340, height = 320 } = options;

        const sch = new Schematic(container, { width, height });

        // Layout - stack the Wilson pair on the RIGHT (Q3 above Q2), single device on the left.
        const vccY = 40;
        const gndY = 290;
        const q1X = 80;     // Single device (left)
        const q2X = 230;    // Mirror device (right, bottom)
        const q1Y = 220;    // Q1 and Q2 at same level
        const q2Y = 220;
        // Place Q3 directly above Q2 for the stacked right-side look.
        const q3X = q2X;
        const q3Y = q2Y - 90;

        // Get terminal positions
        const q1 = Schematic.npnTerminals(q1X, q1Y, false);
        const q2 = Schematic.npnTerminals(q2X, q2Y, false);
        const q3 = Schematic.npnTerminals(q3X, q3Y, false);

        // Title
        sch.text(width / 2, 8, 'Wilson Current Mirror', { size: 12, bold: true });

        // Right-side bus positions (output and reference)
        const outX = q3.collector.x + 30;
        const inX = q3.collector.x + 65;

        // VCC rail (spans output leg and reference resistor)
        sch.wire([[outX, vccY], [inX, vccY]]);
        sch.vcc((outX + inX) / 2, vccY, { label: 'VCC' });

        // Reference resistor from VCC to input node (Iref)
        const rrefStartY = vccY + 5;
        const rrefEndY = rrefStartY + 50;
        sch.resistor(inX, rrefStartY, 'vertical', { label: 'Rref' });
        sch.wire([[inX, vccY], [inX, rrefStartY]]);

        // Draw transistors
        sch.npn(q3X, q3Y, { label: null, circle: false });
        sch.text(q3.base.x - 35, q3.base.y - 18, 'Q3', { size: 11, bold: true, anchor: 'end' });
        sch.npn(q1X, q1Y, { label: 'Q1', circle: false });
        sch.npn(q2X, q2Y, { label: 'Q2', circle: false });

        // Base node: Q1 C=B + Q2 base + Q3 emitter
        const baseRailY = q3.emitter.y + 20;
        sch.wire([[q3.emitter.x, q3.emitter.y], [q3.emitter.x, baseRailY]]);
        sch.dot(q3.emitter.x, baseRailY);
        sch.wire([[q3.emitter.x, baseRailY], [q1.base.x, baseRailY]]);
        sch.wire([[q1.base.x, baseRailY], [q1.base.x, q1.base.y]]);
        sch.wire([[q1.base.x, baseRailY], [q2.base.x, baseRailY]]);
        sch.wire([[q2.base.x, baseRailY], [q2.base.x, q2.base.y]]);

        // Q1 diode-connected (collector to base) - left-side routing
        const diodeX = q1.base.x - 15;
        sch.wire([[q1.base.x, q1.base.y], [diodeX, q1.base.y]]);
        sch.wire([[diodeX, q1.base.y], [diodeX, q1.collector.y]]);
        sch.wire([[diodeX, q1.collector.y], [q1.collector.x, q1.collector.y]]);
        sch.dot(diodeX, q1.base.y);

        // Input node (Iref): Q2 collector + Q3 base
        const routeX = q3.base.x - 20;
        const routeY = q3.emitter.y + 10;
        sch.dot(inX, q2.collector.y);
        sch.text(inX + 12, q2.collector.y - 14, 'Iref', { size: 11, bold: true, anchor: 'start', color: COLORS.annotation });
        sch.wire([[q2.collector.x, q2.collector.y], [inX, q2.collector.y]]);
        sch.dot(q2.collector.x, q2.collector.y);
        sch.wire([[inX, rrefEndY], [inX, q2.collector.y]]);
        sch.dot(inX, routeY);
        sch.wire([[inX, routeY], [routeX, routeY], [routeX, q3.base.y], [q3.base.x, q3.base.y]]);
        sch.dot(routeX, q3.base.y);

        // Output node (Iout): Q3 collector
        sch.wire([[q3.collector.x, q3.collector.y], [outX, q3.collector.y], [outX, vccY]]);
        sch.dot(q3.collector.x, q3.collector.y);
        const arrowTop = vccY + 15;
        const arrowBottom = q3.collector.y + 15;
        sch.currentArrow(outX, arrowTop, outX, arrowBottom);
        sch.text(outX - 12, (arrowTop + arrowBottom) / 2, 'Iout', { size: 11, bold: true, anchor: 'end', color: COLORS.signal });

        // Ground rail
        sch.wire([[q1.emitter.x, q1.emitter.y], [q1.emitter.x, gndY]]);
        sch.wire([[q2.emitter.x, q2.emitter.y], [q2.emitter.x, gndY]]);
        sch.wire([[q1.emitter.x, gndY], [q2.emitter.x, gndY]]);
        sch.ground((q1.emitter.x + q2.emitter.x) / 2, gndY);

        // Annotation
        sch.text(width / 2, height - 10, 'High output impedance: Rout ≈ β × ro',
            { size: 10, color: COLORS.annotation });

        sch.finalize();
        return sch;
    }

    /**
     * Half-Wave Rectifier with filter
     */
    function halfWaveRectifier(container, options = {}) {
        const { width = 350, height = 180, c = '1000µ', rl = '1k' } = options;

        const sch = new Schematic(container, { width, height });

        // Layout
        const midY = 90;
        const gndY = 150;

        // AC input - wire connects from label
        const vinX = 25;
        sch.nodeLabel(vinX, midY, 'VAC');

        // Diode after input
        const diodeX = vinX + 20;
        const diodeEndX = diodeX + 50;
        sch.wire([[vinX, midY], [diodeX, midY]]);
        sch.diode(diodeX, midY, 'horizontal', { label: null });
        sch.text(diodeX + 25, midY - 26, 'D1', { size: 11, bold: true });

        // Filter capacitor (after diode)
        const capX = diodeEndX + 30;
        sch.wire([[diodeEndX, midY], [capX, midY]]);
        sch.dot(capX, midY);
        const capStartY = midY + 10;
        const capEndY = capStartY + 50;
        sch.wire([[capX, midY], [capX, capStartY]]);
        sch.capacitorPol(capX, capStartY, 'vertical', { label: null, value: null });
        sch.text(capX - 18, capStartY + 20, 'C', { size: 11, bold: true, anchor: 'end' });
        sch.text(capX - 18, capStartY + 34, c, { size: 10, color: COLORS.value, anchor: 'end' });
        sch.wire([[capX, capEndY], [capX, gndY]]);

        // Load resistor
        const rlX = capX + 60;
        sch.wire([[capX, midY], [rlX, midY]]);
        sch.dot(rlX, midY);
        const rlStartY = midY + 10;
        const rlEndY = rlStartY + 50;
        sch.wire([[rlX, midY], [rlX, rlStartY]]);
        sch.resistor(rlX, rlStartY, 'vertical', { label: 'RL', value: rl });
        sch.wire([[rlX, rlEndY], [rlX, gndY]]);

        // Output - wire connects to label
        const voutX = rlX + 50;
        sch.wire([[rlX, midY], [voutX, midY]]);
        sch.nodeLabel(voutX, midY, 'VDC');

        // Ground rail
        sch.wire([[vinX, gndY], [rlX, gndY]]);
        sch.ground((vinX + rlX) / 2, gndY);

        // Return path from input
        sch.wire([[vinX, midY], [vinX, gndY]]);
        sch.dot(vinX, midY);

        // Annotation
        sch.text(width / 2, height - 10, 'Vripple ≈ Iload / (f × C)',
            { size: 10, color: COLORS.annotation });

        sch.finalize();
        return sch;
    }

    /**
     * Low-Side MOSFET Switch
     */
    function mosfetSwitch(container, options = {}) {
        const { width = 260, height = 250 } = options;

        const sch = new Schematic(container, { width, height });

        // Layout
        const vccY = 30;
        const gndY = 220;
        const qX = 130;
        const qY = 140;

        // Get terminal positions
        const m1 = Schematic.nmosTerminals(qX, qY, false);

        // VCC
        sch.vcc(m1.drain.x, vccY, { label: 'VCC' });

        // Load (between VCC and drain)
        sch.resistor(m1.drain.x, vccY + 15, 'vertical', { label: 'LOAD' });
        sch.wire([[m1.drain.x, vccY], [m1.drain.x, vccY + 15]]);
        sch.wire([[m1.drain.x, vccY + 65], [m1.drain.x, m1.drain.y]]);

        // NMOS
        sch.nmos(qX, qY, { label: 'M1', showType: true, showTerminals: false });

        // Source to ground
        sch.wire([[m1.source.x, m1.source.y], [m1.source.x, gndY]]);
        sch.ground(m1.source.x, gndY);

        // Gate input with pull-down resistor - wire connects from label
        const vinX = 40;
        sch.nodeLabel(vinX, m1.gate.y, 'Vctrl');
        sch.wire([[vinX, m1.gate.y], [m1.gate.x, m1.gate.y]]);

        // Gate pull-down resistor - tap off the gate wire
        const rpdX = vinX + 30;
        sch.dot(rpdX, m1.gate.y);
        const rpdStartY = m1.gate.y + 15;
        const rpdEndY = rpdStartY + 50;
        sch.wire([[rpdX, m1.gate.y], [rpdX, rpdStartY]]);
        sch.resistor(rpdX, rpdStartY, 'vertical', { label: 'Rpd', value: '10k' });
        sch.wire([[rpdX, rpdEndY], [rpdX, gndY]]);
        sch.wire([[rpdX, gndY], [m1.source.x, gndY]]);

        // Output indicator
        const voutY = (vccY + 65 + m1.drain.y) / 2;
        sch.dot(m1.drain.x, voutY);
        const voutX = m1.drain.x + 45;
        sch.wire([[m1.drain.x, voutY], [voutX, voutY]]);
        sch.nodeLabel(voutX, voutY, 'Vout');

        // Annotation
        sch.text(width / 2, height - 10, 'Low-side switch: Vgs > Vth → ON',
            { size: 10, color: COLORS.annotation });

        sch.finalize();
        return sch;
    }

    /**
     * Clamp Circuit - Limits signal to a reference voltage
     * Rule: Wires connect to diode terminals only (anode at top, cathode at bottom for vertical)
     */
    function clampCircuit(container, options = {}) {
        const { width = 320, height = 200, vref = '3.3V' } = options;

        const sch = new Schematic(container, { width, height });

        // Layout
        const midY = 70;
        const gndY = 170;

        // Input
        sch.nodeLabel(25, midY, 'Vin');

        // Series resistor
        sch.resistor(40, midY, 'horizontal', { label: 'R', value: '1k' });
        sch.wire([[25, midY], [40, midY]]);

        // Clamp node
        const clampX = 110;
        sch.wire([[90, midY], [clampX, midY]]);
        sch.dot(clampX, midY);

        // Clamp diode - vertical, anode at top connects to signal, cathode at bottom to Vref
        const diodeStartY = midY + 15;
        const diodeEndY = diodeStartY + 50;  // Diode is 50px tall
        sch.diode(clampX, diodeStartY, 'vertical', { label: 'D1' });
        sch.wire([[clampX, midY], [clampX, diodeStartY]]);  // Signal to diode anode

        // Diode cathode connects to Vref rail - wire connects to label (no gap!)
        const vrefY = diodeEndY + 15;
        const vrefLabelX = clampX + 65;
        sch.wire([[clampX, diodeEndY], [clampX, vrefY]]);
        sch.wire([[clampX, vrefY], [vrefLabelX, vrefY]]);  // Wire to label
        sch.nodeLabel(vrefLabelX, vrefY, 'Vref');
        sch.text(clampX + 100, vrefY, '= ' + vref, { size: 10, color: COLORS.value });

        // Output
        const voutX = 210;
        sch.wire([[clampX, midY], [voutX, midY]]);
        sch.nodeLabel(voutX, midY, 'Vout');

        // Ground reference (for input signal)
        sch.wire([[25, midY], [25, gndY]]);
        sch.ground(25, gndY);

        // Annotation
        sch.text(width / 2, height - 10, 'Vout ≤ Vref + 0.7V (Schottky: Vref + 0.3V)',
            { size: 10, color: COLORS.annotation });

        sch.finalize();
        return sch;
    }

    /**
     * Relaxation Oscillator (Op-amp based)
     * Rule: No wires through resistors - connect to terminals only with 90° turns
     */
    function relaxationOscillator(container, options = {}) {
        const { width = 400, height = 320, r = '10k', c = '100n' } = options;

        const sch = new Schematic(container, { width, height });

        // Layout - carefully planned to avoid wire-through-resistor issues
        const opX = 200, opY = 130;
        const vccY = 30;
        const gndY = 290;

        // Get terminal positions
        const op = Schematic.opampTerminals(opX, opY);

        // Op-amp
        sch.opamp(opX, opY);

        // VCC connection (op-amp power implied)
        sch.vcc(opX, vccY, { label: 'VCC' });

        // === TIMING CAPACITOR (C) ===
        // Capacitor left of inverting input, connects to ground
        const capX = 60;
        sch.capacitor(capX, op.invInput.y, 'horizontal', { label: 'C', value: c });
        // Wire from cap right terminal to inverting input
        const capRightX = capX + 50;
        sch.wire([[capRightX, op.invInput.y], [op.invInput.x, op.invInput.y]]);
        sch.dot(op.invInput.x, op.invInput.y);
        // Cap left terminal to ground
        sch.wire([[capX, op.invInput.y], [capX, gndY]]);

        // === FEEDBACK RESISTOR (R) - output to inverting input ===
        // Route ABOVE the op-amp
        const fbY = opY - 80;
        // From inverting input up
        sch.wire([[op.invInput.x, op.invInput.y], [op.invInput.x, fbY]]);
        sch.dot(op.invInput.x, fbY);
        // Horizontal resistor R
        sch.resistor(op.invInput.x, fbY, 'horizontal', { label: 'R', value: r });
        const rEndX = op.invInput.x + 50;
        // From R right terminal to output vertical line
        sch.wire([[rEndX, fbY], [op.output.x, fbY]]);
        sch.dot(op.output.x, fbY);
        // From feedback junction down to output
        sch.wire([[op.output.x, fbY], [op.output.x, op.output.y]]);

        // === POSITIVE FEEDBACK DIVIDER (R2, R3) ===
        // Divider is to the LEFT of the non-inverting input
        const divX = op.nonInvInput.x - 30;

        // R2: from output (via routing) to divider node
        // Route: output → right → down → left → divider node
        const r2Y = opY + 70;
        sch.wire([[op.output.x, op.output.y], [op.output.x + 40, op.output.y]]);
        sch.dot(op.output.x + 40, op.output.y);
        sch.wire([[op.output.x + 40, op.output.y], [op.output.x + 40, r2Y]]);
        // R2 horizontal, going LEFT from output side to divider
        sch.resistor(divX + 50, r2Y, 'horizontal', { label: 'R2' });
        sch.wire([[op.output.x + 40, r2Y], [divX + 100, r2Y]]);
        sch.wire([[divX + 50, r2Y], [divX, r2Y]]);  // Connect R2 left terminal to divider X
        sch.dot(divX, r2Y);

        // Connect divider node up to non-inverting input
        sch.wire([[divX, r2Y], [divX, op.nonInvInput.y]]);
        sch.wire([[divX, op.nonInvInput.y], [op.nonInvInput.x, op.nonInvInput.y]]);

        // R3: from divider node down to ground
        const r3StartY = r2Y + 15;
        const r3EndY = r3StartY + 50;
        sch.resistor(divX, r3StartY, 'vertical', { label: 'R3' });
        sch.wire([[divX, r2Y], [divX, r3StartY]]);  // Divider node to R3 top
        sch.wire([[divX, r3EndY], [divX, gndY]]);   // R3 bottom to ground

        // === GROUND RAIL ===
        sch.wire([[capX, gndY], [divX, gndY]]);
        sch.ground((capX + divX) / 2, gndY);

        // === OUTPUT ===
        const voutX = op.output.x + 70;
        sch.wire([[op.output.x + 40, op.output.y], [voutX, op.output.y]]);
        sch.nodeLabel(voutX, op.output.y, 'Vout');

        // Annotation
        sch.text(width / 2, height - 10, 'f ≈ 1/(2RC × ln(1 + 2R3/R2))',
            { size: 10, color: COLORS.annotation });

        sch.finalize();
        return sch;
    }

    /**
     * Bootstrap Bias Circuit - BJT bias with capacitor bootstrap
     * Rule: No wires through resistors - route around with 90° turns
     */
    function bootstrapBias(container, options = {}) {
        const { width = 360, height = 340 } = options;

        const sch = new Schematic(container, { width, height });

        // Layout - carefully planned to fit all components
        const vccY = 30;
        const gndY = 310;
        const qX = 200, qY = 130;

        // Get terminal positions
        const q1 = Schematic.npnTerminals(qX, qY, false);

        // VCC rail
        const rbX = 80;
        sch.wire([[rbX, vccY], [q1.collector.x, vccY]]);
        sch.vcc((rbX + q1.collector.x) / 2, vccY, { label: 'VCC' });

        // RC (collector resistor) - from VCC to collector
        const rcStartY = vccY + 10;
        const rcEndY = rcStartY + 50;
        sch.resistor(q1.collector.x, rcStartY, 'vertical', { label: 'RC' });
        sch.wire([[q1.collector.x, vccY], [q1.collector.x, rcStartY]]);
        sch.wire([[q1.collector.x, rcEndY], [q1.collector.x, q1.collector.y]]);

        // Transistor
        sch.npn(qX, qY, { label: 'Q1', circle: false });

        // RE1 (first emitter resistor) - from emitter down
        const re1StartY = q1.emitter.y + 10;
        const re1EndY = re1StartY + 50;
        sch.resistor(q1.emitter.x, re1StartY, 'vertical', { label: 'RE1' });
        sch.wire([[q1.emitter.x, q1.emitter.y], [q1.emitter.x, re1StartY]]);

        // Bootstrap tap node (at RE1 bottom)
        const bootstrapNodeY = re1EndY;
        sch.dot(q1.emitter.x, bootstrapNodeY);

        // RE2 (second emitter resistor) - from bootstrap node to ground
        const re2StartY = bootstrapNodeY + 10;
        const re2EndY = re2StartY + 50;
        sch.resistor(q1.emitter.x, re2StartY, 'vertical');
        sch.text(q1.emitter.x + 70, re2StartY + 12, 'RE2', { size: 11, bold: true, anchor: 'start' });
        sch.wire([[q1.emitter.x, bootstrapNodeY], [q1.emitter.x, re2StartY]]);
        sch.wire([[q1.emitter.x, re2EndY], [q1.emitter.x, gndY]]);
        sch.ground(q1.emitter.x, gndY);

        // RB (bias resistor) - from VCC down
        const rbStartY = vccY + 10;
        const rbEndY = rbStartY + 50;
        sch.resistor(rbX, rbStartY, 'vertical', { label: 'RB' });
        sch.wire([[rbX, vccY], [rbX, rbStartY]]);

        // RB bottom to base - straight horizontal at base level
        sch.wire([[rbX, rbEndY], [rbX, q1.base.y]]);
        sch.wire([[rbX, q1.base.y], [q1.base.x, q1.base.y]]);
        sch.dot(rbX, q1.base.y);

        // Bootstrap capacitor - connects RB node to RE1/RE2 junction
        // Route: from RB at base level, go RIGHT via capacitor, then DOWN to bootstrap node
        // But we need to go AROUND RE1, not through it!
        const capX = rbX + 15;
        const capEndX = capX + 50;
        const capY = q1.base.y + 25;  // Below base level

        // Wire from RB at base Y down to capacitor Y
        sch.wire([[rbX, q1.base.y], [rbX, capY]]);
        sch.dot(rbX, capY);

        // Capacitor horizontal
        sch.capacitor(capX, capY, 'horizontal');
        sch.text(capX + 25, capY + 28, 'Cb', { size: 11, bold: true });
        sch.wire([[rbX, capY], [capX, capY]]);

        // From capacitor right, go RIGHT past RE1, then DOWN to bootstrap node
        const bypassX = q1.emitter.x + 30;  // Right of RE1
        const bypassY = re2EndY + 10;       // Drop below RE2 to avoid keepouts
        sch.wire([[capEndX, capY], [capEndX, bypassY]]);
        sch.wire([[capEndX, bypassY], [bypassX, bypassY]]);
        sch.wire([[bypassX, bypassY], [bypassX, bootstrapNodeY]]);
        sch.wire([[bypassX, bootstrapNodeY], [q1.emitter.x, bootstrapNodeY]]);

        // Input - wire connects from label (no gap!)
        const vinLabelX = 25;
        sch.nodeLabel(vinLabelX, q1.base.y, 'Vin');
        sch.wire([[vinLabelX, q1.base.y], [rbX, q1.base.y]]);

        // Annotation
        sch.text(width / 2, height - 10, 'Bootstrap increases input impedance',
            { size: 10, color: COLORS.annotation });

        sch.finalize();
        return sch;
    }

    /**
     * Wien Bridge Oscillator - Sine wave oscillator using op-amp
     * Frequency: f = 1/(2πRC)
     */
    function wienBridgeOscillator(container, options = {}) {
        const { width = 450, height = 320, r = '10k', c = '10n' } = options;

        const sch = new Schematic(container, { width, height });

        const opX = 200, opY = 130;
        const gndY = 280;

        const op = Schematic.opampTerminals(opX, opY);

        // Op-amp
        sch.opamp(opX, opY);

        // === NEGATIVE FEEDBACK (gain setting: Av = 1 + Rf/Rg ≥ 3) ===
        // Rf horizontal above op-amp, connecting inv input to output
        const fbY = opY - 80;
        sch.wire([[op.invInput.x, op.invInput.y], [op.invInput.x, fbY]]);
        sch.dot(op.invInput.x, fbY);
        sch.resistor(op.invInput.x, fbY, 'horizontal', { label: 'Rf' });
        sch.wire([[op.invInput.x + 50, fbY], [op.output.x, fbY]]);
        sch.wire([[op.output.x, fbY], [op.output.x, op.output.y]]);
        sch.dot(op.output.x, op.output.y);

        // Rg to ground (from inverting input junction, routes LEFT then DOWN)
        // Keep Rg and its ground return clear of the Wien network (avoid clipping R2).
        const rgX = op.invInput.x - 60;
        sch.wire([[op.invInput.x, fbY], [rgX, fbY]]);
        sch.wire([[rgX, fbY], [rgX, fbY + 15]]);
        sch.resistor(rgX, fbY + 15, 'vertical', { label: 'Rg' });
        sch.wire([[rgX, fbY + 65], [rgX, gndY]]);

        // === WIEN BRIDGE NETWORK (positive feedback) ===
        // Layout: Series R1-C1 on the RIGHT side, from output DOWN to bridge node
        // then bridge node feeds non-inverting input
        // Parallel R2||C2 from bridge node to ground

        // Bridge node position (left of non-inverting input)
        const bridgeX = op.nonInvInput.x - 40;
        const bridgeNodeY = op.nonInvInput.y;

        // Connect bridge node to non-inverting input
        sch.wire([[bridgeX, bridgeNodeY], [op.nonInvInput.x, op.nonInvInput.y]]);
        sch.dot(bridgeX, bridgeNodeY);

        // === SERIES R1-C1 ARM (from output to bridge node) ===
        // Route: output goes RIGHT, then DOWN through R1-C1, then LEFT to bridge
        const seriesArmX = op.output.x + 50;

        // Output to series arm
        sch.wire([[op.output.x, op.output.y], [seriesArmX, op.output.y]]);
        sch.dot(seriesArmX, op.output.y);

        // R1 vertical from output level
        const r1StartY = op.output.y + 10;
        sch.wire([[seriesArmX, op.output.y], [seriesArmX, r1StartY]]);
        sch.resistor(seriesArmX, r1StartY, 'vertical', { label: 'R1', value: r });
        const r1EndY = r1StartY + 50;

        // C1 below R1
        const c1StartY = r1EndY + 10;
        sch.wire([[seriesArmX, r1EndY], [seriesArmX, c1StartY]]);
        sch.capacitor(seriesArmX, c1StartY, 'vertical', { label: 'C1', value: c });
        const c1EndY = c1StartY + 50;

        // === PARALLEL R2||C2 ARM (from bridge node to ground) ===
        // R2 directly below bridge node
        const r2StartY = bridgeNodeY + 15;
        sch.wire([[bridgeX, bridgeNodeY], [bridgeX, r2StartY]]);
        sch.resistor(bridgeX, r2StartY, 'vertical', { label: 'R2', value: r });
        sch.wire([[bridgeX, r2StartY + 50], [bridgeX, gndY]]);

        // C2 in parallel (offset to left)
        const c2X = bridgeX - 45;
        sch.wire([[bridgeX, bridgeNodeY], [c2X, bridgeNodeY]]);
        sch.wire([[c2X, bridgeNodeY], [c2X, r2StartY]]);
        sch.capacitor(c2X, r2StartY, 'vertical', { label: null, value: null });
        sch.text(c2X - 40, r2StartY + 18, 'C2', { size: 11, anchor: 'end', bold: true });
        sch.text(c2X - 40, r2StartY + 32, c, { size: 10, anchor: 'end', color: COLORS.value });
        sch.wire([[c2X, r2StartY + 50], [c2X, gndY]]);

        // === RETURN WIRE from C1 bottom to bridge node ===
        // CRITICAL: Must route LEFT of C2 to avoid going through R2!
        // Route: C1 bottom → down → far left (past C2) → up → right to bridge
        const returnRouteX = c2X - 25;  // Route left of C2

        // Down from C1 bottom
        sch.wire([[seriesArmX, c1EndY], [seriesArmX, c1EndY + 15]]);

        // Left past everything (C2 and R2)
        sch.wire([[seriesArmX, c1EndY + 15], [returnRouteX, c1EndY + 15]]);

        // Up on the far left side (NOT through R2!)
        sch.wire([[returnRouteX, c1EndY + 15], [returnRouteX, bridgeNodeY]]);

        // Right to meet C2 horizontal wire at bridge node level
        sch.wire([[returnRouteX, bridgeNodeY], [c2X, bridgeNodeY]]);
        sch.dot(c2X, bridgeNodeY);  // Junction with C2 top

        // Ground rail connections
        sch.wire([[c2X, gndY], [bridgeX, gndY]]);
        sch.wire([[rgX, gndY], [c2X, gndY]]);
        sch.ground((rgX + bridgeX) / 2, gndY);

        // Output label
        const voutX = seriesArmX + 40;
        sch.wire([[seriesArmX, op.output.y], [voutX, op.output.y]]);
        sch.nodeLabel(voutX, op.output.y, 'Vout');

        sch.text(width / 2, gndY + 30, 'f = 1/(2πRC), Gain ≥ 3 for oscillation',
            { size: 10, color: COLORS.annotation });

        sch.finalize();
        return sch;
    }

    /**
     * Phase Shift Oscillator - RC oscillator using BJT
     * Frequency: f = 1/(2π√6 RC)
     * Each RC stage provides 60° phase shift, 3 stages = 180°
     */
    function phaseShiftOscillator(container, options = {}) {
        const { width = 450, height = 300, r = '10k', c = '10n' } = options;

        const sch = new Schematic(container, { width, height });

        const vccY = 30;
        const gndY = 260;
        const qX = 380, qY = 130;

        const q1 = Schematic.npnTerminals(qX, qY, false);

        // Transistor
        sch.npn(qX, qY, { label: 'Q1', circle: false });

        // VCC and collector resistor
        sch.vcc(q1.collector.x, vccY, { label: 'VCC' });
        sch.wire([[q1.collector.x, vccY], [q1.collector.x, vccY + 15]]);
        sch.resistor(q1.collector.x, vccY + 15, 'vertical', { label: 'RC' });
        const rcBottomY = vccY + 15 + 50;
        sch.wire([[q1.collector.x, rcBottomY], [q1.collector.x, q1.collector.y]]);
        sch.dot(q1.collector.x, rcBottomY);

        // Emitter resistor
        sch.wire([[q1.emitter.x, q1.emitter.y], [q1.emitter.x, q1.emitter.y + 15]]);
        sch.resistor(q1.emitter.x, q1.emitter.y + 15, 'vertical', { label: 'RE' });
        sch.wire([[q1.emitter.x, q1.emitter.y + 65], [q1.emitter.x, gndY]]);

        // === THREE-STAGE RC PHASE SHIFT NETWORK ===
        // Each stage: horizontal capacitor followed by resistor to ground
        const phaseY = q1.base.y;
        const resGndY = phaseY + 30;  // Resistor start position

        // Stage 3 (closest to base): C3 → node → R3 to ground
        const node3X = q1.base.x - 30;
        const c3StartX = node3X - 50;
        sch.capacitor(c3StartX, phaseY, 'horizontal', { label: 'C3', value: c });
        sch.wire([[c3StartX + 50, phaseY], [q1.base.x, phaseY]]);
        sch.dot(c3StartX, phaseY);
        sch.wire([[c3StartX, phaseY], [c3StartX, resGndY]]);
        sch.resistor(c3StartX, resGndY, 'vertical', { label: 'R3', value: r });
        sch.wire([[c3StartX, resGndY + 50], [c3StartX, gndY]]);

        // Stage 2: C2 → node → R2 to ground
        const node2X = c3StartX - 60;
        const c2StartX = node2X - 50;
        sch.capacitor(c2StartX, phaseY, 'horizontal', { label: 'C2', value: c });
        sch.wire([[c2StartX + 50, phaseY], [c3StartX, phaseY]]);
        sch.dot(c2StartX, phaseY);
        sch.wire([[c2StartX, phaseY], [c2StartX, resGndY]]);
        sch.resistor(c2StartX, resGndY, 'vertical', { label: 'R2', value: r });
        sch.wire([[c2StartX, resGndY + 50], [c2StartX, gndY]]);

        // Stage 1 (from collector): C1 → node → R1 to ground
        const node1X = c2StartX - 60;
        const c1StartX = node1X - 50;
        sch.capacitor(c1StartX, phaseY, 'horizontal', { label: 'C1', value: c });
        sch.wire([[c1StartX + 50, phaseY], [c2StartX, phaseY]]);
        sch.dot(c1StartX, phaseY);
        sch.wire([[c1StartX, phaseY], [c1StartX, resGndY]]);
        sch.resistor(c1StartX, resGndY, 'vertical', { label: 'R1', value: r });
        sch.wire([[c1StartX, resGndY + 50], [c1StartX, gndY]]);

        // Feedback from collector to phase shift network
        const feedbackY = phaseY - 40;
        sch.wire([[q1.collector.x, rcBottomY], [q1.collector.x, feedbackY]]);
        sch.wire([[q1.collector.x, feedbackY], [c1StartX, feedbackY]]);
        sch.wire([[c1StartX, feedbackY], [c1StartX, phaseY]]);

        // Ground rail
        sch.wire([[c1StartX, gndY], [q1.emitter.x, gndY]]);
        sch.ground((c1StartX + q1.emitter.x) / 2, gndY);

        // Output label
        const voutX = q1.collector.x + 40;
        sch.wire([[q1.collector.x, rcBottomY], [voutX, rcBottomY]]);
        sch.nodeLabel(voutX, rcBottomY, 'Vout');

        sch.text(width / 2, height - 10, 'f = 1/(2π√6 RC), 3 stages × 60° = 180°',
            { size: 10, color: COLORS.annotation });

        sch.finalize();
        return sch;
    }

    /**
     * Colpitts Oscillator - LC oscillator with capacitive divider
     * Frequency: f = 1/(2π√(L×Ceq)) where Ceq = C1×C2/(C1+C2)
     * RFC = Radio Frequency Choke (blocks AC, passes DC)
     */
    function colpittsOscillator(container, options = {}) {
        const { width = 380, height = 320 } = options;

        const sch = new Schematic(container, { width, height });

        const vccY = 30;
        const gndY = 280;
        const qX = 150, qY = 140;

        const q1 = Schematic.npnTerminals(qX, qY, false);

        // Transistor
        sch.npn(qX, qY, { label: 'Q1', circle: false });

        // VCC rail
        sch.vcc(q1.collector.x, vccY, { label: 'VCC' });

        // RFC (RF Choke) - from VCC to collector
        sch.wire([[q1.collector.x, vccY], [q1.collector.x, vccY + 15]]);
        sch.inductor(q1.collector.x, vccY + 15, 'vertical', { label: 'RFC' });
        const rfcBottomY = vccY + 15 + 50;
        sch.wire([[q1.collector.x, rfcBottomY], [q1.collector.x, q1.collector.y]]);
        sch.dot(q1.collector.x, rfcBottomY);

        // Emitter resistor
        sch.wire([[q1.emitter.x, q1.emitter.y], [q1.emitter.x, q1.emitter.y + 15]]);
        sch.resistor(q1.emitter.x, q1.emitter.y + 15, 'vertical', { label: 'RE' });
        sch.wire([[q1.emitter.x, q1.emitter.y + 65], [q1.emitter.x, gndY]]);
        // Junction for feedback will be placed at emitter terminal
        sch.dot(q1.emitter.x, q1.emitter.y);

        // === TANK CIRCUIT (Colpitts: L || (C1 series C2)) ===
        const tankX = q1.collector.x + 120;
        const tankTopY = rfcBottomY;
        const tankBotY = gndY;

        // Two parallel legs to avoid "series-LC" topology mistakes:
        // - Capacitor divider leg (C1, C2) at capX (junction feeds emitter)
        // - Inductor leg (L) at indX
        const capX = tankX - 40;
        const indX = tankX + 40;

        // Coupling capacitor Cc (collector -> tank top node)
        const ccStartX = q1.collector.x + 25;
        sch.wire([[q1.collector.x, rfcBottomY], [ccStartX, rfcBottomY]]);
        sch.capacitor(ccStartX, rfcBottomY, 'horizontal', { label: 'Cc' });
        const ccEndX = ccStartX + 50;
        sch.wire([[ccEndX, rfcBottomY], [capX, tankTopY]]);
        sch.dot(tankX, tankTopY);

        // Tank rails
        sch.wire([[capX, tankTopY], [indX, tankTopY]]);
        sch.wire([[capX, tankBotY], [indX, tankBotY]]);

        // Capacitor divider leg
        const c1StartY = tankTopY + 15;
        sch.wire([[capX, tankTopY], [capX, c1StartY]]);
        sch.capacitor(capX, c1StartY, 'vertical', { label: 'C1' });
        const c1EndY = c1StartY + 50; // C1 bottom (divider junction)
        sch.dot(capX, c1EndY);

        const c2StartY = c1EndY + 10;
        sch.wire([[capX, c1EndY], [capX, c2StartY]]);
        sch.capacitor(capX, c2StartY, 'vertical', { label: 'C2' });
        const c2EndY = c2StartY + 50;
        sch.wire([[capX, c2EndY], [capX, tankBotY]]);

        // Inductor leg
        const lStartY = tankTopY + 15;
        sch.wire([[indX, tankTopY], [indX, lStartY]]);
        sch.inductor(indX, lStartY, 'vertical', { label: 'L' });
        const lEndY = lStartY + 50;
        sch.wire([[indX, lEndY], [indX, tankBotY]]);

        // Feedback from divider junction (C1/C2) to emitter
        const fbX = capX - 25;
        sch.wire([[capX, c1EndY], [fbX, c1EndY], [fbX, q1.emitter.y], [q1.emitter.x, q1.emitter.y]]);
        sch.dot(fbX, q1.emitter.y);

        // Bias resistor divider (R1, R2)
        const biasX = q1.base.x - 50;
        sch.wire([[q1.base.x, q1.base.y], [biasX, q1.base.y]]);
        sch.dot(biasX, q1.base.y);

        // R1 from VCC
        sch.wire([[biasX, vccY], [biasX, vccY + 15]]);
        sch.resistor(biasX, vccY + 15, 'vertical', { label: 'R1' });
        sch.wire([[biasX, vccY + 65], [biasX, q1.base.y]]);

        // R2 to ground
        sch.wire([[biasX, q1.base.y], [biasX, q1.base.y + 15]]);
        sch.resistor(biasX, q1.base.y + 15, 'vertical', { label: 'R2' });
        sch.wire([[biasX, q1.base.y + 65], [biasX, gndY]]);

        // VCC rail connections
        sch.wire([[biasX, vccY], [q1.collector.x, vccY]]);

        // Ground rail
        sch.wire([[biasX, gndY], [tankX, gndY]]);
        sch.ground((biasX + tankX) / 2, gndY);

        sch.text(width / 2, gndY + 30, 'f = 1/(2π√(L×C1C2/(C1+C2)))',
            { size: 10, color: COLORS.annotation });

        sch.finalize();
        return sch;
    }

    /**
     * Hartley Oscillator - LC oscillator with inductive divider (tapped inductor)
     * Frequency: f = 1/(2π√((L1+L2)×C))
     * RFC = Radio Frequency Choke (high impedance to RF, low to DC)
     */
    function hartleyOscillator(container, options = {}) {
        const { width = 380, height = 320 } = options;

        const sch = new Schematic(container, { width, height });

        const vccY = 30;
        const gndY = 280;
        const qX = 150, qY = 140;

        const q1 = Schematic.npnTerminals(qX, qY, false);

        // Transistor
        sch.npn(qX, qY, { label: 'Q1', circle: false });

        // VCC rail
        sch.vcc(q1.collector.x, vccY, { label: 'VCC' });

        // RFC (RF Choke) from VCC to collector
        sch.wire([[q1.collector.x, vccY], [q1.collector.x, vccY + 15]]);
        sch.inductor(q1.collector.x, vccY + 15, 'vertical', { label: 'RFC' });
        const rfcBottomY = vccY + 15 + 50;
        sch.wire([[q1.collector.x, rfcBottomY], [q1.collector.x, q1.collector.y]]);
        sch.dot(q1.collector.x, rfcBottomY);

        // Emitter resistor
        sch.wire([[q1.emitter.x, q1.emitter.y], [q1.emitter.x, q1.emitter.y + 15]]);
        sch.resistor(q1.emitter.x, q1.emitter.y + 15, 'vertical', { label: 'RE' });
        sch.wire([[q1.emitter.x, q1.emitter.y + 65], [q1.emitter.x, gndY]]);
        // Junction for feedback at emitter terminal
        sch.dot(q1.emitter.x, q1.emitter.y);

        // === TANK CIRCUIT (Hartley: C || (L1 + L2), tap feeds emitter) ===
        const tankX = q1.collector.x + 120;
        const tankTopY = rfcBottomY;
        const tankBotY = gndY;

        // Two parallel legs:
        // - Tapped inductor leg at indX (L1 + L2 in series)
        // - Capacitor leg at capX
        const indX = tankX - 40;
        const capX = tankX + 40;

        // Coupling capacitor Cc (collector -> tank top node)
        const ccStartX = q1.collector.x + 25;
        sch.wire([[q1.collector.x, rfcBottomY], [ccStartX, rfcBottomY]]);
        sch.capacitor(ccStartX, rfcBottomY, 'horizontal', { label: 'Cc' });
        const ccEndX = ccStartX + 50;
        sch.wire([[ccEndX, rfcBottomY], [indX, tankTopY]]);
        sch.dot(tankX, tankTopY);

        // Tank rails
        sch.wire([[indX, tankTopY], [capX, tankTopY]]);
        sch.wire([[indX, tankBotY], [capX, tankBotY]]);

        // Tapped inductor leg: L1 then L2
        const l1StartY = tankTopY + 15;
        sch.wire([[indX, tankTopY], [indX, l1StartY]]);
        sch.inductor(indX, l1StartY, 'vertical', { label: 'L1' });
        const tapY = l1StartY + 50;
        sch.dot(indX, tapY);

        const l2StartY = tapY + 10;
        sch.wire([[indX, tapY], [indX, l2StartY]]);
        sch.inductor(indX, l2StartY, 'vertical', { label: 'L2' });
        const l2EndY = l2StartY + 50;
        sch.wire([[indX, l2EndY], [indX, tankBotY]]);

        // Capacitor leg (in parallel with total inductance)
        const cStartY = tankTopY + 15;
        sch.wire([[capX, tankTopY], [capX, cStartY]]);
        sch.capacitor(capX, cStartY, 'vertical', { label: 'C' });
        const cEndY = cStartY + 50;
        sch.wire([[capX, cEndY], [capX, tankBotY]]);

        // Feedback from tap to emitter
        const fbX = indX - 25;
        sch.wire([[indX, tapY], [fbX, tapY], [fbX, q1.emitter.y], [q1.emitter.x, q1.emitter.y]]);
        sch.dot(fbX, q1.emitter.y);

        // Bias resistor divider (R1, R2)
        const biasX = q1.base.x - 50;
        sch.wire([[q1.base.x, q1.base.y], [biasX, q1.base.y]]);
        sch.dot(biasX, q1.base.y);

        // R1 from VCC
        sch.wire([[biasX, vccY], [biasX, vccY + 15]]);
        sch.resistor(biasX, vccY + 15, 'vertical', { label: 'R1' });
        sch.wire([[biasX, vccY + 65], [biasX, q1.base.y]]);

        // R2 to ground
        sch.wire([[biasX, q1.base.y], [biasX, q1.base.y + 15]]);
        sch.resistor(biasX, q1.base.y + 15, 'vertical', { label: 'R2' });
        sch.wire([[biasX, q1.base.y + 65], [biasX, gndY]]);

        // VCC rail connections
        sch.wire([[biasX, vccY], [q1.collector.x, vccY]]);

        // Ground rail
        sch.wire([[biasX, gndY], [tankX, gndY]]);
        sch.ground((biasX + tankX) / 2, gndY);

        sch.text(width / 2, gndY + 30, 'f = 1/(2π√((L1+L2)×C))',
            { size: 10, color: COLORS.annotation });

        sch.finalize();
        return sch;
    }

    /**
     * Clapp Oscillator - Colpitts variant with an added series capacitor (C3) in the inductor leg.
     * Improves frequency stability by making C3 dominate the effective series capacitance.
     * 1/Ceq = 1/C1 + 1/C2 + 1/C3
     */
    function clappOscillator(container, options = {}) {
        const { width = 400, height = 340 } = options;

        const sch = new Schematic(container, { width, height });

        const vccY = 30;
        const gndY = 300;
        const qX = 150, qY = 140;

        const q1 = Schematic.npnTerminals(qX, qY, false);

        // Transistor
        sch.npn(qX, qY, { label: 'Q1', circle: false });

        // VCC rail
        sch.vcc(q1.collector.x, vccY, { label: 'VCC' });

        // RFC (RF Choke) from VCC to collector
        sch.wire([[q1.collector.x, vccY], [q1.collector.x, vccY + 15]]);
        sch.inductor(q1.collector.x, vccY + 15, 'vertical', { label: 'RFC' });
        const rfcBottomY = vccY + 15 + 50;
        sch.wire([[q1.collector.x, rfcBottomY], [q1.collector.x, q1.collector.y]]);
        sch.dot(q1.collector.x, rfcBottomY);

        // Emitter resistor
        sch.wire([[q1.emitter.x, q1.emitter.y], [q1.emitter.x, q1.emitter.y + 15]]);
        sch.resistor(q1.emitter.x, q1.emitter.y + 15, 'vertical', { label: 'RE' });
        sch.wire([[q1.emitter.x, q1.emitter.y + 65], [q1.emitter.x, gndY]]);
        sch.dot(q1.emitter.x, q1.emitter.y);

        // === TANK CIRCUIT (Clapp: (C1 series C2) in parallel with (L series C3)) ===
        const tankX = q1.collector.x + 130;
        const tankTopY = rfcBottomY;
        const tankBotY = gndY;

        const capX = tankX - 45;   // C1/C2 divider leg
        const indX = tankX + 45;   // L + C3 leg

        // Coupling capacitor from collector to tank top node
        const ccStartX = q1.collector.x + 25;
        sch.wire([[q1.collector.x, rfcBottomY], [ccStartX, rfcBottomY]]);
        sch.capacitor(ccStartX, rfcBottomY, 'horizontal', { label: 'Cc' });
        const ccEndX = ccStartX + 50;
        sch.wire([[ccEndX, rfcBottomY], [capX, tankTopY]]);
        sch.dot(tankX, tankTopY);

        // Tank rails
        sch.wire([[capX, tankTopY], [indX, tankTopY]]);
        sch.wire([[capX, tankBotY], [indX, tankBotY]]);

        // Capacitor divider leg (C1 then C2)
        const c1StartY = tankTopY + 15;
        sch.wire([[capX, tankTopY], [capX, c1StartY]]);
        sch.capacitor(capX, c1StartY, 'vertical', { label: 'C1' });
        const c1EndY = c1StartY + 50;
        sch.dot(capX, c1EndY);

        const c2StartY = c1EndY + 10;
        sch.wire([[capX, c1EndY], [capX, c2StartY]]);
        sch.capacitor(capX, c2StartY, 'vertical', { label: 'C2' });
        const c2EndY = c2StartY + 50;
        sch.wire([[capX, c2EndY], [capX, tankBotY]]);

        // Inductor + series capacitor leg (L then C3)
        const lStartY = tankTopY + 15;
        sch.wire([[indX, tankTopY], [indX, lStartY]]);
        sch.inductor(indX, lStartY, 'vertical', { label: 'L' });
        const lEndY = lStartY + 50;
        sch.dot(indX, lEndY);

        const c3StartY = lEndY + 10;
        sch.wire([[indX, lEndY], [indX, c3StartY]]);
        sch.capacitor(indX, c3StartY, 'vertical', { label: 'C3' });
        const c3EndY = c3StartY + 50;
        sch.wire([[indX, c3EndY], [indX, tankBotY]]);

        // Feedback from divider junction (C1/C2) to emitter
        const fbX = capX - 25;
        sch.wire([[capX, c1EndY], [fbX, c1EndY], [fbX, q1.emitter.y], [q1.emitter.x, q1.emitter.y]]);
        sch.dot(fbX, q1.emitter.y);

        // Bias divider for base
        const biasX = q1.base.x - 50;
        sch.wire([[q1.base.x, q1.base.y], [biasX, q1.base.y]]);
        sch.dot(biasX, q1.base.y);

        sch.wire([[biasX, vccY], [biasX, vccY + 15]]);
        sch.resistor(biasX, vccY + 15, 'vertical', { label: 'R1' });
        sch.wire([[biasX, vccY + 65], [biasX, q1.base.y]]);

        sch.wire([[biasX, q1.base.y], [biasX, q1.base.y + 15]]);
        sch.resistor(biasX, q1.base.y + 15, 'vertical', { label: 'R2' });
        sch.wire([[biasX, q1.base.y + 65], [biasX, gndY]]);

        // VCC rail connection to bias divider
        sch.wire([[biasX, vccY], [q1.collector.x, vccY]]);

        // Ground rail
        sch.wire([[biasX, gndY], [tankX, gndY]]);
        sch.ground((biasX + tankX) / 2, gndY);

        sch.text(width / 2, gndY + 30, 'f ~ 1/(2*pi*sqrt(L*Ceq)), 1/Ceq = 1/C1 + 1/C2 + 1/C3',
            { size: 10, color: COLORS.annotation });

        sch.finalize();
        return sch;
    }

    /**
     * Pierce Crystal Oscillator (conceptual)
     * Inverter with feedback resistor, crystal between input/output, and two load capacitors to ground.
     */
    function pierceOscillator(container, options = {}) {
        const { width = 440, height = 260, rf = '1M', c1 = '18p', c2 = '18p', xtal = 'XTAL' } = options;

        const sch = new Schematic(container, { width, height });

        const vccY = 30;
        const gndY = 230;

        // Inverter block (decorative, but with a keepout to prevent accidental routing through it)
        const blockW = 90;
        const blockH = 60;
        const blockX = Math.round(width / 2 - blockW / 2);
        const blockY = 115;

        {
            const g = group({ stroke: COLORS.component, strokeWidth: LINE_WIDTH, fill: 'none' });
            g.appendChild(elem('rect', { x: blockX, y: blockY, width: blockW, height: blockH, rx: 6, ry: 6 }));
            sch.componentGroup.appendChild(g);
            sch.boundsAccumulator.addRect(blockX, blockY, blockW, blockH);
            const m = 2;
            sch.addKeepout({
                type: 'rectangle',
                bounds: { xMin: blockX + m, xMax: blockX + blockW - m, yMin: blockY + m, yMax: blockY + blockH - m },
                meta: { type: 'block', label: 'INV' }
            });
            sch.text(blockX + blockW / 2, blockY + blockH / 2, 'INV', { size: 12, bold: true, internal: true });
        }

        const inX = blockX;
        const outX = blockX + blockW;
        const pinY = blockY + Math.round(blockH / 2);

        // Connection nodes (same nets as inverter pins)
        const yXtal = blockY - 25;
        const yRf = yXtal - 45;

        // Vertical pin-to-top buses (with an explicit vertex at yXtal)
        sch.wire([[inX, pinY], [inX, yXtal], [inX, yRf]]);
        sch.wire([[outX, pinY], [outX, yXtal], [outX, yRf]]);

        // Crystal between input and output (use 50px symbol + short stubs)
        const xtalStartX = inX + Math.round((outX - inX - 50) / 2);
        const xtalEndX = xtalStartX + 50;
        sch.wire([[inX, yXtal], [xtalStartX, yXtal]]);
        sch.crystal(xtalStartX, yXtal, 'horizontal', { label: null, value: null });
        const xtalLabelX = inX - 12;
        sch.text(xtalLabelX, yXtal - 12, 'X1', { size: 11, anchor: 'end', bold: true });
        sch.text(xtalLabelX, yXtal + 12, xtal, { size: 10, anchor: 'end', color: COLORS.value });
        sch.wire([[xtalEndX, yXtal], [outX, yXtal]]);

        // Feedback resistor (parallel with crystal)
        sch.wire([[inX, yRf], [xtalStartX, yRf]]);
        sch.resistor(xtalStartX, yRf, 'horizontal', { label: null, value: null });
        sch.text(xtalLabelX, yRf - 12, 'Rf', { size: 11, anchor: 'end', bold: true });
        sch.text(xtalLabelX, yRf + 12, rf, { size: 10, anchor: 'end', color: COLORS.value });
        sch.wire([[xtalEndX, yRf], [outX, yRf]]);

        // Load capacitors to ground (placed left/right to avoid blocking the inverter)
        const capY = pinY + 10;
        const cap1X = inX - 70;
        const cap2X = outX + 70;

        // C1 (input node to ground)
        sch.wire([[inX, pinY], [cap1X, pinY], [cap1X, capY]]);
        sch.capacitor(cap1X, capY, 'vertical', { label: 'C1', value: c1 });
        sch.wire([[cap1X, capY + 50], [cap1X, gndY]]);

        // C2 (output node to ground)
        sch.wire([[outX, pinY], [cap2X, pinY], [cap2X, capY]]);
        sch.capacitor(cap2X, capY, 'vertical', { label: 'C2', value: c2 });
        sch.wire([[cap2X, capY + 50], [cap2X, gndY]]);

        // Ground rail
        sch.wire([[cap1X, gndY], [cap2X, gndY]]);
        sch.ground((cap1X + cap2X) / 2, gndY);

        // Optional VDD label (conceptual)
        sch.vcc(Math.round(width / 2), vccY, { label: 'VDD' });

        // I/O labels (conceptual)
        sch.nodeLabel(inX - 90, pinY, 'Xin', { dx: -18, dy: 0, anchor: 'end' });
        sch.wire([[inX - 90, pinY], [inX, pinY]]);
        sch.nodeLabel(outX + 90, pinY, 'Xout', { dx: 18, dy: 0, anchor: 'start' });
        sch.wire([[outX, pinY], [outX + 90, pinY]]);

        sch.text(width / 2, gndY + 25, 'Pierce: crystal sets f; C1/C2 set load capacitance',
            { size: 10, color: COLORS.annotation });

        sch.finalize();
        return sch;
    }

    /**
     * Colpitts Crystal Oscillator (conceptual)
     * Replace the inductor leg of a Colpitts tank with a high-Q crystal resonator.
     */
    function colpittsCrystalOscillator(container, options = {}) {
        const { width = 400, height = 340, c1 = '18p', c2 = '18p', xtal = 'XTAL' } = options;

        const sch = new Schematic(container, { width, height });

        const vccY = 30;
        const gndY = 300;
        const qX = 150, qY = 140;

        const q1 = Schematic.npnTerminals(qX, qY, false);

        sch.npn(qX, qY, { label: 'Q1', circle: false });
        sch.vcc(q1.collector.x, vccY, { label: 'VCC' });

        // RFC from VCC to collector
        sch.wire([[q1.collector.x, vccY], [q1.collector.x, vccY + 15]]);
        sch.inductor(q1.collector.x, vccY + 15, 'vertical', { label: 'RFC' });
        const rfcBottomY = vccY + 15 + 50;
        sch.wire([[q1.collector.x, rfcBottomY], [q1.collector.x, q1.collector.y]]);
        sch.dot(q1.collector.x, rfcBottomY);

        // Emitter resistor
        sch.wire([[q1.emitter.x, q1.emitter.y], [q1.emitter.x, q1.emitter.y + 15]]);
        sch.resistor(q1.emitter.x, q1.emitter.y + 15, 'vertical', { label: 'RE' });
        sch.wire([[q1.emitter.x, q1.emitter.y + 65], [q1.emitter.x, gndY]]);
        sch.dot(q1.emitter.x, q1.emitter.y);

        // Tank rails
        const tankX = q1.collector.x + 130;
        const tankTopY = rfcBottomY;
        const tankBotY = gndY;

        const capX = tankX - 45;    // C1/C2 divider
        const xtalX = tankX + 45;   // crystal leg

        // Coupling capacitor from collector to tank top
        const ccStartX = q1.collector.x + 25;
        sch.wire([[q1.collector.x, rfcBottomY], [ccStartX, rfcBottomY]]);
        sch.capacitor(ccStartX, rfcBottomY, 'horizontal', { label: 'Cc' });
        const ccEndX = ccStartX + 50;
        sch.wire([[ccEndX, rfcBottomY], [capX, tankTopY]]);
        sch.dot(tankX, tankTopY);

        sch.wire([[capX, tankTopY], [xtalX, tankTopY]]);
        sch.wire([[capX, tankBotY], [xtalX, tankBotY]]);

        // Capacitor divider leg
        const c1StartY = tankTopY + 15;
        sch.wire([[capX, tankTopY], [capX, c1StartY]]);
        sch.capacitor(capX, c1StartY, 'vertical', { label: 'C1', value: c1 });
        const c1EndY = c1StartY + 50;
        sch.dot(capX, c1EndY);

        const c2StartY = c1EndY + 10;
        sch.wire([[capX, c1EndY], [capX, c2StartY]]);
        sch.capacitor(capX, c2StartY, 'vertical', { label: 'C2', value: c2 });
        const c2EndY = c2StartY + 50;
        sch.wire([[capX, c2EndY], [capX, tankBotY]]);

        // Crystal leg
        const xStartY = tankTopY + 15;
        sch.wire([[xtalX, tankTopY], [xtalX, xStartY]]);
        sch.crystal(xtalX, xStartY, 'vertical', { label: null, value: null });
        const xtalLabelX = xtalX + 20;
        sch.text(xtalLabelX, xStartY + 18, 'X1', { size: 11, anchor: 'start', bold: true });
        sch.text(xtalLabelX, xStartY + 32, xtal, { size: 10, anchor: 'start', color: COLORS.value });
        const xEndY = xStartY + 50;
        sch.wire([[xtalX, xEndY], [xtalX, tankBotY]]);

        // Feedback from divider junction to emitter
        const fbX = capX - 25;
        sch.wire([[capX, c1EndY], [fbX, c1EndY], [fbX, q1.emitter.y], [q1.emitter.x, q1.emitter.y]]);
        sch.dot(fbX, q1.emitter.y);

        // Base bias divider
        const biasX = q1.base.x - 50;
        sch.wire([[q1.base.x, q1.base.y], [biasX, q1.base.y]]);
        sch.dot(biasX, q1.base.y);

        sch.wire([[biasX, vccY], [biasX, vccY + 15]]);
        sch.resistor(biasX, vccY + 15, 'vertical', { label: 'R1' });
        sch.wire([[biasX, vccY + 65], [biasX, q1.base.y]]);

        sch.wire([[biasX, q1.base.y], [biasX, q1.base.y + 15]]);
        sch.resistor(biasX, q1.base.y + 15, 'vertical', { label: 'R2' });
        sch.wire([[biasX, q1.base.y + 65], [biasX, gndY]]);

        // VCC + ground rails
        sch.wire([[biasX, vccY], [q1.collector.x, vccY]]);
        sch.wire([[biasX, gndY], [tankX, gndY]]);
        sch.ground((biasX + tankX) / 2, gndY);

        sch.text(width / 2, gndY + 25, 'Crystal-controlled Colpitts (conceptual)',
            { size: 10, color: COLORS.annotation });

        sch.finalize();
        return sch;
    }

    /**
     * Butler Oscillator (conceptual block diagram)
     * Shown as two amplifier stages with crystal feedback for low phase noise.
     */
    function butlerOscillator(container, options = {}) {
        const { width = 440, height = 240 } = options;
        const sch = new Schematic(container, { width, height });

        const midY = 120;
        const gndY = 210;

        const leftX = 80;
        const rightX = 280;
        const blockW = 80;
        const blockH = 60;

        function block(x, y, label) {
            const g = group({ stroke: COLORS.component, strokeWidth: LINE_WIDTH, fill: 'none' });
            g.appendChild(elem('rect', { x, y, width: blockW, height: blockH, rx: 6, ry: 6 }));
            sch.componentGroup.appendChild(g);
            sch.boundsAccumulator.addRect(x, y, blockW, blockH);
            const m = 2;
            sch.addKeepout({
                type: 'rectangle',
                bounds: { xMin: x + m, xMax: x + blockW - m, yMin: y + m, yMax: y + blockH - m },
                meta: { type: 'block', label }
            });
            sch.text(x + blockW / 2, y + blockH / 2, label, { size: 11, bold: true, internal: true });
        }

        const stageY = midY - blockH / 2;
        block(leftX, stageY, 'AMP1');
        block(rightX, stageY, 'AMP2');

        // Treat block connection points as pins (conceptual diagram).
        for (const [px, py] of [
            [leftX, midY],
            [leftX + blockW, midY],
            [rightX, midY],
            [rightX + blockW, midY],
            [leftX, gndY],
            [rightX + blockW, gndY]
        ]) {
            sch.nodeRegistry.register(px, py, null, 'pin');
        }

        // Forward path
        sch.wire([[leftX + blockW, midY], [rightX, midY]]);
        sch.dot(leftX + blockW, midY);
        sch.dot(rightX, midY);

        // Crystal feedback (AMP2 output back to AMP1 input)
        const fbY = 55;
        const outX = rightX + blockW;
        const inX = leftX;
        sch.wire([[outX, midY], [outX, fbY]]);
        sch.wire([[inX, midY], [inX, fbY]]);
        const xtalStartX = inX + Math.round((outX - inX - 50) / 2);
        sch.wire([[inX, fbY], [xtalStartX, fbY]]);
        sch.crystal(xtalStartX, fbY, 'horizontal', { label: null });
        sch.text(inX - 12, fbY - 12, 'X1', { size: 11, anchor: 'end', bold: true });
        sch.wire([[xtalStartX + 50, fbY], [outX, fbY]]);
        sch.dot(inX, fbY);
        sch.dot(outX, fbY);

        for (const [px, py] of [
            [inX, fbY],
            [outX, fbY],
            [outX, midY],
            [inX, midY]
        ]) {
            sch.nodeRegistry.register(px, py, null, 'pin');
        }

        // Ground (conceptual reference)
        sch.wire([[leftX, gndY], [rightX + blockW, gndY]]);
        sch.ground((leftX + rightX + blockW) / 2, gndY);

        sch.text(width / 2, gndY + 20, 'Butler: 2-stage amplifier + crystal feedback (conceptual)',
            { size: 10, color: COLORS.annotation });

        sch.finalize();
        return sch;
    }

    /**
     * TCXO (conceptual block diagram)
     */
    function tcxoOscillator(container, options = {}) {
        const { width = 440, height = 220 } = options;
        const sch = new Schematic(container, { width, height });

        const midY = 110;
        const blockW = 120;
        const blockH = 60;
        const oscX = 70;
        const compX = 250;
        const y = midY - blockH / 2;

        function block(x, label) {
            const g = group({ stroke: COLORS.component, strokeWidth: LINE_WIDTH, fill: 'none' });
            g.appendChild(elem('rect', { x, y, width: blockW, height: blockH, rx: 6, ry: 6 }));
            sch.componentGroup.appendChild(g);
            sch.boundsAccumulator.addRect(x, y, blockW, blockH);
            const m = 2;
            sch.addKeepout({
                type: 'rectangle',
                bounds: { xMin: x + m, xMax: x + blockW - m, yMin: y + m, yMax: y + blockH - m },
                meta: { type: 'block', label }
            });
            sch.text(x + blockW / 2, midY, label, { size: 11, bold: true, internal: true });
        }

        block(oscX, 'OSC + XTAL');
        block(compX, 'TEMP COMP');

        // Compensation control line
        sch.wire([[compX, midY], [oscX + blockW, midY]]);
        sch.dot(compX, midY);
        sch.dot(oscX + blockW, midY);

        for (const [px, py] of [
            [compX, midY],
            [oscX + blockW, midY],
            [compX + blockW, midY]
        ]) {
            sch.nodeRegistry.register(px, py, null, 'pin');
        }

        // Output
        const outX = compX + blockW + 60;
        sch.wire([[compX + blockW, midY], [outX, midY]]);
        sch.nodeLabel(outX, midY, 'Fout');

        sch.text(width / 2, height - 10, 'TCXO: oscillator trimmed vs temperature (conceptual)',
            { size: 10, color: COLORS.annotation });

        sch.finalize();
        return sch;
    }

    /**
     * OCXO (conceptual block diagram)
     */
    function ocxoOscillator(container, options = {}) {
        const { width = 440, height = 220 } = options;
        const sch = new Schematic(container, { width, height });

        const midY = 110;
        const blockW = 140;
        const blockH = 70;
        const ovenX = 90;
        const y = midY - blockH / 2;

        const g = group({ stroke: COLORS.component, strokeWidth: LINE_WIDTH, fill: 'none' });
        g.appendChild(elem('rect', { x: ovenX, y, width: blockW, height: blockH, rx: 8, ry: 8 }));
        sch.componentGroup.appendChild(g);
        sch.boundsAccumulator.addRect(ovenX, y, blockW, blockH);
        const m = 2;
        sch.addKeepout({
            type: 'rectangle',
            bounds: { xMin: ovenX + m, xMax: ovenX + blockW - m, yMin: y + m, yMax: y + blockH - m },
            meta: { type: 'block', label: 'OVEN' }
        });
        sch.text(ovenX + blockW / 2, midY - 10, 'OVEN', { size: 11, bold: true, internal: true });
        sch.text(ovenX + blockW / 2, midY + 10, 'OSC + XTAL', { size: 10, color: COLORS.annotation, internal: true });

        // Heater control (conceptual)
        const heaterX = ovenX + blockW / 2;
        const heaterY = y - 25;
        sch.wire([[heaterX, y], [heaterX, heaterY]]);
        sch.nodeLabel(heaterX, heaterY, 'Heater');
        sch.nodeRegistry.register(heaterX, y, null, 'pin');

        // Output
        const outX = ovenX + blockW + 110;
        sch.wire([[ovenX + blockW, midY], [outX, midY]]);
        sch.nodeLabel(outX, midY, 'Fout');
        sch.nodeRegistry.register(ovenX + blockW, midY, null, 'pin');

        sch.text(width / 2, height - 10, 'OCXO: crystal kept at constant temperature (conceptual)',
            { size: 10, color: COLORS.annotation });

        sch.finalize();
        return sch;
    }

    // ===== 555 TIMER (block-level schematics) =====
    function draw555Block(sch, x, y) {
        const w = 110;
        const h = 150;
        const g = group({ stroke: COLORS.component, strokeWidth: LINE_WIDTH, fill: 'none' });
        g.appendChild(elem('rect', { x, y, width: w, height: h, rx: 8, ry: 8 }));
        sch.componentGroup.appendChild(g);
        sch.boundsAccumulator.addRect(x, y, w, h);

        // Keepout inset so wires can touch the boundary without false violations
        const m = 2;
        sch.addKeepout({
            type: 'rectangle',
            bounds: { xMin: x + m, xMax: x + w - m, yMin: y + m, yMax: y + h - m },
            meta: { type: 'ic', label: '555' }
        });

        sch.text(x + w / 2, y + h / 2, '555', { size: 12, bold: true, internal: true });

        const pins = {
            box: { x, y, w, h },
            vcc: { x: x + w / 2, y },
            gnd: { x: x + w / 2, y: y + h },
            out: { x: x + w, y: y + h / 2 },
            reset: { x, y: y + 25 },
            ctrl: { x, y: y + 50 },
            thresh: { x, y: y + 80 },
            trig: { x, y: y + 105 },
            disch: { x, y: y + 125 }
        };

        // Register pins so DRC doesn't flag the 555 block terminals as floating.
        for (const key of ['vcc', 'gnd', 'out', 'reset', 'ctrl', 'thresh', 'trig', 'disch']) {
            const p = pins[key];
            sch.nodeRegistry.register(p.x, p.y, null, 'pin');
        }

        return pins;
    }

    /**
     * 555 Astable Oscillator (block-level schematic)
     */
    function timer555Astable(container, options = {}) {
        const { width = 520, height = 320, r1 = '10k', r2 = '10k', c = '100n', cctrl = '10n' } = options;

        const sch = new Schematic(container, { width, height });

        const vccY = 30;
        const gndY = 280;

        const icX = 260;
        const icY = 80;
        const pins = draw555Block(sch, icX, icY);

        // VCC and GND pins
        sch.vcc(pins.vcc.x, vccY, { label: 'VCC' });
        sch.wire([[pins.vcc.x, vccY], [pins.vcc.x, pins.vcc.y]]);

        sch.wire([[pins.gnd.x, pins.gnd.y], [pins.gnd.x, gndY]]);

        // Reset tied to VCC (standard)
        const resetBusY = icY - 20;
        sch.wire([[pins.reset.x, pins.reset.y], [pins.reset.x - 20, pins.reset.y], [pins.reset.x - 20, resetBusY], [pins.vcc.x, resetBusY], [pins.vcc.x, pins.vcc.y]]);

        // Control voltage bypass capacitor to ground (recommended)
        const ctrlCapX = pins.ctrl.x - 30;
        const ctrlCapY = pins.ctrl.y + 10;
        sch.wire([[pins.ctrl.x, pins.ctrl.y], [ctrlCapX, pins.ctrl.y], [ctrlCapX, ctrlCapY]]);
        sch.capacitor(ctrlCapX, ctrlCapY, 'vertical', { label: null, value: null });
        sch.text(ctrlCapX - 120, ctrlCapY + 70, 'Cctrl', { size: 11, anchor: 'end', bold: true });
        sch.text(ctrlCapX - 120, ctrlCapY + 84, cctrl, { size: 10, anchor: 'end', color: COLORS.value });
        sch.wire([[ctrlCapX, ctrlCapY + 50], [ctrlCapX, gndY]]);

        // Astable timing nodes:
        // Node A: DISCH node (between R1 and R2)
        // Node B: THRESH/TRIG node (capacitor node)
        const nodeAY = pins.disch.y;
        const nodeAX = icX - 50;
        const nodeBX = icX - 100;
        const nodeBY = nodeAY;

        // DISCH pin to node A
        sch.wire([[pins.disch.x, pins.disch.y], [nodeAX, nodeAY]]);
        sch.dot(nodeAX, nodeAY);

        // R2 from node B to node A (horizontal)
        sch.resistor(nodeBX, nodeBY, 'horizontal', { label: null, value: null });
        sch.text(nodeBX - 12, nodeBY - 12, 'R2', { size: 11, anchor: 'end', bold: true });
        sch.text(nodeBX - 12, nodeBY + 12, r2, { size: 10, anchor: 'end', color: COLORS.value });
        sch.dot(nodeBX, nodeBY);

        // R1 from VCC to node A (vertical)
        const r1StartY = vccY + 20;
        sch.wire([[nodeAX, vccY], [nodeAX, r1StartY]]);
        sch.resistor(nodeAX, r1StartY, 'vertical', { label: null, value: null });
        sch.text(nodeAX - 14, r1StartY + 18, 'R1', { size: 11, anchor: 'end', bold: true });
        sch.text(nodeAX - 14, r1StartY + 32, r1, { size: 10, anchor: 'end', color: COLORS.value });
        sch.wire([[nodeAX, r1StartY + 50], [nodeAX, nodeAY]]);
        sch.dot(nodeAX, vccY);

        // VCC rail (ties R1 top to the supply label)
        sch.wire([[nodeAX, vccY], [pins.vcc.x, vccY]]);

        // Capacitor from node B to ground (drop below R2 for clearance)
        const capY = nodeBY + 20;
        sch.wire([[nodeBX, nodeBY], [nodeBX, capY]]);
        sch.capacitor(nodeBX, capY, 'vertical', { label: null, value: null });
        sch.text(nodeBX - 40, capY + 18, 'C', { size: 11, anchor: 'end', bold: true });
        sch.text(nodeBX - 40, capY + 32, c, { size: 10, anchor: 'end', color: COLORS.value });
        sch.wire([[nodeBX, capY + 50], [nodeBX, gndY]]);

        // Ground rail (trimmed to actual connection points)
        {
            const gndXs = [pins.gnd.x, ctrlCapX, nodeBX];
            const gndLeftX = Math.min(...gndXs);
            const gndRightX = Math.max(...gndXs);
            sch.wire([[gndLeftX, gndY], [gndRightX, gndY]]);
            sch.ground(Math.round((gndLeftX + gndRightX) / 2), gndY);
            sch.dot(pins.gnd.x, gndY);
        }

        // TRIG and THRESH both connect to node B (avoid routing through R2 body)
        sch.wire([[pins.trig.x, pins.trig.y], [nodeBX, pins.trig.y], [nodeBX, nodeBY]]);
        {
            // Route THRESH around the CTRL capacitor (no wires through bodies).
            const busX = pins.thresh.x - 10;
            sch.wire([[pins.thresh.x, pins.thresh.y], [busX, pins.thresh.y], [busX, pins.trig.y], [nodeBX, pins.trig.y], [nodeBX, nodeBY]]);
        }

        // OUT pin
        const outX = icX + pins.box.w + 110;
        sch.wire([[pins.out.x, pins.out.y], [outX, pins.out.y]]);
        sch.nodeLabel(outX, pins.out.y, 'OUT');

        sch.text(width / 2, height - 10, 'Astable: f ~ 1.44/((R1+2R2)*C)',
            { size: 10, color: COLORS.annotation });

        sch.finalize();
        return sch;
    }

    /**
     * 555 Monostable (one-shot) (block-level schematic)
     */
    function timer555Monostable(container, options = {}) {
        const { width = 520, height = 320, r = '10k', c = '100n', cctrl = '10n' } = options;

        const sch = new Schematic(container, { width, height });

        const vccY = 30;
        const gndY = 280;

        const icX = 260;
        const icY = 80;
        const pins = draw555Block(sch, icX, icY);

        // VCC + GND
        sch.vcc(pins.vcc.x, vccY, { label: 'VCC' });
        sch.wire([[pins.vcc.x, vccY], [pins.vcc.x, pins.vcc.y]]);

        sch.wire([[pins.gnd.x, pins.gnd.y], [pins.gnd.x, gndY]]);

        // Reset tied high
        const resetBusY = icY - 20;
        sch.wire([[pins.reset.x, pins.reset.y], [pins.reset.x - 20, pins.reset.y], [pins.reset.x - 20, resetBusY], [pins.vcc.x, resetBusY], [pins.vcc.x, pins.vcc.y]]);

        // Control cap to ground
        const ctrlCapX = pins.ctrl.x - 30;
        const ctrlCapY = pins.ctrl.y + 10;
        sch.wire([[pins.ctrl.x, pins.ctrl.y], [ctrlCapX, pins.ctrl.y], [ctrlCapX, ctrlCapY]]);
        sch.capacitor(ctrlCapX, ctrlCapY, 'vertical', { label: null, value: null });
        sch.text(ctrlCapX - 120, ctrlCapY + 70, 'Cctrl', { size: 11, anchor: 'end', bold: true });
        sch.text(ctrlCapX - 120, ctrlCapY + 84, cctrl, { size: 10, anchor: 'end', color: COLORS.value });
        sch.wire([[ctrlCapX, ctrlCapY + 50], [ctrlCapX, gndY]]);

        // RC node for timing capacitor (THRESH + DISCH)
        const nodeX = icX - 70;
        const nodeY = pins.disch.y;
        sch.wire([[pins.disch.x, pins.disch.y], [nodeX, nodeY]]);
        {
            // Route THRESH around the CTRL capacitor (no wires through bodies).
            const busX = pins.thresh.x - 10;
            sch.wire([[pins.thresh.x, pins.thresh.y], [busX, pins.thresh.y], [busX, nodeY], [nodeX, nodeY]]);
        }
        sch.dot(nodeX, nodeY);

        // Timing resistor from VCC to node
        const rStartY = vccY + 20;
        sch.wire([[nodeX, vccY], [nodeX, rStartY]]);
        sch.resistor(nodeX, rStartY, 'vertical', { label: null, value: null });
        sch.text(nodeX - 14, rStartY + 18, 'R', { size: 11, anchor: 'end', bold: true });
        sch.text(nodeX - 14, rStartY + 32, r, { size: 10, anchor: 'end', color: COLORS.value });
        sch.wire([[nodeX, rStartY + 50], [nodeX, nodeY]]);
        sch.dot(nodeX, vccY);

        // VCC rail (ties timing resistor top to the supply label)
        sch.wire([[nodeX, vccY], [pins.vcc.x, vccY]]);

        // Timing capacitor to ground
        sch.capacitor(nodeX, nodeY, 'vertical', { label: null, value: null });
        sch.text(nodeX - 40, nodeY + 18, 'C', { size: 11, anchor: 'end', bold: true });
        sch.text(nodeX - 40, nodeY + 32, c, { size: 10, anchor: 'end', color: COLORS.value });
        sch.wire([[nodeX, nodeY + 50], [nodeX, gndY]]);

        // Ground rail (trimmed to actual connection points)
        {
            const gndXs = [pins.gnd.x, ctrlCapX, nodeX];
            const gndLeftX = Math.min(...gndXs);
            const gndRightX = Math.max(...gndXs);
            sch.wire([[gndLeftX, gndY], [gndRightX, gndY]]);
            sch.ground(Math.round((gndLeftX + gndRightX) / 2), gndY);
            sch.dot(pins.gnd.x, gndY);
        }

        // Trigger input
        const trigX = icX - 180;
        sch.nodeLabel(trigX, pins.trig.y, 'TRIG');
        sch.wire([[trigX, pins.trig.y], [pins.trig.x, pins.trig.y]]);

        // OUT pin
        const outX = icX + pins.box.w + 110;
        sch.wire([[pins.out.x, pins.out.y], [outX, pins.out.y]]);
        sch.nodeLabel(outX, pins.out.y, 'OUT');

        sch.text(width / 2, height - 10, 'Monostable: t ~ 1.1*R*C',
            { size: 10, color: COLORS.annotation });

        sch.finalize();
        return sch;
    }

    /**
     * 555 Bistable (latch) (block-level schematic)
     * Uses TRIG as SET (active-low) and THRESH as RESET (active-high).
     */
    function timer555Bistable(container, options = {}) {
        const { width = 520, height = 320, rpull = '10k', cctrl = '10n' } = options;

        const sch = new Schematic(container, { width, height });

        const vccY = 30;
        const gndY = 280;

        const icX = 260;
        const icY = 80;
        const pins = draw555Block(sch, icX, icY);

        // VCC + GND
        sch.vcc(pins.vcc.x, vccY, { label: 'VCC' });
        sch.wire([[pins.vcc.x, vccY], [pins.vcc.x, pins.vcc.y]]);

        sch.wire([[pins.gnd.x, pins.gnd.y], [pins.gnd.x, gndY]]);

        // Reset tied high (use RESET pin)
        const resetBusY = icY - 20;
        sch.wire([[pins.reset.x, pins.reset.y], [pins.reset.x - 20, pins.reset.y], [pins.reset.x - 20, resetBusY], [pins.vcc.x, resetBusY], [pins.vcc.x, pins.vcc.y]]);

        // Control cap to ground
        const ctrlCapX = pins.ctrl.x - 30;
        const ctrlCapY = pins.ctrl.y + 10;
        sch.wire([[pins.ctrl.x, pins.ctrl.y], [ctrlCapX, pins.ctrl.y], [ctrlCapX, ctrlCapY]]);
        sch.capacitor(ctrlCapX, ctrlCapY, 'vertical', { label: null, value: null });
        sch.text(ctrlCapX - 80, ctrlCapY + 70, 'Cctrl', { size: 11, anchor: 'end', bold: true });
        sch.text(ctrlCapX - 80, ctrlCapY + 84, cctrl, { size: 10, anchor: 'end', color: COLORS.value });
        sch.wire([[ctrlCapX, ctrlCapY + 50], [ctrlCapX, gndY]]);

        // SET input at TRIG (active-low): pull-up (conceptual)
        const setX = icX - 140;
        sch.nodeLabel(setX, pins.trig.y, 'SET', { dx: -30, dy: -16, anchor: 'end' });
        {
            // Route SET around the pull-down resistor and CTRL capacitor.
            const busX = pins.trig.x - 10;
            const setDoglegX = setX + 20;
            const setRouteY = pins.ctrl.y - 5;
            sch.wire([
                [setX, pins.trig.y],
                [setDoglegX, pins.trig.y],
                [setDoglegX, setRouteY],
                [busX, setRouteY],
                [busX, pins.trig.y],
                [pins.trig.x, pins.trig.y]
            ]);
        }
        sch.wire([[setX, vccY], [setX, vccY + 20]]);
        sch.resistor(setX, vccY + 20, 'vertical', { label: null, value: null });
        sch.text(setX - 30, vccY + 38, 'Rset', { size: 11, anchor: 'end', bold: true });
        sch.text(setX - 30, vccY + 52, rpull, { size: 10, anchor: 'end', color: COLORS.value });
        sch.wire([[setX, vccY + 70], [setX, pins.trig.y]]);
        sch.dot(setX, pins.trig.y);

        // VCC rail (ties pull-up to the supply label)
        sch.wire([[setX, vccY], [pins.vcc.x, vccY]]);

        // RESET input at THRESH (active-high): pull-down (conceptual)
        const rstX = icX - 90;
        sch.nodeLabel(rstX, pins.thresh.y, 'RST', { dx: -80, dy: -16, anchor: 'end' });
        {
            // Route RST around the CTRL capacitor (avoid pin-column verticals that pass other pins).
            const busX = pins.thresh.x - 10;
            const rstRouteY = pins.ctrl.y - 10;
            sch.wire([
                [rstX, pins.thresh.y],
                [rstX, rstRouteY],
                [busX, rstRouteY],
                [busX, pins.thresh.y],
                [pins.thresh.x, pins.thresh.y]
            ]);
        }
        sch.wire([[rstX, pins.thresh.y], [rstX, pins.thresh.y + 10]]);
        sch.resistor(rstX, pins.thresh.y + 10, 'vertical', { label: null, value: null });
        sch.text(rstX - 80, pins.thresh.y + 28, 'Rrst', { size: 11, anchor: 'end', bold: true });
        sch.text(rstX - 80, pins.thresh.y + 42, rpull, { size: 10, anchor: 'end', color: COLORS.value });
        sch.wire([[rstX, pins.thresh.y + 60], [rstX, gndY]]);
        sch.dot(rstX, pins.thresh.y);

        // Ground rail (trimmed to actual connection points)
        {
            const gndXs = [pins.gnd.x, ctrlCapX, rstX];
            const gndLeftX = Math.min(...gndXs);
            const gndRightX = Math.max(...gndXs);
            sch.wire([[gndLeftX, gndY], [gndRightX, gndY]]);
            sch.ground(Math.round((gndLeftX + gndRightX) / 2), gndY);
            sch.dot(pins.gnd.x, gndY);
        }

        // DISCH unused: show as labeled stub (prevents floating-node warnings)
        const disX = icX - 50;
        sch.nodeLabel(disX, pins.disch.y, 'DISCH', { dx: -80, dy: 18, anchor: 'end' });
        sch.wire([[pins.disch.x, pins.disch.y], [disX, pins.disch.y]]);

        // OUT pin
        const outX = icX + pins.box.w + 110;
        sch.wire([[pins.out.x, pins.out.y], [outX, pins.out.y]]);
        sch.nodeLabel(outX, pins.out.y, 'OUT');

        sch.text(width / 2, height - 10, 'Bistable: TRIG sets, THRESH resets (conceptual)',
            { size: 10, color: COLORS.annotation });

        sch.finalize();
        return sch;
    }

    /**
     * Op-amp Monostable (one-shot) - non-inverting Schmitt trigger + RC on inverting input.
     * Based on the common diode-clamped monostable: the diode clamps the timing node to ~0.7V in the stable state.
     * Approx pulse width: T ~ R*C*ln(1/(1-beta)) where beta = R2/(R1+R2).
     */
    function opampMonostable(container, options = {}) {
        const { width = 420, height = 320, r1 = '10k', r2 = '10k', r = '15k', c = '100n' } = options;

        const sch = new Schematic(container, { width, height });

        const opX = 220, opY = 140;
        const op = Schematic.opampTerminals(opX, opY);
        sch.opamp(opX, opY);

        const vccY = 30;
        const gndY = 280;

        // Key nodes (kept left of the op-amp so routing doesn't cross bodies)
        const vb = { x: 150, y: op.nonInvInput.y }; // Schmitt node (+ input)
        const va = { x: 150, y: op.invInput.y };    // Timing node (- input)

        // === TRIGGER INPUT -> Vb -> (+) ===
        const trigX = 30;
        sch.nodeLabel(trigX, vb.y, 'TRIG');
        sch.wire([[trigX, vb.y], [vb.x, vb.y]]);
        sch.wire([[vb.x, vb.y], [op.nonInvInput.x, vb.y]]);
        sch.dot(vb.x, vb.y);
        sch.dot(op.nonInvInput.x, vb.y);

        // === SCHMITT DIVIDER (R1, R2) ===
        // R2: Vb -> GND
        const r2TopY = vb.y + 35;
        sch.wire([[vb.x, vb.y], [vb.x, r2TopY]]);
        sch.resistor(vb.x, r2TopY, 'vertical', { label: null, value: null });
        sch.text(20, 80, 'R2', { size: 11, anchor: 'start', bold: true });
        sch.text(20, 94, r2, { size: 10, anchor: 'start', color: COLORS.value, skipValidation: true, internal: true });
        sch.wire([[vb.x, r2TopY + 50], [vb.x, gndY]]);

        // R1: Vout -> Vb (route above the op-amp)
        const fbY = opY - 90;
        sch.wire([[vb.x, vb.y], [vb.x, fbY]]);
        sch.wire([[op.output.x, op.output.y], [op.output.x, fbY]]);
        const r1StartX = va.x + 50;
        sch.wire([[vb.x, fbY], [r1StartX, fbY]]);
        sch.resistor(r1StartX, fbY, 'horizontal', { label: null, value: null });
        sch.text(20, 20, 'R1', { size: 11, anchor: 'start', bold: true });
        sch.text(20, 34, r1, { size: 10, anchor: 'start', color: COLORS.value, skipValidation: true, internal: true });
        sch.wire([[r1StartX + 50, fbY], [op.output.x, fbY]]);
        sch.dot(vb.x, fbY);
        sch.dot(op.output.x, fbY);

        // === (-) INPUT TIMING NODE Va ===
        sch.wire([[va.x, va.y], [op.invInput.x, va.y]]);
        sch.dot(va.x, va.y);
        sch.dot(op.invInput.x, va.y);

        // Timing resistor R: Vout -> Va (route above op-amp, below R1)
        const rtY = fbY + 32;
        const vaDoglegX = va.x + 30;
        const rStartX = vaDoglegX + 20;
        sch.wire([[va.x, va.y], [vaDoglegX, va.y], [vaDoglegX, rtY], [rStartX, rtY]]);
        sch.resistor(rStartX, rtY, 'horizontal', { label: null, value: null });
        sch.text(60, rtY - 24, 'R', { size: 11, anchor: 'end', bold: true });
        sch.text(60, rtY - 10, r, { size: 10, anchor: 'end', color: COLORS.value });
        sch.wire([[rStartX + 50, rtY], [op.output.x, rtY]]);
        sch.dot(op.output.x, rtY);

        // Timing capacitor + diode clamp to ground (placed low to avoid the Vb wiring)
        const capX = 110;
        const capTopY = 190;
        const diodeX = capX - 40;

        // Va to timing node (cap top)
        sch.wire([[va.x, va.y], [capX, va.y], [capX, capTopY]]);
        sch.dot(capX, capTopY);

        // Capacitor: timing node -> ground
        sch.capacitor(capX, capTopY, 'vertical', { label: null, value: null });
        sch.text(20, capTopY + 18, 'C', { size: 11, anchor: 'end', bold: true });
        sch.text(20, capTopY + 32, c, { size: 10, anchor: 'end', color: COLORS.value });
        sch.wire([[capX, capTopY + 50], [capX, gndY]]);

        // Diode clamp: timing node -> ground (anode at node)
        sch.wire([[capX, capTopY], [diodeX, capTopY]]);
        sch.diode(diodeX, capTopY, 'vertical', { label: null });
        sch.text(50, capTopY + 18, 'D1', { size: 11, anchor: 'end', bold: true });
        sch.wire([[diodeX, capTopY + 50], [diodeX, gndY]]);

        // Ground rail
        sch.wire([[diodeX, gndY], [vb.x, gndY]]);
        sch.ground(Math.round((diodeX + vb.x) / 2), gndY);

        // Output label
        const outX = op.output.x + 70;
        sch.wire([[op.output.x, op.output.y], [outX, op.output.y]]);
        sch.nodeLabel(outX, op.output.y, 'Vout');

        // Supply label (op-amp supply implied)
        sch.vcc(Math.round(width / 2), vccY, { label: 'VCC' });

        sch.text(width / 2, height - 10, 'T ~ R*C*ln(1/(1-beta)), beta = R2/(R1+R2); for R1=R2, T~0.69RC',
            { size: 10, color: COLORS.annotation });

        sch.finalize();
        return sch;
    }

    /**
     * Full-Wave Bridge Rectifier with filter capacitor
     * Converts AC to DC using 4 diodes in a bridge configuration
     * Two diodes conduct during each half-cycle
     */
    function fullWaveRectifier(container, options = {}) {
        const { width = 420, height = 260, c = '1000µ', rl = '1k' } = options;

        const sch = new Schematic(container, { width, height });

        const topY = 50;      // Positive DC rail
        const botY = 200;     // Ground rail
        const midY = (topY + botY) / 2;  // AC input level

        // AC input labels
        const acX = 30;
        sch.nodeLabel(acX, midY - 25, 'AC~');
        sch.nodeLabel(acX, midY + 25, 'AC~');

        // Bridge configuration - diamond shape
        const bridgeCenterX = 130;
        const bridgeHalfW = 35;
        const bridgeHalfH = 50;

        // Four diodes arranged in bridge (cathode toward positive rail)
        // D1: left-top (anode at left, cathode at top)
        const d1X = bridgeCenterX - bridgeHalfW;
        const d1Y = midY - 25;
        sch.diode(d1X, d1Y, 'vertical', { label: 'D1' });  // Diode 50px, cathode at top

        // D2: right-top (anode at right, cathode at top)
        const d2X = bridgeCenterX + bridgeHalfW;
        sch.diode(d2X, d1Y, 'vertical', { label: 'D2' });

        // D3: left-bottom (anode at bottom, cathode at left)
        const d3Y = midY + 25;
        sch.diode(d1X, d3Y, 'vertical', { label: 'D3' });

        // D4: right-bottom (anode at bottom, cathode at right)
        sch.diode(d2X, d3Y, 'vertical', { label: 'D4' });

        // Top positive rail (cathodes of D1 and D2)
        sch.wire([[d1X, d1Y], [d1X, topY]]);
        sch.wire([[d2X, d1Y], [d2X, topY]]);
        sch.wire([[d1X, topY], [d2X, topY]]);
        sch.dot(bridgeCenterX, topY);

        // Bottom ground rail (anodes of D3 and D4)
        sch.wire([[d1X, d3Y + 50], [d1X, botY]]);
        sch.wire([[d2X, d3Y + 50], [d2X, botY]]);
        sch.wire([[d1X, botY], [d2X, botY]]);
        sch.dot(bridgeCenterX, botY);

        // AC input connections (to anodes of D1/D3 and D2/D4)
        // Route to the D1/D3 junction without running a wire through the diode body.
        const acLeftStubX = d1X - 20;
        sch.wire([[acX, midY - 25], [acLeftStubX, midY - 25]]);
        sch.wire([[acLeftStubX, midY - 25], [acLeftStubX, d3Y]]);
        sch.wire([[acLeftStubX, d3Y], [d1X, d3Y]]);
        sch.dot(d1X, d3Y);

        sch.wire([[acX, midY + 25], [d2X, midY + 25]]);
        sch.wire([[d2X, midY + 25], [d2X, d1Y + 50]]);
        sch.dot(d2X, d1Y + 50);
        sch.wire([[d2X, d1Y + 50], [d2X, d3Y]]);

        // Output section
        const outStartX = d2X + 30;
        const capX = outStartX + 30;
        const rlX = outStartX + 80;
        const voutX = rlX + 40;

        // Positive rail to output label
        sch.wire([[bridgeCenterX, topY], [voutX, topY]]);

        // Negative rail to the ground node (avoid an unused dangling rail stub)
        sch.wire([[bridgeCenterX, botY], [rlX, botY]]);

        // Filter capacitor (polarized)
        const capCenterY = (topY + botY) / 2;
        sch.wire([[capX, topY], [capX, capCenterY - 25]]);
        sch.capacitorPol(capX, capCenterY - 25, 'vertical', { label: null, value: null });
        const capLabelX = capX - 18;
        sch.text(capLabelX, capCenterY - 45, 'C', { size: 11, bold: true, anchor: 'end' });
        sch.text(capLabelX, capCenterY - 31, c, { size: 10, color: COLORS.value, anchor: 'end' });
        sch.wire([[capX, capCenterY + 25], [capX, botY]]);
        sch.dot(capX, topY);
        sch.dot(capX, botY);

        // Load resistor
        sch.wire([[rlX, topY], [rlX, capCenterY - 25]]);
        sch.resistor(rlX, capCenterY - 25, 'vertical', { label: 'RL', value: rl });
        sch.wire([[rlX, capCenterY + 25], [rlX, botY]]);
        sch.dot(rlX, topY);
        sch.dot(rlX, botY);

        // Output labels
        sch.nodeLabel(voutX, topY, 'Vdc+');

        // Ground symbol
        sch.ground(rlX, botY);

        sch.text(width / 2, height - 15, 'Vdc ≈ Vpeak - 1.4V (two diode drops)',
            { size: 10, color: COLORS.annotation });

        sch.finalize();
        return sch;
    }

    /**
     * Voltage Doubler - Greinacher/Villard cascade voltage multiplier
     * First stage (D1+C1) clamps AC to 0-to-2Vpeak
     * Second stage (D2+C2) peak-detects to give 2×Vpeak DC output
     */
    function voltageDoubler(container, options = {}) {
        const { width = 380, height = 240, c = '100µ' } = options;

        const sch = new Schematic(container, { width, height });

        const topY = 40;      // Positive output rail
        const midY = 110;     // AC input level
        const gndY = 200;     // Ground rail

        // AC input
        const acX = 30;
        sch.nodeLabel(acX, midY, 'Vac~');

        // === STAGE 1: CLAMPING CIRCUIT (D1 + C1) ===
        // C1 in series with AC input
        const c1X = 80;
        sch.wire([[acX, midY], [c1X, midY]]);
        sch.capacitor(c1X, midY, 'horizontal', { label: null, value: null });
        sch.text(c1X - 10, midY - 32, 'C1', { size: 11, bold: true, anchor: 'end' });
        sch.text(c1X - 10, midY - 18, c, { size: 10, color: COLORS.value, anchor: 'end' });
        const c1OutX = c1X + 50;
        sch.dot(c1OutX, midY);

        // D1 from C1 junction to ground (cathode up, clamps negative peaks)
        sch.wire([[c1OutX, midY], [c1OutX, midY + 25]]);
        sch.diode(c1OutX, midY + 25, 'vertical', { label: 'D1' });
        sch.wire([[c1OutX, midY + 75], [c1OutX, gndY]]);

        // === STAGE 2: PEAK DETECTOR (D2 + C2) ===
        // D2 from clamped signal to output (cathode toward output)
        // D2 starts right after c1OutX junction
        const d2StartX = c1OutX + 10;
        sch.wire([[c1OutX, midY], [d2StartX, midY]]);
        sch.diode(d2StartX, midY, 'horizontal', { label: null });
        sch.text(d2StartX + 25, midY - 24, 'D2', { size: 11, bold: true });
        const d2EndX = d2StartX + 50;
        sch.dot(d2EndX, midY);

        // C2 from D2 output to ground (output capacitor)
        const c2X = d2EndX + 40;
        sch.wire([[d2EndX, midY], [c2X, midY]]);
        sch.wire([[c2X, midY], [c2X, midY + 25]]);
        sch.capacitorPol(c2X, midY + 25, 'vertical', { label: null, value: null });
        sch.text(c2X + 32, midY + 45, 'C2', { size: 11, bold: true, anchor: 'start' });
        sch.text(c2X + 32, midY + 59, c, { size: 10, color: COLORS.value, anchor: 'start' });
        sch.wire([[c2X, midY + 75], [c2X, gndY]]);
        sch.dot(c2X, midY);

        // Output voltage label
        const voutX = c2X + 60;
        sch.wire([[c2X, midY], [voutX, midY]]);
        sch.nodeLabel(voutX, midY, 'Vout');

        // Ground rail
        sch.wire([[acX, gndY], [c2X, gndY]]);
        sch.wire([[acX, midY], [acX, gndY]]);  // AC return
        sch.dot(acX, gndY);
        sch.ground((acX + c2X) / 2, gndY);

        sch.text(width / 2, height - 15, 'Vout ≈ 2×Vpeak - 1.4V (2 diode drops)',
            { size: 10, color: COLORS.annotation });

        sch.finalize();
        return sch;
    }

    /**
     * Common Base Amplifier - High frequency, low input impedance
     * CB config: Input at emitter, output at collector, base at AC ground
     * Zin ≈ re (26mV/Ie), high bandwidth, current gain ≈ 1
     */
    function commonBaseAmp(container, options = {}) {
        const { width = 440, height = 320, rc = '4.7k', re = '1k' } = options;

        const sch = new Schematic(container, { width, height });

        const vccY = 30;
        const gndY = 280;
        const qX = 200, qY = 150;

        const q1 = Schematic.npnTerminals(qX, qY, false);

        // Transistor
        sch.npn(qX, qY, { label: 'Q1', circle: false });

        // VCC
        sch.vcc(q1.collector.x, vccY, { label: 'VCC' });

        // RC (collector resistor)
        sch.wire([[q1.collector.x, vccY], [q1.collector.x, vccY + 15]]);
        sch.resistor(q1.collector.x, vccY + 15, 'vertical', { label: 'RC' });
        sch.text(q1.collector.x + 35, vccY + 25, rc, { size: 10, color: COLORS.value });
        const rcBottomY = vccY + 15 + 50;
        sch.wire([[q1.collector.x, rcBottomY], [q1.collector.x, q1.collector.y]]);
        sch.dot(q1.collector.x, rcBottomY);

        // RE (emitter resistor to ground)
        sch.wire([[q1.emitter.x, q1.emitter.y], [q1.emitter.x, q1.emitter.y + 15]]);
        sch.resistor(q1.emitter.x, q1.emitter.y + 15, 'vertical', { label: 'RE', value: re });
        sch.wire([[q1.emitter.x, q1.emitter.y + 65], [q1.emitter.x, gndY]]);
        sch.dot(q1.emitter.x, q1.emitter.y);

        // Input at emitter (through coupling cap Cin)
        const vinX = 40;
        const cinStartX = 70;
        sch.nodeLabel(vinX, q1.emitter.y, 'Vin');
        sch.wire([[vinX, q1.emitter.y], [cinStartX, q1.emitter.y]]);
        sch.capacitor(cinStartX, q1.emitter.y, 'horizontal', { label: 'Cin' });
        sch.wire([[cinStartX + 50, q1.emitter.y], [q1.emitter.x, q1.emitter.y]]);

        // Base bypass capacitor Cb (base to AC ground)
        const cbX = q1.base.x - 60;
        sch.wire([[q1.base.x, q1.base.y], [cbX + 50, q1.base.y]]);
        sch.capacitor(cbX, q1.base.y, 'horizontal', { label: 'Cb' });
        sch.wire([[cbX, q1.base.y], [cbX, gndY]]);
        sch.dot(q1.base.x, q1.base.y);

        // Base bias resistor RB (from VCC rail down to base)
        // RB sets the DC operating point for the transistor
        const rbX = q1.collector.x + 140;

        // VCC rail connection
        sch.wire([[q1.collector.x, vccY], [rbX, vccY]]);
        sch.dot(rbX, vccY);

        // RB vertical from VCC
        sch.wire([[rbX, vccY], [rbX, vccY + 15]]);
        sch.resistor(rbX, vccY + 15, 'vertical', { label: 'RB' });

        // Connect RB bottom to base via horizontal wire
        const rbBottomY = vccY + 15 + 50;
        const baseBusY = q1.base.y + 40;
        sch.wire([[rbX, rbBottomY], [rbX, baseBusY]]);
        sch.wire([[rbX, baseBusY], [q1.base.x, baseBusY]]);
        sch.wire([[q1.base.x, baseBusY], [q1.base.x, q1.base.y]]);

        // Output coupling cap Cout (from collector)
        const coutStartX = q1.collector.x + 60;
        const voutX = coutStartX + 130;
        sch.wire([[q1.collector.x, rcBottomY], [coutStartX, rcBottomY]]);
        sch.capacitor(coutStartX, rcBottomY, 'horizontal');
        sch.text(coutStartX + 25, rcBottomY + 28, 'Cout', { size: 11, bold: true });
        sch.wire([[coutStartX + 50, rcBottomY], [voutX, rcBottomY]]);
        sch.nodeLabel(voutX, rcBottomY, 'Vout', { dx: 16, anchor: 'start' });

        // Ground rail
        sch.wire([[cbX, gndY], [q1.emitter.x, gndY]]);
        sch.ground((cbX + q1.emitter.x) / 2, gndY);

        sch.text(width / 2, height - 15, 'Zin ≈ re (low), Av ≈ RC/re, Good for RF',
            { size: 10, color: COLORS.annotation });

        sch.finalize();
        return sch;
    }

    /**
     * JFET Source Follower - High input impedance voltage buffer
     * JFET = Junction Field-Effect Transistor (depletion-mode N-channel)
     * Output follows input with Av ≈ 1, Zin in megaohms range
     */
    function sourceFollower(container, options = {}) {
        const { width = 320, height = 280, rs = '10k' } = options;

        const sch = new Schematic(container, { width, height });

        const vddY = 30;
        const gndY = 240;
        const jfetX = 160, jfetY = 110;

        // Draw N-channel JFET symbol manually
        const g = sch.svg.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('transform', `translate(${jfetX}, ${jfetY})`);

        // Vertical channel bar
        const channel = sch.svg.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'line');
        channel.setAttribute('x1', 0);
        channel.setAttribute('y1', -20);
        channel.setAttribute('x2', 0);
        channel.setAttribute('y2', 20);
        channel.setAttribute('stroke', COLORS.component);
        channel.setAttribute('stroke-width', '3');
        g.appendChild(channel);

        // Gate lead (horizontal line to channel)
        const gate = sch.svg.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'line');
        gate.setAttribute('x1', -20);
        gate.setAttribute('y1', 0);
        gate.setAttribute('x2', 0);
        gate.setAttribute('y2', 0);
        gate.setAttribute('stroke', COLORS.component);
        gate.setAttribute('stroke-width', '2');
        g.appendChild(gate);

        // Arrow pointing INTO channel (N-channel JFET)
        const arrow = sch.svg.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        arrow.setAttribute('points', '-12,-4 -4,0 -12,4');
        arrow.setAttribute('fill', COLORS.component);
        g.appendChild(arrow);

        sch.componentGroup.appendChild(g);
        sch.text(jfetX + 12, jfetY - 5, 'J1', { size: 10 });

        // Drain terminal (top of JFET at jfetY - 20)
        const drainY = jfetY - 20;
        // Source terminal (bottom of JFET at jfetY + 20)
        const sourceY = jfetY + 20;
        // Gate terminal (left at jfetX - 20)
        const gateX = jfetX - 20;

        // Register JFET terminals so connected wires aren't treated as floating.
        sch.nodeRegistry.register(jfetX, drainY, null, 'pin');
        sch.nodeRegistry.register(jfetX, sourceY, null, 'pin');
        sch.nodeRegistry.register(gateX, jfetY, null, 'pin');

        // VDD supply to drain
        sch.vcc(jfetX, vddY, { label: 'VDD' });
        sch.wire([[jfetX, vddY], [jfetX, drainY]]);

        // Source resistor RS
        sch.wire([[jfetX, sourceY], [jfetX, sourceY + 15]]);
        sch.resistor(jfetX, sourceY + 15, 'vertical', { label: 'RS', value: rs });
        sch.wire([[jfetX, sourceY + 65], [jfetX, gndY]]);
        sch.dot(jfetX, sourceY);

        // Ground
        sch.ground(jfetX, gndY);

        // Input at gate (high impedance)
        const vinX = 40;
        sch.nodeLabel(vinX, jfetY, 'Vin');
        sch.wire([[vinX, jfetY], [gateX, jfetY]]);

        // Output from source (low impedance)
        const voutX = jfetX + 80;
        sch.wire([[jfetX, sourceY], [voutX, sourceY]]);
        sch.nodeLabel(voutX, sourceY, 'Vout');

        sch.text(width / 2, height - 15, 'Av ≈ 1, Zin = 10^9 Ω (gate leakage only)',
            { size: 10, color: COLORS.annotation });

        sch.finalize();
        return sch;
    }

    /**
     * Active Lowpass Filter - Sallen-Key Butterworth 2nd order
     * Provides -40dB/decade rolloff with maximally flat passband
     * fc = 1/(2π√(R1×R2×C1×C2)), Q depends on component ratios
     */
    function activeLowpass(container, options = {}) {
        const { width = 420, height = 280, fc = '1kHz' } = options;

        const sch = new Schematic(container, { width, height });

        const opX = 240, opY = 140;
        const gndY = 240;

        const op = Schematic.opampTerminals(opX, opY);

        // Op-amp (unity-gain buffer in Sallen-Key topology)
        sch.opamp(opX, opY);

        // Input and first resistor R1
        const vinX = 30;
        const r1X = 55;
        sch.nodeLabel(vinX, op.nonInvInput.y, 'Vin');
        sch.wire([[vinX, op.nonInvInput.y], [r1X, op.nonInvInput.y]]);
        sch.resistor(r1X, op.nonInvInput.y, 'horizontal', { label: 'R1' });

        // Junction between R1 and R2
        const jctX = r1X + 50;
        sch.dot(jctX, op.nonInvInput.y);

        // Second resistor R2
        const r2X = jctX + 10;
        sch.wire([[jctX, op.nonInvInput.y], [r2X, op.nonInvInput.y]]);
        sch.resistor(r2X, op.nonInvInput.y, 'horizontal', { label: 'R2' });
        sch.wire([[r2X + 50, op.nonInvInput.y], [op.nonInvInput.x, op.nonInvInput.y]]);
        sch.dot(op.nonInvInput.x, op.nonInvInput.y);

        // C1 from R1/R2 junction to ground
        sch.wire([[jctX, op.nonInvInput.y], [jctX, op.nonInvInput.y + 20]]);
        sch.capacitor(jctX, op.nonInvInput.y + 20, 'vertical', { label: 'C1' });
        sch.wire([[jctX, op.nonInvInput.y + 70], [jctX, gndY]]);

        // C2 feedback from non-inv input to output
        const fbY = opY - 75;
        sch.wire([[op.nonInvInput.x, op.nonInvInput.y], [op.nonInvInput.x, fbY]]);
        sch.wire([[op.nonInvInput.x, fbY], [op.nonInvInput.x + 10, fbY]]);
        sch.capacitor(op.nonInvInput.x + 10, fbY, 'horizontal', { label: 'C2' });
        const c2EndX = op.nonInvInput.x + 60;
        sch.wire([[c2EndX, fbY], [op.output.x + 15, fbY]]);
        sch.wire([[op.output.x + 15, fbY], [op.output.x + 15, op.output.y]]);
        sch.wire([[op.output.x + 15, op.output.y], [op.output.x, op.output.y]]);
        sch.dot(op.output.x, op.output.y);

        // Unity gain: inverting input tied directly to output
        // Route below the op-amp keepout (avoid running through the triangle body).
        const fbLoopY = opY + 60;
        sch.wire([[op.invInput.x, op.invInput.y], [op.invInput.x, fbLoopY]]);
        sch.wire([[op.invInput.x, fbLoopY], [op.output.x + 15, fbLoopY]]);
        sch.wire([[op.output.x + 15, fbLoopY], [op.output.x + 15, op.output.y]]);
        sch.dot(op.output.x + 15, op.output.y);

        // Output label
        const voutX = op.output.x + 50;
        sch.wire([[op.output.x, op.output.y], [voutX, op.output.y]]);
        sch.nodeLabel(voutX, op.output.y, 'Vout');

        // Ground
        sch.ground(jctX, gndY);

        sch.text(width / 2, height - 15, 'Sallen-Key Butterworth, fc = ' + fc,
            { size: 10, color: COLORS.annotation });

        sch.finalize();
        return sch;
    }

    /**
     * Notch Filter (Twin-T) - Rejects a specific frequency
     * Twin-T creates a deep null at fnotch = 1/(2πRC)
     * Used for 50/60Hz hum rejection in audio applications
     */
    function notchFilter(container, options = {}) {
        const { width = 420, height = 300, fnotch = '60Hz' } = options;

        const sch = new Schematic(container, { width, height });

        const midY = 130;
        const gndY = 260;

        // Twin-T topology (canonical):
        // - Top branch: R - R with a shunt capacitor 2C to ground at the midpoint
        // - Bottom branch: C - C with a shunt resistor R/2 to ground at the midpoint
        // Both branches are in parallel between Vin and Vout.

        const vinX = 30;
        const leftX = 60;
        const rightX = 300;
        const centerX = Math.round((leftX + rightX) / 2);
        const topY = midY - 45;
        const botY = midY + 45;

        // Input node to left bus
        sch.nodeLabel(vinX, midY, 'Vin');
        sch.wire([[vinX, midY], [leftX, midY]]);
        sch.dot(leftX, midY);

        // Left/right buses tying top/mid/bottom nodes
        sch.wire([[leftX, topY], [leftX, midY], [leftX, botY]]);
        sch.wire([[rightX, topY], [rightX, midY], [rightX, botY]]);
        sch.dot(rightX, midY);

        // === TOP BRANCH: R - R, midpoint to ground via 2C ===
        sch.resistor(leftX, topY, 'horizontal', { label: 'R' });
        const topR1EndX = leftX + 50;
        const topR2StartX = rightX - 50;
        sch.wire([[topR1EndX, topY], [centerX, topY], [topR2StartX, topY]]);
        sch.dot(centerX, topY);
        sch.resistor(topR2StartX, topY, 'horizontal', { label: 'R' });

        const cap2StartY = topY + 10;
        sch.wire([[centerX, topY], [centerX, cap2StartY]]);
        sch.capacitor(centerX, cap2StartY, 'vertical', { label: '2C' });
        const cap2EndY = cap2StartY + 50;
        sch.wire([[centerX, cap2EndY], [centerX, gndY]]);

        // === BOTTOM BRANCH: C - C, midpoint to ground via R/2 ===
        sch.capacitor(leftX, botY, 'horizontal', { label: 'C' });
        const botC1EndX = leftX + 50;
        const botC2StartX = rightX - 50;
        sch.wire([[botC1EndX, botY], [centerX, botY], [botC2StartX, botY]]);
        sch.dot(centerX, botY);
        sch.capacitor(botC2StartX, botY, 'horizontal', { label: 'C' });

        // Move the R/2 shunt resistor off the centerline so the 2C shunt wire doesn't run through it.
        const rHalfX = centerX + 40;
        const rHalfStartY = botY + 10;
        sch.wire([[centerX, botY], [rHalfX, botY]]);
        sch.dot(rHalfX, botY);
        sch.wire([[rHalfX, botY], [rHalfX, rHalfStartY]]);
        sch.resistor(rHalfX, rHalfStartY, 'vertical', { label: 'R/2' });
        sch.wire([[rHalfX, rHalfStartY + 50], [rHalfX, gndY]]);

        // Ground bus tying shunt elements
        sch.wire([[centerX, gndY], [rHalfX, gndY]]);
        sch.ground(Math.round((centerX + rHalfX) / 2), gndY);

        // Output
        const voutX = rightX + 50;
        sch.wire([[rightX, midY], [voutX, midY]]);
        sch.nodeLabel(voutX, midY, 'Vout');

        sch.text(width / 2, height - 15, 'Notch at f = 1/(2πRC) = ' + fnotch,
            { size: 10, color: COLORS.annotation });

        sch.finalize();
        return sch;
    }

    /**
     * Fixed Bias - Simple BJT bias with single base resistor
     * VCC -> RB -> Base, Collector through RC
     */
    function fixedBias(container, options = {}) {
        const { width = 220, height = 200, rb = 'RB', rc = 'RC' } = options;

        const sch = new Schematic(container, { width, height });

        const vccY = 20;
        const gndY = 170;
        const qX = 90, qY = 115;

        const q1 = Schematic.npnTerminals(qX, qY, false);

        // VCC
        sch.vcc(q1.collector.x, vccY, { label: 'VCC' });

        // RC from VCC to collector (resistor is 50px tall)
        const rcTopY = vccY + 5;
        const rcBotY = rcTopY + 50;
        sch.wire([[q1.collector.x, vccY], [q1.collector.x, rcTopY]]);
        sch.resistor(q1.collector.x, rcTopY, 'vertical', { label: 'RC', value: rc });
        sch.wire([[q1.collector.x, rcBotY], [q1.collector.x, q1.collector.y]]);

        // Transistor
        sch.npn(qX, qY, { label: 'Q1', circle: false });

        // RB from VCC to base
        const rbX = 40;
        sch.wire([[rbX, vccY], [q1.collector.x, vccY]]);
        sch.wire([[rbX, vccY], [rbX, vccY + 5]]);
        sch.resistor(rbX, vccY + 5, 'vertical', { label: 'RB', value: rb });
        sch.wire([[rbX, vccY + 55], [rbX, q1.base.y]]);
        sch.wire([[rbX, q1.base.y], [q1.base.x, q1.base.y]]);

        // Emitter to ground
        sch.wire([[q1.emitter.x, q1.emitter.y], [q1.emitter.x, gndY]]);
        sch.ground(q1.emitter.x, gndY);

        // Labels
        sch.text(q1.collector.x + 20, q1.collector.y - 10, 'C', { size: 10 });
        sch.text(q1.base.x - 25, q1.base.y - 15, 'B', { size: 10, anchor: 'end' });
        sch.text(q1.emitter.x + 20, q1.emitter.y + 10, 'E', { size: 10 });

        sch.finalize();
        return sch;
    }

    /**
     * Voltage Divider Bias - BJT bias circuit with R1/R2 divider
     * Shows the fundamental voltage divider biasing topology
     */
    function voltageDividerBias(container, options = {}) {
        const { width = 280, height = 240, r1 = 'R1', r2 = 'R2', rc = 'RC', re = 'RE' } = options;

        const sch = new Schematic(container, { width, height });

        const vccY = 25;
        const gndY = 215;
        const qX = 150, qY = 120;
        const biasX = 60;

        const q1 = Schematic.npnTerminals(qX, qY, false);

        // VCC rail
        sch.vcc(q1.collector.x, vccY, { label: 'VCC' });
        sch.wire([[biasX, vccY], [q1.collector.x, vccY]]);

        // RC from VCC to collector (leave keepout clearance)
        const rcTopY = vccY + 5;
        const rcBotY = rcTopY + 50;
        sch.wire([[q1.collector.x, vccY], [q1.collector.x, rcTopY]]);
        sch.resistor(q1.collector.x, rcTopY, 'vertical', { label: 'RC', value: rc });
        sch.wire([[q1.collector.x, rcBotY], [q1.collector.x, q1.collector.y]]);

        // Transistor
        sch.npn(qX, qY, { label: 'Q1', circle: false });

        // RE from emitter to ground
        sch.wire([[q1.emitter.x, q1.emitter.y], [q1.emitter.x, q1.emitter.y + 10]]);
        sch.resistor(q1.emitter.x, q1.emitter.y + 10, 'vertical', { label: 'RE', value: re });
        sch.wire([[q1.emitter.x, q1.emitter.y + 60], [q1.emitter.x, gndY]]);

        // R1 from VCC to bias node
        sch.wire([[biasX, vccY], [biasX, vccY + 10]]);
        sch.resistor(biasX, vccY + 10, 'vertical', { label: 'R1', value: r1 });
        const biasNodeY = vccY + 60;
        sch.dot(biasX, biasNodeY);

        // R2 from bias node to ground
        sch.wire([[biasX, biasNodeY], [biasX, biasNodeY + 10]]);
        sch.resistor(biasX, biasNodeY + 10, 'vertical', { label: 'R2', value: r2 });
        sch.wire([[biasX, biasNodeY + 60], [biasX, gndY]]);

        // Ground rail
        sch.wire([[biasX, gndY], [q1.emitter.x, gndY]]);
        sch.ground((biasX + q1.emitter.x) / 2, gndY);

        // Base connection from bias node
        sch.wire([[biasX, biasNodeY], [q1.base.x, biasNodeY]]);
        sch.wire([[q1.base.x, biasNodeY], [q1.base.x, q1.base.y]]);

        // Voltage labels
        sch.text(q1.collector.x + 25, (vccY + 60 + q1.collector.y) / 2, 'VC', { size: 10 });
        sch.text(q1.emitter.x + 25, (q1.emitter.y + q1.emitter.y + 10) / 2, 'VE', { size: 10 });
        sch.text(biasX + 25, biasNodeY + 18, 'VB', { size: 10, anchor: 'start' });

        sch.finalize();
        return sch;
    }

    /**
     * BJT DC Operating Point - Simple bias circuit for simulation
     * VCC through RC to collector, VBE source to base, emitter grounded
     */
    function bjtDcBias(container, options = {}) {
        const { width = 280, height = 240, vcc = '12V', rc = '4.7k', vbe = '0.65V' } = options;

        const sch = new Schematic(container, { width, height });

        const vccY = 30;
        const gndY = 210;
        const qX = 150, qY = 130;

        const q1 = Schematic.npnTerminals(qX, qY, false);

        // VCC rail
        sch.vcc(q1.collector.x, vccY, { label: 'VCC', value: vcc });

        // RC from VCC to collector (leave keepout clearance)
        const rcTopY = vccY + 10;
        const rcBotY = rcTopY + 50;
        sch.wire([[q1.collector.x, vccY], [q1.collector.x, rcTopY]]);
        sch.resistor(q1.collector.x, rcTopY, 'vertical', { label: 'RC', value: rc });
        sch.wire([[q1.collector.x, rcBotY], [q1.collector.x, q1.collector.y]]);

        // Transistor
        sch.npn(qX, qY, { label: 'Q1', circle: false });

        // VBE source to base
        const vbeX = 50;
        sch.nodeLabel(vbeX, q1.base.y, 'VBE');
        sch.text(vbeX - 12, q1.base.y + 26, vbe, { size: 9, color: COLORS.value, anchor: 'end' });
        sch.wire([[vbeX, q1.base.y], [q1.base.x, q1.base.y]]);

        // Emitter to ground
        sch.wire([[q1.emitter.x, q1.emitter.y], [q1.emitter.x, gndY]]);
        sch.ground(q1.emitter.x, gndY);

        // VBE source ground
        sch.wire([[vbeX, q1.base.y], [vbeX, gndY]]);
        sch.wire([[vbeX, gndY], [q1.emitter.x, gndY]]);

        // IC annotation
        const icArrowY = (vccY + 65 + q1.collector.y) / 2;
        sch.currentArrow(q1.collector.x + 20, vccY + 65, q1.collector.x + 20, q1.collector.y, { label: 'IC' });

        sch.text(width / 2, height - 10, 'IC = IS × exp(VBE/VT)',
            { size: 10, color: COLORS.annotation });

        sch.finalize();
        return sch;
    }

    /**
     * BJT DC Sweep - Circuit for VBE sweep analysis
     */
    function bjtDcSweep(container, options = {}) {
        const { width = 300, height = 240, vce = '5V' } = options;

        const sch = new Schematic(container, { width, height });

        const vccY = 30;
        const gndY = 210;
        const qX = 160, qY = 130;

        const q1 = Schematic.npnTerminals(qX, qY, false);

        // VCE voltage source (from collector to ground)
        const vceX = q1.collector.x + 50;
        sch.nodeLabel(vceX, vccY + 20, 'VCE');
        sch.text(vceX + 12, vccY + 35, vce, { size: 9, color: COLORS.value, anchor: 'start' });
        sch.wire([[q1.collector.x, q1.collector.y], [q1.collector.x, vccY + 20]]);
        sch.wire([[q1.collector.x, vccY + 20], [vceX, vccY + 20]]);
        sch.wire([[vceX, vccY + 20], [vceX, gndY]]);

        // Transistor
        sch.npn(qX, qY, { label: 'Q1', circle: false });

        // VBE sweep source to base
        const vbeX = 50;
        sch.nodeLabel(vbeX, q1.base.y, 'VBE');
        sch.text(vbeX - 12, q1.base.y + 26, 'sweep', { size: 9, color: COLORS.annotation, anchor: 'end' });
        sch.wire([[vbeX, q1.base.y], [q1.base.x, q1.base.y]]);

        // Emitter to ground
        sch.wire([[q1.emitter.x, q1.emitter.y], [q1.emitter.x, gndY]]);

        // Ground rail
        sch.wire([[vbeX, gndY], [vceX, gndY]]);
        sch.wire([[vbeX, q1.base.y], [vbeX, gndY]]);
        sch.ground((vbeX + vceX) / 2, gndY);

        sch.text(width / 2, height - 10, '.DC VBE 0.5 0.8 0.01',
            { size: 10, color: COLORS.annotation });

        sch.finalize();
        return sch;
    }

    /**
     * BJT Temperature Sweep - Circuit for temperature analysis
     */
    function bjtTempSweep(container, options = {}) {
        const { width = 300, height = 250, vcc = '12V', rc = '4.7k', ib = '10µA' } = options;

        const sch = new Schematic(container, { width, height });

        const vccY = 30;
        const gndY = 220;
        const qX = 160, qY = 140;

        const q1 = Schematic.npnTerminals(qX, qY, false);

        // VCC rail
        sch.vcc(q1.collector.x, vccY, { label: 'VCC', value: vcc });

        // RC from VCC to collector
        sch.wire([[q1.collector.x, vccY], [q1.collector.x, vccY + 15]]);
        sch.resistor(q1.collector.x, vccY + 15, 'vertical', { label: 'RC', value: rc });
        sch.wire([[q1.collector.x, vccY + 65], [q1.collector.x, q1.collector.y]]);

        // Transistor
        sch.npn(qX, qY, { label: 'Q1', circle: false });

        // IB current source to base
        const ibX = 50;
        sch.nodeLabel(ibX, q1.base.y, 'IB');
        sch.text(ibX - 12, q1.base.y + 26, ib, { size: 9, color: COLORS.value, anchor: 'end' });
        sch.wire([[ibX, q1.base.y], [q1.base.x, q1.base.y]]);
        sch.wire([[ibX, gndY], [ibX, q1.base.y]]);
        sch.currentArrow(ibX, gndY, ibX, q1.base.y, { label: '' });

        // Emitter to ground
        sch.wire([[q1.emitter.x, q1.emitter.y], [q1.emitter.x, gndY]]);

        // Ground rail
        sch.wire([[ibX, gndY], [q1.emitter.x, gndY]]);
        sch.ground((ibX + q1.emitter.x) / 2, gndY);

        // VBE measurement point
        sch.dot(q1.base.x, q1.base.y);
        sch.text(q1.base.x + 65, q1.base.y - 20, 'VBE', { size: 9, color: COLORS.annotation, anchor: 'start' });

        sch.text(width / 2, height - 10, '.DC TEMP -40 125',
            { size: 10, color: COLORS.annotation });

        sch.finalize();
        return sch;
    }

    /**
     * NMOS DC Bias - Simple MOSFET test circuit
     * VGS source to gate, drain through RD to VDD
     */
    function nmosDcBias(container, options = {}) {
        const { width = 280, height = 240, vdd = '10V', rd = '1k', vgs = '4V' } = options;

        const sch = new Schematic(container, { width, height });

        const vddY = 30;
        const gndY = 210;
        const mosX = 150, mosY = 130;

        // NMOS symbol (terminal-first)
        const m1 = Schematic.nmosTerminals(mosX, mosY, false);
        sch.nmos(mosX, mosY, { label: 'M1', showType: true, showTerminals: true });

        // VDD rail
        sch.vcc(m1.drain.x, vddY, { label: 'VDD' });

        // RD from VDD to drain
        sch.wire([[m1.drain.x, vddY], [m1.drain.x, vddY + 15]]);
        sch.resistor(m1.drain.x, vddY + 15, 'vertical', { label: null, value: null });
        sch.text(m1.drain.x - 40, vddY + 33, 'RD', { size: 11, anchor: 'end', bold: true });
        sch.text(m1.drain.x - 40, vddY + 47, rd, { size: 10, anchor: 'end', color: COLORS.value });
        sch.wire([[m1.drain.x, vddY + 65], [m1.drain.x, m1.drain.y]]);

        // VGS source to gate
        const vgsX = 50;
        sch.nodeLabel(vgsX, m1.gate.y, 'VGS');
        sch.text(vgsX - 12, m1.gate.y + 22, vgs, { size: 9, color: COLORS.value, anchor: 'end' });
        sch.wire([[vgsX, m1.gate.y], [m1.gate.x, m1.gate.y]]);

        // Source to ground
        sch.wire([[m1.source.x, m1.source.y], [m1.source.x, gndY]]);
        sch.ground(m1.source.x, gndY);

        // VGS source ground
        sch.wire([[vgsX, m1.gate.y], [vgsX, gndY]]);
        sch.wire([[vgsX, gndY], [m1.source.x, gndY]]);

        sch.text(width / 2, height - 10, 'ID = K(VGS - Vth)²',
            { size: 10, color: COLORS.annotation });

        sch.finalize();
        return sch;
    }

    /**
     * NMOS Common-Source Amplifier
     */
    function nmosCommonSource(container, options = {}) {
        const { width = 340, height = 280, vdd = '12V', rd = '2k', rs = '500' } = options;

        const sch = new Schematic(container, { width, height });

        const vddY = 30;
        const gndY = 250;
        const mosX = 180, mosY = 130;

        // NMOS symbol (terminal-first)
        const m1 = Schematic.nmosTerminals(mosX, mosY, false);
        sch.nmos(mosX, mosY, { label: 'M1', showType: true, showTerminals: true });

        // VDD rail
        sch.vcc(m1.drain.x, vddY, { label: 'VDD' });

        // RD from VDD to drain
        sch.wire([[m1.drain.x, vddY], [m1.drain.x, vddY + 15]]);
        sch.resistor(m1.drain.x, vddY + 15, 'vertical', { label: null, value: null });
        sch.text(m1.drain.x - 40, vddY + 33, 'RD', { size: 11, anchor: 'end', bold: true });
        sch.text(m1.drain.x - 40, vddY + 47, rd, { size: 10, anchor: 'end', color: COLORS.value });
        sch.wire([[m1.drain.x, vddY + 65], [m1.drain.x, m1.drain.y]]);
        sch.dot(m1.drain.x, vddY + 65);

        // RS from source to ground
        sch.wire([[m1.source.x, m1.source.y], [m1.source.x, m1.source.y + 15]]);
        sch.resistor(m1.source.x, m1.source.y + 15, 'vertical', { label: 'RS', value: rs });
        sch.wire([[m1.source.x, m1.source.y + 65], [m1.source.x, gndY]]);

        // Gate bias divider
        const biasX = m1.gate.x - 60;
        sch.wire([[m1.gate.x, m1.gate.y], [biasX, m1.gate.y]]);
        sch.dot(biasX, m1.gate.y);

        // R1 from VDD
        sch.wire([[biasX, vddY], [biasX, vddY + 15]]);
        sch.resistor(biasX, vddY + 15, 'vertical', { label: 'R1' });
        sch.wire([[biasX, vddY + 65], [biasX, m1.gate.y]]);

        // R2 to ground
        sch.wire([[biasX, m1.gate.y], [biasX, m1.gate.y + 15]]);
        sch.resistor(biasX, m1.gate.y + 15, 'vertical', { label: 'R2' });
        sch.wire([[biasX, m1.gate.y + 65], [biasX, gndY]]);

        // VDD rail to R1
        sch.wire([[m1.drain.x, vddY], [biasX, vddY]]);
        sch.dot(biasX, vddY);

        // Input at gate (capacitor connects Vin to bias node)
        const vinX = 30;
        const cinStartX = vinX + 15;
        const cinEndX = cinStartX + 50;  // capacitor is 50px wide
        sch.nodeLabel(vinX, m1.gate.y, 'Vin');
        sch.wire([[vinX, m1.gate.y], [cinStartX, m1.gate.y]]);
        sch.capacitor(cinStartX, m1.gate.y, 'horizontal', { label: 'Cin' });
        sch.wire([[cinEndX, m1.gate.y], [biasX, m1.gate.y]]);  // Wire from capacitor to bias node

        // Output at drain
        const drainNodeY = vddY + 65;
        const voutX = m1.drain.x + 130;
        sch.wire([[m1.drain.x, drainNodeY], [m1.drain.x + 15, drainNodeY]]);
        sch.capacitor(m1.drain.x + 15, drainNodeY, 'horizontal', { label: null });
        sch.text(m1.drain.x + 70, drainNodeY - 22, 'Cout', { size: 11, bold: true, anchor: 'start' });
        sch.wire([[m1.drain.x + 65, drainNodeY], [voutX, drainNodeY]]);
        sch.nodeLabel(voutX, drainNodeY, 'Vout');

        // Ground rail
        sch.wire([[biasX, gndY], [m1.source.x, gndY]]);
        sch.ground((biasX + m1.source.x) / 2, gndY);

        sch.text(width / 2, height - 10, 'Av = -gm × RD',
            { size: 10, color: COLORS.annotation });

        sch.finalize();
        return sch;
    }

    // ===== FACTORY =====
    function create(container, options) {
        return new Schematic(container, options);
    }

    // ===== PUBLIC API =====
    return {
        create,
        Schematic,
        // Amplifiers
        ceAmplifier,
        fixedBias,
        voltageDividerBias,
        bjtDcBias,
        bjtDcSweep,
        bjtTempSweep,
        nmosDcBias,
        nmosCommonSource,
        twoStageCE,
        emitterFollower,
        cascodeAmp,
        commonBaseAmp,
        diffPairActiveLoad,
        pushPullOutput,
        instrumentationAmp,
        sziklaiPair,
        darlingtonPair,
        bootstrapBias,
        sourceFollower,
        // Op-amp circuits
        nonInvertingAmp,
        invertingAmp,
        voltageFollower,
        summingAmp,
        headphoneAmp,
        comparator,
        schmittTrigger,
        opampMonostable,
        // Oscillators
        relaxationOscillator,
        wienBridgeOscillator,
        phaseShiftOscillator,
        colpittsOscillator,
        hartleyOscillator,
        clappOscillator,
        pierceOscillator,
        colpittsCrystalOscillator,
        butlerOscillator,
        tcxoOscillator,
        ocxoOscillator,
        timer555Astable,
        timer555Monostable,
        timer555Bistable,
        // Filters
        sallenKeyLowpass,
        rcLowpass,
        rcHighpass,
        piFilter,
        bandpassFilter,
        activeLowpass,
        notchFilter,
        // Building blocks
        currentMirror,
        wilsonMirror,
        voltageRegulator,
        pmosLdo,
        lcTank,
        lcTankWithQ,
        voltageDivider,
        levelShifter,
        // Power circuits
        halfWaveRectifier,
        fullWaveRectifier,
        voltageDoubler,
        // Digital interface
        mosfetSwitch,
        clampCircuit,
        // Op-amp building blocks
        integrator,
        differentiator,
        peakDetector,
        activeRectifier,
        sampleAndHold,
        COLORS,
        // Simple terminal helpers (for lessons that compute endpoints after drawing)
        // Convention matches resistor()/capacitor()/diode() APIs:
        //  - horizontal: (x,y) is left terminal, length 50
        //  - vertical:   (x,y) is top terminal, height 50
        resistorTerminals: (x, y, orient = 'horizontal') =>
            (orient === 'vertical')
                ? ({ start: { x, y }, end: { x, y: y + 50 } })
                : ({ start: { x, y }, end: { x: x + 50, y } }),
        capacitorTerminals: (x, y, orient = 'horizontal') =>
            (orient === 'vertical')
                ? ({ start: { x, y }, end: { x, y: y + 50 } })
                : ({ start: { x, y }, end: { x: x + 50, y } }),
        diodeTerminals: (x, y, orient = 'horizontal') =>
            (orient === 'vertical')
                ? ({ start: { x, y }, end: { x, y: y + 50 } })
                : ({ start: { x, y }, end: { x: x + 50, y } }),
        inductorTerminals: (x, y, orient = 'horizontal') =>
            (orient === 'vertical')
                ? ({ start: { x, y }, end: { x, y: y + 50 } })
                : ({ start: { x, y }, end: { x: x + 50, y } }),
        // Terminal position helpers (expose static methods for easy access)
        npnTerminals: Schematic.npnTerminals,
        pnpTerminals: Schematic.pnpTerminals,
        opampTerminals: Schematic.opampTerminals,
        nmosTerminals: Schematic.nmosTerminals,
        pmosTerminals: Schematic.pmosTerminals
    };
})();

// Attach to AD namespace
if (typeof AD !== 'undefined') {
    AD.Schematic = SchematicLib;
}

// ===== SCHEMATIC SVG BUILDER (String-based API for inline schematics) =====
/**
 * Simple SVG string builder for creating schematics.
 * Usage: const svg = new SchematicSVG(width, height);
 *        svg.wire([[x1,y1], [x2,y2]]);
 *        container.innerHTML = svg.render();
 */
class SchematicSVGBuilder {
    constructor(arg1, arg2, arg3) {
        // Supports:
        //  - new SchematicSVG(width, height)
        //  - new SchematicSVG(containerId, width, height)
        //  - new SchematicSVG(containerEl, width, height)
        const isElement = (v) => v && typeof v === 'object' && typeof v.nodeType === 'number';

        this.elements = [];
        this.nr = new SchematicSVGBuilder.NodeRegistry();

        // Colors matching dark theme
        this.colors = {
            component: '#6ee7ff',
            wire: '#e6edf3',
            text: '#e6edf3',
            value: '#9fb0c0',
            ground: '#9fb0c0'
        };

        this._containerEl = null;
        this._renderScheduled = false;
        this._svgEl = null;
        this._svgDirty = true;

        if (typeof arg1 === 'string') {
            this._containerEl = (typeof document !== 'undefined') ? document.getElementById(arg1) : null;
            this.width = arg2;
            this.height = arg3;
        } else if (isElement(arg1)) {
            this._containerEl = arg1;
            this.width = arg2;
            this.height = arg3;
        } else {
            this.width = arg1;
            this.height = arg2;
        }

        // Defensive defaults (keeps lessons from exploding if args are wrong)
        if (!Number.isFinite(this.width)) this.width = 600;
        if (!Number.isFinite(this.height)) this.height = 300;

        // If constructed with a container, auto-render after draw calls
        if (this._containerEl) {
            this._containerEl.innerHTML = '';
        }
    }

    // Simple node registry for named coordinates
    static NodeRegistry = class {
        constructor() {
            this.nodes = new Map();
        }
        define(name, x, y) {
            this.nodes.set(name, { x, y });
            return { x, y };
        }
        // Some lesson files use register() instead of define()
        register(name, x, y) {
            return this.define(name, x, y);
        }
        get(name) {
            return this.nodes.get(name);
        }
    };

    _scheduleRender() {
        if (!this._containerEl) return;
        if (this._renderScheduled) return;
        this._renderScheduled = true;

        const doRender = () => {
            this._renderScheduled = false;
            if (!this._containerEl) return;
            this._containerEl.innerHTML = this.render();
        };

        if (typeof queueMicrotask === 'function') queueMicrotask(doRender);
        else setTimeout(doRender, 0);
    }

    _push(markup) {
        this.elements.push(markup);
        this._svgDirty = true;
        this._scheduleRender();
        return this;
    }

    _escapeText(content) {
        return String(content)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    _looksLikeColor(str) {
        return typeof str === 'string' && (
            str.startsWith('#') ||
            str.startsWith('rgb(') || str.startsWith('rgba(') ||
            str.startsWith('hsl(') || str.startsWith('hsla(')
        );
    }

    _parseFontSpec(fontSpec) {
        const spec = (typeof fontSpec === 'string') ? fontSpec : '';
        const sizeMatch = spec.match(/(\\d+(?:\\.\\d+)?)\\s*px/i);
        const fontSize = sizeMatch ? parseFloat(sizeMatch[1]) : null;
        const bold = /\\bbold\\b/i.test(spec);
        return { fontSize, bold };
    }

    // Draw a wire path through points
    wire(points, options = {}) {
        if (!points || points.length < 2) return this;
        const color = options.stroke || options.color || this.colors.wire;
        const width = options.strokeWidth || options.width || 1.5;
        const dasharray = options.strokeDasharray || options.dasharray || null;

        const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');
        const dash = dasharray ? ` stroke-dasharray="${dasharray}"` : '';

        return this._push(`<path d="${d}" stroke="${color}" stroke-width="${width}" fill="none" stroke-linecap="round" stroke-linejoin="round"${dash}/>`);
    }

    // Draw a line between two points
    // Supports legacy signature: line(x1, y1, x2, y2, strokeColor?, strokeWidth?, dasharray?)
    line(x1, y1, x2, y2, options = {}, strokeWidth, strokeDasharray) {
        let opts = {};
        if (this._looksLikeColor(options)) {
            opts.stroke = options;
            if (Number.isFinite(strokeWidth)) opts.strokeWidth = strokeWidth;
            if (typeof strokeDasharray === 'string') opts.strokeDasharray = strokeDasharray;
        } else if (typeof options === 'object' && options !== null) {
            opts = { ...options };
        } else if (Number.isFinite(options)) {
            opts.strokeWidth = options;
        }

        const color = opts.stroke || opts.color || this.colors.wire;
        const width = opts.strokeWidth || opts.width || 1.5;
        const dasharray = opts.strokeDasharray || opts.dasharray || null;
        const dash = dasharray ? ` stroke-dasharray="${dasharray}"` : '';
        return this._push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}"${dash}/>`);
    }

    // Draw text
    // Supports legacy signature: text(x, y, content, fontSpec|fontSize|anchor, color, anchor)
    text(x, y, content, options = {}, color, anchor, baseline) {
        let opts = {};

        if (typeof options === 'object' && options !== null) {
            opts = { ...options };
        } else {
            // Legacy form
            if (typeof options === 'string') {
                const { fontSize, bold } = this._parseFontSpec(options);
                if (fontSize !== null || bold) {
                    if (fontSize !== null) opts.fontSize = fontSize;
                    if (bold) opts.bold = true;
                } else if (['start', 'middle', 'end'].includes(options)) {
                    opts.anchor = options;
                } else {
                    const parsed = parseFloat(options);
                    if (Number.isFinite(parsed)) opts.fontSize = parsed;
                }
            } else if (Number.isFinite(options)) {
                opts.fontSize = options;
            }

            if (this._looksLikeColor(color)) opts.fill = color;
            if (typeof anchor === 'string') opts.anchor = anchor;
            if (typeof baseline === 'string') opts.baseline = baseline;
        }

        const size = opts.fontSize || 11;
        const fill = opts.fill || opts.color || this.colors.text;
        const textAnchor = opts.anchor || 'start';
        const domBaseline = opts.baseline || 'middle';
        const weight = opts.weight || (opts.bold ? '700' : '400');
        const family = opts.fontFamily || 'monospace';

        return this._push(`<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" text-anchor="${textAnchor}" dominant-baseline="${domBaseline}" font-family="${family}" font-weight="${weight}">${this._escapeText(content)}</text>`);
    }

    // Draw a rectangle
    // Supports legacy signature: rect(x, y, width, height, fill?, stroke?, strokeWidth?)
    rect(x, y, width, height, options = {}, stroke, strokeWidth) {
        let opts = {};
        if (typeof options === 'object' && options !== null) {
            opts = { ...options };
        } else {
            opts.fill = options;
            opts.stroke = stroke;
            if (Number.isFinite(strokeWidth)) opts.strokeWidth = strokeWidth;
        }

        const fill = (opts.fill === undefined || opts.fill === null) ? 'none' : opts.fill;
        const strokeColor = opts.stroke || this.colors.component;
        const sw = opts.strokeWidth || 1.5;
        const dasharray = opts.strokeDasharray || null;
        const dash = dasharray ? ` stroke-dasharray="${dasharray}"` : '';
        return this._push(`<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}" stroke="${strokeColor}" stroke-width="${sw}"${dash}/>`);
    }

    // Draw a circle
    // Supports legacy signature: circle(cx, cy, r, fill?, stroke?, strokeWidth?)
    circle(cx, cy, r, options = {}, stroke, strokeWidth) {
        let opts = {};
        if (typeof options === 'object' && options !== null) {
            opts = { ...options };
        } else {
            opts.fill = options;
            opts.stroke = stroke;
            if (Number.isFinite(strokeWidth)) opts.strokeWidth = strokeWidth;
        }

        const fill = (opts.fill === undefined || opts.fill === null) ? this.colors.wire : opts.fill;
        const strokeColor = opts.stroke || 'none';
        const sw = opts.strokeWidth || 1.5;
        return this._push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${strokeColor}" stroke-width="${sw}"/>`);
    }

    // Draw an arbitrary SVG path
    // Supports legacy signatures:
    //  - path(d, strokeColor?, strokeWidth?)
    //  - path(d, fillColor, strokeColor, strokeWidth?)
    path(d, a, b, c) {
        const strokeWidthDefault = 1.5;
        let fill = 'none';
        let stroke = this.colors.component;
        let strokeWidth = strokeWidthDefault;

        if (this._looksLikeColor(a) && this._looksLikeColor(b)) {
            fill = a;
            stroke = b;
            if (Number.isFinite(c)) strokeWidth = c;
        } else if (this._looksLikeColor(a)) {
            stroke = a;
            if (Number.isFinite(b)) strokeWidth = b;
        }

        return this._push(`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`);
    }

    // Draw a junction dot
    dot(x, y, options = {}) {
        const r = options.radius || 3;
        const fill = options.fill || options.color || this.colors.wire;
        return this.circle(x, y, r, { fill, stroke: 'none', strokeWidth: 0 });
    }

    // Backwards-compatible alias (some lessons use svg.junction(...))
    junction(x, y, options = {}) {
        return this.dot(x, y, options);
    }

    // Node label helper (dot + text), matches newer schematics
    nodeLabel(x, y, label, options = {}) {
        const {
            dx = 0,
            dy = -12,
            anchor = 'middle',
            color = this.colors.text,
            size = 10
        } = options;
        this.dot(x, y, { color: this.colors.wire });
        this.text(x + dx, y + dy, label, { fontSize: size, fill: color, anchor });
        return this;
    }

    // Draw an op-amp triangle
    opAmp(x, y, options = {}) {
        const mirror = !!options.mirror;
        const color = options.stroke || this.colors.component;
        const label = options.label || '';

        // Triangle body: apex points right (or left if mirrored)
        // x,y is the CENTER of the symbol
        const w = 50, h = 60;
        const leftX = x - w / 2;
        const rightX = x + w / 2;
        const topY = y - h / 2;
        const botY = y + h / 2;

        const triPath = mirror
            ? `M ${rightX} ${topY} L ${rightX} ${botY} L ${leftX} ${y} Z`
            : `M ${leftX} ${topY} L ${leftX} ${botY} L ${rightX} ${y} Z`;

        this._push(`<path d="${triPath}" stroke="${color}" stroke-width="1.5" fill="none"/>`);

        // Pins (short stubs so wires visually "snap" to the body edge)
        const pinLen = 15;
        const inputX = mirror ? rightX : leftX;
        const inputDir = mirror ? 1 : -1;
        const minusY = y - 10;
        const plusY = y + 10;

        this.line(inputX + inputDir * pinLen, minusY, inputX, minusY, color, 1.5);
        this.line(inputX + inputDir * pinLen, plusY, inputX, plusY, color, 1.5);

        // +/- symbols near inputs
        this.text(inputX + inputDir * (pinLen - 5), plusY, '+', { fontSize: 14, fill: color, anchor: 'middle' });
        this.text(inputX + inputDir * (pinLen - 5), minusY, '-', { fontSize: 14, fill: color, anchor: 'middle' });

        // Output stub
        const outX = mirror ? leftX : rightX;
        this.line(outX, y, outX - inputDir * pinLen, y, color, 1.5);

        if (label) {
            this.text(x, y, label, { fontSize: 10, fill: color, anchor: 'middle' });
        }

        return this;
    }

    // Alias for older lessons that call opamp(...)
    opamp(x, y, options = {}) {
        return this.opAmp(x, y, options);
    }

    _labelPlacement(pos, horizontal) {
        const p = (typeof pos === 'string') ? pos.toLowerCase() : '';
        if (horizontal) {
            if (p === 'bottom') return { dx: 0, dy: 12, anchor: 'middle' };
            if (p === 'left') return { dx: -10, dy: -12, anchor: 'end' };
            if (p === 'right') return { dx: 10, dy: -12, anchor: 'start' };
            // default/top
            return { dx: 0, dy: -12, anchor: 'middle' };
        }
        if (p === 'right') return { dx: 12, dy: 0, anchor: 'start' };
        if (p === 'top') return { dx: 0, dy: -12, anchor: 'middle' };
        if (p === 'bottom') return { dx: 0, dy: 12, anchor: 'middle' };
        // default/left
        return { dx: -12, dy: 0, anchor: 'end' };
    }

    _drawResistorBetween(x1, y1, x2, y2, options = {}) {
        const color = options.stroke || options.color || this.colors.component;
        const strokeWidth = options.strokeWidth || options.width || 1.5;
        const horizontal = (y1 === y2) || (Math.abs(x2 - x1) >= Math.abs(y2 - y1));

        if (horizontal) {
            const y = y1;
            const dir = (x2 >= x1) ? 1 : -1;
            const len = Math.abs(x2 - x1);
            const lead = Math.min(8, Math.max(4, Math.round(len * 0.2)));
            const zigs = 6;
            const amp = 7;
            const zigLen = Math.max(1, (len - 2 * lead) / zigs);
            let d = `M ${x1} ${y} L ${x1 + dir * lead} ${y}`;
            for (let i = 0; i < zigs; i++) {
                const x = x1 + dir * (lead + zigLen * (i + 1));
                const dy = (i % 2 === 0) ? -amp : amp;
                d += ` L ${x} ${y + dy}`;
            }
            d += ` L ${x2 - dir * lead} ${y} L ${x2} ${y}`;
            this._push(`<path d="${d}" stroke="${color}" stroke-width="${strokeWidth}" fill="none" stroke-linejoin="round" stroke-linecap="round"/>`);

            if (options.label) {
                const { dx, dy, anchor } = this._labelPlacement(options.labelPos || 'top', true);
                this.text((x1 + x2) / 2 + dx, y + dy, options.label, { fontSize: 10, fill: options.labelColor || this.colors.text, anchor });
            }
        } else {
            const x = x1;
            const dir = (y2 >= y1) ? 1 : -1;
            const len = Math.abs(y2 - y1);
            const lead = Math.min(8, Math.max(4, Math.round(len * 0.2)));
            const zigs = 6;
            const amp = 7;
            const zigLen = Math.max(1, (len - 2 * lead) / zigs);
            let d = `M ${x} ${y1} L ${x} ${y1 + dir * lead}`;
            for (let i = 0; i < zigs; i++) {
                const y = y1 + dir * (lead + zigLen * (i + 1));
                const dx = (i % 2 === 0) ? -amp : amp;
                d += ` L ${x + dx} ${y}`;
            }
            d += ` L ${x} ${y2 - dir * lead} L ${x} ${y2}`;
            this._push(`<path d="${d}" stroke="${color}" stroke-width="${strokeWidth}" fill="none" stroke-linejoin="round" stroke-linecap="round"/>`);

            if (options.label) {
                const { dx, dy, anchor } = this._labelPlacement(options.labelPos || 'left', false);
                this.text(x + dx, (y1 + y2) / 2 + dy, options.label, { fontSize: 10, fill: options.labelColor || this.colors.text, anchor });
            }
        }

        return this;
    }

    // Draw a resistor (compat: center/options, endpoints, or legacy h/v form)
    resistor(a, b, c, d, e, f) {
        // Endpoints form: resistor(x1, y1, x2, y2, label?, labelPos?)
        if (Number.isFinite(c) && Number.isFinite(d)) {
            const x1 = a, y1 = b, x2 = c, y2 = d;
            const label = (typeof e === 'string') ? e : '';
            const labelPos = (typeof f === 'string') ? f : null;
            return this._drawResistorBetween(x1, y1, x2, y2, { label, labelPos });
        }

        // Legacy form: resistor(x, y, 'h'|'v', label, value)
        if (typeof c === 'string') {
            const orient = c.toLowerCase();
            const label = (typeof d === 'string') ? d : '';
            const value = (typeof e === 'string') ? e : '';

            if (orient === 'h' || orient === 'horizontal') {
                // Historical lessons treat (x,y) as start of body, with a longer left lead
                this.line(a - 30, b, a, b);
                this._drawResistorBetween(a, b, a + 50, b, {});
                if (label || value) {
                    const cx = a + 25;
                    if (label) this.text(cx, b - 12, label, { fontSize: 9, anchor: 'middle' });
                    if (value) this.text(cx, b + 12, value, { fontSize: 9, fill: this.colors.value, anchor: 'middle' });
                }
                return this;
            }
            if (orient === 'v' || orient === 'vertical') {
                this.line(a, b - 30, a, b);
                this._drawResistorBetween(a, b, a, b + 50, {});
                if (label || value) {
                    const cy = b + 25;
                    if (label) this.text(a + 14, cy - 8, label, { fontSize: 9, anchor: 'start' });
                    if (value) this.text(a + 14, cy + 8, value, { fontSize: 9, fill: this.colors.value, anchor: 'start' });
                }
                return this;
            }
        }

        // Center/options form: resistor(x, y, {horizontal?:boolean, label?:string})
        const x = a, y = b;
        const options = (typeof c === 'object' && c !== null) ? c : {};
        const horizontal = options.horizontal !== false;
        const half = Number.isFinite(options.halfLength) ? options.halfLength : 20;
        const x1 = horizontal ? x - half : x;
        const y1 = horizontal ? y : y - half;
        const x2 = horizontal ? x + half : x;
        const y2 = horizontal ? y : y + half;
        return this._drawResistorBetween(x1, y1, x2, y2, options);
    }

    _drawCapacitorBetween(x1, y1, x2, y2, options = {}) {
        const color = options.stroke || options.color || this.colors.component;
        const strokeWidth = options.strokeWidth || options.width || 1.5;
        const horizontal = (y1 === y2) || (Math.abs(x2 - x1) >= Math.abs(y2 - y1));

        if (horizontal) {
            const y = y1;
            const left = Math.min(x1, x2);
            const right = Math.max(x1, x2);
            const cx = (left + right) / 2;
            const plateSep = 6;
            const plateH = 18;
            const xL = cx - plateSep / 2;
            const xR = cx + plateSep / 2;

            this.line(left, y, xL, y, { stroke: color, strokeWidth });
            this.line(xL, y - plateH / 2, xL, y + plateH / 2, { stroke: color, strokeWidth: 2 });
            this.line(xR, y - plateH / 2, xR, y + plateH / 2, { stroke: color, strokeWidth: 2 });
            this.line(xR, y, right, y, { stroke: color, strokeWidth });

            if (options.label) {
                const { dx, dy, anchor } = this._labelPlacement(options.labelPos || 'top', true);
                this.text(cx + dx, y + dy, options.label, { fontSize: 10, fill: options.labelColor || this.colors.text, anchor });
            }
        } else {
            const x = x1;
            const top = Math.min(y1, y2);
            const bot = Math.max(y1, y2);
            const cy = (top + bot) / 2;
            const plateSep = 6;
            const plateW = 18;
            const yT = cy - plateSep / 2;
            const yB = cy + plateSep / 2;

            this.line(x, top, x, yT, { stroke: color, strokeWidth });
            this.line(x - plateW / 2, yT, x + plateW / 2, yT, { stroke: color, strokeWidth: 2 });
            this.line(x - plateW / 2, yB, x + plateW / 2, yB, { stroke: color, strokeWidth: 2 });
            this.line(x, yB, x, bot, { stroke: color, strokeWidth });

            if (options.label) {
                const { dx, dy, anchor } = this._labelPlacement(options.labelPos || 'right', false);
                this.text(x + dx, cy + dy, options.label, { fontSize: 10, fill: options.labelColor || this.colors.text, anchor });
            }
        }

        return this;
    }

    // Draw a capacitor (compat: center/options, endpoints, or legacy h/v form)
    capacitor(a, b, c, d, e) {
        // Endpoints form: capacitor(x1, y1, x2, y2, label?)
        if (Number.isFinite(c) && Number.isFinite(d)) {
            const x1 = a, y1 = b, x2 = c, y2 = d;
            const label = (typeof e === 'string') ? e : '';
            return this._drawCapacitorBetween(x1, y1, x2, y2, { label });
        }

        // Legacy form: capacitor(x, y, 'h'|'v', label, value)
        if (typeof c === 'string') {
            const orient = c.toLowerCase();
            const label = (typeof d === 'string') ? d : '';
            const value = (typeof e === 'string') ? e : '';
            const half = 30; // legacy lessons tend to use a taller symbol

            if (orient === 'h' || orient === 'horizontal') {
                this._drawCapacitorBetween(a - half, b, a + half, b, {});
                if (label) this.text(a, b - 12, label, { fontSize: 9, anchor: 'middle' });
                if (value) this.text(a, b + 12, value, { fontSize: 9, fill: this.colors.value, anchor: 'middle' });
                return this;
            }
            if (orient === 'v' || orient === 'vertical') {
                this._drawCapacitorBetween(a, b - half, a, b + half, {});
                if (label) this.text(a + 14, b - 6, label, { fontSize: 9, anchor: 'start' });
                if (value) this.text(a + 14, b + 10, value, { fontSize: 9, fill: this.colors.value, anchor: 'start' });
                return this;
            }
        }

        // Center/options form: capacitor(x, y, {horizontal?:boolean, label?:string})
        const x = a, y = b;
        const options = (typeof c === 'object' && c !== null) ? c : {};
        const horizontal = options.horizontal !== false;
        const half = Number.isFinite(options.halfLength) ? options.halfLength : 20;
        const x1 = horizontal ? x - half : x;
        const y1 = horizontal ? y : y - half;
        const x2 = horizontal ? x + half : x;
        const y2 = horizontal ? y : y + half;
        return this._drawCapacitorBetween(x1, y1, x2, y2, options);
    }

    _drawDiodeBetween(x1, y1, x2, y2, options = {}) {
        const color = options.stroke || options.color || this.colors.component;
        const strokeWidth = options.strokeWidth || options.width || 1.5;
        const horizontal = (y1 === y2) || (Math.abs(x2 - x1) >= Math.abs(y2 - y1));
        const flip = !!options.flip;

        if (horizontal) {
            const y = y1;
            const left = Math.min(x1, x2);
            const right = Math.max(x1, x2);
            const dir = flip ? -1 : 1;
            const cx = (left + right) / 2;
            const triW = 10;
            const triH = 8;
            const barX = cx + dir * (triW + 3);
            const tipX = cx + dir * triW;
            const baseX = cx - dir * triW;

            this.line(left, y, baseX, y, { stroke: color, strokeWidth });
            const triPath = flip
                ? `M ${cx + triW} ${y - triH} L ${cx - triW} ${y} L ${cx + triW} ${y + triH} Z`
                : `M ${cx - triW} ${y - triH} L ${cx + triW} ${y} L ${cx - triW} ${y + triH} Z`;
            this._push(`<path d="${triPath}" stroke="${color}" stroke-width="${strokeWidth}" fill="none"/>`);
            this.line(barX, y - triH, barX, y + triH, { stroke: color, strokeWidth: 2 });
            this.line(barX, y, right, y, { stroke: color, strokeWidth });
        } else {
            const x = x1;
            const top = Math.min(y1, y2);
            const bot = Math.max(y1, y2);
            const dir = flip ? -1 : 1;
            const cy = (top + bot) / 2;
            const triH = 10;
            const triW = 8;
            const barY = cy + dir * (triH + 3);

            this.line(x, top, x, cy - dir * triH, { stroke: color, strokeWidth });
            const triPath = flip
                ? `M ${x - triW} ${cy + triH} L ${x} ${cy - triH} L ${x + triW} ${cy + triH} Z`
                : `M ${x - triW} ${cy - triH} L ${x} ${cy + triH} L ${x + triW} ${cy - triH} Z`;
            this._push(`<path d="${triPath}" stroke="${color}" stroke-width="${strokeWidth}" fill="none"/>`);
            this.line(x - triW, barY, x + triW, barY, { stroke: color, strokeWidth: 2 });
            this.line(x, barY, x, bot, { stroke: color, strokeWidth });
        }

        return this;
    }

    // Draw a diode (center/options form). (Endpoints supported loosely.)
    diode(a, b, c, d) {
        // Endpoints form: diode(x1, y1, x2, y2, {flip?:boolean}?)
        if (Number.isFinite(c) && Number.isFinite(d)) {
            return this._drawDiodeBetween(a, b, c, d, {});
        }

        const x = a, y = b;
        const options = (typeof c === 'object' && c !== null) ? c : {};
        const horizontal = options.horizontal !== false;
        const half = Number.isFinite(options.halfLength) ? options.halfLength : 25;
        const x1 = horizontal ? x - half : x;
        const y1 = horizontal ? y : y - half;
        const x2 = horizontal ? x + half : x;
        const y2 = horizontal ? y : y + half;
        return this._drawDiodeBetween(x1, y1, x2, y2, options);
    }

    _drawInductorBetween(x1, y1, x2, y2, options = {}) {
        const color = options.stroke || options.color || this.colors.component;
        const strokeWidth = options.strokeWidth || options.width || 1.5;
        const horizontal = (y1 === y2) || (Math.abs(x2 - x1) >= Math.abs(y2 - y1));

        if (horizontal) {
            const y = y1;
            const left = Math.min(x1, x2);
            const right = Math.max(x1, x2);
            const len = right - left;
            const lead = Math.min(8, Math.max(4, Math.round(len * 0.2)));
            const coils = 4;
            const coilSpan = Math.max(4, (len - 2 * lead) / coils);
            const r = coilSpan / 2;

            let d = `M ${left} ${y} L ${left + lead} ${y}`;
            for (let i = 0; i < coils; i++) {
                d += ` a ${r} ${r} 0 0 1 ${2 * r} 0`;
            }
            d += ` L ${right} ${y}`;
            this._push(`<path d="${d}" stroke="${color}" stroke-width="${strokeWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`);

            if (options.label) {
                const { dx, dy, anchor } = this._labelPlacement(options.labelPos || 'top', true);
                this.text((left + right) / 2 + dx, y + dy, options.label, { fontSize: 10, fill: options.labelColor || this.colors.text, anchor });
            }
        } else {
            const x = x1;
            const top = Math.min(y1, y2);
            const bot = Math.max(y1, y2);
            const len = bot - top;
            const lead = Math.min(8, Math.max(4, Math.round(len * 0.2)));
            const coils = 4;
            const coilSpan = Math.max(4, (len - 2 * lead) / coils);
            const r = coilSpan / 2;

            let d = `M ${x} ${top} L ${x} ${top + lead}`;
            for (let i = 0; i < coils; i++) {
                d += ` a ${r} ${r} 0 0 1 0 ${2 * r}`;
            }
            d += ` L ${x} ${bot}`;
            this._push(`<path d="${d}" stroke="${color}" stroke-width="${strokeWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`);

            if (options.label) {
                const { dx, dy, anchor } = this._labelPlacement(options.labelPos || 'right', false);
                this.text(x + dx, (top + bot) / 2 + dy, options.label, { fontSize: 10, fill: options.labelColor || this.colors.text, anchor });
            }
        }

        return this;
    }

    // Draw an inductor (compat: center/options or endpoints)
    inductor(a, b, c, d, e) {
        // Endpoints form: inductor(x1, y1, x2, y2, label?)
        if (Number.isFinite(c) && Number.isFinite(d)) {
            const label = (typeof e === 'string') ? e : '';
            return this._drawInductorBetween(a, b, c, d, { label });
        }

        const x = a, y = b;
        const options = (typeof c === 'object' && c !== null) ? c : {};
        const horizontal = options.horizontal !== false;
        const half = Number.isFinite(options.halfLength) ? options.halfLength : 20;
        const x1 = horizontal ? x - half : x;
        const y1 = horizontal ? y : y - half;
        const x2 = horizontal ? x + half : x;
        const y2 = horizontal ? y : y + half;
        return this._drawInductorBetween(x1, y1, x2, y2, options);
    }

    // Draw ground symbol
    ground(x, y) {
        const color = this.colors.ground;
        // Small stem to make connection intent clearer across legacy lessons
        this.line(x, y - 20, x, y, { stroke: color, strokeWidth: 1.5 });
        this.line(x - 10, y, x + 10, y, { stroke: color, strokeWidth: 1.5 });
        this.line(x - 6, y + 4, x + 6, y + 4, { stroke: color, strokeWidth: 1.5 });
        this.line(x - 2, y + 8, x + 2, y + 8, { stroke: color, strokeWidth: 1.5 });
        return this;
    }

    // Draw a current source symbol (minimal)
    currentSource(x, y, orient = 'vertical', options = {}) {
        const color = options.stroke || options.color || this.colors.component;
        const label = options.label || '';

        if (orient === 'horizontal') {
            this.line(x, y, x + 10, y, { stroke: color, strokeWidth: 1.5 });
            this.circle(x + 25, y, 15, { fill: 'none', stroke: color, strokeWidth: 1.5 });
            this.line(x + 40, y, x + 50, y, { stroke: color, strokeWidth: 1.5 });
            // Arrow inside (rightward)
            this.line(x + 18, y, x + 32, y, { stroke: color, strokeWidth: 1.5 });
            this.path(`M ${x + 32} ${y} L ${x + 28} ${y - 4} L ${x + 28} ${y + 4} Z`, color, color, 1);
            if (label) this.text(x + 25, y - 18, label, { fontSize: 10, fill: color, anchor: 'middle' });
        } else {
            this.line(x, y, x, y + 10, { stroke: color, strokeWidth: 1.5 });
            this.circle(x, y + 25, 15, { fill: 'none', stroke: color, strokeWidth: 1.5 });
            this.line(x, y + 40, x, y + 50, { stroke: color, strokeWidth: 1.5 });
            // Arrow inside (downward)
            this.line(x, y + 18, x, y + 32, { stroke: color, strokeWidth: 1.5 });
            this.path(`M ${x} ${y + 32} L ${x - 4} ${y + 28} L ${x + 4} ${y + 28} Z`, color, color, 1);
            if (label) this.text(x + 18, y + 25, label, { fontSize: 10, fill: color, anchor: 'start' });
        }

        return this;
    }

    // Draw NMOS transistor
    nmos(x, y, facing = 'right', label = '') {
        const color = this.colors.component;
        const flip = facing === 'left' ? -1 : 1;

        // Gate line (vertical)
        this._push(`<line x1="${x - 20 * flip}" y1="${y}" x2="${x - 10 * flip}" y2="${y}" stroke="${color}" stroke-width="1.5"/>`);
        // Gate bar (vertical)
        this._push(`<line x1="${x - 10 * flip}" y1="${y - 15}" x2="${x - 10 * flip}" y2="${y + 15}" stroke="${color}" stroke-width="1.5"/>`);

        // Channel
        this._push(`<line x1="${x - 5 * flip}" y1="${y - 15}" x2="${x - 5 * flip}" y2="${y + 15}" stroke="${color}" stroke-width="1.5"/>`);

        // Drain (top)
        this._push(`<line x1="${x - 5 * flip}" y1="${y - 10}" x2="${x + 15 * flip}" y2="${y - 10}" stroke="${color}" stroke-width="1.5"/>`);
        this._push(`<line x1="${x + 15 * flip}" y1="${y - 10}" x2="${x + 15 * flip}" y2="${y - 25}" stroke="${color}" stroke-width="1.5"/>`);

        // Source (bottom)
        this._push(`<line x1="${x - 5 * flip}" y1="${y + 10}" x2="${x + 15 * flip}" y2="${y + 10}" stroke="${color}" stroke-width="1.5"/>`);
        this._push(`<line x1="${x + 15 * flip}" y1="${y + 10}" x2="${x + 15 * flip}" y2="${y + 25}" stroke="${color}" stroke-width="1.5"/>`);

        // Body line
        this._push(`<line x1="${x - 5 * flip}" y1="${y}" x2="${x + 5 * flip}" y2="${y}" stroke="${color}" stroke-width="1.5"/>`);
        // Arrow to source (N-channel)
        const arrowX = x + 5 * flip;
        this._push(`<path d="M ${arrowX - 3} ${y + 7} L ${arrowX} ${y + 10} L ${arrowX - 3} ${y + 13}" stroke="${color}" stroke-width="1.5" fill="none"/>`);

        if (label) {
            this.text(x + 25 * flip, y, label, { fontSize: 9 });
        }

        return this;
    }

    // Draw PMOS transistor
    pmos(x, y, facing = 'right', label = '') {
        const color = this.colors.component;
        const flip = facing === 'left' ? -1 : 1;

        // Similar to NMOS but with circle on gate and arrow pointing away
        this._push(`<line x1="${x - 20 * flip}" y1="${y}" x2="${x - 15 * flip}" y2="${y}" stroke="${color}" stroke-width="1.5"/>`);
        this._push(`<circle cx="${x - 12 * flip}" cy="${y}" r="3" stroke="${color}" fill="none" stroke-width="1.5"/>`);
        this._push(`<line x1="${x - 9 * flip}" y1="${y - 15}" x2="${x - 9 * flip}" y2="${y + 15}" stroke="${color}" stroke-width="1.5"/>`);

        // Channel
        this._push(`<line x1="${x - 5 * flip}" y1="${y - 15}" x2="${x - 5 * flip}" y2="${y + 15}" stroke="${color}" stroke-width="1.5"/>`);

        // Source (top for PMOS)
        this._push(`<line x1="${x - 5 * flip}" y1="${y - 10}" x2="${x + 15 * flip}" y2="${y - 10}" stroke="${color}" stroke-width="1.5"/>`);
        this._push(`<line x1="${x + 15 * flip}" y1="${y - 10}" x2="${x + 15 * flip}" y2="${y - 25}" stroke="${color}" stroke-width="1.5"/>`);

        // Drain (bottom for PMOS)
        this._push(`<line x1="${x - 5 * flip}" y1="${y + 10}" x2="${x + 15 * flip}" y2="${y + 10}" stroke="${color}" stroke-width="1.5"/>`);
        this._push(`<line x1="${x + 15 * flip}" y1="${y + 10}" x2="${x + 15 * flip}" y2="${y + 25}" stroke="${color}" stroke-width="1.5"/>`);

        // Arrow pointing from source
        const arrowX = x + 5 * flip;
        this._push(`<path d="M ${arrowX + 3} ${y - 7} L ${arrowX} ${y - 10} L ${arrowX + 3} ${y - 13}" stroke="${color}" stroke-width="1.5" fill="none"/>`);

        if (label) {
            this.text(x + 25 * flip, y, label, { fontSize: 9 });
        }

        return this;
    }

    // Draw NPN transistor
    npn(x, y, facing = 'right', label = '') {
        const color = this.colors.component;
        const flip = facing === 'left' ? -1 : 1;

        // Base bar
        this._push(`<line x1="${x}" y1="${y - 15}" x2="${x}" y2="${y + 15}" stroke="${color}" stroke-width="1.5"/>`);
        // Base lead
        this._push(`<line x1="${x - 15 * flip}" y1="${y}" x2="${x}" y2="${y}" stroke="${color}" stroke-width="1.5"/>`);

        // Collector
        this._push(`<line x1="${x}" y1="${y - 8}" x2="${x + 20 * flip}" y2="${y - 20}" stroke="${color}" stroke-width="1.5"/>`);
        this._push(`<line x1="${x + 20 * flip}" y1="${y - 20}" x2="${x + 20 * flip}" y2="${y - 30}" stroke="${color}" stroke-width="1.5"/>`);

        // Emitter with arrow
        this._push(`<line x1="${x}" y1="${y + 8}" x2="${x + 20 * flip}" y2="${y + 20}" stroke="${color}" stroke-width="1.5"/>`);
        this._push(`<line x1="${x + 20 * flip}" y1="${y + 20}" x2="${x + 20 * flip}" y2="${y + 30}" stroke="${color}" stroke-width="1.5"/>`);

        // Arrow on emitter
        const arrowMidX = x + 12 * flip;
        const arrowMidY = y + 12;
        this._push(`<path d="M ${arrowMidX - 2} ${arrowMidY - 4} L ${arrowMidX + 4 * flip} ${arrowMidY} L ${arrowMidX - 2} ${arrowMidY + 4}" stroke="${color}" stroke-width="1.5" fill="none"/>`);

        if (label) {
            this.text(x + 30 * flip, y, label, { fontSize: 9 });
        }

        return this;
    }

    // Draw PNP transistor
    pnp(x, y, facing = 'right', label = '') {
        const color = this.colors.component;
        const flip = facing === 'left' ? -1 : 1;

        // Base bar
        this._push(`<line x1="${x}" y1="${y - 15}" x2="${x}" y2="${y + 15}" stroke="${color}" stroke-width="1.5"/>`);
        // Base lead
        this._push(`<line x1="${x - 15 * flip}" y1="${y}" x2="${x}" y2="${y}" stroke="${color}" stroke-width="1.5"/>`);

        // Emitter (top for PNP)
        this._push(`<line x1="${x}" y1="${y - 8}" x2="${x + 20 * flip}" y2="${y - 20}" stroke="${color}" stroke-width="1.5"/>`);
        this._push(`<line x1="${x + 20 * flip}" y1="${y - 20}" x2="${x + 20 * flip}" y2="${y - 30}" stroke="${color}" stroke-width="1.5"/>`);

        // Collector (bottom for PNP)
        this._push(`<line x1="${x}" y1="${y + 8}" x2="${x + 20 * flip}" y2="${y + 20}" stroke="${color}" stroke-width="1.5"/>`);
        this._push(`<line x1="${x + 20 * flip}" y1="${y + 20}" x2="${x + 20 * flip}" y2="${y + 30}" stroke="${color}" stroke-width="1.5"/>`);

        // Arrow on emitter pointing toward base
        const arrowMidX = x + 8 * flip;
        const arrowMidY = y - 8;
        this._push(`<path d="M ${arrowMidX + 2} ${arrowMidY - 4} L ${arrowMidX - 4 * flip} ${arrowMidY} L ${arrowMidX + 2} ${arrowMidY + 4}" stroke="${color}" stroke-width="1.5" fill="none"/>`);

        if (label) {
            this.text(x + 30 * flip, y, label, { fontSize: 9 });
        }

        return this;
    }

    // Draw VCC symbol
    vcc(x, y, options = {}) {
        const color = this.colors.component;
        const label = options.label || 'VCC';
        // Upward arrow or line
        this.line(x, y, x, y - 10, { stroke: color, strokeWidth: 1.5 });
        this.text(x, y - 15, label, { fontSize: 10, anchor: 'middle' });
        return this;
    }

    // Draw VEE symbol (negative rail)
    vee(x, y, options = {}) {
        const color = this.colors.component;
        const label = options.label || 'VEE';
        // Downward line
        this.line(x, y, x, y + 10, { stroke: color, strokeWidth: 1.5 });
        this.text(x, y + 15, label, { fontSize: 10, anchor: 'middle' });
        return this;
    }

    // Legacy helpers used by some lessons (module-20/22/24)
    addWire(points, stroke = null, strokeWidth = null, strokeDasharray = null) {
        const options = {};
        if (this._looksLikeColor(stroke)) options.stroke = stroke;
        if (Number.isFinite(strokeWidth)) options.strokeWidth = strokeWidth;
        if (typeof strokeDasharray === 'string') options.strokeDasharray = strokeDasharray;
        return this.wire(points, options);
    }

    addRect(x, y, width, height, fill, stroke, strokeWidth) {
        return this.rect(x, y, width, height, fill, stroke, strokeWidth);
    }

    addText(x, y, content, fontSpec, arg5, arg6) {
        let anchor = null;
        let fill = null;

        if (this._looksLikeColor(arg5)) fill = arg5;
        else if (typeof arg5 === 'string') anchor = arg5;

        if (this._looksLikeColor(arg6)) fill = arg6;
        else if (typeof arg6 === 'string') anchor = arg6;

        const opts = {};
        if (typeof fontSpec === 'string') {
            const { fontSize, bold } = this._parseFontSpec(fontSpec);
            if (fontSize !== null) opts.fontSize = fontSize;
            if (bold) opts.bold = true;
        } else if (Number.isFinite(fontSpec)) {
            opts.fontSize = fontSpec;
        }
        if (this._looksLikeColor(fill)) opts.fill = fill;
        if (typeof anchor === 'string') opts.anchor = anchor;

        return this.text(x, y, content, opts);
    }

    addGround(x, y) {
        return this.ground(x, y);
    }

    addResistor(x, y, orientation = 'horizontal', label = '', value = '') {
        const orient = String(orientation).toLowerCase();
        const horizontal = orient.startsWith('h');
        const half = 30;
        const x1 = horizontal ? x - half : x;
        const y1 = horizontal ? y : y - half;
        const x2 = horizontal ? x + half : x;
        const y2 = horizontal ? y : y + half;
        this._drawResistorBetween(x1, y1, x2, y2, {});

        if (label || value) {
            const cx = (x1 + x2) / 2;
            const cy = (y1 + y2) / 2;
            if (horizontal) {
                if (label) this.text(cx, cy - 12, label, { fontSize: 9, anchor: 'middle' });
                if (value) this.text(cx, cy + 12, value, { fontSize: 9, fill: this.colors.value, anchor: 'middle' });
            } else {
                if (label) this.text(cx + 14, cy - 8, label, { fontSize: 9, anchor: 'start' });
                if (value) this.text(cx + 14, cy + 8, value, { fontSize: 9, fill: this.colors.value, anchor: 'start' });
            }
        }
        return this;
    }

    addCapacitor(x, y, orientation = 'vertical', label = '', value = '') {
        const orient = String(orientation).toLowerCase();
        const horizontal = orient.startsWith('h');
        const half = 25;
        const x1 = horizontal ? x - half : x;
        const y1 = horizontal ? y : y - half;
        const x2 = horizontal ? x + half : x;
        const y2 = horizontal ? y : y + half;
        this._drawCapacitorBetween(x1, y1, x2, y2, {});

        if (label || value) {
            const cx = (x1 + x2) / 2;
            const cy = (y1 + y2) / 2;
            if (horizontal) {
                if (label) this.text(cx, cy - 12, label, { fontSize: 9, anchor: 'middle' });
                if (value) this.text(cx, cy + 12, value, { fontSize: 9, fill: this.colors.value, anchor: 'middle' });
            } else {
                if (label) this.text(cx + 14, cy - 6, label, { fontSize: 9, anchor: 'start' });
                if (value) this.text(cx + 14, cy + 10, value, { fontSize: 9, fill: this.colors.value, anchor: 'start' });
            }
        }
        return this;
    }

    addInductor(x, y, orientation = 'horizontal', label = '', value = '') {
        const orient = String(orientation).toLowerCase();
        const horizontal = orient.startsWith('h');
        const half = 30;
        const x1 = horizontal ? x - half : x;
        const y1 = horizontal ? y : y - half;
        const x2 = horizontal ? x + half : x;
        const y2 = horizontal ? y : y + half;
        this._drawInductorBetween(x1, y1, x2, y2, {});

        if (label || value) {
            const cx = (x1 + x2) / 2;
            const cy = (y1 + y2) / 2;
            if (horizontal) {
                if (label) this.text(cx, cy - 12, label, { fontSize: 9, anchor: 'middle' });
                if (value) this.text(cx, cy + 12, value, { fontSize: 9, fill: this.colors.value, anchor: 'middle' });
            } else {
                if (label) this.text(cx + 14, cy - 8, label, { fontSize: 9, anchor: 'start' });
                if (value) this.text(cx + 14, cy + 8, value, { fontSize: 9, fill: this.colors.value, anchor: 'start' });
            }
        }
        return this;
    }

    addFuse(x, y, label = '', value = '') {
        const color = this.colors.component;
        const half = 30;
        this.line(x - half, y, x + half, y, { stroke: color, strokeWidth: 2 });
        this.rect(x - 10, y - 6, 20, 12, { fill: '#181818', stroke: color, strokeWidth: 1.5 });

        if (label) this.text(x, y - 14, label, { fontSize: 9, anchor: 'middle' });
        if (value) this.text(x, y + 14, value, { fontSize: 9, fill: this.colors.value, anchor: 'middle' });
        return this;
    }

    toSVGElement() {
        if (typeof document === 'undefined') return null;

        if (!this._svgEl) {
            this._svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            this._svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
            this._svgEl.setAttribute('class', 'schematic-svg');
            this._svgEl.style.background = 'transparent';
            this._svgDirty = true;
        }

        if (this._svgDirty) {
            this._svgEl.setAttribute('width', String(this.width));
            this._svgEl.setAttribute('height', String(this.height));
            this._svgEl.setAttribute('viewBox', `0 0 ${this.width} ${this.height}`);
            this._svgEl.innerHTML = this.elements.join('\n');
            this._svgDirty = false;
        }

        return this._svgEl;
    }

    get svg() {
        return this.toSVGElement();
    }

    // Render to SVG string
    render() {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${this.width}" height="${this.height}" viewBox="0 0 ${this.width} ${this.height}" class="schematic-svg" style="background: transparent;">
${this.elements.join('\n')}
</svg>`;
    }
}

// Expose the builder globally for lesson files
window.SchematicSVG = SchematicSVGBuilder;
// Also expose circuit factories on the same global so both styles work:
//  - new SchematicSVG(width, height)           (builder API used by older lessons)
//  - SchematicSVG.colpittsOscillator(div, {})  (factory API used by newer lessons)
if (typeof AD !== 'undefined' && AD.Schematic) {
    Object.assign(window.SchematicSVG, AD.Schematic);
}
// Some lesson files refer to these helpers directly
window.NodeRegistry = window.NodeRegistry || SchematicSVGBuilder.NodeRegistry;
window.SegmentRegistry = window.SegmentRegistry || class {
    // Minimal stub (some lessons instantiate but do not use)
    constructor() { this.segments = []; }
};
window.BoundsAccumulator = window.BoundsAccumulator || class {
    // Minimal stub (some lessons instantiate but do not use)
    constructor() { this.bounds = null; }
};
