#!/usr/bin/env node
/**
 * solve-op - the DC operating point of a build table that contains semiconductors.
 *
 * Why this exists
 * ---------------
 * solve-dc and solve-ac between them handle 45 and 17 of the 193 build tables.
 * Of the rest, 102 contain a transistor or a diode, which is to say most of the
 * course: every bias point, every current mirror, every differential pair. Those
 * were still being worked out by hand, and a bias point done by hand is where
 * three of my own numbers went wrong.
 *
 * Newton-Raphson over the same modified nodal analysis, with each nonlinear
 * device linearised about the current guess and stamped as a companion model.
 *
 * How much to trust the answer
 * ----------------------------
 * Less than the linear tools, and the reason is worth being explicit about.
 * A resistive divider's answer is the answer. A bipolar stage's collector
 * current depends on I_S and B_F, so it depends on the MODEL, and Circuit Toy's
 * 2N3904 is not necessarily this one. The model used is printed with every
 * result for that reason.
 *
 * So the quantities worth putting in a SimCheck are the ones that survive a
 * change of model:
 *
 *   - V_BE of a conducting silicon transistor: 0.6 to 0.7 V, always
 *   - a collector current set by an emitter resistor and a base divider, where
 *     beta cancels out almost entirely
 *   - a diode clamp sitting one drop from a rail
 *   - a current mirror's ratio, which is a ratio of two identical devices
 *
 * And the ones that are not: any absolute current that depends on I_S, any
 * gain that depends on beta, anything in weak inversion.
 *
 *   node tools/solve-op.js lessons/module-05/lesson-01.html
 *   node tools/solve-op.js --list          every table, with the reason for skips
 *   node tools/solve-op.js                 summary across every lesson
 */

'use strict';

const fs = require('fs');
const path = require('path');
const N = require('./netlist');

const ROOT = path.dirname(__dirname);
const LESSONS = path.join(ROOT, 'lessons');
const args = process.argv.slice(2);
const LIST = args.includes('--list');
const TARGET = args.find(a => !a.startsWith('--'));

const VT = 0.025852;             // kT/q at 300.15 K
const GMIN = 1e-12;
const MAXIT = parseInt(process.env.OP_MAXIT, 10) || 400;
const MAXSTEP = 2;             // volts a node may move per Newton iteration

/** Gauss-Jordan with partial pivoting. Null when singular. */
function solve(A, b) {
    const n = b.length;
    const M = A.map((row, i) => row.concat([b[i]]));
    for (let col = 0; col < n; col++) {
        let piv = col;
        for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
        if (Math.abs(M[piv][col]) < 1e-14) return null;
        [M[col], M[piv]] = [M[piv], M[col]];
        for (let r = 0; r < n; r++) {
            if (r === col) continue;
            const f = M[r][col] / M[col][col];
            if (f === 0) continue;
            for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
        }
    }
    return M.map((row, i) => row[n] / row[i]);
}

/**
 * The junction-voltage limiter every SPICE has.
 *
 * exp(V/VT) with V a volt or two is 10^17, so an unlimited Newton step past a
 * forward-biased junction produces a number the matrix cannot recover from.
 * This clamps the step in the exponential region without changing the solution
 * the iteration converges to.
 */
function pnjlim(vnew, vold, vt, vcrit) {
    if (vnew > vcrit && Math.abs(vnew - vold) > 2 * vt) {
        if (vold > 0) {
            const arg = 1 + (vnew - vold) / vt;
            vnew = arg > 0 ? vold + vt * Math.log(arg) : vcrit;
        } else {
            vnew = vnew > 0 ? vt * Math.log(vnew / vt) : vcrit;
        }
    }
    return vnew;
}

const vcritOf = Is => VT * Math.log(VT / (Math.SQRT2 * Is));

