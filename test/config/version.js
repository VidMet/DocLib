export const VERSION = Object.freeze({
  value: '2.02-preview.10.2-test',
  label: 'DocLib TEST v2.02-preview.10.2-test',
  cacheKey: '2.02-preview.10.2-test'
});

export function applyVersionDisplay(root = document) {
  document.title = VERSION.label;
  const title = root.querySelector?.('.title b');
  if (title) title.textContent = VERSION.label;
  root.querySelectorAll?.('[data-doclib-version]').forEach(node => {
    node.textContent = VERSION.label;
  });
}

export function installVersionDisplay() {
  applyVersionDisplay();
  const observer = new MutationObserver(() => {
    const title = document.querySelector('.title b');
    if (document.title !== VERSION.label || (title && title.textContent !== VERSION.label)) {
      applyVersionDisplay();
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  return observer;
}
