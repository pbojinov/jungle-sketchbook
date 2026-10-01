from pathlib import Path
import cv2, numpy as np, subprocess, json, shutil, xml.etree.ElementTree as ET
from PIL import Image,ImageDraw
root=Path(__file__).resolve().parents[1]
src=root/'source-art'
Path('/tmp/jungle-pdf-review').mkdir(parents=True,exist_ok=True)
W,H=840,1087
board=Image.new('RGB',(1260,1088),'#dedede')
for i,p in enumerate(sorted(src.glob('*.pdf'))):
 species=p.stem
 out=root/'public/animals'/species;out.mkdir(parents=True,exist_ok=True)
 subprocess.run(['pdftoppm','-scale-to-x','1680','-scale-to-y','2174','-singlefile','-png',str(p),f'/tmp/jungle-pdf-review/{species}-full'],check=True)
 gray=cv2.imread(f'/tmp/jungle-pdf-review/{species}-full.png',0)
 ink=(gray<150).astype('uint8')*255
 # Reconnect scan antialias gaps for silhouette detection, retaining original ink separately.
 closed=cv2.morphologyEx(ink,cv2.MORPH_CLOSE,np.ones((3,3),np.uint8))
 contours,_=cv2.findContours(closed,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
 contour=max(contours,key=cv2.contourArea)
 silhouette=np.zeros_like(ink);cv2.drawContours(silhouette,[contour],-1,255,-1)
 # Keep all facial details within the main animal and discard isolated printing artifacts.
 padded=cv2.dilate(silhouette,np.ones((3,3),np.uint8))
 clean=cv2.bitwise_and(ink,padded)
 for name,pixels in [('ink',clean),('mask',silhouette)]:
  pbm=Path(f'/tmp/jungle-pdf-review/{species}-{name}.pbm')
  Image.fromarray(255-pixels).convert('1').save(pbm)
  subprocess.run(['potrace',str(pbm),'-s','--flat','--turdsize','3','--opttolerance','0.2','-o',str(out/f'{name}.svg')],check=True)
  tree=ET.parse(out/f'{name}.svg'); ns={'s':'http://www.w3.org/2000/svg'}
  paths=' '.join(el.attrib['d'] for el in tree.findall('.//s:path',ns))
  # Potrace paths use 10x integer coordinates and an inverted Y axis.
  svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}"><g transform="translate(0 {H}) scale(.05 -.05)" fill="'+('black' if name=='ink' else 'white')+'" stroke="none"><path d="'+paths+'"/></g></svg>'
  (out/f'{name}.svg').write_text(svg)
  if name=='mask': maskpath=paths
 x,y,w,h=cv2.boundingRect(contour);bounds={'x':max(0,x//2-3),'y':max(0,y//2-3),'width':(w+1)//2+6,'height':(h+1)//2+6}
 manifest={'species':species,'page':{'width':W,'height':H},'bounds':bounds,'pathTransform':[.05,0,0,-.05,0,H],'maskPath':maskpath,'source':f'source-art/{species}.pdf'}
 (out/'shape.json').write_text(json.dumps(manifest))
 # Preview exact full-page trace input, with grid to place joints later.
 rgba=np.zeros((2174,1680,4),np.uint8);rgba[:,:,:3]=255-clean[:,:,None];rgba[:,:,3]=silhouette
 Image.fromarray(rgba).save(out/'source-preview.png')
 im=Image.fromarray(255-clean);im.thumbnail((420,544));board.paste(im,(i%3*420,i//3*544))
 print(species,bounds,flush=True)
board.save('/tmp/jungle-pdf-review/clean-contact.png')
