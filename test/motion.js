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
    for (let layer = 0; layer < motion.rowCount; layer++) {
      const animalWidth = motion.rigs[species].width * motion.rowScale(layer, width);
      const animal = { species, direction, layer, x: direction === 1 ? width - 1 : 1 - animalWidth, age: 9999 };
      assert.equal(motion.nextPass(animal, width), null, 'visible animals must stay in their row regardless of age');
      animal.x = direction === 1 ? width + 100 : -animalWidth - 100;
      const next = motion.nextPass(animal, width);
      if (layer === motion.rowCount-1) {
        assert.deepEqual(next, { dead: true }, 'last row exits permanently');
      } else {
        assert.equal(next.layer, layer + 1, 'advance exactly one row');
        const nextWidth = motion.rigs[species].width * motion.rowScale(next.layer, width);
        assert.equal(next.direction, -direction);
        assert.ok(next.direction === 1 ? next.x + nextWidth < 0 : next.x > width, 'reenter entirely offscreen');
        assert.equal(motion.nextPass({ ...animal, ...next }, width), null, 'do not skip a row on reentry');
      }
    }
  }
}
assert.equal(motion.rowCount,4,'front trail plus three background trails');
const start = motion.footstep(0, 50, 15);
const stance = motion.footstep(0.31, 50, 15);
assert.equal(start.lift, 0);
assert.equal(stance.lift, 0);
assert.ok(stance.x < start.x, 'planted foot moves opposite travel');
assert.ok(motion.footstep(.86, 50, 15).lift > 14, 'foot lifts during recovery');
assert.deepEqual(motion.footstep(1, 50, 15), start);
console.log('Motion tests passed');