/**
 * One Newton-Raphson solve at a given gmin. Returns {v, iters} or null.
 *
 * `gmin` is a small conductance placed across every junction. At its normal
 * 1e-12 it does nothing but keep the matrix non-singular when a device is fully
 * off; raised, it linearises the circuit enough for Newton to find its way, and
 * that is what gminStep uses below.
 */
function newton(parts, idx, gmin, seed) {
    const nn = idx.size;
    const branches = parts.filter(p => p.type === 'V' || p.type === 'E' || p.type === 'OA' || p.type === 'short');
    const size = nn + branches.length;
    if (size === 0 || size > 300) return null;
    const at = n => (N.isGround(n) ? -1 : idx.get(n));

    let x = seed ? seed.slice() : new Array(size).fill(0);
    const prev = new Map();        // last junction voltages, for limiting

    for (let iter = 0; iter < MAXIT; iter++) {
        const A = Array.from({ length: size }, () => new Array(size).fill(0));
        const rhs = new Array(size).fill(0);
        const V = n => { const i = at(n); return i < 0 ? 0 : x[i]; };
        const G = (r, c, v) => { if (r >= 0 && c >= 0) A[r][c] += v; };
        const inj = (r, v) => { if (r >= 0) rhs[r] += v; };
        // Conductance between two nodes.
        const cond = (a, b, g) => { G(a, a, g); G(b, b, g); G(a, b, -g); G(b, a, -g); };
        // A transconductance: current from p to m, controlled by (cp - cm).
        const vccs = (p, m, cp, cm, g) => { G(p, cp, g); G(p, cm, -g); G(m, cp, -g); G(m, cm, g); };
        // A fixed current from p to m.
        const isrc = (p, m, i) => { inj(p, -i); inj(m, i); };

        // A leak from every node to ground. A node that touches only
        // capacitors - an AC-coupled output, a sample-and-hold top plate - has
        // no DC path anywhere and makes the matrix singular, which came back
        // as "did not converge" and hid the real reason. SPICE does exactly
        // this; 1e-12 S moves nothing measurable and lets such a node read 0 V.
        for (let i = 0; i < nn; i++) A[i][i] += GMIN;

        let bi = 0;
        for (const q of parts) {
            if (q.type === 'R') {
                cond(at(q.n[0]), at(q.n[1]), 1 / q.v);
            } else if (q.type === 'open') {
                /* a capacitor at DC */
            } else if (q.type === 'I') {
                const a = at(q.n[0]), b = at(q.n[1]);
                inj(b, q.v); inj(a, -q.v);
            } else if (q.type === 'V' || q.type === 'short') {
                const k = nn + bi++, a = at(q.n[0]), b = at(q.n[1]);
                if (a >= 0) { A[a][k] += 1; A[k][a] += 1; }
                if (b >= 0) { A[b][k] -= 1; A[k][b] -= 1; }
                rhs[k] = q.type === 'V' ? q.v : 0;
            } else if (q.type === 'E') {
                const k = nn + bi++, a = at(q.n[0]), b = at(q.n[1]);
                if (a >= 0) { A[a][k] += 1; A[k][a] += 1; }
                if (b >= 0) { A[b][k] -= 1; A[k][b] -= 1; }
                const cp = at(q.n[2]), cm = at(q.n[3]);
                if (cp >= 0) A[k][cp] -= q.v;
                if (cm >= 0) A[k][cm] += q.v;
            } else if (q.type === 'OA') {
                const k = nn + bi++, out = at(q.n[2]);
                if (out >= 0) A[out][k] += 1;
                const p = at(q.n[0]), m = at(q.n[1]);
                if (p >= 0) A[k][p] += 1;
                if (m >= 0) A[k][m] -= 1;
            } else if (q.type === 'SEMI') {
                const M = q.model;
                if (M.type === 'diode') {
                    const a = at(q.n[0]), c = at(q.n[1]);
                    const nvt = (M.N || 1) * VT, vcrit = vcritOf(M.Is);
                    let vd = V(q.n[0]) - V(q.n[1]);
                    vd = pnjlim(vd, prev.get(q.part) || 0, nvt, vcrit);
                    prev.set(q.part, vd);
                    const e = Math.exp(Math.min(vd / nvt, 80));
                    const Id = M.Is * (e - 1);
                    const gd = M.Is * e / nvt + gmin;
                    cond(a, c, gd);
                    isrc(a, c, Id - gd * vd);
                } else if (M.type === 'npn' || M.type === 'pnp') {
                    const s = M.type === 'npn' ? 1 : -1;
                    const c = at(q.n[0]), b = at(q.n[1]), e = at(q.n[2]);
                    const vcrit = vcritOf(M.Is);
                    let vbe = s * (V(q.n[1]) - V(q.n[2]));
                    let vbc = s * (V(q.n[1]) - V(q.n[0]));
                    vbe = pnjlim(vbe, prev.get(q.part + '_be') || 0, VT, vcrit);
                    vbc = pnjlim(vbc, prev.get(q.part + '_bc') || 0, VT, vcrit);
                    prev.set(q.part + '_be', vbe); prev.set(q.part + '_bc', vbc);
                    const ef = Math.exp(Math.min(vbe / VT, 80));
                    const er = Math.exp(Math.min(vbc / VT, 80));
                    const Ibe = M.Is / M.BF * (ef - 1), gbe = M.Is / (M.BF * VT) * ef + gmin;
                    const Ibc = M.Is / M.BR * (er - 1), gbc = M.Is / (M.BR * VT) * er + gmin;
                    const It = M.Is * (ef - er);
                    const gif = M.Is / VT * ef, gir = M.Is / VT * er;
                    // Two junction conductances. Their equivalent CURRENTS are
                    // stamped in the polarity block below, once each - an
                    // earlier draft stamped the base-emitter one here as well,
                    // which doubled the base current and biased every divider
                    // stage 40% hot.
                    cond(b, e, gbe);
                    cond(b, c, gbc);
                    // ...plus the transport current from collector to emitter.
                    // Signs are carried by s so one block serves both polarities.
                    const bb = b, ee = e, cc = c;
                    if (s > 0) {
                        isrc(bb, ee, Ibe - gbe * vbe);
                        isrc(bb, cc, Ibc - gbc * vbc);
                        vccs(cc, ee, bb, ee, gif);
                        vccs(cc, ee, bb, cc, -gir);
                        isrc(cc, ee, It - gif * vbe + gir * vbc);
                    } else {
                        // PNP: vbe here is Ve - Vb and vbc is Vc - Vb, so the
                        // controlling pairs are reversed too. An earlier draft
                        // copied (bb, ee) and (bb, cc) from the NPN block, which
                        // gave the Jacobian the negative of the transconductance
                        // while the companion current below kept the right sign;
                        // Newton then walked away from the solution by a factor
                        // of ten a step, and every circuit with a PNP in it
                        // "did not converge".
                        isrc(ee, bb, Ibe - gbe * vbe);
                        isrc(cc, bb, Ibc - gbc * vbc);
                        vccs(ee, cc, ee, bb, gif);
                        vccs(ee, cc, cc, bb, -gir);
                        isrc(ee, cc, It - gif * vbe + gir * vbc);
                    }
                } else if (M.type === 'nmos' || M.type === 'pmos') {
                    const s = M.type === 'nmos' ? 1 : -1;
                    let d = q.n[0], g = q.n[1], src = q.n[2];
                    let vgs = s * (V(g) - V(src)), vds = s * (V(d) - V(src));
                    let swapped = false;
                    if (vds < 0) {                    // the drain is the source
                        [d, src] = [src, d];
                        vgs = s * (V(g) - V(src)); vds = s * (V(d) - V(src));
                        swapped = true;
                    }
                    const vov = vgs - M.Vth;
                    let Id = 0, gm = 0, gds = 0;
                    if (vov > 0) {
                        if (vds < vov) {              // triode
                            // The (1 + lambda*vds) factor belongs here too, as
                            // in SPICE level 1. Without it the current jumps by
                            // lambda*vds*Id at the boundary and Newton cycles
                            // across it forever - a 10 V / 1 k / VGS 4 V stage
                            // sat at that boundary and never converged.
                            const l = 1 + M.lambda * vds;
                            const tri = M.K * (vov * vds - vds * vds / 2);
                            Id = tri * l;
                            gm = M.K * vds * l;
                            gds = M.K * (vov - vds) * l + tri * M.lambda;
                        } else {                      // saturation
                            const l = 1 + M.lambda * vds;
                            Id = M.K / 2 * vov * vov * l;
                            gm = M.K * vov * l;
                            gds = M.K / 2 * vov * vov * M.lambda;
                        }
                    }
                    gds += gmin;
                    const dd = at(d), ss = at(src), gg = at(g);
                    cond(dd, ss, gds);
                    vccs(dd, ss, gg, ss, s > 0 ? gm : gm);
                    const ieq = Id - gm * vgs - gds * vds;
                    if (s > 0) isrc(dd, ss, ieq); else isrc(ss, dd, ieq);
                    void swapped;
                }
            }
        }

        // The residual of the NONLINEAR equations at x, before stepping. The
        // companion stamps built at x reproduce each device's actual current
        // at x, so A.x - rhs is Kirchhoff's current law evaluated exactly -
        // amps at node rows, volts at the branch rows of sources and op-amps.
        // A convergence test on step size alone cannot tell a root from a
        // stall: Newton against a near-singular Jacobian takes tiny steps
        // while sitting nowhere near a solution, and the circuit_toy session's
        // solver reported such a stall as success (353 A of KCL violation) on
        // a seven-transistor amplifier. Tolerance is SPICE's shape: absolute
        // plus a relative part scaled by the currents actually flowing.
        let res = 0, scale = 0;
        for (let i = 0; i < size; i++) {
            let ax = 0, mag = 0;
            for (let j = 0; j < size; j++) { const t = A[i][j] * x[j]; ax += t; mag += Math.abs(t); }
            res = Math.max(res, Math.abs(ax - rhs[i]));
            scale = Math.max(scale, mag, Math.abs(rhs[i]));
        }
        // OP_NORES=1 restores the step-only test, for finding out which
        // answers were resting on it.
        const resOk = process.env.OP_NORES ? true : res < 1e-9 + 1e-6 * scale;

        const xn = solve(A, rhs);
        if (!xn) return null;
        if (xn.some(v => !isFinite(v))) return null;

        // Damping: no node moves more than MAXSTEP volts in one iteration.
        // A current source feeding a cut-off MOSFET sees only the gmin leak,
        // and the first undamped step put that node at 120 MV; forty
        // iterations went on walking it back down and the cap ran out before
        // the answer. SPICE limits junction and gate voltages per device;
        // one global limit does the same job here, and the residual test
        // means a damped step can never be mistaken for convergence.
        for (let i = 0; i < size; i++) {
            const d = xn[i] - x[i];
            if (Math.abs(d) > MAXSTEP) xn[i] = x[i] + Math.sign(d) * MAXSTEP;
        }

        let worst = 0;
        for (let i = 0; i < size; i++) worst = Math.max(worst, Math.abs(xn[i] - x[i]));
        if (process.env.OP_DEBUG && iter < 40) {
            console.error('    iter ' + iter + '  worst step ' + worst.toExponential(3) +
                          '  residual ' + res.toExponential(3) +
                          '  x0..2 = ' + xn.slice(0, 3).map(v => v.toFixed(4)).join(', '));
        }
        if (worst < 1e-9 && resOk && iter > 2) {
            // x already satisfies the equations; keep it rather than xn so the
            // reported residual is the one that was tested.
            const v = {};
            idx.forEach((i, n) => { v[n] = x[i]; });
            return { v, iters: iter + 1, x, res };
        }
        x = xn;
    }
    return null;
}

