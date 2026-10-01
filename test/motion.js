const assert = require('node:assert/strict');
const motion = require('../public/motion');
for (const [species, rig] of Object.entries(motion.rigs)) {
  for (const direction of [-1, 1]) {
    const facing = motion.shouldFlip(species, direction) ? -rig.facing : rig.facing;
    assert.equal(facing, direction, `${species} must face its travel direction`);
  }
}
assert.equal(motion.pace(0), 0);
assert.equal(motion.pace(2), 0);
assert.equal(motion.pace(3.5), 1);
for (const species of Object.keys(motion.rigs)) {
  const width = 900;
  for (const direction of [-1, 1]) {
    for (const layer of [0, 1, 2]) {
      const animalWidth = motion.rigs[species].width * motion.rowScale(layer, width);
      const animal = { species, direction, layer, x: direction === 1 ? width - 1 : 1 - animalWidth, age: 9999 };
      assert.equal(motion.nextPass(animal, width), null, 'visible animals must stay in their row regardless of age');
      animal.x = direction === 1 ? width + 100 : -animalWidth - 100;
      const next = motion.nextPass(animal, width);
      if (layer === 2) {
        assert.deepEqual(next, { dead: true }, 'last row exits permanently');
      } else {
        assert.equal(next.layer, layer + 1, 'advance exactly one row');
        const nextWidth = motion.rigs[species].width * motion.rowScale(next.layer, width);
        assert.equal(next.direction, motion.rowDirection(next.layer));
        assert.ok(next.direction === 1 ? next.x + nextWidth < 0 : next.x > width, 'reenter entirely offscreen');
        assert.equal(motion.nextPass({ ...animal, ...next }, width), null, 'do not skip a row on reentry');
      }
    }
  }
}
const start = motion.footstep(0, 50, 15);
const stance = motion.footstep(0.31, 50, 15);
assert.equal(start.lift, 0);
assert.equal(stance.lift, 0);
assert.ok(stance.x < start.x, 'planted foot moves opposite travel');
assert.ok(motion.footstep(0.81, 50, 15).lift > 14, 'foot lifts during recovery');
assert.deepEqual(motion.footstep(1, 50, 15), start);
console.log('Motion tests passed');

for (const layer of [0, 1, 2]) {
  for (const species of Object.keys(motion.rigs)) {
    const arrival = { species, layer, waiting: true };
    assert.ok(motion.canEnter(arrival, [], 900));
    const leader = { species: 'giraffe', layer, x: motion.rowDirection(layer) === 1 ? 0 : 900, waiting: false };
    assert.equal(motion.canEnter(arrival, [leader], 900), false, 'occupied entry must queue arrivals');
    leader.x = motion.rowDirection(layer) === 1
      ? motion.entryPosition(arrival, 900) + motion.rigs[species].width * motion.rowScale(layer, 900) + 109
      : motion.entryPosition(arrival, 900) - motion.rigs.giraffe.width * motion.rowScale(layer, 900) - 109;
    assert.ok(motion.canEnter(arrival, [leader], 900), 'release only after a full animal width plus gap');
  }
}
console.log('Arrival spacing tests passed');

for (const species of Object.keys(motion.rigs)) {
  assert.ok(motion.preferredSpeed(species, 0) > 25);
  assert.ok(motion.preferredSpeed(species, 1) < 31, 'variation stays subtle');
}
assert.ok(motion.preferredSpeed('monkey') > motion.preferredSpeed('zebra'));
assert.ok(motion.preferredSpeed('zebra') > motion.preferredSpeed('lion'));
assert.ok(motion.preferredSpeed('lion') > motion.preferredSpeed('elephant'));
for (const layer of [0, 1]) {
  const direction = motion.rowDirection(layer);
  const scale = motion.rowScale(layer, 900);
  const follower = { species: 'giraffe', layer, direction, x: 0, speed: 31, elapsed: 10, phase: 0, spacing: 1 };
  const leader = { species: 'elephant', layer, direction, x: direction === 1 ? motion.rigs.giraffe.width * scale + 45 : -motion.rigs.elephant.width * scale - 45 };
  const free = motion.travelDistance(follower, [follower], 900, 0.05);
  assert.ok(motion.travelDistance(follower, [follower, leader], 900, 0.05) < free, 'ease off near a slower leader');
  for (let frame = 0; frame < 1200; frame++) {
    follower.x += direction * motion.travelDistance(follower, [follower, leader], 900, 0.05);
  }
  const gap = direction === 1 ? leader.x - follower.x - motion.rigs.giraffe.width * scale : follower.x - leader.x - motion.rigs.elephant.width * scale;
  assert.ok(gap >= 31.49, 'never overlap even behind a stopped animal');
}
console.log('Variable pace and following-distance tests passed');

const tempoAnimal = { tempo: 1, tempoTarget: 1, tempoIn: 0 };
let lastTempo = 1;
for (let frame = 0; frame < 1200; frame++) {
  const tempo = motion.updateTempo(tempoAnimal, 0.05, () => frame % 2 ? 0 : 1);
  assert.ok(tempo >= 0.88 && tempo <= 1.12, 'tempo stays within gentle bounds');
  assert.ok(Math.abs(tempo - lastTempo) < 0.01, 'tempo changes smoothly without jitter');
  lastTempo = tempo;
}
assert.equal(motion.pace(2, 3), 0, 'individual greeting pause is respected');
assert.equal(motion.pace(5, 3), 1);
console.log('Smooth random tempo tests passed');
