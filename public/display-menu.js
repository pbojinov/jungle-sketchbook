(() => {
  const toggle = document.querySelector('#menu-toggle');
  const menu = document.querySelector('#safari-menu');

  function setOpen(open, returnFocus = false) {
    menu.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close safari controls' : 'Open safari controls');
    if (open) menu.querySelector('button').focus();
    else if (returnFocus) toggle.focus();
  }

  toggle.addEventListener('click', () => setOpen(menu.hidden, !menu.hidden));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !menu.hidden) {
      event.preventDefault();
      setOpen(false, true);
    }
  });
  document.addEventListener('click', (event) => {
    if (!menu.hidden && !menu.contains(event.target) && !toggle.contains(event.target)) {
      setOpen(false, menu.contains(document.activeElement));
    }
  });
})();
