const wholeImageButton = document.querySelector('#wholeImage');
const fileInput = document.querySelector('#fileInput');
const cameraInput = document.querySelector('#cameraInput');
const photoCanvas = document.querySelector('#photoCanvas');
const photoContext = photoCanvas.getContext('2d');
const rectifiedCanvas = document.querySelector('#rectified');
const rectifiedContext = rectifiedCanvas.getContext('2d');
const cutoutCanvas = document.querySelector('#cutout');
const cutoutContext = cutoutCanvas.getContext('2d');
const resetPointsButton = document.querySelector('#resetPoints');
const processButton = document.querySelector('#processBtn');
const sendButton = document.querySelector('#sendBtn');
const detectButton = document.querySelector('#detectAgain');
const statusElement = document.querySelector('#status');
const previewTitle = document.querySelector('#animalPreviewTitle');
const speciesSelect = document.querySelector('#speciesSelect');
const animalChoice = document.querySelector('#animalChoice');
const animalResult = document.querySelector('#animalResult');
const animalName = document.querySelector('#animalName');
const photoHint = document.querySelector('#photoHint');
const { createHomography, isValidQuadrilateral, mapHomography } = window.SketchGeometry;
const speciesDefinitions = window.AnimalShapes || {};
const PAGE_WIDTH = 840;
const PAGE_HEIGHT = 1087;
const MAX_SOURCE_DIMENSION = 2400;
let species = null;
let shape = null;
let speciesName = 'Animal';
let image = null;
let selectedCorners = [];
let displayScale = 1;
let photoOffset = { x: 0, y: 0 };
let finalTexture = null;
let activeCorner = null;
let activePointer = null;
let grabOffset = { x: 0, y: 0 };
let photoGeneration = 0;
let detectionGeneration = 0;
let detectionController = null;
let cutoutGeneration = 0;

