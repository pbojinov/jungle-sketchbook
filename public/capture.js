const fileInput = document.querySelector('#fileInput');
const photoCanvas = document.querySelector('#photoCanvas');
const photoContext = photoCanvas.getContext('2d');
const rectifiedCanvas = document.querySelector('#rectified');
const rectifiedContext = rectifiedCanvas.getContext('2d');
const cutoutCanvas = document.querySelector('#cutout');
const cutoutContext = cutoutCanvas.getContext('2d');
const resetPointsButton = document.querySelector('#resetPoints');
const processButton = document.querySelector('#processBtn');
const sendButton = document.querySelector('#sendBtn');
const statusElement = document.querySelector('#status');

const {
  createHomography,
  isValidQuadrilateral,
  mapHomography,
} = window.SketchGeometry;
const { bounds: LION_BOUNDS, maskPath: LION_MASK_PATH } = window.LionShape;

const PAGE_WIDTH = 840;
const PAGE_HEIGHT = 1188;
const MAX_SOURCE_DIMENSION = 2400;

let image = null;
let selectedCorners = [];
let displayScale = 1;
let finalTexture = null;

function setStatus(message) {
  statusElement.textContent = message;
}

function clearPreview() {
  rectifiedContext.clearRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
  cutoutContext.clearRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
}

function redrawPhoto() {
  photoContext.clearRect(0, 0, photoCanvas.width, photoCanvas.height);
  if (!image) return;

  photoContext.drawImage(image, 0, 0, photoCanvas.width, photoCanvas.height);
  photoContext.lineWidth = 3;
  photoContext.font = 'bold 18px system-ui';

  const labels = ['TL', 'TR', 'BR', 'BL'];
  selectedCorners.forEach((point, index) => {
    photoContext.beginPath();
    photoContext.arc(point.x, point.y, 11, 0, Math.PI * 2);
    photoContext.fillStyle = '#f0d36a';
    photoContext.fill();
    photoContext.strokeStyle = '#111';
    photoContext.stroke();
    photoContext.fillStyle = '#111';
    photoContext.fillText(labels[index], point.x + 15, point.y + 6);
  });

  if (selectedCorners.length > 1) {
    photoContext.beginPath();
    photoContext.moveTo(selectedCorners[0].x, selectedCorners[0].y);
    selectedCorners.slice(1).forEach((point) => {
      photoContext.lineTo(point.x, point.y);
    });
    if (selectedCorners.length === 4) photoContext.closePath();
    photoContext.strokeStyle = '#f0d36a';
    photoContext.stroke();
  }
}

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (!file) return;

  const objectUrl = URL.createObjectURL(file);
  image = new Image();

  image.addEventListener('load', () => {
    const maximumDisplayWidth = Math.min(window.innerWidth - 36, 1100);
    displayScale = Math.min(1, maximumDisplayWidth / image.naturalWidth);
    photoCanvas.width = Math.round(image.naturalWidth * displayScale);
    photoCanvas.height = Math.round(image.naturalHeight * displayScale);

    selectedCorners = [];
    finalTexture = null;
    clearPreview();
    processButton.disabled = true;
    sendButton.disabled = true;
    resetPointsButton.disabled = false;
    redrawPhoto();
    setStatus('Tap the top-left corner.');
    URL.revokeObjectURL(objectUrl);
  });

  image.addEventListener('error', () => {
    URL.revokeObjectURL(objectUrl);
    image = null;
    resetPointsButton.disabled = true;
    setStatus('Could not read that image. Try another photo.');
  });

  image.src = objectUrl;
});

photoCanvas.addEventListener('pointerdown', (event) => {
  if (!image || selectedCorners.length >= 4) return;

  const bounds = photoCanvas.getBoundingClientRect();
  selectedCorners.push({
    x: ((event.clientX - bounds.left) * photoCanvas.width) / bounds.width,
    y: ((event.clientY - bounds.top) * photoCanvas.height) / bounds.height,
  });
  redrawPhoto();

  const nextLabels = ['top-right', 'bottom-right', 'bottom-left'];
  if (selectedCorners.length < 4) {
    setStatus(`Now tap the ${nextLabels[selectedCorners.length - 1]} corner.`);
    return;
  }

  if (isValidQuadrilateral(selectedCorners, photoCanvas.width, photoCanvas.height)) {
    setStatus('Corners ready. Cut out the lion.');
    processButton.disabled = false;
  } else {
    setStatus(
      'Those corners cross or cover too little of the photo. Reset and tap TL → TR → BR → BL.',
    );
    processButton.disabled = true;
  }
});

resetPointsButton.addEventListener('click', () => {
  selectedCorners = [];
  finalTexture = null;
  processButton.disabled = true;
  sendButton.disabled = true;
  clearPreview();
  redrawPhoto();
  setStatus('Tap the top-left corner.');
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
    (point.x / displayScale) * sourceScale,
    (point.y / displayScale) * sourceScale,
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

function makeLionCutout() {
  cutoutContext.clearRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
  cutoutContext.save();
  cutoutContext.clip(new Path2D(LION_MASK_PATH));
  cutoutContext.drawImage(rectifiedCanvas, 0, 0);
  cutoutContext.restore();

  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = LION_BOUNDS.width;
  croppedCanvas.height = LION_BOUNDS.height;
  croppedCanvas.getContext('2d').drawImage(
    cutoutCanvas,
    LION_BOUNDS.x,
    LION_BOUNDS.y,
    LION_BOUNDS.width,
    LION_BOUNDS.height,
    0,
    0,
    LION_BOUNDS.width,
    LION_BOUNDS.height,
  );
  finalTexture = croppedCanvas.toDataURL('image/png');
}

processButton.addEventListener('click', async () => {
  try {
    setStatus('Rectifying page…');
    await new Promise((resolve) => requestAnimationFrame(resolve));
    rectifyPage();
    makeLionCutout();
    sendButton.disabled = false;
    setStatus('Lion extracted. Check the preview, then send it.');
  } catch (error) {
    setStatus(`Could not process: ${error.message}`);
  }
});

sendButton.addEventListener('click', async () => {
  if (!finalTexture) return;

  sendButton.disabled = true;
  setStatus('Sending lion…');
  try {
    const response = await fetch('/api/animals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ species: 'lion', texture: finalTexture }),
    });
    if (!response.ok) throw new Error(await response.text());
    setStatus('🦁 Sent! Look at the safari display.');
  } catch (error) {
    setStatus(`Send failed: ${error.message}`);
  } finally {
    sendButton.disabled = false;
  }
});
