document.querySelectorAll('[data-species]').forEach((demoButton) => {
  demoButton.addEventListener('click', async () => {
    const species = demoButton.dataset.species;
    const label = demoButton.textContent;
    demoButton.disabled = true;
    demoButton.textContent = `Adding ${species}…`;
    try {
      const texture = await sampleTexture(species);
      const upload = await fetch('/api/animals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ species, artworkVersion: AnimalShapes[species].version, texture }),
      });
      if (!upload.ok) throw new Error(`Could not add the ${species}`);
      demoButton.textContent = label;
    } catch (error) {
      demoButton.textContent = `Retry ${species}`;
      document.querySelector('#hud').textContent = error.message;
    } finally {
      demoButton.disabled = false;
    }
  });
});
