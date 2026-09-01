const assert = require('assert/strict');
const config = require('../public/display-config');

const memory = new Map();
const storage = {
  getItem: (key) => memory.get(key) || null,
  setItem: (key, value) => memory.set(key, value),
};

assert.deepEqual(config.load(storage), config.defaults);
assert.deepEqual(config.normalize({ lowPower: 'yes', motion: 'wild' }), config.defaults);

const saved = config.save(storage, {
  lowPower: true,
  motion: 'reduced',
  quietHud: false,
});
assert.deepEqual(config.load(storage), saved);
assert.equal(config.reducedMotion(saved, false), true);
assert.equal(config.reducedMotion({ ...saved, motion: 'full' }, true), false);
assert.equal(config.reducedMotion({ ...saved, motion: 'system' }, true), true);

memory.set(config.STORAGE_KEY, '{bad json');
assert.deepEqual(config.load(storage), config.defaults);

console.log('Display config tests passed');