function setStatus(message) { statusElement.textContent = message; }
function clearPreview() {
  rectifiedContext.clearRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
  cutoutContext.clearRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
}
function invalidateCutout() {
  cutoutGeneration += 1;
  finalTexture = null;
  sendButton.disabled = true;
  clearPreview();
}
function chooseSpecies(value) {
  species = speciesDefinitions[value] ? value : null;
  shape = species ? speciesDefinitions[species] : null;
  speciesName = species ? species[0].toUpperCase() + species.slice(1) : 'Animal';
  speciesSelect.value = species || '';
  animalResult.hidden = !species;
  animalName.textContent = species ? `${shape.emoji} ${speciesName} found` : '';
  previewTitle.textContent = species ? `Your ${species}` : 'Your animal';
  processButton.textContent = species ? `✂️ Update ${species} cutout` : '✂️ Cut out animal';
  sendButton.textContent = species ? `${shape.emoji} Send to safari` : 'Send to safari';
  invalidateCutout();
}
function stopDetection() {
  detectionGeneration += 1;
  if (detectionController) detectionController.abort();
  detectionController = null;
  detectButton.disabled = !image;
}
function setupPhoto(normalizedCorners = []) {
  const corners = normalizedCorners.map(([x,y]) => ({ x:x*image.naturalWidth, y:y*image.naturalHeight }));
  const padding = normalizedCorners.length ? image.naturalWidth*.025 : 0;
  const left = Math.min(0,...corners.map(p=>p.x))-padding;
  const top = Math.min(0,...corners.map(p=>p.y))-padding;
  const right = Math.max(image.naturalWidth,...corners.map(p=>p.x))+padding;
  const bottom = Math.max(image.naturalHeight,...corners.map(p=>p.y))+padding;
  displayScale = Math.min(1, Math.min(window.innerWidth-36,1100)/(right-left));
  photoOffset = { x:-left*displayScale, y:-top*displayScale };
  photoCanvas.width = Math.round((right-left)*displayScale);
  photoCanvas.height = Math.round((bottom-top)*displayScale);
  selectedCorners = corners.map(p=>({ x:p.x*displayScale+photoOffset.x, y:p.y*displayScale+photoOffset.y }));
}
function redrawPhoto() {
  photoContext.clearRect(0,0,photoCanvas.width,photoCanvas.height);
  if (!image) return;
  photoContext.fillStyle = '#14221f';
  photoContext.fillRect(0,0,photoCanvas.width,photoCanvas.height);
  photoContext.drawImage(image,photoOffset.x,photoOffset.y,image.naturalWidth*displayScale,image.naturalHeight*displayScale);
  const unit = photoCanvas.width/photoCanvas.getBoundingClientRect().width;
  photoContext.lineWidth = 2*unit;
  photoContext.strokeStyle = '#f0d36a';
  if (selectedCorners.length > 1) {
    photoContext.beginPath();
    photoContext.moveTo(selectedCorners[0].x,selectedCorners[0].y);
    selectedCorners.slice(1).forEach(point=>photoContext.lineTo(point.x,point.y));
    if (selectedCorners.length===4) photoContext.closePath();
    photoContext.stroke();
  }
  photoContext.font = `bold ${16*unit}px system-ui`;
  selectedCorners.forEach((point,index)=>{
    photoContext.beginPath();
    photoContext.arc(point.x,point.y,11*unit,0,Math.PI*2);
    photoContext.fillStyle = '#f0d36a'; photoContext.fill();
    photoContext.strokeStyle = '#111'; photoContext.stroke();
    const labelX = point.x > photoCanvas.width-60*unit ? point.x-42*unit : point.x+15*unit;
    const labelY = Math.max(20*unit,Math.min(photoCanvas.height-8*unit,point.y+6*unit));
    photoContext.fillStyle = '#f0d36a';
    photoContext.strokeStyle = '#14221f';
    photoContext.lineWidth = 4*unit;
    photoContext.strokeText(['TL','TR','BR','BL'][index],labelX,labelY);
    photoContext.fillText(['TL','TR','BR','BL'][index],labelX,labelY);
    photoContext.lineWidth = 2*unit;
    if (index===activeCorner) {
      photoContext.beginPath();photoContext.arc(point.x,point.y,19*unit,0,Math.PI*2);
      photoContext.strokeStyle = '#fff';photoContext.stroke();
    }
  });
}
function cornersReady() {
  return Boolean(image && shape && isValidQuadrilateral(selectedCorners,photoCanvas.width,photoCanvas.height));
}
function updateCornerStatus() {
  processButton.disabled = !cornersReady();
  if (selectedCorners.length < 4) {
    photoHint.textContent = 'Tap the paper corners: top-left → top-right → bottom-right → bottom-left. Drag a marker to adjust it.';
    setStatus(`Tap the ${['top-left','top-right','bottom-right','bottom-left'][selectedCorners.length]} corner.`);
  } else if (!isValidQuadrilateral(selectedCorners,photoCanvas.width,photoCanvas.height)) {
    setStatus('Corners cross or cover too little of the photo. Drag them into TL → TR → BR → BL order.');
  } else if (!shape) {
    animalChoice.hidden = false;
    setStatus('Page corners found. Choose the animal on your sheet to finish the cutout.');
  } else {
    setStatus('Corners ready. Drag any marker to adjust the alignment.');
  }
}
function photoPoint(event) {
  const bounds = photoCanvas.getBoundingClientRect();
  return { x:(event.clientX-bounds.left)*photoCanvas.width/bounds.width,
    y:(event.clientY-bounds.top)*photoCanvas.height/bounds.height };
}
function nearestCorner(point) {
  const bounds = photoCanvas.getBoundingClientRect();
  let nearest = null, distance = 28;
  selectedCorners.forEach((corner,index)=>{
    const separation = Math.hypot((corner.x-point.x)*bounds.width/photoCanvas.width,
      (corner.y-point.y)*bounds.height/photoCanvas.height);
    if (separation<distance) { nearest=index;distance=separation; }
  });
  return nearest;
}
function stopCornerDrag() {
  const pointer = activePointer;
  activeCorner = null;activePointer = null;
  if (pointer!==null && photoCanvas.hasPointerCapture(pointer)) photoCanvas.releasePointerCapture(pointer);
  photoCanvas.style.cursor = image ? 'crosshair' : '';
}
async function detectPhoto() {
  if (!image) return;
  stopDetection();stopCornerDrag();
  const generation = detectionGeneration;
  const currentImage = image;
  const controller = new AbortController();
  detectionController = controller;
  detectButton.disabled = true;
  processButton.disabled = true;
  invalidateCutout();
  setStatus('Finding the animal and lining up your sheet…');
  photoHint.textContent = 'Finding the page corners automatically…';
  const source = document.createElement('canvas');
  const ratio = Math.min(1,1800/Math.max(image.naturalWidth,image.naturalHeight));
  source.width = Math.round(image.naturalWidth*ratio);
  source.height = Math.round(image.naturalHeight*ratio);
  source.getContext('2d').drawImage(image,0,0,source.width,source.height);
  try {
    const response = await fetch('/api/detect',{
      method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,
      body:JSON.stringify({image:source.toDataURL('image/jpeg',.88),species}),
    });
    if (!response.ok) throw new Error('Automatic alignment unavailable');
    const result = await response.json();
    if (generation!==detectionGeneration || image!==currentImage) return;
    if (result.identified && speciesDefinitions[result.species]) {
      chooseSpecies(result.species);
      animalChoice.hidden = true;
    } else if (!species) {
      animalChoice.hidden = false;
    }
    if (result.confident && Array.isArray(result.corners) && result.corners.length===4 &&
        result.corners.every(point=>Array.isArray(point)&&point.length===2&&point.every(Number.isFinite))) {
      setupPhoto(result.corners);
      photoHint.textContent = 'Page aligned automatically. Drag any corner if you want to adjust it.';
      redrawPhoto();updateCornerStatus();
      if (cornersReady()) await extractAnimal();
    } else {
      setupPhoto();redrawPhoto();updateCornerStatus();
      setStatus(shape ? 'Animal found, but the page alignment is uncertain. Tap the four paper corners.' :
        'We couldn’t confidently identify this sheet. Choose the animal, then tap its four paper corners.');
    }
  } catch (error) {
    if (generation!==detectionGeneration || image!==currentImage || error.name==='AbortError') return;
    if (!species) animalChoice.hidden = false;
    updateCornerStatus();
    setStatus('Automatic detection is unavailable. Choose the animal if needed, then tap the four paper corners.');
  } finally {
    if (generation===detectionGeneration) { detectionController=null;detectButton.disabled=false; }
  }
}
function loadPhoto(event) {
  const input = event.currentTarget, file = input.files[0];
  if (!file) return;
  input.value = '';
  stopDetection();stopCornerDrag();
  const generation = ++photoGeneration;
  chooseSpecies(null);
  image = null;selectedCorners = [];
  photoContext.clearRect(0,0,photoCanvas.width,photoCanvas.height);
  animalChoice.hidden = true;
  processButton.disabled=true;resetPointsButton.disabled=true;wholeImageButton.disabled=true;detectButton.disabled=true;
  setStatus('Loading your photo…');
  const objectUrl = URL.createObjectURL(file);
  const loadedImage = new Image();
  loadedImage.addEventListener('load',()=>{
    URL.revokeObjectURL(objectUrl);
    if (generation!==photoGeneration) return;
    image = loadedImage;
    setupPhoto();redrawPhoto();
    resetPointsButton.disabled=false;wholeImageButton.disabled=false;
    detectPhoto();
  });
  loadedImage.addEventListener('error',()=>{
    URL.revokeObjectURL(objectUrl);
    if (generation===photoGeneration) setStatus('Could not read that image. Try another photo.');
  });
  loadedImage.src = objectUrl;
}
document.querySelector('#choosePhoto').addEventListener('click',()=>fileInput.click());
document.querySelector('#takePhoto').addEventListener('click',()=>cameraInput.click());
fileInput.addEventListener('change',loadPhoto);
cameraInput.addEventListener('change',loadPhoto);
detectButton.addEventListener('click',detectPhoto);
document.querySelector('#changeAnimal').addEventListener('click',()=>{
  animalChoice.hidden = false;speciesSelect.focus();
});
speciesSelect.addEventListener('change',()=>{
  stopDetection();chooseSpecies(speciesSelect.value);updateCornerStatus();
  if (cornersReady()) extractAnimal();
});
wholeImageButton.addEventListener('click',()=>{
  if (!image) return;
  stopDetection();stopCornerDrag();setupPhoto();invalidateCutout();
  selectedCorners = [{x:0,y:0},{x:photoCanvas.width-1,y:0},{x:photoCanvas.width-1,y:photoCanvas.height-1},{x:0,y:photoCanvas.height-1}];
  redrawPhoto();updateCornerStatus();
  photoHint.textContent = 'Whole image selected. Use this for a flat scan cropped to the paper edges.';
  if (cornersReady()) extractAnimal();
});
photoCanvas.addEventListener('pointerdown',event=>{
  if (!image || event.isPrimary===false || event.button!==0 || activePointer!==null) return;
  const point = photoPoint(event);
  let index = nearestCorner(point);
  if (index===null) {
    if (selectedCorners.length>=4) return;
    selectedCorners.push(point);index=selectedCorners.length-1;
  }
  stopDetection();
  if (!species) animalChoice.hidden = false;
  activeCorner=index;activePointer=event.pointerId;
  grabOffset={x:selectedCorners[index].x-point.x,y:selectedCorners[index].y-point.y};
  photoCanvas.setPointerCapture(event.pointerId);photoCanvas.style.cursor='grabbing';event.preventDefault();
  invalidateCutout();updateCornerStatus();redrawPhoto();
});
photoCanvas.addEventListener('pointermove',event=>{
  if (!image) return;
  const point = photoPoint(event);
  if (activePointer===null) { photoCanvas.style.cursor=nearestCorner(point)===null?'crosshair':'grab';return; }
  if (event.pointerId!==activePointer) return;
  if (finalTexture) invalidateCutout();
  selectedCorners[activeCorner]={x:Math.max(0,Math.min(photoCanvas.width-1,point.x+grabOffset.x)),
    y:Math.max(0,Math.min(photoCanvas.height-1,point.y+grabOffset.y))};
  event.preventDefault();updateCornerStatus();redrawPhoto();
});
function finishCornerDrag(event) {
  if (event.pointerId!==activePointer) return;
  stopCornerDrag();redrawPhoto();updateCornerStatus();
  if (cornersReady()) extractAnimal();
}
photoCanvas.addEventListener('pointerup',finishCornerDrag);
photoCanvas.addEventListener('pointercancel',finishCornerDrag);
photoCanvas.addEventListener('lostpointercapture',finishCornerDrag);
resetPointsButton.addEventListener('click',()=>{
  stopDetection();stopCornerDrag();
  if (image) setupPhoto();
  selectedCorners=[];invalidateCutout();processButton.disabled=true;
  if (!species) animalChoice.hidden=false;
  redrawPhoto();updateCornerStatus();
});

