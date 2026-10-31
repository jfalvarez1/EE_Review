"""Create and simulate the native LTspice undershoot schematic against its CSV."""
import argparse
import csv
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
def load(name,file):
    spec=importlib.util.spec_from_file_location(name,ROOT/'tools'/file)
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module

native=load('native','build-pdn-native.py')
raw=load('raw','run-pdn-ltspice.py')
parser=argparse.ArgumentParser();parser.add_argument('--exe',required=True);args=parser.parse_args()
s=native.Sheet('Negative undershoot - an assumed RLC network, no I/O clamp')
s.text(48,80,'3.3 V -> 0 V in 2 ns; source resistance 20 ohms; loop L = 100 nH; pin C = 100 pF')
s.part('voltage','VIN','PWL(0 3.3 50n 3.3 52n 0)',96,256)
s.wire(96,192,96,272);s.wire(96,352,96,416);s.flag(96,416,'0');s.flag(96,192,'src')
s.wire(96,192,352,192);s.part('res','RS','20',448,176,'R90')
s.wire(432,192,608,192);s.part('ind','LP','100n',704,176,'R90',extra='Rser=0')
s.wire(688,192,960,192);s.flag(960,192,'pin');s.wire(960,192,960,288)
s.part('cap','CP','100p',944,288,extra='Rser=0');s.wire(960,352,960,416);s.flag(960,416,'0')
s.text(48,544,'.tran 0 180n 0 100p',directive=True)
s.text(48,592,'.save V(pin) V(src) I(LP)',directive=True)
s.text(48,640,'.options plotwinsize=0 numdgt=15 reltol=1e-6 vntol=1e-8 abstol=1e-11',directive=True)
s.text(48,720,'Change RS to 63.2455532034 ohms for the critical-damping comparison.')
s.text(48,768,'These parasitics are assumed, not extracted. This is not an IC absolute-maximum test.')
name='protocol-ringing-native';s.save(name)
out=ROOT/'docs/examples';work=ROOT/'_audit/ltspice-protocol'
plt=['[Transient Analysis]','{','   Npanes: 1','   {',
     '      traces: 2 {524290,0,"V(pin)"} {524291,0,"V(src)"}',
     "      X: ('n',0,0.000000035,0.00000001,0.00000012)",
     "      Y[0]: (' ',0,-1.5,0.5,3.5)","      Y[1]: (' ',0,0,1,4)",
     '      Log: 0 0 0','      GridStyle: 1','   }','}']
(out/(name+'.plt')).write_text('\n'.join(plt)+'\n',encoding='ascii')
source=out/(name+'.asc');target=work/source.name
shutil.copyfile(source,target)
subprocess.run([args.exe,'-b','-ascii',str(target)],check=True,timeout=60,creationflags=0x08000000)
net=target.with_suffix('.net').read_text(encoding='utf-8-sig');assert 'NC_' not in net
variables,rows=raw.read_raw(target.with_suffix('.raw'))
reference=np.array(list(csv.reader((ROOT/'docs/data/protocol/protocol-ringing.csv').open()))[1:],dtype=float)
t=np.array([r[0].real for r in rows]);y=np.array([r[variables.index('v(pin)')].real for r in rows])
error=float(np.max(abs(reference[:,1]-np.interp(reference[:,0],t,y))))
assert error<.001,error
record={'asc_sha256':hashlib.sha256(source.read_bytes().replace(b'\r\n',b'\n')).hexdigest(),
        'maximum_difference_from_csv_V':error,'reference':'protocol-ringing.csv',
        'simulator':target.with_suffix('.log').read_text(encoding='utf-8-sig').splitlines()[0]}
(ROOT/'docs/data/protocol/native-checks.json').write_text(json.dumps(record,indent=2)+'\n',encoding='utf-8')
print(json.dumps(record,indent=2))
