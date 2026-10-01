(function (root, factory) {
  const motion = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = motion;
  else root.SafariMotion = motion;
})(typeof globalThis === 'object' ? globalThis : this, function (root) {
  // Coordinates refer to the printed page; crops retain the child's pixels.
  const definitions = typeof module === 'object' && module.exports
    ? Object.fromEntries(['elephant','giraffe','lion','monkey','tiger','zebra'].map(name => [name,require(`./animals/${name}/shape.js`)]))
    : root.AnimalShapes;
  const rigs = Object.fromEntries(Object.entries(definitions).map(([name, shape]) => [name, {
    ...shape.bounds, species: name, facing: shape.facing, feet: shape.feet, displayScale: shape.displayScale,
  }]));
  const smooth = (value) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
  // Gentle artistic compression of running-speed differences, not measured walking speeds.
  const speedFactors = { elephant: 0.94, giraffe: 1.02, lion: 0.98, monkey: 1.04, tiger: 1.01, zebra: 1.02 };
  function preferredSpeed(species, individual = 0.5) {
    return 36 * speedFactors[species] * (0.98 + individual * 0.04);
  }
  function travelDistance(animal, others, width, dt) {
    const scale = rowScale(animal.layer, width);
    const drift = animal.tempo || 1;
    const desired = animal.speed * scale / 0.42 * pace(animal.elapsed, animal.arrivalPause) * drift * dt;
    const animalWidth = rigs[animal.species].width * scale;
    let nearestGap = Infinity;
    for (const other of others) {
      if (other === animal || other.waiting || other.dead || other.layer !== animal.layer || (other.direction ?? rowDirection(other.layer)) !== animal.direction) continue;
      const ahead = (other.x - animal.x) * animal.direction > 0;
      if (!ahead) continue;
      const gap = animal.direction === 1
        ? other.x - animal.x - animalWidth
        : animal.x - other.x - rigs[other.species].width * scale;
      nearestGap = Math.min(nearestGap, gap);
    }
    const safeGap = Math.max(28, width * 0.035);
    const preferredGap = Math.max(safeGap + 12, Math.max(55, width * 0.075) * (animal.spacing || 1));
    const ease = smooth((nearestGap - safeGap) / (preferredGap - safeGap));
    return Math.max(0, Math.min(desired * ease, nearestGap - safeGap));
  }
  const rowCount = 2;
  function rowDirection(layer) { return layer === 1 ? -1 : 1; }
  function rowScale(layer, width) {
    return (0.42 - layer * 0.115) * Math.min(width / 900, 1.5);
  }
  function nextPass(animal, width) {
    const rig = rigs[animal.species];
    const scale = rowScale(animal.layer, width);
    const animalWidth = rig.width * scale;
    // Include the moving feet beyond the texture's original bounds.
    const margin = 40 * scale;
    const exited = animal.direction === 1
      ? animal.x > width + margin
      : animal.x + animalWidth < -margin;
    if (!exited) return null;
    if (animal.layer >= rowCount-1) return { dead: true };
    const layer = animal.layer + 1;
    const nextScale = rowScale(layer, width);
    const direction = -animal.direction;
    return {
      layer,
      direction,
      x: direction === 1 ? -(rig.width + 40) * nextScale : width + 40 * nextScale,
    };
  }
  function entryPosition(animal, width) {
    const scale = rowScale(animal.layer, width);
    const animalWidth = rigs[animal.species].width * scale;
    const direction=animal.direction ?? rowDirection(animal.layer);
    // The head appears at the entry edge; later queued arrivals need only a
    // leading portion of their body to fit, from either side.
    if(animal.layer===0) return direction===1
      ? (animal.entryFromQueue ? 24-animalWidth+72*scale : 24)
      : (animal.entryFromQueue ? width-24-72*scale : width-24-animalWidth);
    return direction===1 ? -(animalWidth+40*scale) : width+40*scale;
  }
  function canEnter(animal, others, width) {
    if(animal.layer>0&&others.filter(other=>other!==animal&&!other.waiting&&!other.dead&&other.layer===animal.layer).length>=3)return false;
    const scale = rowScale(animal.layer, width);
    const left = entryPosition(animal, width);
    const right = left + rigs[animal.species].width * scale;
    const gap = Math.max(Math.max(28, width * 0.035) + 4,
      Math.max(32, width * 0.04) * (animal.spacing || 1));
    const direction=animal.direction ?? rowDirection(animal.layer);
    return others.every((other) => other === animal || other.waiting || other.dead ||
      other.layer !== animal.layer || (other.direction ?? rowDirection(other.layer)) !== direction || (direction === 1
        ? other.x >= right + gap
        : other.x + rigs[other.species].width * scale <= left - gap));
  }
  function arrivalPlan(order, backlog=0, random=Math.random) {
    // A steady queue still uses both edges; low traffic has longer pauses/gaps.
    const pressure=Math.min(1,Math.max(0,backlog)/8);
    const spread=random();
    return { layer:0, direction:order%2===0 ? -1 : 1,
      spacing: .85 + spread*(1.65-pressure*1.05),
      arrivalPause: .12+random()*(.65-pressure*.45) };
  }
  function updateTempo(animal, dt, random = Math.random) {
    animal.tempoIn = (animal.tempoIn ?? 0) - dt;
    if (animal.tempoIn <= 0) {
      animal.tempoTarget = 0.88 + random() * 0.24;
      animal.tempoIn = 2.5 + random() * 5.5;
    }
    const current = animal.tempo ?? 1;
    animal.tempo = current + ((animal.tempoTarget ?? 1) - current) * (1 - Math.exp(-dt / 1.4));
    return animal.tempo;
  }
  function pace(elapsed, pause = 2) { return smooth((elapsed - pause) / 1.5); }
  function footstep(phase, stride, lift, stance = .72) {
    const t = ((phase % 1) + 1) % 1;
    // A planted foot travels backwards at constant speed; recovery lifts it.
    if (t < stance) return { x: stride * (0.5 - t / stance), lift: 0, swing: 0 };
    const swing = (t - stance) / (1 - stance);
    // Hermite recovery joins the backwards stance velocity at both ends.
    // The sole leaves and meets the floor with zero vertical velocity.
    const slope=-(1-stance)/stance;
    const progress=(-2*swing**3+3*swing**2)+slope*(2*swing**3-3*swing**2+swing);
    return { x: stride * (-0.5 + progress), lift: Math.sin(Math.PI*swing)**2 * lift, swing };
  }
  return { rigs, rowCount, arrivalPlan, speedFactors, preferredSpeed, travelDistance, updateTempo, smooth, rowDirection, rowScale, nextPass, entryPosition, canEnter, pace, footstep, shouldFlip: (species, direction) => rigs[species].facing !== direction };
});
