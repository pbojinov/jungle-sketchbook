const actions = document.querySelector('#speciesActions');

for (const [id, species] of Object.entries(window.SpeciesCatalog)) {
  const capture = document.createElement('a');
  capture.className = 'button';
  capture.href = `/capture.html?species=${id}`;
  capture.textContent = `📷 Capture a ${species.label.toLowerCase()}`;
  actions.append(capture);

  const template = document.createElement('a');
  template.className = 'button secondary';
  template.href = `/animals/${id}/template.svg`;
  template.target = '_blank';
  template.textContent = `🖨️ Open ${species.label.toLowerCase()} coloring sheet`;
  actions.append(template);
}
