const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
require('../public/vendor/js-aruco2/cv');
const { AR } = require('../public/vendor/js-aruco2/aruco');
const geometry = require('../public/geometry');
const {
  detectPage,
  resolveMarkerSet,
  speciesMarkerIds,
} = require('../public/markers');

function makeMarker(id, x, y, size = 40) {
  return {
    id,
    corners: [
      { x: x - size / 2, y: y - size / 2 },
      { x: x + size / 2, y: y - size / 2 },
      { x: x + size / 2, y: y + size / 2 },
      { x: x - size / 2, y: y + size / 2 },
    ],
  };
}

const foxMarkers = speciesMarkerIds.fox.map((id, index) => {
  const centers = [
    [120, 90],
    [920, 130],
    [860, 1320],
    [150, 1280],
  ];
  return makeMarker(id, ...centers[index]);
});

assert.equal(resolveMarkerSet(foxMarkers).species, 'fox');
assert.equal(resolveMarkerSet(foxMarkers.slice(0, 3)), null, 'partial sets are uncertain');
assert.equal(
  resolveMarkerSet([...foxMarkers, foxMarkers[0]]),
  null,
  'duplicate IDs are uncertain',
);

const registration = detectPage(foxMarkers, geometry);
assert.equal(registration.species, 'fox');
assert.equal(registration.corners.length, 4);
assert.ok(
  geometry.isValidQuadrilateral(registration.corners, 1_100, 1_450),
  'derived page corners should stay clockwise and page-sized',
);

function renderMarker(id, cellSize = 20) {
  const dictionary = new AR.Dictionary('ARUCO_MIP_36h12');
  const cells = dictionary.markSize + 2;
  const width = cells * cellSize;
  const data = new Uint8ClampedArray(width * width * 4).fill(255);

  function fillCell(cellX, cellY, value) {
    for (let y = cellY * cellSize; y < (cellY + 1) * cellSize; y += 1) {
      for (let x = cellX * cellSize; x < (cellX + 1) * cellSize; x += 1) {
        const offset = (y * width + x) * 4;
        data[offset] = value;
        data[offset + 1] = value;
        data[offset + 2] = value;
      }
    }
  }

  for (let y = 1; y < cells - 1; y += 1) {
    for (let x = 1; x < cells - 1; x += 1) fillCell(x, y, 0);
  }

  const code = dictionary.codeList[id];
  const codeSize = Math.sqrt(dictionary.nBits);
  for (let y = 0; y < codeSize; y += 1) {
    for (let x = 0; x < codeSize; x += 1) {
      if (code[y * codeSize + x] === '1') fillCell(x + 2, y + 2, 255);
    }
  }

  return { data, height: width, width };
}

const detector = new AR.Detector({
  dictionaryName: 'ARUCO_MIP_36h12',
  maxHammingDistance: 5,
});
for (const id of [0, 7, 15, 19, 23]) {
  const detected = detector.detect(renderMarker(id));
  assert.equal(detected.length, 1, `marker ${id} should be detected`);
  assert.equal(detected[0].id, id);
}

for (const [species, ids] of Object.entries(speciesMarkerIds)) {
  const template = fs.readFileSync(
    path.join(__dirname, '..', 'public', 'animals', species, 'template.svg'),
    'utf8',
  );
  ids.forEach((id) => {
    assert.match(template, new RegExp(`href="/markers/${id}\\.svg"`));
  });
}

console.log('Marker mapping tests passed');
