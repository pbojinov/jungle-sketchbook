const assert = require('assert/strict');
const { height, parts, poseAt, width } = require('../public/animals/lion/rig');

assert.equal(new Set(parts.map((part) => part.id)).size, parts.length, 'part IDs are unique');
assert.deepEqual(
  parts.map((part) => part.z),
  [...parts].sort((first, second) => first.z - second.z).map((part) => part.z),
  'parts are stored in draw order',
);

for (const part of parts) {
  assert.ok(part.path.length > 20, `${part.id} has a clip path`);
  assert.ok(part.pivot[0] >= 0 && part.pivot[0] <= width, `${part.id} pivot x is valid`);
  assert.ok(part.pivot[1] >= 0 && part.pivot[1] <= height, `${part.id} pivot y is valid`);
}

const quarter = poseAt(Math.PI / 10);
const threeQuarter = poseAt((3 * Math.PI) / 10);
assert.ok(quarter['front-leg'] > 0);
assert.ok(quarter['rear-leg'] < 0);
assert.ok(threeQuarter['front-leg'] < 0);
assert.ok(threeQuarter['rear-leg'] > 0);
assert.ok(Math.abs(quarter['front-leg']) <= 0.18);
assert.ok(Math.abs(quarter.tail) <= 0.1);

console.log('Lion rig tests passed');
