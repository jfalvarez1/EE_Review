"""Build native LTspice schematics for two retained reference runs.

ASCII symbols/directives only; all parts use the stock LTspice library.
Pin positions follow the installed symbol definitions. Run --verify EXE to
netlist and simulate the drawings, then compare against the published CSV.
"""
import argparse
import csv
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/examples'
WORK = ROOT / '_audit/ltspice-pdn'
OPTIONS = '.options plotwinsize=0 numdgt=15 reltol=1e-6 vntol=1e-8 abstol=1e-10'


class Sheet:
    def __init__(self, title):
        self.lines = ['Version 4', 'SHEET 1 1700 1050']
        self.text(48, 16, title, size=3)

    def wire(self, x, y, xx, yy):
        self.lines.append(f'WIRE {x} {y} {xx} {yy}')

    def flag(self, x, y, name):
        self.lines.append(f'FLAG {x} {y} {name}')

    def text(self, x, y, text, size=2, directive=False):
        self.lines.append(f'TEXT {x} {y} Left {size} {"!" if directive else ";"}{text}')

    def part(self, symbol, name, value, x, y, rotation='R0', extra=None):
        self.lines.append(f'SYMBOL {symbol} {x} {y} {rotation}')
        if rotation == 'R90':
            self.lines += ['WINDOW 0 0 32 VBottom 2', 'WINDOW 3 32 32 VTop 2']
        self.lines += [f'SYMATTR InstName {name}', f'SYMATTR Value {value}']
        if extra:
            self.lines.append('SYMATTR SpiceLine '+extra)

    def branch(self, x, start, names, cap):
        r, l, c = names
        self.wire(x, start, x, 272)
        self.part('res', r, '0.01', x-16, 256)
        self.wire(x, 352, x, 416)
        self.part('ind', l, '1n', x-16, 400, extra='Rser=0')
        self.wire(x, 496, x, 560)
        self.part('cap', c, cap, x-16, 560, extra='Rser=0')
        self.wire(x, 624, x, 672)
        self.flag(x, 672, '0')

    def save(self, name):
        (OUT/(name+'.asc')).write_text('\n'.join(self.lines)+'\n', encoding='ascii')


