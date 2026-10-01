"""Confidence and registration checks against rendered printouts and adverse inputs."""
from pathlib import Path
import sys
import cv2
import numpy as np
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scanning'))
from detector import Detector, PAGE, project_page
from registration import SPECIES, DICTIONARY, MARKER_SIZE, MARKER_POSITIONS

detector = Detector()
source_page = np.float32([[0,0],[839,0],[839,1086],[0,1086]])
photo_page = np.float32([[170,110],[920,165],[950,1290],[90,1240]])
transform = cv2.getPerspectiveTransform(source_page,photo_page)

def photographed_sheet(species, marks=True):
    reference = cv2.imread(str(ROOT/f'public/animals/{species}/source-preview.png'),cv2.IMREAD_UNCHANGED)
    reference = cv2.resize(reference,(840,1087),interpolation=cv2.INTER_AREA)
    page = reference[:,:,:3].copy()
    page[reference[:,:,3]<128] = 255
    if marks:
        for index,(x,y) in enumerate(MARKER_POSITIONS):
            marker = cv2.aruco.generateImageMarker(DICTIONARY,SPECIES.index(species)*4+index,MARKER_SIZE)
            page[y:y+MARKER_SIZE,x:x+MARKER_SIZE] = marker[:,:,None]
    return page,cv2.warpPerspective(page,transform,(1080,1400),borderValue=(80,100,120))

for species in SPECIES:
    page,photo = photographed_sheet(species)
    result = detector.detect(photo)
    assert result['species']==species and result['confident'] and result['method']=='markers',result
    actual = np.float32(result['corners'])*np.float32([1080,1400])
    assert float(np.max(np.linalg.norm(actual-photo_page,axis=1)))<4,(species,actual)
    # One covered marker should still align using the other three.
    x,y = MARKER_POSITIONS[0]
    page[y-8:y+MARKER_SIZE+8,x-8:x+MARKER_SIZE+8]=255
    covered = cv2.warpPerspective(page,transform,(1080,1400),borderValue=(80,100,120))
    result = detector.detect(covered)
    assert result['species']==species and result['confident'] and result['markers']==3,result
    _,unmarked = photographed_sheet(species,False)
    result = detector.detect(unmarked)
    assert result['species']==species and result['confident'] and result['method']=='artwork',result
    print(species,'marked, partly obscured and unmarked pages passed',flush=True)

for blank in [np.full((900,700,3),255,np.uint8),np.zeros((900,700,3),np.uint8)]:
    result = detector.detect(blank)
    assert not result['identified'] and not result['confident'],result

# A close-up of only the face cannot claim a confident alignment of the entire page.
page,_ = photographed_sheet('giraffe',False)
face=page[150:480,410:740]
face_result=detector.detect(cv2.resize(face,(700,700)))
assert not (face_result['confident'] and face_result['method']=='artwork'),face_result
assert project_page(np.array([[1.,0,10000],[0,1,0],[0,0,1]]),1000,1000) is None
print('Blank images, partial art and impossible transforms do not produce confident artwork alignment')
