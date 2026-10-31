"""Reproduce the published PDN experiments with LTspice, never fabricated traces.

Usage: python -X utf8 tools/run-pdn-ltspice.py --exe PATH_TO_LTSPICE
The circuits are deliberately lumped examples, not vendor/PCB extraction models.
"""
import argparse
import csv
import hashlib
import json
import math
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
EXAMPLES = ROOT / 'docs/examples'
DATA = ROOT / 'docs/data/pdn'
FIGURES = ROOT / 'assets/figures/pdn'
SCRATCH = ROOT / '_audit/ltspice-pdn'
for directory in (EXAMPLES, DATA, FIGURES, SCRATCH):
    directory.mkdir(parents=True, exist_ok=True)


def read_raw(path):
    blob = path.read_bytes()
    text = blob.decode('utf-16-le' if b'\x00' in blob[:30] else 'utf-8-sig').replace('\r\n','\n')
    header, body = text.split('Values:\n')
    variables = []
    for line in header.split('Variables:\n')[1].splitlines():
        fields = line.split()
        if fields:
            variables.append(fields[1].lower())
    rows, row = [], []
    for line in body.splitlines():
        fields = line.split()
        if not fields:
            continue
        token = fields[-1]
        value = complex(*map(float, token.split(','))) if ',' in token else complex(float(token), 0)
        row.append(value)
        if len(row) == len(variables):
            rows.append(row)
            row = []
    if row or not rows:
        raise ValueError('Incomplete or empty LTspice output')
    return variables, rows


def run(exe, name, lines):
    deck = '\n'.join(['* EE_Review illustrative PDN experiment: ' + name,
                       '* Explicit lumped assumptions; no extracted PCB or vendor capacitor model.',
                       *lines, '.options plotwinsize=0 numdgt=15 reltol=1e-6 vntol=1e-8 abstol=1e-10', '.end', ''])
    (EXAMPLES / (name + '.cir')).write_text(deck, encoding='utf-8')
    work = SCRATCH / (name + '.cir')
    work.write_text(deck, encoding='utf-8')
    completed = subprocess.run([exe, '-b', '-ascii', str(work)], capture_output=True,
                               timeout=60, creationflags=0x08000000 if os.name == 'nt' else 0)
    if completed.returncode:
        raise RuntimeError(completed.stderr.decode(errors='replace'))
    raw = work.with_suffix('.raw')
    if not raw.exists():
        raise RuntimeError('No raw result: ' + name)
    variables, rows = read_raw(raw)
    # Keep solver logs and raw-file hashes so exported plots have provenance.
    log = work.with_suffix('.log').read_text(encoding='utf-8-sig').replace(str(ROOT), '<workspace>')
    (DATA / (name + '-log.txt')).write_text(log.rstrip()+'\n', encoding='utf-8')
    return variables, rows, {'deck_sha256': hashlib.sha256(deck.encode()).hexdigest(),
                            'raw_sha256': hashlib.sha256(raw.read_bytes()).hexdigest(),
                            'points': len(rows)}


