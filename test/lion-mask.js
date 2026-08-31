const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { maskParts } = require('../public/animals/lion/shape');

const templatePath = path.join(
  __dirname,
  '..',
  'public',
  'animals',
  'lion',
  'template.svg',
);
const template = fs.readFileSync(templatePath, 'utf8');
const templateParts = [...template.matchAll(/data-mask-part="[^"]+"\s+d="([^"]+)"/g)].map(
  (match) => match[1],
);

function normalizePath(value) {
  return value.replace(/\s+/g, ' ').trim();
}

assert.equal(templateParts.length, maskParts.length, 'every mask part should be represented');
assert.deepEqual(
  templateParts.map(normalizePath),
  maskParts.map(normalizePath),
  'the printable silhouette and capture mask must stay identical',
);

console.log('Lion mask test passed');
