const assert = require('assert/strict');
const {
  createHomography,
  isValidQuadrilateral,
  mapHomography,
} = require('../public/geometry');

function almostEqual(actual, expected, epsilon = 1e-6) {
  assert.ok(
    Math.abs(actual - expected) < epsilon,
    `Expected ${actual} to be within ${epsilon} of ${expected}`,
  );
}

const width = 1_000;
const height = 800;

assert.equal(
  isValidQuadrilateral(
    [
      { x: 100, y: 100 },
      { x: 900, y: 120 },
      { x: 850, y: 700 },
      { x: 130, y: 680 },
    ],
    width,
    height,
  ),
  true,
  'a clockwise page-sized quadrilateral should be valid',
);

assert.equal(
  isValidQuadrilateral(
    [
      { x: 100, y: 100 },
      { x: 850, y: 700 },
      { x: 900, y: 120 },
      { x: 130, y: 680 },
    ],
    width,
    height,
  ),
  false,
  'crossed corners should be rejected',
);

assert.equal(
  isValidQuadrilateral(
    [
      { x: 10, y: 10 },
      { x: 20, y: 10 },
      { x: 20, y: 20 },
      { x: 10, y: 20 },
    ],
    width,
    height,
  ),
  false,
  'tiny selections should be rejected',
);

const destination = [
  [0, 0],
  [839, 0],
  [839, 1187],
  [0, 1187],
];
const source = [
  [120, 80],
  [1_850, 150],
  [1_720, 2_650],
  [180, 2_560],
];
const homography = createHomography(destination, source);

destination.forEach(([u, v], index) => {
  const [x, y] = mapHomography(homography, u, v);
  almostEqual(x, source[index][0]);
  almostEqual(y, source[index][1]);
});

console.log('Geometry tests passed');