/**
 * Newton first; if it will not converge, walk gmin down from something large.
 *
 * Starting with a heavily shunted circuit gives an easy problem with a
 * guaranteed solution, and each step uses the previous answer as its starting
 * guess, so the hard problem is only ever approached from somewhere close to
 * its own answer. This is the standard SPICE fallback and it rescued every
 * table that plain Newton refused.
 */
function operatingPoint(parts, idx) {
    const plain = newton(parts, idx, GMIN, null);
    if (plain) return plain;

    // gmin stepping: shunt every junction hard, then relax.
    let seed = null, last = null, ok = true;
    for (const g of [1e-3, 1e-4, 1e-5, 1e-6, 1e-7, 1e-8, 1e-9, 1e-10, 1e-11, GMIN]) {
        const r = newton(parts, idx, g, seed);
        if (!r) { ok = false; break; }
        seed = r.x; last = r;
    }
    if (ok && last) return { v: last.v, iters: last.iters, res: last.res, stepped: 'gmin' };

    // Source stepping: bring every supply up from zero. At zero volts every
    // junction is off and the answer is trivially all-zero; each step then
    // starts from the previous answer, so a complementary output stage is
    // never asked to guess which of its two devices is conducting - it is
    // walked there. This is what rescues class-AB stages, where plain Newton
    // oscillates between the two devices at the crossover.
    const scaled = a => parts.map(q => (q.type === 'V' || q.type === 'I') ? Object.assign({}, q, { v: q.v * a }) : q);
    seed = null; last = null;
    for (const a of [0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 1.0]) {
        const r = newton(scaled(a), idx, GMIN, seed);
        if (!r) {
            if (process.env.OP_DEBUG) console.error('  source stepping failed at alpha = ' + a);
            return null;
        }
        seed = r.x; last = r;
    }
    return last ? { v: last.v, iters: last.iters, res: last.res, stepped: 'source' } : null;
}

