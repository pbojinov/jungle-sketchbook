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
  if (!data || !data.id || animalIds.has(data.id) || typeof data.texture !== 'string') {
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
      haze: makeHazeTexture(image),
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

  try {
    image.src = await refreshLegacySample(data.species, data.texture);
  } catch {
    image.src = data.texture;
  }
}

function makeHazeTexture(image) {
  const texture = document.createElement('canvas');
  texture.width = image.width;
  texture.height = image.height;
  const paint = texture.getContext('2d');
  paint.drawImage(image, 0, 0);
  paint.globalCompositeOperation = 'source-in';
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

function drawRig(animal, rig, movement, fog) {
  const image = animal.image;
  const ratioX = image.width / rig.width;
  const ratioY = image.height / rig.height;
  const hipY = rig.hip - rig.y;
  const legLength = rig.foot - rig.hip;
  const stride = legLength * 0.46;
  function piece(sx, sy, sw, sh, dx, dy, dw, dh) {
    context.drawImage(image, sx * ratioX, sy * ratioY, sw * ratioX, sh * ratioY, dx, dy, dw, dh);
    if (fog > 0) {
      const opacity = context.globalAlpha;
      context.globalAlpha = opacity * fog;
      context.drawImage(animal.haze, sx * ratioX, sy * ratioY, sw * ratioX, sh * ratioY, dx, dy, dw, dh);
      context.globalAlpha = opacity;
    }
  }
  function leg(index, far) {
    const [left, right] = rig.legs[index];
    const legWidth = right - left;
    const hipX = (left + right) / 2 - rig.x;
    const step = SafariMotion.footstep(animal.gait + index * 0.5 + (far ? 0.25 : 0), stride, legLength * 0.17);
    const dx = step.x * rig.facing * movement;
    const dy = legLength * 0.96 - step.lift * movement;
    const length = legLength / 2;
    const distance = Math.min(Math.hypot(dx, dy), legLength - 0.01);
    const bend = Math.sqrt(Math.max(0, length * length - distance * distance / 4));
    const kneeX = dx / 2 + rig.facing * bend * dy / distance;
    const kneeY = dy / 2 - rig.facing * bend * dx / distance;
    context.save();
    context.translate(hipX + (far ? -rig.facing * 9 : 0), hipY);
    if (far) context.globalAlpha = 0.72;
    function segment(x1, y1, x2, y2, sourceY, sourceHeight) {
      context.save();
      context.translate(x1, y1);
      context.rotate(-Math.atan2(x2 - x1, y2 - y1));
      piece(left - rig.x, sourceY, legWidth, sourceHeight,
        -legWidth / 2, -1, legWidth, Math.hypot(x2 - x1, y2 - y1) + 2);
      context.restore();
    }
    segment(0, 0, kneeX, kneeY, hipY, length);
    segment(kneeX, kneeY, dx, dy, hipY + length, length + 3);
    context.restore();
  }
  leg(0, true);
  leg(1, true);
  leg(0, false);
  leg(1, false);
  // Overlap the hips to avoid seams while keeping the original upper artwork.
  piece(0, 0, rig.width, hipY + 5, 0, 0, rig.width, hipY + 5);
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
  animal.gait += distance * 0.62 / ((rig.foot - rig.hip) * 0.46 * scale);
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
  drawRig(animal, rig, movement, [0.025, 0.28, 0.46][depth]);
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