def build():
    s=Sheet('Capacitor bank B - AC impedance at port')
    s.text(48, 80, '10 / 1 / 0.1 uF; each branch: 10 mOhm ESR + 1 nH mounted inductance')
    s.part('voltage','VAC','AC 1',96,256)
    s.wire(96,192,96,272);s.wire(96,352,96,400);s.flag(96,400,'0')
    s.wire(96,192,416,192);s.wire(416,192,736,192);s.wire(736,192,1056,192)
    s.flag(96,192,'port')
    for i,(x,c) in enumerate([(416,'10u'),(736,'1u'),(1056,'0.1u')],1):
        s.branch(x,192,(f'R{i}',f'L{i}',f'C{i}'),c)
    s.text(48,752,'.ac dec 200 1k 100meg',directive=True)
    s.text(48,800,'.save V(port) I(VAC)',directive=True)
    s.text(48,848,OPTIONS,directive=True)
    s.text(48,912,'Plot mag(-V(port)/I(VAC)) in ohms. No regulator, PCB extraction or vendor capacitor model.')
    s.save('pdn-bank-b-native')

    s=Sheet('Load-local capacitor experiment - 10 uF reference case')
    s.text(48,80,'Fixed 1 V source; 4 A load pulse; 100 ns smooth edges; Lpath = 10 nH')
    s.part('voltage','VREG','1',96,256)
    s.wire(96,192,96,272);s.wire(96,352,96,400);s.flag(96,400,'0');s.flag(96,192,'src')
    s.wire(96,192,256,192);s.part('res','Rreg','0.005',352,176,'R90')
    s.wire(336,192,496,192);s.flag(496,192,'supply')
    s.branch(496,192,('Rb','Lb','Cb'),'100u')
    s.wire(496,192,704,192);s.part('res','Rpath','0.005',800,176,'R90')
    s.wire(784,192,880,192);s.part('ind','Lpath','10n',976,176,'R90',extra='Rser=0')
    s.wire(960,192,1120,192);s.flag(1120,192,'load')
    s.branch(1120,192,('Rc','Lc','Clocal'),'10u')
    s.wire(1120,192,1408,192);s.wire(1408,192,1408,272)
    s.part('bi','BILOAD','I=loadstep(time)',1408,272)
    s.wire(1408,352,1408,400);s.flag(1408,400,'0')
    s.text(1300,464,'Current sink: 0 -> 4 A at 2 us')
    s.text(1300,512,'4 -> 0 A at 12 us')
    s.text(48,752,'.tran 0 30u 0 5n',directive=True)
    s.text(48,800,'.save V(load) V(supply) I(BILOAD)',directive=True)
    s.text(48,848,OPTIONS,directive=True)
    s.text(48,896,'.func edge(t,t0) if(t<t0,0,if(t<t0+100n,(1-cos(pi*(t-t0)/100n))/2,1))',directive=True)
    s.text(48,944,'.func loadstep(t) 4*(edge(t,2u)-edge(t,12u))',directive=True)
    s.text(48,1008,'Passive source/path model: no active control loop. Change Clocal to reproduce 1u / 10u / 100u cases.')
    s.save('pdn-local-10u-native')

    ac=['[AC Analysis]','{','   Npanes: 1','   {',
        '      traces: 1 {524290,0,"mag(-V(port)/I(VAC))"}',
        "      X: (' ',0,1000,0,100000000)",
        "      Y[0]: (' ',0,0.001,1,100)",
        "      Y[1]: (' ',0,0,30,180)",
        '      Log: 1 1 0','      GridStyle: 1','      PltMag: 1','      PltPhi: 0 0','   }','}']
    tran=['[Transient Analysis]','{','   Npanes: 2','   {',
          '      traces: 2 {524290,0,"V(load)"} {524291,0,"V(supply)"}',
          "      X: ('u',0,0,0.000005,0.00003)",
          "      Y[0]: (' ',0,0.85,0.05,1.1)",
          "      Y[1]: (' ',0,0,1,4)",'      Log: 0 0 0','      GridStyle: 1','   }','   {',
          '      traces: 1 {34603012,0,"I(BILOAD)"}',
          "      X: ('u',0,0,0.000005,0.00003)",
          "      Y[0]: (' ',0,0,1,5)",
          "      Y[1]: (' ',0,0,1,5)",
          "      Amps: (' ',0,0,0,0,1,5)",
          '      Log: 0 0 0','      GridStyle: 1','   }','}']
    for name,lines in [('pdn-bank-b-native',ac),('pdn-local-10u-native',tran)]:
        (OUT/(name+'.plt')).write_text('\n'.join(lines)+'\n',encoding='ascii')


def verify(exe):
    import numpy as np
    spec=importlib.util.spec_from_file_location('pdn',ROOT/'tools/run-pdn-ltspice.py')
    pdn=importlib.util.module_from_spec(spec);spec.loader.exec_module(pdn)
    checks={}
    for name,reference in [('pdn-bank-b-native','pdn-bank-b'),('pdn-local-10u-native','pdn-local-10u')]:
        source=OUT/(name+'.asc');work=WORK/source.name
        shutil.copyfile(source,work);shutil.copyfile(source.with_suffix('.plt'),work.with_suffix('.plt'))
        subprocess.run([exe,'-b','-ascii',str(work)],check=True,timeout=60)
        net=work.with_suffix('.net').read_text(encoding='utf-8-sig')
        assert 'NC_' not in net,net
        vars,rows=pdn.read_raw(work.with_suffix('.raw'))
        data=np.array(list(csv.reader((ROOT/'docs/data/pdn'/(reference+'.csv')).open()))[1:],dtype=float)
        if 'bank' in name:
            z=np.array([-r[vars.index('v(port)')]/r[vars.index('i(vac)')] for r in rows])
            error=float(np.max(np.abs(z-(data[:,1]+1j*data[:,2]))/data[:,3]))
            assert error<1e-9,error
            kind='max_relative_complex_error'
        else:
            time=np.array([r[0].real for r in rows]);volts=np.array([r[vars.index('v(load)')].real for r in rows])
            error=float(np.max(np.abs(data[:,1]-np.interp(data[:,0],time,volts))))
            assert error<.002,error
            kind='max_interpolated_voltage_difference_V'
        checks[name]={'reference':reference,kind:error,'asc_sha256':hashlib.sha256(source.read_bytes().replace(b'\r\n',b'\n')).hexdigest(),
                      'simulator':work.with_suffix('.log').read_text(encoding='utf-8-sig').splitlines()[0]}
    (ROOT/'docs/data/pdn/native-checks.json').write_text(json.dumps(checks,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(checks,indent=2))


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--verify');args=parser.parse_args()
    build()
    if args.verify:
        verify(args.verify)