/**
 * A converged answer that is not a circuit. Newton can settle on a
 * self-consistent solution in which a junction carries a megaamp - the
 * circuit_toy session's solver did exactly that on a class AB stage whose
 * bias diodes and transistors had mismatched models, and reported success
 * because it checked for NaN and not for absurdity. Refuse to report any
 * operating point where a device carries more than 100 A or a node sits
 * beyond a kilovolt; a lesson would rather have nothing than that number.
 */
function absurdity(parts, v) {
    const V = n => (N.isGround(n) ? 0 : (v[n] || 0));
    for (const n of Object.keys(v)) {
        if (Math.abs(v[n]) > 1e3) return 'V(' + n + ') = ' + v[n].toExponential(2) + ' V';
    }
    for (const q of parts) {
        if (q.type !== 'SEMI') continue;
        const M = q.model;
        let i = 0;
        if (M.type === 'diode') {
            const vd = V(q.n[0]) - V(q.n[1]);
            i = M.Is * (Math.exp(Math.min(vd / ((M.N || 1) * VT), 80)) - 1);
        } else if (M.type === 'npn' || M.type === 'pnp') {
            const s = M.type === 'npn' ? 1 : -1;
            const vbe = s * (V(q.n[1]) - V(q.n[2])), vbc = s * (V(q.n[1]) - V(q.n[0]));
            const ef = Math.exp(Math.min(vbe / VT, 80)), er = Math.exp(Math.min(vbc / VT, 80));
            i = M.Is * (ef - er) - M.Is / M.BR * (er - 1);
        } else {
            const s = M.type === 'nmos' ? 1 : -1;
            let vgs = s * (V(q.n[1]) - V(q.n[2])), vds = s * (V(q.n[0]) - V(q.n[2]));
            if (vds < 0) { vds = -vds; vgs = s * (V(q.n[1]) - V(q.n[0])); }
            const vov = vgs - M.Vth;
            if (vov > 0) i = (vds < vov ? M.K * (vov * vds - vds * vds / 2) : M.K / 2 * vov * vov) * (1 + M.lambda * vds);
        }
        if (Math.abs(i) > 100) return q.part + ' carries ' + fmtI(i);
    }
    return null;
}

