(function exposeDisplayConfig(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.SketchDisplayConfig = api;
  }
})(typeof globalThis === 'object' ? globalThis : this, function createDisplayConfig() {
  const STORAGE_KEY = 'jungle-sketchbook-display';
  const defaults = Object.freeze({
    lowPower: false,
    motion: 'system',
    quietHud: true,
  });

  function normalize(value) {
    const motion = ['system', 'full', 'reduced'].includes(value?.motion)
      ? value.motion
      : defaults.motion;
    return {
      lowPower: typeof value?.lowPower === 'boolean' ? value.lowPower : defaults.lowPower,
      motion,
      quietHud: typeof value?.quietHud === 'boolean' ? value.quietHud : defaults.quietHud,
    };
  }

  function load(storage) {
    try {
      return normalize(JSON.parse(storage.getItem(STORAGE_KEY) || '{}'));
    } catch {
      return { ...defaults };
    }
  }

  function save(storage, value) {
    const normalized = normalize(value);
    storage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  }

  function reducedMotion(config, systemPrefersReducedMotion) {
    if (config.motion === 'reduced') return true;
    if (config.motion === 'full') return false;
    return systemPrefersReducedMotion;
  }

  return { defaults, load, normalize, reducedMotion, save, STORAGE_KEY };
});
