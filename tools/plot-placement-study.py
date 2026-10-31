"""Publish reviewed FastHenry/LTspice placement data and paired layout plots.

No solver is run here. Inputs are the completed run-placement-study.py directory.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import zipfile

import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'docs/data/placement-study'
FIGURES=ROOT/'assets/figures/placement-study'
SPEC=importlib.util.spec_from_file_location('placement',Path(__file__).with_name('run-placement-study.py'))
STUDY=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(STUDY)
COLORS={'short':'#6ee7ff','detour':'#ffb86c','underside':'#91e0ac','neck':'#ec9fd5','wide':'#bcbbff'}
BG='#101d29'; INK='#e3edf4'; GRID='#425568'
plt.rcParams.update({'font.size':12,'axes.facecolor':BG,'figure.facecolor':BG,
    'text.color':INK,'axes.labelcolor':INK,'xtick.color':INK,'ytick.color':INK,
    'axes.edgecolor':'#8b9eae','grid.color':GRID,'svg.fonttype':'none','svg.hashsalt':'placement-study'})


def read_csv(file):
    return np.loadtxt(file,delimiter=',',skiprows=1)


def save(fig,name,scratch):
    fig.savefig(FIGURES/(name+'.svg'),metadata={'Date':None},bbox_inches='tight')
    fig.savefig(scratch/(name+'.png'),dpi=130,bbox_inches='tight')
    plt.close(fig)


def draw_layout(name,case,scratch):
    fig=plt.figure(figsize=(5.7,5.3),layout='constrained')
    if name=='underside':
        axes=fig.subplots(2,1,gridspec_kw={'height_ratios':[1.2,1]}); ax=axes[0]
    else: ax=fig.subplots()
    for net,color,width in [('power','#f4b65f',case['width_p']),('ground','#6abcf3',case['width_g'])]:
        points=np.array(case[net],dtype=float); xy=points[:,:2]
        for p,q in zip(xy,xy[1:]):
            if np.array_equal(p,q):
                ax.add_patch(Rectangle((p[0]-.125,p[1]-.125),.25,.25,fill=False,ec=color,lw=2))
                continue
            lo=np.minimum(p,q);hi=np.maximum(p,q)
            if p[0]==q[0]: lo[0]-=width/2;hi[0]+=width/2
            else: lo[1]-=width/2;hi[1]+=width/2
            ax.add_patch(Rectangle(lo,*(hi-lo),fc=color,ec='none',alpha=.9))
        ax.scatter([xy[0,0],xy[-1,0]],[xy[0,1],xy[-1,1]],s=30,c=color,edgecolors=INK,zorder=5)
    x=case['power'][-1][0]
    ax.add_patch(Rectangle((x-.14,.2),.28,.6,fc='#465364',ec=INK,zorder=3))
    ax.plot([x,x],[0,.2],c=INK,lw=2);ax.plot([x,x],[.8,1],c=INK,lw=2)
    ax.text(x,1.65,'10 µF\ncomponent model',ha='center',va='top',fontsize=10,
            bbox=dict(fc=BG,ec='none',alpha=.9))
    ax.text(0,-.55,'Load port',ha='center',fontsize=11)
    maxx=max(p[0] for net in ['power','ground'] for p in case[net])
    maxy=max(p[1] for net in ['power','ground'] for p in case[net])
    ax.set(xlim=(-.7,maxx+.8),ylim=(max(maxy+.7,2.6),-1),xlabel='x (mm)',ylabel='y (mm)')
    ax.set_aspect('equal');ax.grid(alpha=.25);ax.set_axisbelow(True)
    ax.set_title('Top projection — modeled copper',fontsize=12,pad=13)
    if name=='underside':
        side=axes[1]
        side.plot([0,0,.6],[0,-1,-1],color='#f4b65f',lw=6,solid_capstyle='butt')
        side.scatter([0,.6],[0,-1],c=INK,s=20,zorder=5)
        side.set(xlim=(-.4,1),ylim=(-1.4,.3),xlabel='x (mm)',ylabel='z (mm)')
        side.set_aspect('equal');side.grid(alpha=.25)
        side.set_title('Side view of either leg: 1 mm depth',fontsize=11)
    fig.suptitle(case['title'],fontsize=14,wrap=True)
    fig.supxlabel(f'Strip widths: P {case["width_p"]:g} mm / G {case["width_g"]:g} mm; thickness 35 µm\nAmber: power  •  Blue: return  •  No reference plane',fontsize=10)
    save(fig,name+'-layout',scratch)


def draw_results(name,summary,ac,tran,base_ac,base_tran,scratch):
    fig,axes=plt.subplots(2,1,figsize=(7.5,6.2),layout='constrained')
    color=COLORS[name]
    a=axes[0]
    if name!='short':a.loglog(base_ac[:,0],base_ac[:,3]*1000,'--',c='#abb6c1',label='Short-pair reference',lw=1.5)
    a.loglog(ac[:,0],ac[:,3]*1000,c=color,label='This layout',lw=2)
    a.set(xlabel='Frequency (Hz)',ylabel='Load-port |Z| (mΩ)',xlim=(1e3,1e8),ylim=(5,11000))
    a.grid(which='both',alpha=.25)
    a.scatter([1e7],[summary['z_at_10MHz_ohm']*1000],c=color,s=32,zorder=5)
    a.text(.03,.96,f'10 MHz: {summary["z_at_10MHz_ohm"]*1000:.1f} mΩ',transform=a.transAxes,va='top',fontsize=11,
           bbox=dict(fc=BG,ec=color,pad=5))
    a.legend(loc='lower right',fontsize=10)
    a.set_title('LTspice AC with extracted copper model',fontsize=13)
    b=axes[1]
    b.axvspan(2,2.1,color='#ffce71',alpha=.18,label='100 ns load rise')
    b.axvspan(7,7.1,color='#6ee7ff',alpha=.15)
    if name!='short': b.plot(base_tran[:,0]*1e6,base_tran[:,1],'--',c='#abb6c1',lw=1.5)
    b.plot(tran[:,0]*1e6,tran[:,1],c=color,lw=2)
    b.axhline(.96,c='#abb6c1',ls=':',lw=1)
    b.set(xlabel='Time (µs)',ylabel='Voltage at load (V)',xlim=(0,12),ylim=(.7,1.22))
    b.grid(alpha=.25)
    b.scatter([summary['minimum_time_s']*1e6],[summary['minimum_V']],c=color,zorder=5)
    b.text(.98,.95,f'Min {summary["minimum_V"]:.4f} V\nPeak {summary["maximum_V"]:.4f} V',
           transform=b.transAxes,ha='right',va='top',fontsize=11,bbox=dict(fc=BG,ec=color,pad=5))
    fig.supxlabel('Load: 0 → 2 A at 2 µs; 2 → 0 A at 7 µs; each edge 100 ns\nDotted line: 0.96 V DC at 2 A (20 mΩ source)',fontsize=10)
    b.set_title('LTspice load pulse — shaded edges are viewing regions',fontsize=12)
    save(fig,name+'-results',scratch)


def main():
    p=argparse.ArgumentParser();p.add_argument('--input',type=Path,required=True);args=p.parse_args()
    source=args.input.resolve();scratch=source/'plots';scratch.mkdir(exist_ok=True)
    DATA.mkdir(parents=True,exist_ok=True);FIGURES.mkdir(parents=True,exist_ok=True)
    manifest=dict(model='FastHenry MQS copper extraction + positive Foster RL fit + LTspice passive PDN',
        field_solver='FastHenry 3.0wr mod 031424',source_url='https://www.wrcad.com/ftp/pub/fasthenry-3.0wr-031424.tar.gz',
        source_archive_sha256='6da40d0e31425bca85be46434b33ecc194205d705b47f4459d91568c9f4301ef',
        binary_sha256='d379c3541ea8d2759fd2311699442431fae142180c74ddc021470e34391be577',
        assumptions=dict(conductivity_S_m=STUDY.COPPER,copper_thickness_mm=.035,capacitor_F=10e-6,capacitor_ESR_ohm=.01,
                         capacitor_ESL_H=.3e-9,source_V=1,source_R_ohm=.02,source_L_H=20e-9,load_A=2,edge_s=100e-9),
        raw_header_note='Download raw files preserve all numerical samples; local paths in Title headers are replaced by <study>. Original and download hashes are both recorded.',
        cases={},files={})
    base_ac=read_csv(source/'short/circuit/ac.csv');base_tran=read_csv(source/'short/circuit/tran-1ns.csv')
    with zipfile.ZipFile(DATA/'inputs-and-raw-results.zip','w',zipfile.ZIP_DEFLATED) as archive:
        for name,case in STUDY.CASES.items():
            summary=json.loads((source/name/'summary.json').read_text())
            assert summary['mesh_max_complex_relative_change']<.03
            for run,tag in [('ac','ac'),('tran','tran-2ns'),('fine','tran-1ns')]:
                blob=(source/name/'circuit'/(tag+'.raw')).read_bytes()
                body=blob.decode('utf-16-le' if b'\0' in blob[:30] else 'utf-8-sig').replace(str(source),'<study>')
                summary['runs'][run]['raw_original_sha256']=summary['runs'][run].pop('raw_sha256')
                summary['runs'][run]['raw_download_sha256']=hashlib.sha256(body.encode('utf-8')).hexdigest()
            manifest['cases'][name]=summary
            ac=read_csv(source/name/'circuit/ac.csv');tran=read_csv(source/name/'circuit/tran-1ns.csv')
            for filename,target in [('ac.csv','ac'),('tran-1ns.csv','transient')]:
                shutil.copyfile(source/name/'circuit'/filename,DATA/f'{name}-{target}.csv')
            shutil.copyfile(source/name/'fine/extraction.csv',DATA/f'{name}-copper.csv')
            shutil.copyfile(source/name/'fine/geometry.json',DATA/f'{name}-geometry.json')
            for runfile in sorted((source/name).rglob('*')):
                if runfile.is_file() and runfile.suffix in {'.inp','.json','.mat','.csv','.cir','.raw','.log'}:
                    relative=runfile.relative_to(source).as_posix()
                    if runfile.name.endswith('.op.raw'):continue
                    if runfile.name=='summary.json':
                        archive.writestr(relative,json.dumps(summary,indent=2)+'\n')
                    elif runfile.suffix=='.raw':
                        blob=runfile.read_bytes()
                        body=blob.decode('utf-16-le' if b'\0' in blob[:30] else 'utf-8-sig').replace(str(source),'<study>')
                        archive.writestr(relative,body)
                    elif runfile.suffix=='.log':
                        body=runfile.read_text(encoding='utf-8-sig').replace(str(source),'<study>').replace('Host: juanputer','Host: <redacted>')
                        archive.writestr(relative,body)
                    else: archive.write(runfile,relative)
            draw_layout(name,case,scratch)
            draw_results(name,summary,ac,tran,base_ac,base_tran,scratch)
        for script in ['run-placement-study.py','plot-placement-study.py']:
            archive.write(ROOT/'tools'/script,'reproduce/'+script)
    # One view compares all curves using identical axes; the individual cards
    # retain the same short-pair reference to avoid misleading auto-scaling.
    fig,axes=plt.subplots(1,2,figsize=(12,4.5),layout='constrained')
    for name in STUDY.CASES:
        ac=read_csv(DATA/f'{name}-ac.csv');tran=read_csv(DATA/f'{name}-transient.csv')
        axes[0].loglog(ac[:,0],ac[:,3]*1000,c=COLORS[name],label=name)
        axes[1].plot(tran[:,0]*1e6,tran[:,1],c=COLORS[name],label=name)
    axes[0].set(xlabel='Frequency (Hz)',ylabel='Load-port |Z| (mΩ)',title='Same capacitor and source',ylim=(5,11000))
    axes[1].set(xlabel='Time (µs)',ylabel='Load voltage (V)',title='First 100 ns load rise and recovery',xlim=(1.95,3.5),ylim=(.7,1.03))
    axes[1].axvspan(2,2.1,color='#ffce71',alpha=.15)
    for ax in axes:ax.grid(which='both',alpha=.25);ax.legend(fontsize=10)
    save(fig,'comparison',scratch)
    manifest['simulator']=(source/'short/circuit/ac.log').read_text(encoding='utf-8-sig').splitlines()[0]
    for file in sorted([*DATA.glob('*'),*FIGURES.glob('*.svg')]):
        if file.name=='manifest.json':continue
        manifest['files'][file.relative_to(ROOT).as_posix()]=dict(bytes=file.stat().st_size,sha256=STUDY.digest(file))
    STUDY.write_json(DATA/'manifest.json',manifest)
    print(json.dumps({name:{k:v for k,v in m.items() if k in ['minimum_V','maximum_V','z_at_10MHz_ohm','mesh_max_complex_relative_change','timestep_max_difference_V']} for name,m in manifest['cases'].items()},indent=2))


if __name__=='__main__':main()
