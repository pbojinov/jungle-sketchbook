const form = document.querySelector('#displaySettings');
const motionInput = document.querySelector('#motion');
const lowPowerInput = document.querySelector('#lowPower');
const quietHudInput = document.querySelector('#quietHud');
const statusElement = document.querySelector('#settingsStatus');

const saved = window.SketchDisplayConfig.load(window.localStorage);
motionInput.value = saved.motion;
lowPowerInput.checked = saved.lowPower;
quietHudInput.checked = saved.quietHud;

form.addEventListener('submit', (event) => {
  event.preventDefault();
  try {
    window.SketchDisplayConfig.save(window.localStorage, {
      lowPower: lowPowerInput.checked,
      motion: motionInput.value,
      quietHud: quietHudInput.checked,
    });
    window.location.assign('/display.html');
  } catch (error) {
    statusElement.textContent = `Could not save settings: ${error.message}`;
  }
});
