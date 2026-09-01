const loginPanel = document.querySelector('#loginPanel');
const controlsPanel = document.querySelector('#controlsPanel');
const loginForm = document.querySelector('#loginForm');
const settingsForm = document.querySelector('#settingsForm');
const pausedInput = document.querySelector('#paused');
const maxAnimalsInput = document.querySelector('#maxAnimals');
const statusElement = document.querySelector('#adminStatus');
const animalList = document.querySelector('#animalList');
const refreshButton = document.querySelector('#refresh');
const clearButton = document.querySelector('#clearAll');

function setStatus(message) {
  statusElement.textContent = message;
}

async function request(pathname, options = {}) {
  const response = await fetch(pathname, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || `HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function renderAnimals(animals) {
  animalList.replaceChildren();
  if (!animals.length) {
    const empty = document.createElement('p');
    empty.textContent = 'No saved drawings yet.';
    animalList.append(empty);
    return;
  }

  [...animals].reverse().forEach((animal) => {
    const row = document.createElement('article');
    row.className = 'animal-row';
    const image = document.createElement('img');
    image.src = animal.texture;
    image.alt = `${window.SpeciesCatalog[animal.species]?.label || animal.species} drawing`;
    const description = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = window.SpeciesCatalog[animal.species]?.label || animal.species;
    const date = document.createElement('small');
    date.textContent = new Date(animal.createdAt).toLocaleString();
    description.append(name, date);
    const remove = document.createElement('button');
    remove.className = 'button danger';
    remove.type = 'button';
    remove.textContent = 'Delete';
    remove.addEventListener('click', async () => {
      if (!window.confirm(`Delete this ${name.textContent.toLowerCase()} drawing?`)) return;
      try {
        await request(`/api/animals/${animal.id}`, { method: 'DELETE' });
        row.remove();
        setStatus('Drawing deleted.');
      } catch (error) {
        setStatus(error.message);
      }
    });
    row.append(image, description, remove);
    animalList.append(row);
  });
}

async function loadStatus() {
  try {
    const data = await request('/api/admin/status');
    loginPanel.hidden = true;
    controlsPanel.hidden = false;
    pausedInput.checked = data.settings.paused;
    maxAnimalsInput.value = data.settings.maxAnimals;
    renderAnimals(data.animals);
    const suffix = data.animals.length === 1 ? '' : 's';
    setStatus(`${data.animals.length} saved drawing${suffix}.`);
  } catch (error) {
    if (error.status === 401) {
      loginPanel.hidden = false;
      controlsPanel.hidden = true;
      setStatus('Parent controls are locked.');
      return;
    }
    setStatus(error.message);
  }
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await request('/api/admin/login', {
      body: JSON.stringify({ pin: new FormData(loginForm).get('pin') }),
      method: 'POST',
    });
    loginForm.reset();
    await loadStatus();
  } catch (error) {
    setStatus(error.message);
  }
});

settingsForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await request('/api/admin/settings', {
      body: JSON.stringify({
        maxAnimals: Number(maxAnimalsInput.value),
        paused: pausedInput.checked,
      }),
      method: 'PATCH',
    });
    await loadStatus();
    setStatus('Settings saved.');
  } catch (error) {
    setStatus(error.message);
  }
});

refreshButton.addEventListener('click', loadStatus);
clearButton.addEventListener('click', async () => {
  if (!window.confirm('Delete every saved drawing? This cannot be undone.')) return;
  try {
    await request('/api/clear', { method: 'POST' });
    await loadStatus();
    setStatus('All drawings cleared.');
  } catch (error) {
    setStatus(error.message);
  }
});

loadStatus();
