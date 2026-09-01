(function exposeSpecies(root, factory) {
  const catalog = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = catalog;
  } else {
    root.SpeciesCatalog = catalog;
  }
})(typeof globalThis === 'object' ? globalThis : this, function createSpeciesCatalog() {
  return {
    lion: {
      emoji: '🦁',
      label: 'Lion',
      markerIds: [0, 1, 2, 3],
      behavior: { scale: 1, speed: 1, laneOffset: 0 },
    },
    fox: {
      emoji: '🦊',
      label: 'Fox',
      markerIds: [4, 5, 6, 7],
      behavior: { scale: 0.78, speed: 1.24, laneOffset: 0.025 },
    },
    zebra: {
      emoji: '🦓',
      label: 'Zebra',
      markerIds: [8, 9, 10, 11],
      behavior: { scale: 0.96, speed: 1.08, laneOffset: 0 },
    },
    gazelle: {
      emoji: '🦌',
      label: 'Gazelle',
      markerIds: [12, 13, 14, 15],
      behavior: { scale: 0.84, speed: 1.32, laneOffset: -0.015 },
    },
    rhino: {
      emoji: '🦏',
      label: 'Rhino',
      markerIds: [16, 17, 18, 19],
      behavior: { scale: 1.12, speed: 0.78, laneOffset: 0.02 },
    },
    elephant: {
      emoji: '🐘',
      label: 'Elephant',
      markerIds: [20, 21, 22, 23],
      behavior: { scale: 1.18, speed: 0.7, laneOffset: 0.015 },
    },
  };
});
