const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { maskParts } = require('../public/animals/gazelle/shape');

const templatePath = path.join(__dirname, '..', 'public', 'animals', 'gazelle', 'template.svg');
const template = fs.readFileSync(templatePath, 'utf8');
const templateParts = [...template.matchAll(/data-mask-part="[^"]+"\s+d="([^"]+)"/g)].map(
  (match) => match[1],
);
const normalizePath = (value) => value.replace(/\s+/g, ' ').trim();

assert.deepEqual(
  templateParts.map(normalizePath),
  maskParts.map(normalizePath),
  'the printable silhouette and capture mask must stay identical',
);

console.log('Gazelle mask test passed');