function sampleBilinear(source, sourceWidth, sourceHeight, x, y, output, outputIndex) {
  const clampedX = Math.max(0, Math.min(sourceWidth - 1.001, x));
  const clampedY = Math.max(0, Math.min(sourceHeight - 1.001, y));
  const x0 = Math.floor(clampedX);
  const y0 = Math.floor(clampedY);
  const x1 = Math.min(sourceWidth - 1, x0 + 1);
  const y1 = Math.min(sourceHeight - 1, y0 + 1);
  const fractionX = clampedX - x0;
  const fractionY = clampedY - y0;

  for (let channel = 0; channel < 4; channel += 1) {
    const topLeft = source[(y0 * sourceWidth + x0) * 4 + channel];
    const topRight = source[(y0 * sourceWidth + x1) * 4 + channel];
    const bottomLeft = source[(y1 * sourceWidth + x0) * 4 + channel];
    const bottomRight = source[(y1 * sourceWidth + x1) * 4 + channel];
    const top = topLeft * (1 - fractionX) + topRight * fractionX;
    const bottom = bottomLeft * (1 - fractionX) + bottomRight * fractionX;
    output[outputIndex + channel] = Math.round(
      top * (1 - fractionY) + bottom * fractionY,
    );
  }
}

function rectifyPage() {
  const sourceScale = Math.min(
    1,
    MAX_SOURCE_DIMENSION / image.naturalWidth,
    MAX_SOURCE_DIMENSION / image.naturalHeight,
  );
  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = Math.max(1, Math.round(image.naturalWidth * sourceScale));
  sourceCanvas.height = Math.max(1, Math.round(image.naturalHeight * sourceScale));

  const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true });
  sourceContext.drawImage(image, 0, 0, sourceCanvas.width, sourceCanvas.height);
  const sourceImage = sourceContext.getImageData(
    0,
    0,
    sourceCanvas.width,
    sourceCanvas.height,
  );

  const sourcePoints = selectedCorners.map((point) => [
    ((point.x - photoOffset.x) / displayScale) * sourceScale,
    ((point.y - photoOffset.y) / displayScale) * sourceScale,
  ]);
  const destinationPoints = [
    [0, 0],
    [PAGE_WIDTH - 1, 0],
    [PAGE_WIDTH - 1, PAGE_HEIGHT - 1],
    [0, PAGE_HEIGHT - 1],
  ];
  const homography = createHomography(destinationPoints, sourcePoints);
  const outputImage = rectifiedContext.createImageData(PAGE_WIDTH, PAGE_HEIGHT);

  for (let y = 0; y < PAGE_HEIGHT; y += 1) {
    for (let x = 0; x < PAGE_WIDTH; x += 1) {
      const [sourceX, sourceY] = mapHomography(homography, x, y);
      sampleBilinear(
        sourceImage.data,
        sourceCanvas.width,
        sourceCanvas.height,
        sourceX,
        sourceY,
        outputImage.data,
        (y * PAGE_WIDTH + x) * 4,
      );
    }
  }

  rectifiedContext.putImageData(outputImage, 0, 0);
}

