const canvas = document.querySelector('#world');
const context = canvas.getContext('2d');
const hud = document.querySelector('#hud');
const clearButton = document.querySelector('#clear');

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

function updateAnimalCount() {
  if (!animals.length) {
    hud.textContent = 'Live Sketchbook Safari · waiting for animals…';
    return;
  }
  hud.textContent = `${animals.length} animal${animals.length === 1 ? '' : 's'} in the safari`;
}

function addAnimal(data, restored = false) {
  if (!data || !data.id || animalIds.has(data.id) || typeof data.texture !== 'string') {
    return;
  }

  animalIds.add(data.id);
  const loadGeneration = generation;
  const image = new Image();

  image.addEventListener('load', () => {
    if (loadGeneration !== generation) {
      animalIds.delete(data.id);
      return;
    }

    const direction = Math.random() < 0.5 ? 1 : -1;
    animals.push({
      id: data.id,
      image,
      direction,
      x: direction === 1 ? -image.width : window.innerWidth + image.width,
      age: restored ? 25 : 0,
      phase: Math.random() * Math.PI * 2,
      speed: 80 + Math.random() * 35,
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

function drawBackground(width, height, time) {
  const sky = context.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#557662');
  sky.addColorStop(0.55, '#253f31');
  sky.addColorStop(1, '#142219');
  context.fillStyle = sky;
  context.fillRect(0, 0, width, height);

  context.globalAlpha = 0.32;
  context.fillStyle = '#0b1d12';
  context.beginPath();
  context.moveTo(0, height * 0.58);
  for (let x = 0; x <= width; x += 90) {
    context.lineTo(x, height * (0.48 + 0.05 * Math.sin(x * 0.008 + time * 0.00005)));
  }
  context.lineTo(width, height);
  context.lineTo(0, height);
  context.fill();

  context.globalAlpha = 1;
  context.fillStyle = '#17301f';
  context.fillRect(0, height * 0.72, width, height * 0.28);
}

function drawAnimal(animal, width, height, deltaTime) {
  animal.age += deltaTime;
  if (animal.age > 14 && animal.layer === 0) animal.layer = 1;
  if (animal.age > 32 && animal.layer === 1) animal.layer = 2;

  const scale = [0.42, 0.28, 0.18][animal.layer] * Math.min(width / 900, 1.5);
  const lane = [0.69, 0.61, 0.55][animal.layer];
  animal.x += animal.speed * deltaTime * animal.direction * (1 - 0.14 * animal.layer);

  const animalWidth = animal.image.width * scale;
  const animalHeight = animal.image.height * scale;
  const y =
    height * lane - animalHeight + Math.sin(animal.phase + animal.age * 5) * 5;

  context.save();
  context.translate(animal.x, y);
  if (animal.direction < 0) {
    context.translate(animalWidth, 0);
    context.scale(-1, 1);
  }
  context.translate(animalWidth * 0.5, animalHeight * 0.5);
  context.rotate(Math.sin(animal.phase + animal.age * 3) * 0.015);
  context.translate(-animalWidth * 0.5, -animalHeight * 0.5);
  context.drawImage(animal.image, 0, 0, animalWidth, animalHeight);
  context.restore();

  const leftScene =
    (animal.direction === 1 && animal.x > width + animalWidth * 2) ||
    (animal.direction === -1 && animal.x < -animalWidth * 2);
  if (leftScene) {
    animal.x = animal.direction === 1 ? -animalWidth * 1.5 : width + animalWidth * 1.5;
    animal.phase = Math.random() * Math.PI * 2;
    if (animal.age > 55) animal.dead = true;
  }
}

function drawFrame(now) {
  const deltaTime = Math.min((now - lastFrameTime) / 1000, 0.05);
  lastFrameTime = now;
  const width = canvas.width / deviceScale;
  const height = canvas.height / deviceScale;

  context.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
  drawBackground(width, height, now);

  animals.sort((first, second) => second.layer - first.layer);
  animals.forEach((animal) => drawAnimal(animal, width, height, deltaTime));

  for (let index = animals.length - 1; index >= 0; index -= 1) {
    if (animals[index].dead) {
      animalIds.delete(animals[index].id);
      animals.splice(index, 1);
    }
  }

  requestAnimationFrame(drawFrame);
}

requestAnimationFrame(drawFrame);

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
