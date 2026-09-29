(function (root, factory) {
  const motion = factory();
  if (typeof module === 'object' && module.exports) module.exports = motion;
  else root.SafariMotion = motion;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  // Coordinates refer to the printed page; crops retain the child's pixels.
  const rigs = {
    lion: { facing: -1, x: 104, y: 387, width: 709, height: 471, hip: 742, foot: 850, legs: [[377, 444], [553, 623]] },
    fox: { facing: -1, x: 108, y: 363, width: 695, height: 470, hip: 695, foot: 825, legs: [[298, 354], [484, 544]] },
    zebra: { facing: 1, x: 168, y: 273, width: 555, height: 580, hip: 705, foot: 845, legs: [[268, 331], [448, 508]] },
    gazelle: { facing: -1, x: 148, y: 193, width: 554, height: 665, hip: 680, foot: 850, legs: [[308, 358], [478, 528]] },
  };
  const smooth = (value) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
  // Gentle artistic compression of running-speed differences, not measured walking speeds.
  const speedFactors = { fox: 0.96, lion: 0.98, zebra: 1.02, gazelle: 1.06 };
  function preferredSpeed(species, individual = 0.5) {
    return 28 * speedFactors[species] * (0.98 + individual * 0.04);
  }
  function travelDistance(animal, others, width, dt) {
    const scale = rowScale(animal.layer, width);
    const drift = animal.tempo || 1;
    const desired = animal.speed * scale / 0.42 * pace(animal.elapsed, animal.arrivalPause) * drift * dt;
    const animalWidth = rigs[animal.species].width * scale;
    let nearestGap = Infinity;
    for (const other of others) {
      if (other === animal || other.waiting || other.dead || other.layer !== animal.layer) continue;
      const ahead = (other.x - animal.x) * animal.direction > 0;
      if (!ahead) continue;
      const gap = animal.direction === 1
        ? other.x - animal.x - animalWidth
        : animal.x - other.x - rigs[other.species].width * scale;
      nearestGap = Math.min(nearestGap, gap);
    }
    const safeGap = Math.max(28, width * 0.035);
    const preferredGap = Math.max(55, width * 0.075) * (animal.spacing || 1);
    const ease = smooth((nearestGap - safeGap) / (preferredGap - safeGap));
    return Math.max(0, Math.min(desired * ease, nearestGap - safeGap));
  }
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
    if (animal.layer === 2) return { dead: true };
    const layer = animal.layer + 1;
    const nextScale = rowScale(layer, width);
    const direction = rowDirection(layer);
    return {
      layer,
      direction,
      x: direction === 1 ? -(rig.width + 40) * nextScale : width + 40 * nextScale,
    };
  }
  function entryPosition(animal, width) {
    const scale = rowScale(animal.layer, width);
    const animalWidth = rigs[animal.species].width * scale;
    // First arrivals are visible during their greeting pause; later passes enter at the edge.
    if (animal.layer === 0) return 24;
    return rowDirection(animal.layer) === 1 ? -(animalWidth + 40 * scale) : width + 40 * scale;
  }
  function canEnter(animal, others, width) {
    const scale = rowScale(animal.layer, width);
    const left = entryPosition(animal, width);
    const right = left + rigs[animal.species].width * scale;
    const gap = Math.max(55, width * 0.075) * (animal.spacing || 1);
    return others.every((other) => other === animal || other.waiting || other.dead ||
      other.layer !== animal.layer || (rowDirection(animal.layer) === 1
        ? other.x >= right + gap
        : other.x + rigs[other.species].width * scale <= left - gap));
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
  function footstep(phase, stride, lift) {
    const t = ((phase % 1) + 1) % 1;
    // A planted foot travels backwards at constant speed; recovery lifts it.
    if (t < 0.62) return { x: stride * (0.5 - t / 0.62), lift: 0 };
    const swing = (t - 0.62) / 0.38;
    return { x: stride * (-0.5 + smooth(swing)), lift: Math.sin(Math.PI * swing) * lift };
  }
  return { rigs, speedFactors, preferredSpeed, travelDistance, updateTempo, smooth, rowDirection, rowScale, nextPass, entryPosition, canEnter, pace, footstep, shouldFlip: (species, direction) => rigs[species].facing !== direction };
});