/** Device operating points, for the report. */
function devices(parts, v) {
    const V = n => (N.isGround(n) ? 0 : (v[n] || 0));
    const out = [];
    parts.forEach(q => {
        if (q.type !== 'SEMI') return;
        const M = q.model;
        if (M.type === 'diode') {
            const vd = V(q.n[0]) - V(q.n[1]);
            const id = M.Is * (Math.exp(Math.min(vd / ((M.N || 1) * VT), 80)) - 1);
            out.push('  ' + q.part.padEnd(10) + M.type + ' ' + q.modelName +
                     '   Vd = ' + vd.toFixed(4) + ' V, Id = ' + fmtI(id));
        } else if (M.type === 'npn' || M.type === 'pnp') {
            const s = M.type === 'npn' ? 1 : -1;
            const vbe = s * (V(q.n[1]) - V(q.n[2])), vbc = s * (V(q.n[1]) - V(q.n[0]));
            const vce = s * (V(q.n[0]) - V(q.n[2]));
            const ef = Math.exp(Math.min(vbe / VT, 80)), er = Math.exp(Math.min(vbc / VT, 80));
            const ic = M.Is * (ef - er) - M.Is / M.BR * (er - 1);
            const ib = M.Is / M.BF * (ef - 1) + M.Is / M.BR * (er - 1);
            const region = vbe < 0.3 ? 'off' : (vbc > 0.4 ? 'saturated' : 'active');
            out.push('  ' + q.part.padEnd(10) + M.type.toUpperCase() + ' ' + q.modelName +
                     '   Vbe = ' + vbe.toFixed(4) + ' V, Vce = ' + vce.toFixed(4) +
                     ' V, Ic = ' + fmtI(ic) + ', beta_eff = ' + (ib > 1e-15 ? (ic / ib).toFixed(0) : '-') +
                     '   [' + region + ']');
        } else {
            const s = M.type === 'nmos' ? 1 : -1;
            const vgs = s * (V(q.n[1]) - V(q.n[2])), vds = s * (V(q.n[0]) - V(q.n[2]));
            const vov = vgs - M.Vth;
            let id = 0, region = 'cutoff';
            if (vov > 0) {
                if (vds < vov) { id = M.K * (vov * vds - vds * vds / 2) * (1 + M.lambda * vds); region = 'triode'; }
                else { id = M.K / 2 * vov * vov * (1 + M.lambda * vds); region = 'saturation'; }
            }
            out.push('  ' + q.part.padEnd(10) + M.type.toUpperCase() +
                     '   Vgs = ' + vgs.toFixed(4) + ' V, Vds = ' + vds.toFixed(4) +
                     ' V, Id = ' + fmtI(id) + '   [' + region + ']');
        }
    });
    return out;
}