for (let layer = 0; layer < motion.rowCount; layer++) {
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
  assert.ok(motion.preferredSpeed(species, 0) > 27);
  assert.ok(motion.preferredSpeed(species, 1) < 33, 'walking is 15% slower with subtle species variation');
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

// Queue admission is measured in seconds and still preserves physical spacing.
for(const width of [450,900,1500]) for(const species of Object.keys(motion.rigs)) {
  const leader={species:'elephant',layer:0,direction:1,x:24,speed:motion.preferredSpeed('elephant'),elapsed:0,arrivalPause:.2,spacing:1};
  const next={species,layer:0,waiting:true,entryFromQueue:true,spacing:1};
  let seconds=0;
  while(!motion.canEnter(next,[leader],width)&&seconds<20){
    const dt=1/60;leader.elapsed+=dt;
    leader.x+=motion.travelDistance(leader,[leader],width,dt);seconds+=dt;
  }
  assert.ok(seconds<5,`${species} starts entering promptly at ${width}px (${seconds.toFixed(2)}s)`);
  const right=motion.entryPosition(next,width)+motion.rigs[species].width*motion.rowScale(0,width);
  assert.ok(right<width*.15+24,'only the leading portion enters initially');
  assert.ok(leader.x-right>=Math.max(28,width*.035),'admission keeps a safe gap');
}
console.log('Faster queued arrivals passed at phone, desktop and wide viewport sizes');

for(let order=0;order<12;order++) {
 const plan=motion.arrivalPlan(order,12,()=>.5);
 assert.equal(plan.layer,0);
 assert.equal(plan.direction,order%2 ? 1 : -1,'a continual queue uses both edges');
}
assert.ok(motion.arrivalPlan(0,0,()=>1).spacing>motion.arrivalPlan(0,12,()=>1).spacing,'busy scan queues use closer gaps');
assert.ok(motion.arrivalPlan(0,0,()=>1).spacing-motion.arrivalPlan(0,0,()=>0).spacing>1.5,'quiet arrivals have visibly varied gaps');
for(const direction of [-1,1]) {
 const walker={species:'elephant',layer:0,direction,x:300,speed:36,elapsed:10,spacing:1};
 const opposite={...walker,direction:-direction,x:direction===1 ? 400 : 200};
 assert.equal(motion.travelDistance(walker,[walker,opposite],900,.05),motion.travelDistance(walker,[walker],900,.05),'opposing tracks can pass without blocking');
 assert.ok(motion.canEnter({...walker,waiting:true},[opposite],900),'both sides can enter the front row');
}
// Ground speed and stance speed must cancel, including at lift-off/landing.
for(const stance of [.70,.72,.74,.76]) {
 const stride=50,scale=.42,travel=8,start=.1;
 const before=motion.footstep(start,stride,20,stance);
 const after=motion.footstep(start+travel*stance/(stride*scale),stride,20,stance);
 assert.ok(Math.abs(travel+(after.x-before.x)*scale)<1e-8,'a planted foot stays fixed in world space');
 for(const boundary of [stance,1]) {
  const e=.000001;
  const centre=motion.footstep(boundary,stride,20,stance);
  const left=motion.footstep(boundary-e,stride,20,stance);
  const right=motion.footstep(boundary+e,stride,20,stance);
  assert.ok(Math.abs((centre.x-left.x)/e-(right.x-centre.x)/e)<.01,'contact has no horizontal velocity snap');
  assert.ok(left.lift+right.lift<.000001,'lift-off and landing have zero vertical velocity');
 }
}
console.log('Two-way traffic, variable scan spacing and continuous planted-foot motion passed');

const rearArrival={species:'elephant',layer:1,direction:1,waiting:true};
const rearCrowd=[300,550,800].map(x=>({species:'elephant',layer:1,direction:1,x}));
assert.equal(motion.canEnter(rearArrival,rearCrowd,900),false,'background row is limited to three active animals');
rearCrowd[0].dead=true;
assert.ok(motion.canEnter(rearArrival,rearCrowd,900),'background queue resumes when an animal finishes');
console.log('Background crowd limit passed');

for (const direction of [-1, 1]) for (const size of [.7, 1.3]) {
  for (const species of Object.keys(motion.rigs)) {
    let animal = { species, layer: 0, direction, startDirection: direction, size, hasEntered: true };
    for (let pass = 0; pass < motion.rowCount * 3; pass++) {
      const scale = motion.animalScale(animal, 1920, 540);
      const bodyWidth = motion.rigs[species].width * scale;
      animal.x = animal.direction === 1 ? 1920 + 79 * scale : -bodyWidth - 79 * scale;
      assert.equal(motion.nextPass(animal, 1920, true, 540), null, 'wait until the animated extremities are offscreen');
      animal.x = animal.direction === 1 ? 1920 + 81 * scale : -bodyWidth - 81 * scale;
      const next = motion.nextPass(animal, 1920, true, 540);
      assert.equal(next.layer, (pass + 1) % motion.rowCount);
      if (next.layer === 0) assert.equal(next.direction, direction, 'loop returns to the original side');
      animal = { ...animal, ...next };
      assert.equal(animal.size, size, 'individual size remains constant between passes');
      const entry = motion.entryPosition(animal, 1920, 540);
      const nextWidth = motion.rigs[species].width * motion.animalScale(animal, 1920, 540);
      assert.ok(animal.direction === 1 ? entry + nextWidth < 0 : entry > 1920, 'repeat entries begin entirely offscreen');
    }
    animal.layer = motion.rowCount - 1;
    animal.x = animal.direction === 1 ? 3000 : -3000;
    assert.deepEqual(motion.nextPass(animal, 1920, false, 540), { dead: true }, 'disabling infinite mode takes effect at the final exit');
  }
}
for (const random of [() => 0, () => 1]) {
  const size = motion.arrivalPlan(0, 0, random).size;
  assert.ok(size >= .7 && size <= 1.3, 'size varies by at most 30%');
}
for (const direction of [-1, 1]) {
  const follower = { species: 'giraffe', layer: 0, direction, size: 1.3, x: 500, speed: 31, elapsed: 10 };
  const leader = { species: 'elephant', layer: 0, direction, size: .7 };
  leader.x = direction === 1
    ? follower.x + motion.rigs.giraffe.width * motion.animalScale(follower, 1280, 720) + 90
    : follower.x - motion.rigs.elephant.width * motion.animalScale(leader, 1280, 720) - 90;
  for (let i = 0; i < 2000; i++) follower.x += direction * motion.travelDistance(follower, [follower, leader], 1280, .05, 720);
  const gap = direction === 1
    ? leader.x - follower.x - motion.rigs.giraffe.width * motion.animalScale(follower, 1280, 720)
    : follower.x - leader.x - motion.rigs.elephant.width * motion.animalScale(leader, 1280, 720);
  assert.ok(gap >= 1280 * .035 - 1e-6, 'different individual sizes retain safe following gaps');
}
console.log('Four-row lifecycle, repeated loops, size extremes and mixed-size spacing passed');
