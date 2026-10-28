export const VERSION = Object.freeze({
  value: '2.02-rc.1',
  label: 'DocLib v2.02-rc.1',
  cacheKey: '2.02-rc.1'
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
    if (document.title !== VERSION.label || (title && title.textContent !== VERSION.label)) applyVersionDisplay();
  });
  observer.observe(document.documentElement, {childList:true,subtree:true,characterData:true});
  return observer;
}