function fmtI(i) {
    const a = Math.abs(i);
    if (a < 1e-12) return '0 A';
    if (a < 1e-9) return (i * 1e12).toPrecision(4) + ' pA';
    if (a < 1e-6) return (i * 1e9).toPrecision(4) + ' nA';
    if (a < 1e-3) return (i * 1e6).toPrecision(4) + ' uA';
    if (a < 1) return (i * 1e3).toPrecision(4) + ' mA';
    return i.toPrecision(4) + ' A';
}

const fmtV = v => {
    const a = Math.abs(v);
    if (a < 1e-9) return '0 V';
    if (a < 1e-3) return (v * 1e6).toPrecision(5) + ' uV';
    if (a < 1) return (v * 1e3).toPrecision(5) + ' mV';
    return v.toPrecision(6) + ' V';
};

// solve-ac linearises each device about the point this finds, to sweep
// transistor amplifiers; it needs the solver and nothing below this line.
module.exports = { operatingPoint, newton, devices, absurdity, VT, GMIN };
if (require.main !== module) return;

const files = TARGET ? [path.resolve(ROOT, TARGET)] : N.walk(LESSONS, []).sort();
let tables = 0, solved = 0, withSemi = 0;
const skips = new Map();

files.forEach(file => {
    const rel = path.relative(ROOT, file).split(path.sep).join('/');
    N.tablesIn(fs.readFileSync(file, 'utf8')).forEach((rows, i) => {
        tables++;
        const tag = rel + (i > 0 ? ' [table ' + (i + 1) + ']' : '');
        const p = N.parse(rows, 'op');
        if (p.error) {
            const key = p.error.replace(/:.*$/, '');
            skips.set(key, (skips.get(key) || 0) + 1);
            if (LIST || TARGET) console.log('skip    ' + tag + '   ' + p.error);
            return;
        }
        if (!p.parts.some(q => q.type === 'SEMI')) {
            skips.set('no semiconductors (solve-dc has it)', (skips.get('no semiconductors (solve-dc has it)') || 0) + 1);
            if (LIST) console.log('skip    ' + tag + '   no semiconductors');
            return;
        }
        withSemi++;
        const idx = N.nodeIndex(p.parts);
        const r = operatingPoint(p.parts, idx);
        if (!r) {
            // An ideal op-amp is a nullor: it forces its inputs equal and lets
            // its output current float. Put one around a class-AB stage and the
            // crossover deadband means a whole RANGE of output-node voltages
            // satisfies that constraint, so there is no unique operating point
            // to find - the same situation solve-dc reports as singular, and not
            // a numerical failure. Say which it probably is rather than blaming
            // the arithmetic.
            const nullorPlusSemi = p.parts.some(q => q.type === 'OA');
            const why = nullorPlusSemi
                ? 'no unique operating point: an ideal op-amp around a nonlinear stage (a deadband admits a range of answers)'
                : 'did not converge, even with gmin and source stepping';
            skips.set(why.replace(/:.*$/, ''), (skips.get(why.replace(/:.*$/, '')) || 0) + 1);
            if (LIST || TARGET) console.log('skip    ' + tag + '   ' + why);
            return;
        }
        const absurd = absurdity(p.parts, r.v);
        if (absurd) {
            const why = 'absurd operating point: ' + absurd + ' - self-consistent, and not a circuit';
            skips.set('absurd operating point', (skips.get('absurd operating point') || 0) + 1);
            if (LIST || TARGET) console.log('skip    ' + tag + '   ' + why);
            return;
        }
        solved++;
        console.log('OP      ' + tag + '   (' + r.iters + ' iterations' +
                    (r.res !== undefined ? ', KCL residual ' + r.res.toExponential(1) + ' A' : '') + ')');
        Object.keys(r.v).sort().forEach(n => console.log('           V(' + n + ') = ' + fmtV(r.v[n])));
        devices(p.parts, r.v).forEach(l => console.log('         ' + l));
    });
});

if (!TARGET) {
    console.log('');
    console.log('NONLINEAR OPERATING POINTS\n');
    console.log('  build tables            ' + String(tables).padStart(4));
    console.log('  containing semiconductors ' + String(withSemi).padStart(4));
    console.log('  solved                  ' + String(solved).padStart(4));
    console.log('');
    [...skips.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).forEach(([why, n]) => {
        console.log('     ' + String(n).padStart(4) + '  ' + why);
    });
    console.log('');
    console.log('Bias points depend on the device model, which is printed above. Use the');
    console.log('model-insensitive quantities in a SimCheck, not the absolute currents.');
}
