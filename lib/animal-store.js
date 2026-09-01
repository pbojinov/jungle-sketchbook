const fs = require('fs/promises');
const path = require('path');

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const DEFAULT_SETTINGS = Object.freeze({ maxAnimals: 30, paused: false });

function isPng(buffer) {
  return buffer.length >= PNG_SIGNATURE.length &&
    buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE);
}

function validId(id) {
  return typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id);
}

class AnimalStore {
  constructor({ dataDir, validSpecies }) {
    this.dataDir = dataDir;
    this.imagesDir = path.join(dataDir, 'animals');
    this.indexPath = path.join(dataDir, 'animals.json');
    this.settingsPath = path.join(dataDir, 'settings.json');
    this.validSpecies = new Set(validSpecies);
    this.animals = [];
    this.settings = { ...DEFAULT_SETTINGS };
    this.mutations = Promise.resolve();
    this.ready = false;
  }

  async readJson(filePath, fallback) {
    try {
      return JSON.parse(await fs.readFile(filePath, 'utf8'));
    } catch {
      return fallback;
    }
  }

  async writeJsonAtomic(filePath, value) {
    const temporaryPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
    try {
      await fs.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`);
      await fs.rename(temporaryPath, filePath);
    } finally {
      await fs.rm(temporaryPath, { force: true });
    }
  }

  imagePath(id) {
    if (!validId(id)) throw new Error('Invalid animal ID');
    return path.join(this.imagesDir, `${id}.png`);
  }

  publicAnimal(animal) {
    return { ...animal, texture: `/data/animals/${animal.id}.png` };
  }

  async validAnimal(animal) {
    if (
      !animal ||
      !validId(animal.id) ||
      !this.validSpecies.has(animal.species) ||
      !Number.isFinite(animal.createdAt)
    ) {
      return false;
    }
    try {
      return isPng(await fs.readFile(this.imagePath(animal.id)));
    } catch {
      return false;
    }
  }

  normalizeSettings(value) {
    const maxAnimals = Number(value?.maxAnimals);
    return {
      maxAnimals: Number.isInteger(maxAnimals) && maxAnimals >= 1 && maxAnimals <= 100
        ? maxAnimals
        : DEFAULT_SETTINGS.maxAnimals,
      paused: typeof value?.paused === 'boolean' ? value.paused : false,
    };
  }

  async initialize() {
    await fs.mkdir(this.imagesDir, { recursive: true });
    this.settings = this.normalizeSettings(
      await this.readJson(this.settingsPath, DEFAULT_SETTINGS),
    );

    const saved = await this.readJson(this.indexPath, []);
    const candidates = Array.isArray(saved) ? saved : [];
    const validity = await Promise.all(candidates.map((animal) => this.validAnimal(animal)));
    this.animals = candidates
      .filter((_animal, index) => validity[index])
      .sort((first, second) => first.createdAt - second.createdAt)
      .slice(-this.settings.maxAnimals);

    await this.writeJsonAtomic(this.indexPath, this.animals);
    await this.writeJsonAtomic(this.settingsPath, this.settings);
    await this.removeOrphanedImages();
    this.ready = true;
  }

  async removeOrphanedImages() {
    const retained = new Set(this.animals.map((animal) => `${animal.id}.png`));
    const entries = await fs.readdir(this.imagesDir);
    await Promise.all(entries.map(async (entry) => {
      if ((entry.endsWith('.png') && !retained.has(entry)) || entry.includes('.tmp-')) {
        await fs.rm(path.join(this.imagesDir, entry), { force: true });
      }
    }));
  }

  list(limit = 20) {
    return this.animals.slice(-limit).map((animal) => this.publicAnimal(animal));
  }

  has(id) {
    return this.animals.some((animal) => animal.id === id);
  }

  mutate(operation) {
    const result = this.mutations.then(operation, operation);
    this.mutations = result.catch(() => {});
    return result;
  }

  async add(animal, image) {
    return this.mutate(() => this.addUnsafe(animal, image));
  }

  async addUnsafe(animal, image) {
    if (this.settings.paused) {
      const error = new Error('New arrivals are paused');
      error.code = 'PAUSED';
      throw error;
    }
    if (!isPng(image)) throw new Error('Invalid PNG data');

    const finalPath = this.imagePath(animal.id);
    const temporaryPath = `${finalPath}.tmp-${process.pid}-${Date.now()}`;
    const previousAnimals = this.animals;
    const nextAnimals = [...previousAnimals, animal].slice(-this.settings.maxAnimals);

    try {
      await fs.writeFile(temporaryPath, image, { flag: 'wx' });
      await fs.rename(temporaryPath, finalPath);
      await this.writeJsonAtomic(this.indexPath, nextAnimals);
      this.animals = nextAnimals;
    } catch (error) {
      await fs.rm(temporaryPath, { force: true });
      await fs.rm(finalPath, { force: true });
      throw error;
    }

    const retained = new Set(nextAnimals.map((entry) => entry.id));
    await Promise.all(previousAnimals
      .filter((entry) => !retained.has(entry.id))
      .map((entry) => fs.rm(this.imagePath(entry.id), { force: true })));
    return this.publicAnimal(animal);
  }

  async remove(id) {
    return this.mutate(() => this.removeUnsafe(id));
  }

  async removeUnsafe(id) {
    const nextAnimals = this.animals.filter((animal) => animal.id !== id);
    if (nextAnimals.length === this.animals.length) return false;
    await this.writeJsonAtomic(this.indexPath, nextAnimals);
    this.animals = nextAnimals;
    await fs.rm(this.imagePath(id), { force: true });
    return true;
  }

  async clear() {
    return this.mutate(() => this.clearUnsafe());
  }

  async clearUnsafe() {
    const previousAnimals = this.animals;
    await this.writeJsonAtomic(this.indexPath, []);
    this.animals = [];
    await Promise.all(previousAnimals.map(
      (animal) => fs.rm(this.imagePath(animal.id), { force: true }),
    ));
  }

  async updateSettings(changes) {
    return this.mutate(() => this.updateSettingsUnsafe(changes));
  }

  async updateSettingsUnsafe(changes) {
    const proposed = this.normalizeSettings({ ...this.settings, ...changes });
    const previousAnimals = this.animals;
    const nextAnimals = previousAnimals.slice(-proposed.maxAnimals);
    await this.writeJsonAtomic(this.indexPath, nextAnimals);
    await this.writeJsonAtomic(this.settingsPath, proposed);
    this.animals = nextAnimals;
    this.settings = proposed;

    const retained = new Set(nextAnimals.map((animal) => animal.id));
    await Promise.all(previousAnimals
      .filter((animal) => !retained.has(animal.id))
      .map((animal) => fs.rm(this.imagePath(animal.id), { force: true })));
    return { ...this.settings };
  }

  getSettings() {
    return { ...this.settings };
  }
}

module.exports = { AnimalStore, isPng };
