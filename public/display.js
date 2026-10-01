const canvas = document.querySelector('#world');
const context = canvas.getContext('2d');
const hud = document.querySelector('#hud');
const clearButton = document.querySelector('#clear');
const arrivals = document.querySelector('#arrivals');
const arrivalList = document.querySelector('#arrival-list');
const arrivalCards = new Map();
let arrivalOrder = 0;

const animals = [];
const animalIds = new Set();
let deviceScale = 1;
let lastFrameTime = performance.now();
let generation = 0;

function resizeCanvas() {
  deviceScale = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * deviceScale);
  canvas.height = Math.floor(window.innerHeight * deviceScale);
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function updateArrivals() {
  const waiting = animals.filter((animal) => animal.waiting && !animal.hasEntered && !animal.restored)
    .sort((a, b) => a.order - b.order);
  const ids = new Set(waiting.map((animal) => animal.id));
  for (const [id, card] of arrivalCards) {
    if (!ids.has(id)) { card.remove(); arrivalCards.delete(id); }
  }
  for (const [index, animal] of waiting.entries()) {
    let card = arrivalCards.get(animal.id);
    if (!card) {
      card = document.createElement('div');
      card.className = 'arrival';
      card.setAttribute('role', 'listitem');
      const picture = document.createElement('img');
      picture.src = animal.image.src;
      picture.alt = `Your ${animal.species}`;
      card.append(picture, document.createElement('span'));
      arrivalCards.set(animal.id, card);
      arrivalList.append(card);
      // Reveal the newest scan even when many people submit together.
      arrivalList.scrollLeft = arrivalList.scrollWidth;
    }
    card.querySelector('span').textContent = index === 0 ? 'You’re next' : `Waiting · ${index + 1}`;
  }
  arrivals.hidden = waiting.length === 0;
}

function updateAnimalCount() {
  updateArrivals();
  if (!animals.length) {
    hud.textContent = 'Live Sketchbook Safari · waiting for animals…';
    return;
  }
  const waiting = animals.filter((animal) => animal.waiting).length;
  const visible = animals.length - waiting;
  hud.textContent = `${visible} animal${visible === 1 ? '' : 's'} in the safari${waiting ? ` · ${waiting} waiting for space` : ''}`;
}

async function addAnimal(data, restored = false) {
  if (!data || !data.id || animalIds.has(data.id) || typeof data.texture !== 'string' ||
      !SafariMotion.rigs[data.species] || data.artworkVersion !== '2026-09-artwork') {
    return;
  }

  animalIds.add(data.id);
  const order = arrivalOrder++;
  const loadGeneration = generation;
  const image = new Image();

  image.addEventListener('load', () => {
    if (loadGeneration !== generation) {
      animalIds.delete(data.id);
      return;
    }

    const direction = SafariMotion.rowDirection(restored ? 1 : 0);
    const species = SafariMotion.rigs[data.species] ? data.species : 'lion';
    animals.push({
      id: data.id,
      order,
      restored,
      hasEntered: restored,
      readyAt: performance.now() + (restored ? 0 : 450),
      arrivalPause: 0.25 + Math.random() * 0.45,
      tempo: 1,
      tempoTarget: 1,
      tempoIn: 0,
      image,
      species,
      direction,
      x: -1000,
      waiting: true,
      elapsed: 0,
      gait: 0,
      textures: [0.025, 0.28, 0.46].map(fog => makeHazeTexture(image, fog)),
      mesh: AnimalRig.create(SafariMotion.rigs[species]),
      age: restored ? 25 : 0,
      phase: Math.random() * Math.PI * 2,
      speed: SafariMotion.preferredSpeed(species, Math.random()),
      spacing: 0.75 + Math.random() * 0.7,
      layer: restored ? 1 : 0,
    });

    while (animals.length > 30) {
      const removed = animals.shift();
      animalIds.delete(removed.id);
    }
    updateAnimalCount();
  });

  image.addEventListener('error', () => {
    animalIds.delete(data.id);
    if (!animals.length) hud.textContent = 'Could not load an animal texture';
  });

  image.src = data.texture;
}

function makeHazeTexture(image, fog) {
  const texture = document.createElement('canvas');
  texture.width = image.width;
  texture.height = image.height;
  const paint = texture.getContext('2d');
  paint.drawImage(image, 0, 0);
  paint.globalCompositeOperation = 'source-atop';
  paint.globalAlpha = fog;
  paint.fillStyle = '#9bb9b5';
  paint.fillRect(0, 0, texture.width, texture.height);
  return texture;
}

function drawMist(width, height, lane, opacity) {
  const top = 0;
  const bottom = height * (lane + 0.055);
  const mist = context.createLinearGradient(0, top, 0, bottom);
  mist.addColorStop(0, `rgba(153, 187, 182, ${opacity * 0.3})`);
  mist.addColorStop(0.4, `rgba(153, 187, 182, ${opacity * 0.8})`);
  mist.addColorStop(0.7, `rgba(153, 187, 182, ${opacity})`);
  mist.addColorStop(1, 'rgba(153, 187, 182, 0)');
  context.fillStyle = mist;
  context.fillRect(0, top, width, bottom - top);
}

