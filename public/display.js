const canvas = document.querySelector('#world');
const context = canvas.getContext('2d');
const hud = document.querySelector('#hud');
const clearButton = document.querySelector('#clear');
const arrivals = document.querySelector('#arrivals');
const arrivalList = document.querySelector('#arrival-list');
const controls = document.querySelector('#controls');
const arrivalCards = new Map();
let arrivalOrder = 0;

const animals = [];
const animalIds = new Set();
let deviceScale = 1;
let lastFrameTime = performance.now();
let generation = 0;
let controlsHeight = controls.getBoundingClientRect().height;

function layoutControls() {
  controlsHeight = controls.getBoundingClientRect().height;
  arrivals.style.bottom = `${controlsHeight + 30}px`;
}
new ResizeObserver(layoutControls).observe(controls);
layoutControls();

function resizeCanvas() {
  deviceScale = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * deviceScale);
  canvas.height = Math.floor(window.innerHeight * deviceScale);
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function updateArrivals() {
  const waiting = animals.filter((animal) => animal.waiting && !animal.hasEntered)
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

    const plan = SafariMotion.arrivalPlan(order, animals.filter(a=>a.waiting&&a.layer===0).length);
    const species = SafariMotion.rigs[data.species] ? data.species : 'lion';
    animals.push({
      id: data.id,
      order,
      restored,
      hasEntered: false,
      readyAt: performance.now() + (restored ? 0 : 450),
      arrivalPause: plan.arrivalPause,
      tempo: 1,
      tempoTarget: 1,
      tempoIn: 0,
      image,
      footBaseline: textureFootBaseline(image, SafariMotion.rigs[species]),
      species,
      direction: plan.direction,
      x: -1000,
      waiting: true,
      elapsed: 0,
      gait: 0,
      textures: [0.025, 0.34].map(fog => makeHazeTexture(image, fog)),
      mesh: AnimalRig.create(SafariMotion.rigs[species]),
      age: 0,
      phase: Math.random() * Math.PI * 2,
      speed: SafariMotion.preferredSpeed(species, Math.random()),
      spacing: plan.spacing,
      layer: 0,
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

// Texture crops include transparent padding below the feet. Align visible ink,
// rather than the rectangular crop, with the trail and its contact shadow.
function textureFootBaseline(image, rig) {
  const probe=document.createElement('canvas');
  probe.width=image.width;probe.height=image.height;
  const paint=probe.getContext('2d',{willReadFrequently:true});
  paint.drawImage(image,0,0);
  const pixels=paint.getImageData(0,0,probe.width,probe.height).data;
  for(let y=probe.height-1;y>=0;y--) for(let x=0;x<probe.width;x++) {
    if(pixels[(y*probe.width+x)*4+3]>32)return (y+1)/probe.height*rig.height;
  }
  return rig.height;
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
  const movement = 1; // Cadence already follows actual travel, including acceleration.
  const rig = SafariMotion.rigs[animal.species];
  const distance = SafariMotion.travelDistance(animal, animals, width, deltaTime);
  animal.x += distance * animal.direction;
  // Match planted-foot motion to ground speed instead of a fixed timer.
  animal.gait += distance * animal.mesh.profile.stance / (animal.mesh.profile.stride * scale);
  const animalWidth = rig.width * scale;
  const ground=JungleScene.groundY(width,height,depth,animal.x+animalWidth*.5,controlsHeight) + height*.008*animal.direction;
  const y = ground - animal.footBaseline * scale;

  context.save();
  context.globalAlpha = 0.22 * (1 - depth * 0.18);
  context.fillStyle = '#001a20';
  context.beginPath();
  context.ellipse(animal.x + animalWidth * 0.5, ground - 4, animalWidth * 0.34, 5 * scale + 2, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();

  context.save();
  context.translate(animal.x, y);
  if (SafariMotion.shouldFlip(animal.species, animal.direction)) {
    context.translate(animalWidth, 0);
    context.scale(-1, 1);
  }
  context.scale(scale, scale);
  context.globalAlpha = 1;
  AnimalRig.draw(context, animal.textures[depth], rig, animal.mesh, animal.gait, movement, animal.age, animal.phase, undefined, animal.footBaseline);
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
  JungleScene.background(context, width, height, now, controlsHeight);

  // Each entry edge has its own FIFO queue on opposite sides of the same trail.
  for (const layer of [0, 1]) for (const direction of [-1,1]) {
    const animal=animals.filter(entry=>entry.waiting&&entry.layer===layer&&entry.direction===direction)
      .sort((a,b)=>a.order-b.order)[0];
    if(animal&&layer===0) animal.entryFromQueue=animals.some(other=>other!==animal&&other.layer===0&&other.direction===direction&&!other.waiting&&!other.dead);
    if(animal&&now>=animal.readyAt&&SafariMotion.canEnter(animal,animals,width)) {
      animal.x=SafariMotion.entryPosition(animal,width);
      animal.waiting=false;animal.hasEntered=true;
      animal.elapsed=animal.layer===0 ? 0 : 10;
      updateAnimalCount();
    }
  }
  animals.sort((a,b)=>b.layer-a.layer || a.direction-b.direction);
  // Snapshot membership: exiting animals must not draw twice in the same frame.
  const rows = [0, 1].map((layer) => animals.filter((animal) => animal.layer === layer));
  for (const layer of [1, 0]) {
    rows[layer].forEach((animal) => drawAnimal(animal, width, height, deltaTime));
    // Composite mist AFTER its animals, BEFORE the closer row.
    if (layer > 0) drawMist(width, height, JungleScene.groundY(width,height,layer,width*.5,controlsHeight)/height, 0.18);
  }
  JungleScene.foreground(context, width, height, now, controlsHeight);

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
