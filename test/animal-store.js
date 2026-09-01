const assert = require('assert/strict');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { AnimalStore, isPng } = require('../lib/animal-store');

const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk' +
    '+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

function animal(id, species, createdAt) {
  return { id, species, createdAt };
}

async function run() {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jungle-store-'));
  try {
    assert.equal(isPng(onePixelPng), true);
    const store = new AnimalStore({ dataDir, validSpecies: ['lion', 'fox'] });
    await store.initialize();
    assert.deepEqual(store.list(), []);

    const lionId = '00000000-0000-4000-8000-000000000001';
    const foxId = '00000000-0000-4000-8000-000000000002';
    await store.add(animal(lionId, 'lion', 1), onePixelPng);
    await store.add(animal(foxId, 'fox', 2), onePixelPng);
    assert.equal(store.list().length, 2);
    assert.equal(store.list()[0].texture, `/data/animals/${lionId}.png`);

    const restarted = new AnimalStore({ dataDir, validSpecies: ['lion', 'fox'] });
    await restarted.initialize();
    assert.deepEqual(restarted.list().map((entry) => entry.id), [lionId, foxId]);

    await restarted.updateSettings({ maxAnimals: 1, paused: true });
    assert.deepEqual(restarted.list().map((entry) => entry.id), [foxId]);
    await assert.rejects(
      restarted.add(animal(lionId, 'lion', 3), onePixelPng),
      (error) => error.code === 'PAUSED',
    );
    assert.equal(await fs.stat(restarted.imagePath(lionId)).catch(() => null), null);

    await restarted.updateSettings({ maxAnimals: 10, paused: false });
    assert.equal(await restarted.remove(foxId), true);
    assert.deepEqual(restarted.list(), []);

    await fs.writeFile(path.join(dataDir, 'animals.json'), '{not valid json');
    await fs.writeFile(path.join(dataDir, 'animals', `${lionId}.png`), onePixelPng);
    const recovered = new AnimalStore({ dataDir, validSpecies: ['lion', 'fox'] });
    await recovered.initialize();
    assert.deepEqual(recovered.list(), [], 'corrupt state should recover empty');
    assert.equal(await fs.stat(recovered.imagePath(lionId)).catch(() => null), null);
  } finally {
    await fs.rm(dataDir, { force: true, recursive: true });
  }
}

run()
  .then(() => console.log('Animal store tests passed'))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
