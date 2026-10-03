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
  let awaitingGesture = false;

  try {
    const saved = localStorage.getItem(storageKey);
    const value = Number(saved);
    if (saved !== null && Number.isFinite(value) && value >= 0 && value <= 100) volume.value = String(value);
  } catch { /* Private/TV browsers can disable local storage. */ }

  function render() {
    const playing = wanted && !audio.paused;
    button.textContent = starting ? 'Starting sounds…' : playing
      ? (audio.volume === 0 ? '🔇 Sounds muted' : '🔊 Sounds on')
      : awaitingGesture ? '🔈 Enable jungle sounds' : '🔈 Jungle sounds';
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
    awaitingGesture = false;
    audio.pause();
    status.textContent = '';
    render();
  }
  async function start(automatic = false) {
    wanted = true;
    starting = true;
    awaitingGesture = false;
    const current = ++request;
    status.textContent = '';
    render();
    try {
      // Try on load, and retry inside a gesture if the browser blocks autoplay.
      await audio.play();
      if (current !== request) { if (!wanted) audio.pause(); return; }
      starting = false;
      render();
    } catch (error) {
      if (current !== request) return;
      stop();
      awaitingGesture = automatic && error.name === 'NotAllowedError';
      status.textContent = error.name === 'NotAllowedError'
        ? 'Tap or press a key to enable jungle sounds.'
        : 'Sound could not load. Check the connection, then try again.';
      render();
    }
  }
  button.addEventListener('click', () => {
    if (wanted) { stop(); return; }
    return start();
  });
  function unlock(event) {
    // The toggle handles its own gesture so it cannot immediately mute the retry.
    if (awaitingGesture && event.target !== button && !button.contains(event.target)) return start(true);
  }
  document.addEventListener('click', unlock);
  document.addEventListener('keydown', unlock);
  audio.addEventListener('playing', () => { starting = false; render(); });
  audio.addEventListener('pause', render);
  audio.addEventListener('error', () => {
    stop();
    status.textContent = 'Sound could not load. Check the connection, then try again.';
  });
  // Leaving the display stops audio, including any pending autoplay retry.
  window.addEventListener('pagehide', stop);
  volume.addEventListener('input', setVolume);
  setVolume();
  start(true);
})();
