const canvas = document.querySelector('#world');
const context = canvas.getContext('2d');
const hud = document.querySelector('#hud');
const connectionStatus = document.querySelector('#connectionStatus');

const displayConfig = window.SketchDisplayConfig.load(window.localStorage);
const systemPrefersReducedMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)',
).matches;
const reducedMotion = window.SketchDisplayConfig.reducedMotion(
  displayConfig,
  systemPrefersReducedMotion,
);
const paperRigsEnabled =
  !reducedMotion &&
  new URLSearchParams(window.location.search).get('rig') !== 'off';
connectionStatus.classList.toggle('quiet', displayConfig.quietHud);

const animals = [];
const animalIds = new Set();
let deviceScale = 1;
let lastFrameTime = performance.now();
let lastRenderedTime = 0;
let generation = 0;
let disconnectTimer = null;

function resizeCanvas() {
  deviceScale = displayConfig.lowPower
    ? 1
    : Math.min(window.devicePixelRatio || 1, 2);
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
    const behavior = window.SpeciesCatalog[data.species]?.behavior || {
      laneOffset: 0,
      scale: 1,
      speed: 1,
    };
    let rig = null;
    if (paperRigsEnabled && data.species === 'lion' && window.AnimalRigs?.lion) {
      try {
        rig = window.AnimalRigs.lion.create(image);
      } catch {
        rig = null;
      }
    }
    animals.push({
      behavior,
      id: data.id,
      image,
      direction,
      x: direction === 1 ? -image.width : window.innerWidth + image.width,
      age: restored ? 25 : 0,
      phase: Math.random() * Math.PI * 2,
      rig,
      speed: (80 + Math.random() * 35) * behavior.speed,
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

function drawFrond(x, y, length, angle, color, sway) {
  context.save();
  context.translate(x, y);
  context.rotate(angle + sway);
  context.strokeStyle = color;
  context.lineCap = 'round';
  context.lineWidth = Math.max(2, length * 0.025);
  context.beginPath();
  context.moveTo(0, 0);
  context.quadraticCurveTo(length * 0.45, -length * 0.12, length, 0);
  context.stroke();

  for (let index = 1; index < 8; index += 1) {
    const progress = index / 8;
    const stemX = length * progress;
    const leafLength = length * 0.28 * (1 - progress * 0.45);
    context.lineWidth = Math.max(1.5, length * 0.017);
    for (const side of [-1, 1]) {
      context.beginPath();
      context.moveTo(stemX, -length * 0.05 * Math.sin(progress * Math.PI));
      context.quadraticCurveTo(
        stemX - leafLength * 0.15,
        side * leafLength * 0.35,
        stemX - leafLength * 0.55,
        side * leafLength,
      );
      context.stroke();
    }
  }
  context.restore();
}

function drawGlow(x, y, radius, color) {
  const glow = context.createRadialGradient(x, y, 0, x, y, radius);
  glow.addColorStop(0, color);
  glow.addColorStop(1, 'transparent');
  context.fillStyle = glow;
  context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

function drawTree(x, width, height, color) {
  context.fillStyle = color;
  context.beginPath();
  context.moveTo(x - width * 0.55, height);
  context.bezierCurveTo(
    x - width * 0.2,
    height * 0.72,
    x - width * 0.45,
    height * 0.4,
    x - width * 0.15,
    -20,
  );
  context.lineTo(x + width * 0.35, -20);
  context.bezierCurveTo(
    x + width * 0.1,
    height * 0.42,
    x + width * 0.48,
    height * 0.72,
    x + width * 0.55,
    height,
  );
  context.closePath();
  context.fill();
}

function drawBackground(width, height, time) {
  const sky = context.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#08152c');
  sky.addColorStop(0.48, '#10293a');
  sky.addColorStop(0.76, '#073a39');
  sky.addColorStop(1, '#061d28');
  context.fillStyle = sky;
  context.fillRect(0, 0, width, height);

  drawGlow(width * 0.18, height * 0.5, height * 0.3, '#155d7088');
  drawGlow(width * 0.78, height * 0.42, height * 0.26, '#5b256f66');

  const treePositions = [0.08, 0.34, 0.68, 0.93];
  treePositions.forEach((position, index) => {
    drawTree(
      width * position,
      width * (0.08 + (index % 2) * 0.025),
      height,
      index % 2 ? '#09252a' : '#0a3034',
    );
  });

  const sway = reducedMotion ? 0 : Math.sin(time * 0.00035) * 0.025;
  const frondCount = displayConfig.lowPower ? 8 : 12;
  for (let index = 0; index < frondCount; index += 1) {
    const fromLeft = index % 2 === 0;
    const x = fromLeft ? width * 0.03 : width * 0.97;
    const y = height * (0.05 + (index % 6) * 0.075);
    const angle = fromLeft ? -0.12 + index * 0.025 : Math.PI + 0.12 - index * 0.02;
    const colors = ['#1f817e', '#3a8b87', '#6b3e8d', '#2e6e77'];
    drawFrond(x, y, width * 0.16, angle, colors[index % colors.length], sway);
  }

  context.fillStyle = '#082d35';
  context.fillRect(0, height * 0.7, width, height * 0.3);

  const fireflyCount = displayConfig.lowPower ? 16 : 34;
  for (let index = 0; index < fireflyCount; index += 1) {
    const x = ((index * 83) % 997) / 997 * width;
    const baseY = (0.2 + ((index * 47) % 70) / 100) * height;
    const y = baseY + (reducedMotion ? 0 : Math.sin(time * 0.001 + index * 1.7) * 8);
    const pulse = reducedMotion ? 1.5 : 1.5 + 1.4 * Math.sin(time * 0.002 + index);
    context.fillStyle = index % 3 === 0 ? '#ffd88c' : '#75f8df';
    context.globalAlpha = reducedMotion
      ? 0.55
      : 0.45 + 0.35 * Math.sin(time * 0.0015 + index * 0.9);
    context.beginPath();
    context.arc(x, y, Math.max(0.8, pulse), 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;
}

function drawForeground(width, height, time) {
  const colors = ['#235f63', '#71418e', '#267c77', '#a34389'];
  const sway = reducedMotion ? 0 : Math.sin(time * 0.0005) * 0.035;
  for (let index = 0; index < 10; index += 1) {
    const x = width * (index / 9);
    const y = height * (0.86 + (index % 2) * 0.05);
    const length = height * (0.13 + (index % 3) * 0.025);
    drawFrond(x, y, length, -Math.PI / 2, colors[index % colors.length], sway);
  }

  const grass = context.createLinearGradient(0, height * 0.82, 0, height);
  grass.addColorStop(0, '#0d545499');
  grass.addColorStop(1, '#04181f');
  context.fillStyle = grass;
  context.fillRect(0, height * 0.88, width, height * 0.12);
}

function drawAnimal(animal, width, height, deltaTime) {
  animal.age += deltaTime;
  if (animal.age > 14 && animal.layer === 0) animal.layer = 1;
  if (animal.age > 32 && animal.layer === 1) animal.layer = 2;

  const scale =
    [0.42, 0.28, 0.18][animal.layer] *
    Math.min(width / 900, 1.5) *
    animal.behavior.scale;
  const lane = [0.69, 0.61, 0.55][animal.layer] + animal.behavior.laneOffset;
  const motionScale = reducedMotion ? 0.35 : 1;
  animal.x +=
    animal.speed * deltaTime * animal.direction * (1 - 0.14 * animal.layer) * motionScale;

  const animalWidth = animal.image.width * scale;
  const animalHeight = animal.image.height * scale;
  const bob = reducedMotion ? 0 : Math.sin(animal.phase + animal.age * 5) * 5;
  const y = height * lane - animalHeight + bob;

  context.save();
  context.translate(animal.x, y);
  if (animal.direction < 0) {
    context.translate(animalWidth, 0);
    context.scale(-1, 1);
  }
  context.translate(animalWidth * 0.5, animalHeight * 0.5);
  const rotation = reducedMotion
    ? 0
    : Math.sin(animal.phase + animal.age * 3) * 0.015;
  context.rotate(rotation);
  context.translate(-animalWidth * 0.5, -animalHeight * 0.5);
  if (animal.rig) {
    context.scale(scale, scale);
    animal.rig.draw(context, animal.age, animal.phase);
  } else {
    context.drawImage(animal.image, 0, 0, animalWidth, animalHeight);
  }
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
  if (displayConfig.lowPower && now - lastRenderedTime < 1000 / 30) {
    requestAnimationFrame(drawFrame);
    return;
  }
  lastRenderedTime = now;
  const deltaTime = Math.min((now - lastFrameTime) / 1000, 0.05);
  lastFrameTime = now;
  const width = canvas.width / deviceScale;
  const height = canvas.height / deviceScale;

  context.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
  drawBackground(width, height, now);

  animals.sort((first, second) => second.layer - first.layer);
  animals.forEach((animal) => drawAnimal(animal, width, height, deltaTime));
  drawForeground(width, height, now);

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
  clearTimeout(disconnectTimer);
  disconnectTimer = null;
  connectionStatus.dataset.state = 'online';
  connectionStatus.textContent = '';
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
events.addEventListener('remove', (event) => {
  try {
    const { id } = JSON.parse(event.data);
    const index = animals.findIndex((animal) => animal.id === id);
    if (index >= 0) animals.splice(index, 1);
    animalIds.delete(id);
    updateAnimalCount();
  } catch {
    hud.textContent = 'Received an invalid removal';
  }
});
events.addEventListener('error', () => {
  if (disconnectTimer) return;
  disconnectTimer = setTimeout(() => {
    connectionStatus.dataset.state = 'offline';
    connectionStatus.textContent = 'Reconnecting';
  }, 2_500);
});
