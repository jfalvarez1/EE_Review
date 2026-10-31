"""Run reproducible signal-fault experiments. All values are illustrative assumptions.

python -X utf8 tools/run-protocol-ltspice.py --exe PATH_TO_LTSPICE
No vendor I/O, package extraction, protocol engine or compliance model is implied.
"""
import argparse
import csv
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'docs/data/protocol'
FIG = ROOT / 'assets/figures/protocol'
WORK = ROOT / '_audit/ltspice-protocol'
DECK = ROOT / 'docs/examples'
for folder in (DATA, FIG, WORK, DECK):
    folder.mkdir(parents=True, exist_ok=True)
spec = importlib.util.spec_from_file_location('pdn', ROOT/'tools/run-pdn-ltspice.py')
pdn = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pdn)


def run(exe, name, lines, stop, step, signals):
    deck = '\n'.join(['* EE_Review: '+name,
        '* Assumed lumped educational model, NOT a specific IC or measured board.',
        *lines, f'.tran 0 {stop} 0 {step:.12g}', '.save '+' '.join(signals),
        '.options plotwinsize=0 numdgt=15 reltol=1e-6 vntol=1e-8 abstol=1e-11', '.end', ''])
    source = DECK/(name+'.cir')
    source.write_text(deck, encoding='utf-8')
    work = WORK/source.name
    work.write_text(deck, encoding='utf-8')
    subprocess.run([exe, '-b', '-ascii', str(work)], check=True, capture_output=True,
                   timeout=60, creationflags=0x08000000 if os.name=='nt' else 0)
    variables, rows = pdn.read_raw(work.with_suffix('.raw'))
    import numpy as np
    output = np.array([[r[0].real]+[r[variables.index(s.lower())].real for s in signals] for r in rows])
    log = work.with_suffix('.log').read_text(encoding='utf-8-sig').replace(str(ROOT), '<workspace>')
    (DATA/(name+'-log.txt')).write_text(log.rstrip()+'\n', encoding='utf-8')
    return output, {'deck_sha256':hashlib.sha256(deck.encode()).hexdigest(),
        'raw_sha256':hashlib.sha256(work.with_suffix('.raw').read_bytes()).hexdigest(),
        'points':len(rows), 'simulator':log.splitlines()[0], 'max_step_s':step}


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--exe',required=True);args=parser.parse_args()
    import numpy as np
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    plt.rcParams.update({'font.size':12,'axes.facecolor':'#101d29','figure.facecolor':'#101d29',
        'text.color':'#e3edf4','axes.labelcolor':'#e3edf4','xtick.color':'#c4d3df','ytick.color':'#c4d3df',
        'axes.edgecolor':'#8b9eae','grid.color':'#425568','svg.fonttype':'none','svg.hashsalt':'ee-protocol',
        'axes.prop_cycle':plt.cycler(color=['#6ee7ff','#ffce71','#34d399'])})
    manifest={'model':'Assumed lumped networks; no real I/O clamps unless explicitly included; not measured hardware',
              'runs':{}}
    results={}

    def experiment(name,lines,stop,step,signals,headers):
        name='protocol-'+name
        a,record=run(args.exe,name,lines,stop,step,signals)
        b,fine=run(args.exe,name+'-fine',lines,stop,step/2,signals)
        # Compare every saved voltage; switched currents have ideal discontinuities.
        errors={s:float(np.max(np.abs(a[:,i+1]-np.interp(a[:,0],b[:,0],b[:,i+1]))))
                for i,s in enumerate(signals) if s.lower().startswith('v(')}
        assert max(errors.values())<.003,(name,errors)
        record.update({'voltage_convergence_V':errors,'fine_run':fine})
        path=DATA/(name+'.csv')
        with path.open('w',newline='',encoding='utf-8') as stream:
            writer=csv.writer(stream);writer.writerow(['time_s']+headers);writer.writerows(a)
        record['csv_sha256']=hashlib.sha256(path.read_bytes().replace(b'\r\n',b'\n')).hexdigest()
        manifest['runs'][name]=record;results[name]=a
        return a,record

    switch='.model EN SW(Ron=0.01 Roff=1T Vt=0.5 Vh=0)'
    for name,rlo in [('balanced',22),('unequal',66)]:
        a,r=experiment(name,['VH high 0 3.3','VEA ea 0 PWL(0 1 6u 1 6.01u 0)',
            'VEB eb 0 PWL(0 0 2u 0 2.01u 1 8u 1 8.01u 0)',
            'SA high ah ea 0 EN','RA ah bus 22',f'RB bus bl {rlo}',
            'SB bl 0 eb 0 EN','CB bus 0 100p','RLEAK bus 0 1meg',switch],
            '10u',.5e-9,['V(bus)','I(RA)','V(ea)','V(eb)'],['bus_V','high_driver_A','enable_A_V','enable_B_V'])
        i=int(np.argmin(abs(a[:,0]-4e-6)))
        expected=3.3/(1/(rlo+.01)+1/1e6+1/22.01)/22.01
        assert abs(a[i,1]-expected)<1e-6
        r.update({'plateau_V':float(a[i,1]),'high_driver_A':float(a[i,2]),'dc_expected_V':expected})
    for name,bad in [('open-drain',False),('wrong-push-pull',True)]:
        lines=['VDD vdd 0 3.3','RP vdd bus 2.2k','CB bus 0 100p',
            'VA ea 0 PWL(0 0 2u 0 2.01u 1 6u 1 6.01u 0)',
            'VB eb 0 PWL(0 0 4u 0 4.01u 1 8u 1 8.01u 0)',
            'RA bus aa 22','SA aa 0 ea 0 EN','RB bus bb 22','SB bb 0 eb 0 EN',switch]
        if bad: lines+=['RHIGH vdd bus 22']
        a,r=experiment(name,lines,'10u',.5e-9,['V(bus)','I(VDD)'],['bus_V','supply_current_A'])
        r['single_sink_V']=float(np.interp(3e-6,a[:,0],a[:,1]))
        r['two_sink_V']=float(np.interp(5e-6,a[:,0],a[:,1]))
    for name,resistance in [('ringing',20),('damped',63.2455532034)]:
        a,r=experiment(name,['VIN src 0 PWL(0 3.3 50n 3.3 52n 0)',f'RS src n1 {resistance}',
            'LP n1 pin 100n Rser=0','CP pin 0 100p Rser=0'],
            '180n',.1e-9,['V(pin)','V(src)','I(LP)'],['pin_V','source_V','inductor_A'])
        r['minimum_V']=float(a[:,1].min());r['minimum_time_s']=float(a[np.argmin(a[:,1]),0])
    a,r=experiment('reference',['VPIN pin 0 PWL(0 3.3 50n 3.3 52n 0)',
        'VREF ref 0 PWL(0 0 60n 0 65n 1 85n 1 90n 0)',
        'BMEAS measured 0 V=V(pin)-V(ref)'], '180n',.1e-9,
        ['V(pin)','V(ref)','V(measured)'],['pin_local_V','reference_shift_V','displayed_V'])
    assert np.max(abs(a[:,3]-(a[:,1]-a[:,2])))<1e-10
    lines=['VDD vdd 0 3.3','VE e 0 PWL(0 1 2u 1 2.01u 0)',switch]
    for i,resistance in enumerate(['1T','100k','10k']):
        lines += [f'S{i} vdd a{i} e 0 EN',f'RD{i} a{i} z{i} 22',f'C{i} z{i} 0 100p',f'R{i} z{i} 0 {resistance}']
    experiment('released',lines,'30u',5e-9,['V(z0)','V(z1)','V(z2)'],['nearly_floating_V','bias_100k_V','bias_10k_V'])

    def save(fig,name):
        fig.savefig(FIG/(name+'.svg'),metadata={'Date':None},bbox_inches='tight')
        p=FIG/(name+'.svg');p.write_text('\n'.join(l.rstrip() for l in p.read_text(encoding='utf-8').splitlines())+'\n',encoding='utf-8')
        fig.savefig(WORK/(name+'.png'),dpi=125,bbox_inches='tight');plt.close(fig)

    def box(ax,text,xy,pos):
        ax.plot(*xy,'o',color='#ffce71',ms=5)
        ax.annotate(text,xy=xy,xytext=pos,textcoords='axes fraction',fontsize=10,va='top',
            bbox=dict(boxstyle='round,pad=.4',fc='#101d29',ec='#ffce71',alpha=.97),
            arrowprops=dict(arrowstyle='->',color='#ffce71'))

    fig,(ax,ai)=plt.subplots(2,1,figsize=(10,7),sharex=True,layout='constrained')
    for name,label in [('balanced','22 Ω high / 22 Ω low'),('unequal','22 Ω high / 66 Ω low')]:
        a=results['protocol-'+name];r=manifest['runs']['protocol-'+name]
        ax.plot(a[:,0]*1e6,a[:,1],label=f'{label}: {r["plateau_V"]:.3f} V')
        ai.plot(a[:,0]*1e6,a[:,2]*1000,label=label)
    for pane in (ax,ai):pane.axvspan(2.005,6.005,color='#ffce71',alpha=.1);pane.grid(alpha=.4)
    ax.set(title='LTspice: a third voltage plateau from opposing drivers',ylabel='Bus (V)',ylim=(-.15,4.5))
    ai.set(xlabel='Time (µs)',ylabel='High driver (mA)',xlim=(0,10))
    ax.legend(loc='upper right',fontsize=10)
    box(ax,'Both enabled: resistance ratio sets level\nAmber = intentional fault interval',(4,1.65),(.04,.94))
    ai.text(.64,.8,'6–8 µs: only LOW driver\n8–10 µs: both Hi-Z; line stays near 0 V',transform=ai.transAxes,fontsize=10)
    save(fig,'contention')

    fig,(ax,ai)=plt.subplots(2,1,figsize=(10,7),sharex=True,layout='constrained')
    for name,label in [('open-drain','Legal open-drain sharing'),('wrong-push-pull','Fault: extra 22 Ω drive to 3.3 V')]:
        a=results['protocol-'+name];ax.plot(a[:,0]*1e6,a[:,1],label=label);ai.plot(a[:,0]*1e6,-a[:,2]*1000,label=label)
    for pane in (ax,ai):pane.axvspan(4.005,6.005,color='#ffce71',alpha=.1);pane.grid(alpha=.4)
    ax.set(title='LTspice: wired-AND is different from push-pull contention',ylabel='Bus (V)',ylim=(-.2,4.5))
    ai.set(xlabel='Time (µs)',ylabel='Supply draw (mA)',xlim=(0,10));ax.legend(loc='upper right',fontsize=10)
    box(ax,'Two LOW sinks in parallel\nLOW remains valid in the open-drain model',(5,.0164),(.04,.94))
    box(ai,'Fault draws about 100 mA here\nIdealized drivers: no current limit',(5,100),(.66,.56))
    save(fig,'open-drain')

    fig,ax=plt.subplots(figsize=(10,6),layout='constrained')
    for name,label in [('ringing','20 Ω: underdamped'),('damped','63.25 Ω: critical damping')]:
        a=results['protocol-'+name];r=manifest['runs']['protocol-'+name]
        ax.plot(a[:,0]*1e9,a[:,1],label=f'{label}; min {r["minimum_V"]:.3f} V')
    ax.plot(a[:,0]*1e9,a[:,2],':',color='#aebdcc',label='Source: 3.3 → 0 V in 2 ns')
    ax.axhspan(-1.6,0,color='#ffce71',alpha=.08);ax.axhline(0,color='#aebdcc',lw=.6)
    r=manifest['runs']['protocol-ringing']
    box(ax,'Below ground without opposing drivers\nNo clamp diode is included in this model',
        (r['minimum_time_s']*1e9,r['minimum_V']),(.43,.88))
    ax.set(title='LTspice: stored energy produces negative undershoot',xlabel='Time (ns)',ylabel='Voltage (V)',xlim=(35,120),ylim=(-1.6,3.8))
    ax.grid(alpha=.4);ax.legend(loc='lower right',fontsize=10);save(fig,'undershoot')

    fig,ax=plt.subplots(figsize=(10,6),layout='constrained');a=results['protocol-reference']
    for i,label in enumerate(['Pin relative to local ground','Reference rises by +1 V','Displayed: pin − reference'],1):
        ax.plot(a[:,0]*1e9,a[:,i],label=label)
    ax.axvspan(65,85,color='#ffce71',alpha=.1)
    box(ax,'Pin is 0 V locally; displayed value is −1 V\nThe reference disturbance is imposed, not extracted',(75,-1),(.32,.79))
    ax.set(title='LTspice: a wrong reference can also display −1 V',xlabel='Time (ns)',ylabel='Voltage (V)',xlim=(35,120),ylim=(-1.4,3.8))
    ax.grid(alpha=.4);ax.legend(loc='upper right',fontsize=10);save(fig,'reference')

    fig,ax=plt.subplots(figsize=(10,6),layout='constrained');a=results['protocol-released']
    for i,label in enumerate(['1 TΩ: almost floating','100 kΩ pulldown: τ ≈ 10 µs','10 kΩ pulldown: τ ≈ 1 µs'],1):
        ax.plot(a[:,0]*1e6,a[:,i],label=label)
    ax.axvspan(2.005,30,color='#6ee7ff',alpha=.04)
    box(ax,'Same Hi-Z state, three different voltages\nBias and stored charge decide what is observed',(8,1.81),(.39,.57))
    ax.set(title='LTspice: Hi-Z is an output condition, not a third voltage',xlabel='Time (µs)',ylabel='Bus (V)',xlim=(0,30),ylim=(-.1,4.3))
    ax.grid(alpha=.4);ax.legend(loc='upper right',fontsize=10);save(fig,'released')
    (DATA/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({name:{k:v for k,v in r.items() if k in ('plateau_V','high_driver_A','minimum_V','single_sink_V','two_sink_V','voltage_convergence_V')} for name,r in manifest['runs'].items()},indent=2))


if __name__=='__main__':
    main()
