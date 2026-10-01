const sampleTextures = new Map();
function sampleTexture(species) {
  if (!AnimalShapes[species]) return Promise.reject(new Error('Unknown animal'));
  if (!sampleTextures.has(species)) {
    sampleTextures.set(species, renderSampleTexture(species).catch(error => { sampleTextures.delete(species); throw error; }));
  }
  return sampleTextures.get(species);
}
async function renderSampleTexture(species) {
  const image = new Image();
  image.src = `/animals/${species}/sample.svg?v=20260930`;
  await image.decode();
  const {x,y,width,height} = AnimalShapes[species].bounds;
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  canvas.getContext('2d').drawImage(image,x,y,width,height,0,0,width,height);
  return canvas.toDataURL('image/png');
}
