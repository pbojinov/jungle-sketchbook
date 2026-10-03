(() => {
  const audio = document.querySelector('#jungle-audio');
  const button = document.querySelector('#sound-toggle');
  const volume = document.querySelector('#sound-volume');
  const level = document.querySelector('#sound-level');
  const status = document.querySelector('#sound-status');
  const storageKey = 'jungle-sound-volume';
  let wanted = false;
  let request = 0;
  let starting = false;

  try {
    const saved = localStorage.getItem(storageKey);
    const value = Number(saved);
    if (saved !== null && Number.isFinite(value) && value >= 0 && value <= 100) volume.value = String(value);
  } catch { /* Private/TV browsers can disable local storage. */ }

  function render() {
    const playing = wanted && !audio.paused;
    button.textContent = starting ? 'Starting sounds…' : playing
      ? (audio.volume === 0 ? '🔇 Sounds muted' : '🔊 Sounds on') : '🔈 Jungle sounds';
    button.setAttribute('aria-pressed', String(playing));
    button.setAttribute('aria-label', wanted ? 'Turn jungle sounds off' : 'Turn jungle sounds on');
    button.setAttribute('aria-busy', String(starting));
  }
  function setVolume() {
    const value = Math.max(0, Math.min(100, Number(volume.value) || 0));
    audio.volume = value / 100;
    level.textContent = `${value}%`;
    volume.setAttribute('aria-valuetext', `${value} percent`);
    try { localStorage.setItem(storageKey, String(value)); } catch { /* Optional preference. */ }
    render();
  }
  function stop() {
    request += 1;
    wanted = false;
    starting = false;
    audio.pause();
    status.textContent = '';
    render();
  }
  button.addEventListener('click', async () => {
    if (wanted) { stop(); return; }
    wanted = true;
    starting = true;
    const current = ++request;
    status.textContent = '';
    render();
    try {
      // Call inside the user's gesture; TV browsers generally block audible autoplay.
      await audio.play();
      if (current !== request) { if (!wanted) audio.pause(); return; }
      starting = false;
      render();
    } catch (error) {
      if (current !== request) return;
      stop();
      status.textContent = error.name === 'NotAllowedError'
        ? 'Select Jungle sounds again to enable audio.'
        : 'Sound could not load. Check the connection, then try again.';
    }
  });
  audio.addEventListener('playing', () => { starting = false; render(); });
  audio.addEventListener('pause', render);
  audio.addEventListener('error', () => {
    stop();
    status.textContent = 'Sound could not load. Check the connection, then try again.';
  });
  // Leaving the display stops audio; returning still requires an explicit gesture.
  window.addEventListener('pagehide', stop);
  volume.addEventListener('input', setVolume);
  setVolume();
})();