def csv_write(name, header, rows):
    with (DATA / (name + '.csv')).open('w', newline='', encoding='utf-8') as stream:
        writer = csv.writer(stream)
        writer.writerow(header)
        writer.writerows(rows)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--exe', required=True)
    args = parser.parse_args()
    import numpy as np
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    plt.rcParams.update({'font.size': 12, 'axes.facecolor': '#101d29', 'figure.facecolor': '#101d29',
                         'text.color': '#e3edf4', 'axes.labelcolor': '#e3edf4', 'xtick.color': '#c4d3df',
                         'ytick.color': '#c4d3df', 'axes.edgecolor': '#8b9eae', 'grid.color': '#425568',
                         'svg.fonttype': 'none', 'svg.hashsalt': 'ee-review-pdn', 'axes.prop_cycle': plt.cycler(color=['#6ee7ff','#34d399','#ffce71'])})
    manifest = {'simulator': 'LTspice', 'model': 'explicit linear lumped RLC; not measured PCB', 'runs': {}}
    ac = {}
    cases = [('bank-a',[10e-6]*3,0),('bank-b',[10e-6,1e-6,.1e-6],0),('bank-c',[3.7e-6]*3,0),
             ('shared-02',[10e-6]*3,.2e-9),('shared-05',[10e-6]*3,.5e-9)]
    for name, caps, shared in cases:
        lines = ['VAC port 0 AC 1']
        bus = 'port'
        if shared:
            lines.append(f'Lshared port bank {shared:.15g} Rser=0')
            bus = 'bank'
        for i,c in enumerate(caps,1):
            lines += [f'R{i} {bus} r{i} 0.01', f'L{i} r{i} c{i} 1n Rser=0',f'C{i} c{i} 0 {c:.15g} Rser=0']
        lines += ['.ac dec 200 1k 100meg','.save V(port) I(VAC)']
        variables, rows, record = run(args.exe, 'pdn-'+name, lines)
        iv, vv = variables.index('i(vac)'), variables.index('v(port)')
        output = [(r[0].real, -r[vv]/r[iv]) for r in rows]
        errs=[]
        for f,z in output:
            expected = 1/sum(1/complex(.01,2*math.pi*f*1e-9-1/(2*math.pi*f*c)) for c in caps)+complex(0,2*math.pi*f*shared)
            errs.append(abs(z-expected)/abs(expected))
        record['max_relative_complex_error'] = max(errs)
        if max(errs)>1e-6:
            raise AssertionError('SPICE and closed form disagree: '+name+' '+str(max(errs)))
        manifest['runs'][name]=record
        csv_write('pdn-'+name,['frequency_Hz','Zreal_ohm','Zimag_ohm','Zmag_ohm'],[(f,z.real,z.imag,abs(z)) for f,z in output])
        ac[name]=np.array([(f,abs(z)) for f,z in output])

    def save(fig,name):
        fig.tight_layout()
        fig.savefig(FIGURES/(name+'.svg'),metadata={'Date':None})
        svg=FIGURES/(name+'.svg')
        svg.write_text('\n'.join(line.rstrip() for line in svg.read_text(encoding='utf-8').splitlines())+'\n',encoding='utf-8')
        fig.savefig(SCRATCH/(name+'.png'),dpi=120)
        plt.close(fig)

    fig,ax=plt.subplots(figsize=(9,5))
    for name,label in [('bank-a','A: 3 × 10 µF (30 µF)'),('bank-b','B: 10 / 1 / 0.1 µF (11.1 µF)'),('bank-c','C: 3 × 3.7 µF (11.1 µF)')]:
        ax.loglog(ac[name][:,0],ac[name][:,1],label=label)
    ax.set(xlabel='Frequency (Hz)',ylabel='Port impedance magnitude (Ω)',title='LTspice AC: equal count versus equal total C')
    ax.grid(True,which='both',alpha=.35);ax.legend(fontsize=10);save(fig,'bank-comparison')
    fig,ax=plt.subplots(figsize=(9,5))
    for name,label in [('bank-a','Shared L = 0'),('shared-02','Shared L = 0.2 nH'),('shared-05','Shared L = 0.5 nH')]:
        ax.loglog(ac[name][:,0],ac[name][:,1],label=label)
    ax.set(xlabel='Frequency (Hz)',ylabel='Port impedance magnitude (Ω)',title='LTspice AC: common inductance remains outside the bank')
    ax.grid(True,which='both',alpha=.35);ax.legend(fontsize=10);save(fig,'shared-inductance')

    transient={}
    # Fixed 1 V Thevenin source; no active regulator control loop is modeled.
    def transient_lines(c,l,step):
        return ['VREG src 0 1','Rreg src supply 0.005','Rb supply rb 0.01','Lb rb cb 1n Rser=0','Cb cb 0 100u Rser=0',
                'Rpath supply rp 0.005',f'Lpath rp load {l:.15g} Rser=0','Rc load rc 0.01','Lc rc cc 1n Rser=0',
                f'Clocal cc 0 {c:.15g} Rser=0',
                '* Raised-cosine 100ns edges: continuous current and derivative, no artificial voltage jumps.',
                'BILOAD load 0 I=4*(if(time<2u,0,if(time<2.1u,(1-cos(pi*(time-2u)/100n))/2,1))-if(time<12u,0,if(time<12.1u,(1-cos(pi*(time-12u)/100n))/2,1)))',
                f'.tran 0 30u 0 {step:.15g}', '.save V(load) V(supply) I(BILOAD)']
    cases=[('local-1u',1e-6,10e-9),('local-10u',10e-6,10e-9),('local-100u',100e-6,10e-9),
           ('path-1n',10e-6,1e-9),('path-30n',10e-6,30e-9)]
    for name,c,l in cases:
        variables,rows,record=run(args.exe,'pdn-'+name,transient_lines(c,l,5e-9))
        ti,vi,si,ii=0,variables.index('v(load)'),variables.index('v(supply)'),variables.index('i(biload)')
        out=np.array([(r[ti].real,r[vi].real,r[si].real,r[ii].real) for r in rows])
        # Convergence check: repeat with half the maximum transient timestep.
        fv,fr,fine=run(args.exe,'pdn-'+name+'-fine',transient_lines(c,l,2.5e-9))
        fine_y=np.array([r[fv.index('v(load)')].real for r in fr])
        fine_t=np.array([r[0].real for r in fr])
        difference=float(np.max(np.abs(out[:,1]-np.interp(out[:,0],fine_t,fine_y))))
        if difference>.002:
            raise AssertionError('Transient timestep convergence exceeds 2mV: '+name+' '+str(difference))
        record.update({'max_timestep_difference_V':difference,'min_load_V':float(out[:,1].min()),'max_load_V':float(out[:,1].max()),'fine_run':fine})
        manifest['runs'][name]=record
        transient[name]=out
        csv_write('pdn-'+name,['time_s','load_V','supply_V','load_current_A'],out)
    for figure,selection,title in [
        ('local-capacitance',[('local-1u','1 µF local'),('local-10u','10 µF local'),('local-100u','100 µF local')],'LTspice transient: local C changes droop and ringing'),
        ('distribution-inductance',[('path-1n','1 nH path'),('local-10u','10 nH path'),('path-30n','30 nH path')],'LTspice transient: distribution L changes the load voltage')]:
        fig,(ax,ai)=plt.subplots(2,1,figsize=(9,6),sharex=True,gridspec_kw={'height_ratios':[3,1]})
        for name,label in selection:
            d=transient[name];ax.plot(d[:,0]*1e6,d[:,1],label=label)
        d=transient['local-10u'];ai.plot(d[:,0]*1e6,d[:,3],color='#c4d3df')
        ax.set(ylabel='Load voltage (V)',title=title);ai.set(xlabel='Time (µs)',ylabel='Load (A)')
        ax.grid(True,alpha=.35);ai.grid(True,alpha=.35);ax.legend(fontsize=10);save(fig,figure)

    # Analytical plots are explicitly separate from LTspice data.
    fig,ax=plt.subplots(figsize=(9,4.5))
    t=np.logspace(-2,1,150)
    for c,label in [(10e-6,'10 µF'),(100e-6,'100 µF'),(470e-6,'470 µF')]:
        ax.loglog(t,c*3.3/(t*1e-3),label=label)
    ax.set(xlabel='0–3.3 V linear ramp duration (ms)',ylabel='Capacitor charging current (A)',title='Calculated inrush: I = C × ΔV / Δt (load current excluded)')
    ax.grid(True,which='both',alpha=.35);ax.legend();save(fig,'inrush-calculated')
    csv_write('inrush-calculated',['ramp_ms','I_10u_A','I_100u_A','I_470u_A'],[(x,*[c*3.3/(x*1e-3) for c in [10e-6,100e-6,470e-6]]) for x in t])
    fig,ax=plt.subplots(figsize=(9,4.5))
    h=np.linspace(.02,.3,150)
    ax.plot(h,8.8541878128e-12*4*.05*.05/(h*1e-3)*1e9)
    ax.set(xlabel='Plane separation (mm)',ylabel='Ideal plane-pair capacitance (nF)',title='Calculated parallel plates: 50 × 50 mm, εr = 4')
    ax.grid(True,alpha=.35);save(fig,'plane-capacitance-calculated')
    csv_write('plane-capacitance-calculated',['separation_mm','capacitance_nF'],[(x,8.8541878128e-12*4*.05*.05/(x*1e-3)*1e9) for x in h])
    fig,ax=plt.subplots(figsize=(9,4.5))
    bars=ax.bar(['0603 inch','0402 inch','0201 inch'],[100,132,183],color=['#6ee7ff','#34d399','#ffce71'])
    ax.bar_label(bars,padding=6)
    ax.set(ylabel='Relative maximum principal stress',ylim=(0,210),title='Reported Murata FEM results — not a new simulation')
    ax.grid(True,axis='y',alpha=.35);ax.set_axisbelow(True);save(fig,'murata-stress-reported')
    csv_write('murata-stress-reported',['inch_package','relative_stress','source'],[
        (package,value,'Murata Points of Downsizing MLCCs 2022-03-25 p7; 1mm wiring,35um copper; p6 boundary conditions')
        for package,value in [('0603',100),('0402',132),('0201',183)]])
    manifest['simulator_version']=(DATA/'pdn-bank-a-log.txt').read_text(encoding='utf-8').splitlines()[0]
    (DATA/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(manifest,indent=2))


if __name__=='__main__':
    main()
