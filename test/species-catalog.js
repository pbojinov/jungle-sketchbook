const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const catalog = require('../public/species');

assert.deepEqual(Object.keys(catalog), [
  'lion',
  'fox',
  'zebra',
  'gazelle',
  'rhino',
  'elephant',
]);

function normalizePath(value) {
  return value.replace(/\s+/g, ' ').trim();
}

const allMarkerIds = [];
for (const [id, species] of Object.entries(catalog)) {
  assert.ok(species.label);
  assert.ok(species.emoji);
  assert.ok(species.behavior.scale > 0);
  assert.ok(species.behavior.speed > 0);
  assert.equal(species.markerIds.length, 4);
  allMarkerIds.push(...species.markerIds);

  const animalDirectory = path.join(__dirname, '..', 'public', 'animals', id);
  const template = fs.readFileSync(path.join(animalDirectory, 'template.svg'), 'utf8');
  const shape = require(path.join(animalDirectory, 'shape.js'));
  const templateParts = [
    ...template.matchAll(/data-mask-part="[^"]+"\s+d="([^"]+)"/g),
  ].map((match) => normalizePath(match[1]));

  assert.deepEqual(
    templateParts,
    shape.maskParts.map(normalizePath),
    `${id} printable silhouette and capture mask stay identical`,
  );
  assert.ok(shape.bounds.width > 0 && shape.bounds.height > 0);

  species.markerIds.forEach((markerId) => {
    assert.match(template, new RegExp(`href="/markers/${markerId}\\.svg"`));
  });
}

assert.equal(new Set(allMarkerIds).size, allMarkerIds.length, 'marker IDs must be unique');

console.log('Species catalog tests passed');
