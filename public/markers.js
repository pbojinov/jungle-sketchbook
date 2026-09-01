(function exposeMarkers(root, factory) {
  const catalog = typeof module === 'object' && module.exports
    ? require('./species')
    : root.SpeciesCatalog;
  const markers = factory(catalog);
  if (typeof module === 'object' && module.exports) {
    module.exports = markers;
  } else {
    root.SketchMarkers = markers;
  }
})(typeof globalThis === 'object' ? globalThis : this, function createMarkers(catalog) {
  if (!catalog) throw new Error('Species catalog must load before marker mapping');

  const speciesMarkerIds = Object.fromEntries(
    Object.entries(catalog).map(([species, definition]) => [
      species,
      definition.markerIds,
    ]),
  );

  const canonicalMarkerCenters = [
    [63, 63],
    [777, 63],
    [777, 1125],
    [63, 1125],
  ];
  const canonicalPageCorners = [
    [0, 0],
    [839, 0],
    [839, 1187],
    [0, 1187],
  ];

  function markerCenter(marker) {
    const total = marker.corners.reduce(
      (sum, corner) => ({ x: sum.x + corner.x, y: sum.y + corner.y }),
      { x: 0, y: 0 },
    );
    return [total.x / marker.corners.length, total.y / marker.corners.length];
  }

  function resolveMarkerSet(detectedMarkers) {
    const markersById = new Map();
    const duplicateIds = new Set();
    for (const marker of detectedMarkers) {
      if (markersById.has(marker.id)) duplicateIds.add(marker.id);
      markersById.set(marker.id, marker);
    }

    const matches = Object.entries(speciesMarkerIds).filter(([, ids]) =>
      ids.every((id) => markersById.has(id) && !duplicateIds.has(id)),
    );
    if (matches.length !== 1) return null;

    const [species, ids] = matches[0];
    return {
      species,
      markers: ids.map((id) => markersById.get(id)),
    };
  }

  function detectPage(detectedMarkers, geometry) {
    const resolved = resolveMarkerSet(detectedMarkers);
    if (!resolved) return null;

    const detectedCenters = resolved.markers.map(markerCenter);
    const homography = geometry.createHomography(
      canonicalMarkerCenters,
      detectedCenters,
    );
    const corners = canonicalPageCorners.map(([x, y]) => {
      const [mappedX, mappedY] = geometry.mapHomography(homography, x, y);
      return { x: mappedX, y: mappedY };
    });

    return { corners, species: resolved.species };
  }

  return {
    canonicalMarkerCenters,
    detectPage,
    markerCenter,
    resolveMarkerSet,
    speciesMarkerIds,
  };
});
