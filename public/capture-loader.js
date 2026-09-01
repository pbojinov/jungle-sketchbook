(function loadCapture() {
  const requested = new URLSearchParams(window.location.search).get('species');
  const species = window.SpeciesCatalog[requested] ? requested : 'lion';
  const shapeLoads = new Map();

  function loadScript(source) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = source;
      script.addEventListener('load', resolve);
      script.addEventListener('error', () => reject(new Error(`Could not load ${source}`)));
      document.body.append(script);
    });
  }

  function loadSpeciesShape(speciesId) {
    if (!window.SpeciesCatalog[speciesId]) {
      return Promise.reject(new Error(`Unknown species: ${speciesId}`));
    }
    if (window.AnimalShapes && window.AnimalShapes[speciesId]) {
      return Promise.resolve(window.AnimalShapes[speciesId]);
    }
    if (!shapeLoads.has(speciesId)) {
      shapeLoads.set(
        speciesId,
        loadScript(`/animals/${speciesId}/shape.js`).then(
          () => window.AnimalShapes[speciesId],
        ),
      );
    }
    return shapeLoads.get(speciesId);
  }

  window.loadSpeciesShape = loadSpeciesShape;

  loadSpeciesShape(species)
    .then(() => loadScript('/capture.js'))
    .catch((error) => {
      document.querySelector('#status').textContent = error.message;
    });
})();
