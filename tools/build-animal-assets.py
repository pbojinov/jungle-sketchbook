from pathlib import Path
import json,cv2,numpy as np,subprocess,xml.etree.ElementTree as ET
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
import sys
sys.path.insert(0, str(ROOT))
from scanning.registration import template_svg
animals=['elephant','giraffe','lion','monkey','tiger','zebra']
emojis=dict(zip(animals,['🐘','🦒','🦁','🐒','🐯','🦓']))
colors={'elephant':('#adbacb',{2:'#c6b8cc'}),'giraffe':('#efc875',{13:'#fff0c9',21:'#b37a47',25:'#b37a47',29:'#b37a47',32:'#b37a47',34:'#b37a47',36:'#b37a47',39:'#b37a47',41:'#b37a47',45:'#876145',46:'#876145',47:'#876145'}),'lion':('#e2aa53',{1:'#ad6737',10:'#f9d480',26:'#ffefca',16:'#ad6737',9:'#ecc99e',14:'#ecc99e'}),'monkey':('#a57c57',{4:'#f0d1a2',5:'#deb48b',8:'#deb48b',20:'#efd2ad',23:'#efd2ad',25:'#efd2ad'}),'tiger':('#e9a553',{36:'#fff0d3',44:'#fff0d3',4:'#ead0b0',10:'#ead0b0'}),'zebra':('#f8f3e8',{1:'#ead5d0',45:'#eddfce'})}
feet={
'elephant':[[250,630,175,760,58],[350,650,347,780,46],[445,651,515,783,58]],
'giraffe':[[303,655,159,889,42],[379,671,409,911,42],[494,666,624,907,50]],
'lion':[[276,704,164,858,52],[382,705,397,851,42],[452,676,604,862,60]],
'monkey':[[313,670,207,799,48],[425,696,430,816,45],[489,639,652,803,56]],
'tiger':[[254,672,167,818,48],[354,682,344,824,44],[468,672,572,842,62]],
'zebra':[[300,620,191,809,44],[356,638,393,809,38],[452,637,530,855,46],[553,604,688,809,42]],
}
manifest={}
for species in animals:
 folder=ROOT/'public/animals'/species
 data=json.loads((folder/'shape.json').read_text());data.update(emoji=emojis[species],version='2026-09-artwork',facing=1,feet=feet[species])
 data['displayScale']={'giraffe':.43,'elephant':.50,'lion':.43,'monkey':.42,'tiger':.43,'zebra':.43}[species]
 (folder/'shape.json').write_text(json.dumps(data))
 # Shared source geometry usable by browser and Node validation.
 (folder/'shape.js').write_text('(function(root){const shape='+json.dumps(data)+';if(typeof module==="object"&&module.exports)module.exports=shape;else{root.AnimalShapes=root.AnimalShapes||{};root.AnimalShapes.'+species+'=shape;}})(globalThis);\n')
 def inner(name):
  s=(folder/name).read_text();return s[s.index('<g'):s.rindex('</svg>')]
 ink=inner('ink.svg');mask=inner('mask.svg')
 template=template_svg(species, ink)
 (folder/'template.svg').write_text(template)
 img=cv2.imread(str(folder/'source-preview.png'),cv2.IMREAD_UNCHANGED)
 white=((img[:,:,0]>200)&(img[:,:,3]>0)).astype('uint8');_,labels,_,_=cv2.connectedComponentsWithStats(white)
 base,regions=colors[species];sample=mask.replace('fill="white"',f'fill="{base}"')
 for label,color in regions.items():
  region=(labels==label).astype('uint8')*255
  Image.fromarray(255-region).convert('1').save('/tmp/jungle-pdf-review/region.pbm')
  subprocess.run(['potrace','/tmp/jungle-pdf-review/region.pbm','-s','--flat','-o','/tmp/jungle-pdf-review/region.svg'],check=True)
  t=ET.parse('/tmp/jungle-pdf-review/region.svg');path=' '.join(e.attrib['d'] for e in t.findall('.//{http://www.w3.org/2000/svg}path'))
  sample+=f'<g transform="translate(0 1087) scale(.05 -.05)" fill="{color}"><path d="{path}"/></g>'
 (folder/'sample.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="840" height="1087" viewBox="0 0 840 1087">{sample}{ink}</svg>')
 manifest[species]={'emoji':emojis[species],'version':data['version']}
(ROOT/'public/animals/catalog.json').write_text(json.dumps(manifest,indent=2)+'\n')
