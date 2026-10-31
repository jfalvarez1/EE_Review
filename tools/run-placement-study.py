"""Extract dimensioned copper paths with FastHenry and simulate them in LTspice.

This is an experiment runner, not bundled solver source. FastHenry runs in WSL;
LTspice runs on Windows. All work directories must be outside the course repo.
See docs/PLACEMENT_SIMULATION.md for the model and reproduction commands.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import re
import subprocess

import numpy as np
from scipy.optimize import nnls
from scipy.integrate import solve_ivp

COPPER = 5.8e7
CASES = {
    'short': dict(title='Short top-side pair', power=[[0,0,0],[2,0,0]], ground=[[0,1,0],[2,1,0]], width_p=.4, width_g=.4),
    'detour': dict(title='Same capacitor, return detour', power=[[0,0,0],[2,0,0]], ground=[[0,1,0],[0,4,0],[4,4,0],[4,1,0],[2,1,0]], width_p=.4, width_g=.4),
    'underside': dict(title='Underside, paired through connections', power=[[0,0,0],[0,0,-1],[.6,0,-1]], ground=[[0,1,0],[0,1,-1],[.6,1,-1]], width_p=.4, width_g=.4),
    'neck': dict(title='6 mm feed with a narrow power neck', power=[[0,0,0],[6,0,0]], ground=[[0,1,0],[6,1,0]], width_p=.12, width_g=.8),
    'wide': dict(title='6 mm feed, wider power control', power=[[0,0,0],[6,0,0]], ground=[[0,1,0],[6,1,0]], width_p=.8, width_g=.8),
}
MESHES = {'coarse': (7,3), 'medium': (13,5), 'fine': (21,7)}


def digest(file):
    return hashlib.sha256(Path(file).read_bytes()).hexdigest()


def write_json(file, value):
    Path(file).write_text(json.dumps(value, indent=2)+'\n', encoding='utf-8')


def geometry(case, mesh):
    """Two isolated conductors; Ipower=+I and Iground=-I define loop impedance.

    Vertical connections are explicit square hollow copper shells, represented
    by four wall bars joined ideally at each end. They are not round PCB drills.
    """
    nw, nh = MESHES[mesh]
    lines = ['* Capacitor connection coupon: dimensions mm, no reference plane',
             '.units mm', f'.default sigma={COPPER/1000:g} nhinc={nh} nwinc={nw} rh=1.3 rw=1.3']
    nodes, segments, equivalents = [], [], []
    def node(p):
        name = f'N{len(nodes)}'
        nodes.append((name, list(map(float,p))))
        lines.append(name+' '+' '.join(f'{k}={v:.12g}' for k,v in zip('xyz',p)))
        return name
    def segment(a,b,width,height,wx=None):
        extra = '' if wx is None else ' '+' '.join(f'w{k}={v}' for k,v in zip('xyz',wx))
        lines.append(f'E{len(segments)} {a} {b} w={width:g} h={height:g}{extra}')
        segments.append(dict(a=a,b=b,width_mm=width,height_mm=height))
    ports = []
    resistance = 0
    for net,width in [('power',case['width_p']),('ground',case['width_g'])]:
        points = [np.array(p,dtype=float) for p in case[net]]
        current = node(points[0]); first = current
        for p,q in zip(points,points[1:]):
            length = float(np.linalg.norm(q-p))
            assert np.count_nonzero(q-p) == 1
            if q[2] != p[2]:
                end = node(q)
                # Square shell: outer 0.25 mm, inner 0.20 mm, wall 25 um.
                for offset,w,h,direction in [([0,.1125,0],.25,.025,[1,0,0]),
                                              ([0,-.1125,0],.25,.025,[1,0,0]),
                                              ([.1125,0,0],.20,.025,[0,1,0]),
                                              ([-.1125,0,0],.20,.025,[0,1,0])]:
                    a=node(p+offset); b=node(q+offset)
                    segment(a,b,w,h,direction)
                    equivalents.extend([(current,a),(end,b)])
                resistance += length*1e3/(COPPER*(.25**2-.20**2))
                current=end
            else:
                count=math.ceil(length/.5)
                for i in range(1,count+1):
                    end=node(p+(q-p)*i/count)
                    segment(current,end,width,.035)
                    current=end
                resistance += length*1e3/(COPPER*width*.035)
        ports.append((first,current))
    lines += [f'.equiv {a} {b}' for a,b in equivalents]
    lines += [f'.external {a} {b}' for a,b in ports]
    lines += ['.freq fmin=1e3 fmax=1e8 ndec=8','.end','']
    return '\n'.join(lines), dict(**case,nodes=nodes,segments=segments,ports=ports,
                                  dc_resistance_ohm=resistance,mesh=[nw,nh])


def wsl_path(path):
    p=Path(path).resolve()
    return '/mnt/'+p.drive[0].lower()+p.as_posix()[2:]


def extract(args, name, mesh):
    out=args.output/name/mesh
    out.mkdir(parents=True,exist_ok=True)
    deck, model=geometry(CASES[name],mesh)
    (out/'geometry.inp').write_text(deck,encoding='ascii')
    write_json(out/'geometry.json',model)
    write_json(out/'provenance.json',dict(generator_sha256=digest(__file__),solver_options=['-m','direct','-a','off','-p','seg','-t','1e-8','-c','1000']))
    # Pass cwd and input as arguments, not shell-interpolated source.
    command=['C:/Windows/System32/wsl.exe','-d',args.distro,'--cd',wsl_path(out),
             '--exec',args.fasthenry,'-m','direct','-a','off','-p','seg','-t','1e-8','-c','1000','geometry.inp']
    result=subprocess.run(command,capture_output=True,timeout=900)
    (out/'solver.log').write_bytes(result.stdout+result.stderr)
    if result.returncode:
        raise RuntimeError((out/'solver.log').read_text(errors='replace')[-4000:])
    assert b'Convergence not reached' not in result.stdout+result.stderr, 'Unconverged field solve'
    text=(out/'Zc.mat').read_text()
    blocks=re.findall(r'Impedance matrix for frequency\s*=\s*([\d.eE+-]+).*?\n([^\n]+)\n([^\n]+)',text)
    rows=[]
    for frequency,*matrix in blocks:
        z=[]
        for line in matrix:
            values=re.findall(r'([+-]?[\d.]+(?:[eE][+-]?\d+)?)\s*([+-])\s*([\d.]+(?:[eE][+-]?\d+)?)j',line)
            z.extend(complex(float(a),float(c)*(1 if b=='+' else -1)) for a,b,c in values)
        assert len(z)==4, matrix
        loop=z[0]+z[3]-z[1]-z[2]
        rows.append([float(frequency),loop.real,loop.imag,*[v for c in z for v in (c.real,c.imag)]])
    data=np.array(rows)
    assert data.shape==(41,11), (data.shape,text[:500])
    np.savetxt(out/'extraction.csv',data,delimiter=',',header='frequency_Hz,Rloop_ohm,Xloop_ohm,Z11_re,Z11_im,Z12_re,Z12_im,Z21_re,Z21_im,Z22_re,Z22_im',comments='',fmt='%.12g')
    dc_error=abs(data[0,1]/model['dc_resistance_ohm']-1)
    assert dc_error<.002, ('DC length/area check',dc_error)
    assert np.min(data[:,1])>0
    print(name,mesh,'Rdc(mOhm)',data[0,1]*1000,'L@1MHz(nH)',np.interp(1e6,data[:,0],data[:,2]/(2*np.pi*data[:,0]))*1e9,flush=True)
    return data,model


def fit(data, dc):
    """Positive Foster RL fit: Rdc + sLinf + sum(Rk*s/(s+pk)).

    Every fitted term is passive. Validate at independently extracted samples;
    this is model reduction, not replacement of field data with a fixed L.
    """
    frequency=data[:,0]; s=2j*np.pi*frequency
    z=data[:,1]+1j*data[:,2]
    poles=2*np.pi*np.logspace(3,10,24)
    basis=np.column_stack([s*1e-9,*[s/(s+p)*.01 for p in poles]])
    scale=np.abs(z)
    matrix=np.vstack([basis.real/scale[:,None],basis.imag/scale[:,None]])
    target=np.r_[(z.real-dc)/scale,z.imag/scale]
    # Even field samples train the model; odd samples are held out for checking.
    train=np.arange(len(z))%2==0
    coef,_=nnls(matrix[np.r_[train,train]],target[np.r_[train,train]],maxiter=10000)
    # Negligible fitted branches can make the SPICE matrix ill-conditioned.
    # Drop only <1 micro-ohm terms, then recheck the resulting fit below.
    coef[1:][coef[1:]<1e-4]=0
    fitted=dc+basis@coef
    error=np.abs(fitted-z)/np.abs(z)
    assert max(error)<.01, ('Foster fit',max(error))
    return dict(rdc=dc,linf=coef[0]*1e-9,branches=[dict(r=c*.01,l=c*.01/p,pole_hz=p/(2*np.pi)) for c,p in zip(coef[1:],poles) if c>1e-9],max_complex_relative_error=float(max(error))),fitted


def read_raw(file):
    raw=Path(file).read_bytes()
    text=raw.decode('utf-16-le' if b'\0' in raw[:30] else 'utf-8-sig').replace('\r\n','\n')
    head,body=text.split('Values:\n')
    names=[line.split()[1].lower() for line in head.split('Variables:\n')[1].splitlines() if line.strip()]
    rows=[]; row=[]
    for line in body.splitlines():
        if not line.strip(): continue
        token=line.split()[-1]
        row.append(complex(*map(float,token.split(','))) if ',' in token else complex(float(token),0))
        if len(row)==len(names): rows.append(row); row=[]
    assert not row and rows
    return names,np.array(rows)


def network(fit_model):
    lines=['.subckt COPPER p m',f'Rdc p n0 {fit_model["rdc"]:.15g}',f'Linf n0 n1 {fit_model["linf"]:.15g} Rser=0']
    for i,b in enumerate(fit_model['branches']):
        last='m' if i==len(fit_model['branches'])-1 else f'n{i+2}'
        lines.extend([f'Rskin{i} n{i+1} {last} {b["r"]:.15g}',f'Lskin{i} n{i+1} {last} {b["l"]:.15g} Rser=0'])
    assert fit_model['branches']
    return lines+['.ends COPPER']


def spice(args,name,model,kind,step_ns=2):
    out=args.output/name/'circuit';out.mkdir(exist_ok=True)
    tag=kind if kind=='ac' else f'tran-{step_ns:g}ns'
    # Whole copper loop is collapsed into one passive series branch; mutual
    # coupling inside that loop was included in the extraction. Source wiring
    # is an explicit common Thevenin assumption, not part of the field model.
    lines=['* Geometry-derived copper loop + explicit identical capacitor/source',
           'VREG source 0 1','Rsource source rs 0.02','Lsource rs load 20n Rser=0',
           'Xroute load cap COPPER','RESR cap esl 0.01','LESL esl cc 0.3n Rser=0',
           'CLOCAL cc 0 10u Rser=0',*network(model)]
    if kind=='ac':
        lines+=['IAC 0 load AC 1','.ac dec 200 1k 100meg','.save V(load)']
    else:
        lines+=['.func edge(t,t0) {if(t<t0,0,if(t<t0+100n,(1-cos(pi*(t-t0)/100n))/2,1))}',
                'BLOAD load 0 I=2*(edge(time,2u)-edge(time,7u))',
                f'.tran 0 12u 0 {step_ns:g}n','.save V(load) I(BLOAD)']
    lines+=['.options plotwinsize=0 numdgt=15 reltol=1e-7 vntol=1e-9 abstol=1e-11 method=gear','.end','']
    deck=out/(tag+'.cir');deck.write_text('\n'.join(lines),encoding='ascii')
    result=subprocess.run([args.ltspice,'-b','-ascii',str(deck)],capture_output=True,timeout=120,creationflags=0x08000000)
    assert result.returncode==0, result.stderr
    names,raw=read_raw(deck.with_suffix('.raw'))
    if kind=='ac':
        z=raw[:,names.index('v(load)')]; data=np.column_stack([raw[:,0].real,z.real,z.imag,abs(z)])
        header='frequency_Hz,Zreal_ohm,Zimag_ohm,Zmag_ohm'
    else:
        data=np.column_stack([raw[:,0].real,raw[:,names.index('v(load)')].real,raw[:,names.index('i(bload)')].real])
        header='time_s,Vload_V,Iload_A'
    np.savetxt(out/(tag+'.csv'),data,delimiter=',',header=header,comments='',fmt='%.12g')
    return data,dict(deck_sha256=digest(deck),raw_sha256=digest(deck.with_suffix('.raw')),points=len(data))


def check_transient(model, samples):
    """Independent KCL/KVL state equations, integrated with SciPy Radau."""
    resistors=np.array([b['r'] for b in model['branches']])
    inductors=np.array([b['l'] for b in model['branches']])
    total_l=20e-9+model['linf']+.3e-9
    def load(t):
        current=0.;derivative=0.
        for start,sign in [(2e-6,1),(7e-6,-1)]:
            u=(t-start)/100e-9
            if u>=1:current+=2*sign
            elif u>0:
                current+=sign*(1-np.cos(np.pi*u))
                derivative+=sign*np.pi*np.sin(np.pi*u)/100e-9
        return current,derivative
    def equations(t,y):
        vc,i=y[:2];current,rate=load(t)
        branch=resistors*(i-y[2:])
        di=(1-vc-(.02+model['rdc']+.01)*i-.02*current-branch.sum()-20e-9*rate)/total_l
        return np.r_[i/10e-6,di,branch/inductors]
    times=np.linspace(0,12e-6,3001)
    state=solve_ivp(equations,(0,12e-6),np.r_[1.,0.,np.zeros(len(resistors))],
                    method='Radau',rtol=1e-8,atol=1e-10,max_step=10e-9,t_eval=times)
    assert state.success
    voltage=[]
    for t,y in zip(times,state.y.T):
        current,rate=load(t)
        voltage.append(1-.02*(y[1]+current)-20e-9*(equations(t,y)[1]+rate))
    difference=float(max(abs(np.array(voltage)-np.interp(times,samples[:,0],samples[:,1]))))
    assert difference<.001, ('independent transient equations',difference)
    return difference


def main():
    p=argparse.ArgumentParser();p.add_argument('--output',type=Path,required=True)
    p.add_argument('--fasthenry',default='/home/zerav/pcb-sim/fasthenry-3.0wr/bin/fasthenry')
    p.add_argument('--distro',default='Ubuntu');p.add_argument('--ltspice',required=True)
    p.add_argument('--case',choices=CASES);p.add_argument('--mesh',choices=MESHES)
    p.add_argument('--reuse-extraction',action='store_true')
    args=p.parse_args();args.output=args.output.resolve()
    if args.output.is_relative_to(Path(__file__).resolve().parents[1]):
        p.error('Keep raw solver work outside EE_Review')
    args.output.mkdir(parents=True,exist_ok=True)
    for name in [args.case] if args.case else CASES:
        data={}; models={}
        for mesh in [args.mesh] if args.mesh else MESHES:
            path=args.output/name/mesh
            if args.reuse_extraction and (path/'extraction.csv').exists():
                expected,_=geometry(CASES[name],mesh)
                assert (path/'geometry.inp').read_text()==expected, 'Changed geometry; use a new output directory'
                log=(path/'solver.log').read_text()
                assert 'Convergence not reached' not in log and 'Matrix vector product method: DIRECT' in log
                data[mesh]=np.loadtxt(path/'extraction.csv',delimiter=',',skiprows=1)
                models[mesh]=json.loads((path/'geometry.json').read_text())
            else: data[mesh],models[mesh]=extract(args,name,mesh)
        if args.mesh: continue
        z=lambda a:a[:,1]+1j*a[:,2]
        mesh_error=float(max(abs(z(data['medium'])-z(data['fine']))/abs(z(data['fine']))))
        assert mesh_error<.03, ('mesh check',name,mesh_error)
        fitted,approx=fit(data['fine'],models['fine']['dc_resistance_ohm'])
        write_json(args.output/name/'fit.json',fitted)
        ac,ac_record=spice(args,name,fitted,'ac')
        tran,tran_record=spice(args,name,fitted,'tran',2)
        fine,fine_record=spice(args,name,fitted,'tran',1)
        timestep_error=float(max(abs(tran[:,1]-np.interp(tran[:,0],fine[:,0],fine[:,1]))))
        assert timestep_error<.001, ('timestep check',name,timestep_error)
        ode_error=check_transient(fitted,fine)
        # Independent impedance assembled from field data and common circuit.
        f=data['fine'][:,0];s=2j*np.pi*f
        expected=1/(1/(.02+s*20e-9)+1/(z(data['fine'])+.01+s*.3e-9+1/(s*10e-6)))
        simulated=np.interp(np.log(f),np.log(ac[:,0]),ac[:,1])+1j*np.interp(np.log(f),np.log(ac[:,0]),ac[:,2])
        port_error=float(max(abs(simulated-expected)/abs(expected)))
        assert port_error<.015, ('field-to-SPICE port check',name,port_error)
        minimum=int(np.argmin(fine[:,1]));maximum=int(np.argmax(fine[:,1]))
        summary=dict(case=name,title=CASES[name]['title'],mesh_max_complex_relative_change=mesh_error,
                     fit=fitted,timestep_max_difference_V=timestep_error,port_max_complex_relative_error=port_error,
                     independent_transient_max_difference_V=ode_error,voltage_at_end_of_rise_V=float(np.interp(2.1e-6,fine[:,0],fine[:,1])),
                     minimum_V=float(fine[minimum,1]),minimum_time_s=float(fine[minimum,0]),
                     maximum_V=float(fine[maximum,1]),maximum_time_s=float(fine[maximum,0]),
                     z_at_10MHz_ohm=float(np.interp(1e7,ac[:,0],ac[:,3])),runs=dict(ac=ac_record,tran=tran_record,fine=fine_record),generator_sha256=digest(__file__))
        write_json(args.output/name/'summary.json',summary)
        print('PASS',name,'min V',summary['minimum_V'],'mesh',mesh_error,'dt',timestep_error,flush=True)


if __name__=='__main__': main()