function drawAnimal(animal, width, height, deltaTime) {
  if (animal.waiting) return;
  animal.age += deltaTime;
  animal.elapsed += deltaTime;
  SafariMotion.updateTempo(animal, deltaTime);
  const depth = animal.layer;
  const scale = SafariMotion.rowScale(depth, width);
  const lane = 0.80 - depth * 0.145;
  const movement = SafariMotion.pace(animal.elapsed, animal.arrivalPause);
  const rig = SafariMotion.rigs[animal.species];
  const distance = SafariMotion.travelDistance(animal, animals, width, deltaTime);
  animal.x += distance * animal.direction;
  // Match planted-foot motion to ground speed instead of a fixed timer.
  animal.gait += distance * 0.62 / (AnimalRig.STRIDE * scale);
  const animalWidth = rig.width * scale;
  const animalHeight = rig.height * scale;
  const y = height * lane - animalHeight;

  context.save();
  context.globalAlpha = 0.13 * (1 - depth * 0.3);
  context.fillStyle = '#001a20';
  context.beginPath();
  context.ellipse(animal.x + animalWidth * 0.5, height * lane - 4, animalWidth * 0.34, 5 * scale + 2, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();

  context.save();
  context.translate(animal.x, y);
  if (SafariMotion.shouldFlip(animal.species, animal.direction)) {
    context.translate(animalWidth, 0);
    context.scale(-1, 1);
  }
  context.scale(scale, scale);
  AnimalRig.draw(context, animal.textures[depth], rig, animal.mesh, animal.gait, movement);
  context.restore();

  const nextPass = SafariMotion.nextPass(animal, width);
  if (nextPass) {
    Object.assign(animal, nextPass);
    if (!animal.dead) animal.waiting = true;
    updateAnimalCount();
  }
}

function drawFrame(now) {
  const deltaTime = Math.min((now - lastFrameTime) / 1000, 0.05);
  lastFrameTime = now;
  const width = canvas.width / deviceScale;
  const height = canvas.height / deviceScale;

  context.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
  JungleScene.background(context, width, height, now);

  // Admit each row's oldest waiting animal first, after its welcome poof.
  for (const layer of [0, 1, 2]) {
    const animal = animals.filter((entry) => entry.waiting && entry.layer === layer)
      .sort((a, b) => a.order - b.order)[0];
    if (animal && now >= animal.readyAt && SafariMotion.canEnter(animal, animals, width)) {
      animal.x = SafariMotion.entryPosition(animal, width);
      animal.waiting = false;
      animal.hasEntered = true;
      animal.elapsed = animal.layer === 0 ? 0 : 10;
      updateAnimalCount();
    }
  }
  animals.sort((first, second) => second.layer - first.layer);
  // Snapshot membership: exiting animals must not draw twice in the same frame.
  const rows = [0, 1, 2].map((layer) => animals.filter((animal) => animal.layer === layer));
  for (const layer of [2, 1, 0]) {
    rows[layer].forEach((animal) => drawAnimal(animal, width, height, deltaTime));
    // Composite mist AFTER its animals, BEFORE the closer row.
    if (layer > 0) drawMist(width, height, 0.80 - layer * 0.145, layer === 2 ? 0.25 : 0.16);
  }
  JungleScene.foreground(context, width, height, now);

  for (let index = animals.length - 1; index >= 0; index -= 1) {
    if (animals[index].dead) {
      animalIds.delete(animals[index].id);
      animals.splice(index, 1);
      updateAnimalCount();
    }
  }

  requestAnimationFrame(drawFrame);
}

requestAnimationFrame(drawFrame);

function clearScene() {
  generation += 1;
  animals.length = 0;
  animalIds.clear();
  updateAnimalCount();
}

if (location.hostname.endsWith('.trycloudflare.com')) {
  // Quick Tunnels do not support SSE. Keep a separate seen set so animals
  // that have finished their walk are not replayed on every poll.
  const seen = new Set();
  let initialized = false;
  async function pollAnimals() {
    try {
      const response = await fetch('/api/animals', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const saved = await response.json();
      if (initialized && saved.length === 0 && seen.size) {
        clearScene();
        seen.clear();
      }
      for (const animal of saved) {
        if (seen.has(animal.id)) continue;
        seen.add(animal.id);
        addAnimal(animal, !initialized);
      }
      initialized = true;
    } catch {
      if (!animals.length) hud.textContent = 'Connecting to the sketchbook server…';
    } finally {
      setTimeout(pollAnimals, 1500);
    }
  }
  pollAnimals();
} else {
  fetch('/api/animals')
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then((savedAnimals) => savedAnimals.forEach((animal) => addAnimal(animal, true)))
    .catch(() => {
      hud.textContent = 'Display connected, but saved animals could not be loaded';
    });

  const events = new EventSource('/api/events');
  events.addEventListener('open', () => {
    if (!animals.length) updateAnimalCount();
  });
  events.addEventListener('animal', (event) => {
    try {
      addAnimal(JSON.parse(event.data));
    } catch {
      hud.textContent = 'Received an invalid animal';
    }
  });
  events.addEventListener('clear', () => {
    generation += 1;
    animals.length = 0;
    animalIds.clear();
    updateAnimalCount();
  });
  events.addEventListener('error', () => {
    if (!animals.length) hud.textContent = 'Reconnecting to the sketchbook server…';
  });

}

clearButton.addEventListener('click', async () => {
  clearButton.disabled = true;
  try {
    const response = await fetch('/api/clear', { method: 'POST' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch {
    hud.textContent = 'Could not clear the safari';
  } finally {
    clearButton.disabled = false;
  }
});
