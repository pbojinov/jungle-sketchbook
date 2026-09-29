const sampleTextures = new Map();
function sampleTexture(species, legacyLion = false) {
  const key = `${species}:${legacyLion}`;
  if (!sampleTextures.has(key)) {
    const pending = renderSampleTexture(species, legacyLion).catch((error) => {
      sampleTextures.delete(key);
      throw error;
    });
    sampleTextures.set(key, pending);
  }
  return sampleTextures.get(key);
}
async function renderSampleTexture(species, legacyLion) {
  let imageUrl;
  try {
  const response = await fetch(`/animals/${species}/template.svg`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Could not load the ${species} template`);
  const svg = new DOMParser().parseFromString(await response.text(), 'image/svg+xml');
  const { x, y, width, height } = AnimalShapes[species].bounds;
  const root = svg.documentElement;
  root.setAttribute('viewBox', `${x} ${y} ${width} ${height}`);
  root.setAttribute('width', width);
  root.setAttribute('height', height);
  root.querySelector('rect').remove();
  root.querySelectorAll('text').forEach((text) => text.remove());
  const colors = { body: '#f3bd51', tail: '#f3bd51', tuft: '#b96630', mane: '#dc8136' };
  root.querySelectorAll('[data-mask-part]').forEach((part) => {
    const partName = part.getAttribute('data-mask-part');
    const baseColor = { lion: '#f3bd51', fox: '#e98a42', zebra: '#fff9eb', gazelle: '#d6ab74' }[species];
    part.style.fill = species === 'lion' ? (colors[partName] || baseColor) : (partName.includes('horn') ? '#5b4435' : baseColor);
    part.style.stroke = '#683b29';
  });
  if (species === 'lion' && !legacyLion) {
    root.querySelector('[data-color-part="face"]').style.fill = '#ffda83';
    root.querySelector('[data-color-part="muzzle"]').style.fill = '#fff1c9';
    root.querySelectorAll('.detail').forEach((part) => { part.style.stroke = '#75452c'; });
    root.querySelectorAll('circle, path:not([class])').forEach((part) => {
      part.style.fill = '#513426';
    });
  }
  imageUrl = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], {
    type: 'image/svg+xml',
  }));
  const image = new Image();
  image.src = imageUrl;
  await image.decode();
  const preview = document.createElement('canvas');
  preview.width = width;
  preview.height = height;
  preview.getContext('2d').drawImage(image, 0, 0);
    return preview.toDataURL('image/png');
  } finally {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
  }
}
async function refreshLegacySample(species, texture) {
  if (species !== 'lion') return texture;
  // Exact generated-image match only: never recolor photographed artwork.
  const legacy = await sampleTexture('lion', true);
  return texture === legacy ? sampleTexture('lion') : texture;
}