function makeAnimalCutout() {
  cutoutContext.clearRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
  cutoutContext.save();
  const mask = new Path2D();
  mask.addPath(new Path2D(shape.maskPath), new DOMMatrix(shape.pathTransform));
  cutoutContext.clip(mask);
  cutoutContext.drawImage(rectifiedCanvas, 0, 0);
  cutoutContext.restore();

  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = shape.bounds.width;
  croppedCanvas.height = shape.bounds.height;
  croppedCanvas.getContext('2d').drawImage(
    cutoutCanvas,
    shape.bounds.x,
    shape.bounds.y,
    shape.bounds.width,
    shape.bounds.height,
    0,
    0,
    shape.bounds.width,
    shape.bounds.height,
  );
  finalTexture = croppedCanvas.toDataURL('image/png');
}

async function extractAnimal() {
  if (!cornersReady()) return;
  const generation = cutoutGeneration;
  try {
    setStatus('Preparing your animal…');
    await new Promise(resolve=>requestAnimationFrame(resolve));
    if (generation!==cutoutGeneration || !cornersReady()) return;
    rectifyPage();makeAnimalCutout();
    sendButton.disabled=false;
    setStatus(`${speciesName} ready. Check the cutout, then send it to the jungle.`);
  } catch {
    finalTexture=null;sendButton.disabled=true;
    setStatus('Could not prepare the cutout. Adjust the corners or try another photo.');
  }
}
processButton.addEventListener('click',extractAnimal);
sendButton.addEventListener('click',async()=>{
  if (!finalTexture || !shape) return;
  const generation=photoGeneration;
  const payload={species,artworkVersion:shape.version,texture:finalTexture};
  sendButton.disabled=true;setStatus('Sending your animal…');
  try {
    const response=await fetch('/api/animals',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    if (!response.ok) throw new Error('Upload failed');
    if (generation===photoGeneration) setStatus('Sent! Look for your drawing in the jungle.');
  } catch {
    if (generation===photoGeneration) setStatus('Could not send your animal. Please try again.');
  } finally {
    if (generation===photoGeneration) sendButton.disabled=!finalTexture;
  }
});
