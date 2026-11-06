// Shared tree: keeps IFC and workspace selections in sync across active tools.
export function createFileTree(context) {
  const state = {};
  let controller = null;
  let lastFileAnchorId = null;
  let pendingShiftRange = null;

  state.makeNode = (id, name, path, parent = null) => ({
    id,
    name,
    path,
    parent,
    folders: [],
    files: [],
  });

  state.scanFolder = async (id, name, path, parent) => {
    const node = state.makeNode(id, name, path, parent);
    const response = await context.req(`${context.CORE}/folders/${id}/items`);
    if (!response.ok) {
      throw Error(`Mappen ${path || '/'} kunne ikke leses (HTTP ${response.status}).`);
    }

    const data = response.data;
    const items = Array.isArray(data) ? data : data?.items;
    if (!Array.isArray(items)) {
      throw Error(`Ukjent mappelisteformat for ${path || '/'}`);
    }
    if (
      response.status === 206 ||
      data?.nextPageToken ||
      data?.nextLink ||
      data?.['@odata.nextLink'] ||
      (data?.total !== undefined && Number(data.total) !== items.length)
    ) {
      throw Error(`Ufullstendig mappeliste for ${path || '/'}`);
    }

    const folders = [];
    for (const item of items) {
      if (item.type === 'FILE') {
        item.folderId = id;
        item.folderPath = path;
        item.format = String(item.format || context.fileExt(item.name) || '').toLowerCase();
        node.files.push(item);
      } else if (item.type === 'FOLDER') {
        const hiddenAtRoot =
          path === '' &&
          ['extensionconfig', 'projectconfig'].includes(context.norm(item.name));
        if (!hiddenAtRoot) folders.push(item);
      }
    }

    node.folders = await Promise.all(
      folders.map((folder) =>
        state.scanFolder(folder.id, folder.name, `${path}/${folder.name}`, node),
      ),
    );
    return node;
  };

  state.flatten = (node, output = []) => {
    for (const file of node.files) output.push(file);
    for (const folder of node.folders) state.flatten(folder, output);
    return output;
  };

  state.descendants = (node, output = []) => {
    for (const file of node.files) output.push(file.id);
    for (const folder of node.folders) state.descendants(folder, output);
    return output;
  };

  state.findNode = (node, id) => {
    if (node.id === id) return node;
    for (const folder of node.folders) {
      const found = state.findNode(folder, id);
      if (found) return found;
    }
    return null;
  };

  state.renderTree = () => {
    if (!context.treeRoot) return;

    const tree = context.$('tree');
    const scope = context.workspaceScope();
    const scrollTop = tree.scrollTop;
    const planMode = context.workspaceMode === 'plan';
    const ifcIds = new Set(context.listIfcFiles().map((file) => String(file.id)));
    const selectedIfcIds = new Set(
      context.listSelectedIfcFiles().map((file) => String(file.id)),
    );

    const selected = (id) =>
      ifcIds.has(String(id)) ? selectedIfcIds.has(String(id)) : scope.has(id);

    const fileHtml = (file) => {
      const id = String(file.id);
      const isIfc = ifcIds.has(id);
      const checked = isIfc ? selectedIfcIds.has(id) : scope.has(file.id);
      const disabled = planMode && !isIfc;
      return `<div class="node-row ws-file" title="${context.esc(file.folderPath || '/')} / ${context.esc(file.name)}"><span class="twisty"></span><input type="checkbox" data-scope-file="${context.esc(id)}" aria-label="${planMode ? 'Velg IFC-modell' : 'Velg fil'} ${context.esc(file.name)}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}><span aria-hidden="true">📄</span><span class="ws-name">${context.esc(file.name)}</span><span class="format">${context.esc(file.format || '')}</span></div>`;
    };

    const nodeHtml = (node) => {
      const open = state.expanded.has(node.id);
      const allIds = [...new Set(state.descendants(node, []))];
      const ids = planMode ? allIds.filter((id) => ifcIds.has(String(id))) : allIds;
      const checked = ids.length > 0 && ids.every((id) => selected(id));
      const some = ids.some((id) => selected(id));
      const children = open
        ? `<div class="children">${node.folders.map(nodeHtml).join('')}${node.files.map(fileHtml).join('')}</div>`
        : '';

      return `<div class="node"><div class="node-row"><button type="button" class="twisty ws-toggle" data-toggle="${context.esc(node.id)}" aria-label="Utvid eller skjul ${context.esc(node.name)}" aria-expanded="${open}">${open ? '▼' : '▶'}</button><input type="checkbox" data-folder-check="${context.esc(node.id)}" aria-label="${planMode ? 'Velg IFC-modellene i mappen' : 'Velg mappe'} ${context.esc(node.name)} med undermapper" ${checked ? 'checked' : ''} ${some && !checked ? 'data-indeterminate="1"' : ''} ${ids.length ? '' : 'disabled'}><button type="button" class="ws-folder-name" data-toggle="${context.esc(node.id)}" title="${context.esc(node.path)}">📁 ${context.esc(node.name)}</button><span class="count">(${ids.length})</span></div>${children}</div>`;
    };

    tree.innerHTML =
      context.treeRoot.folders.map(nodeHtml).join('') +
      context.treeRoot.files.map(fileHtml).join('');
    tree.scrollTop = scrollTop;
    if (!tree.innerHTML) tree.textContent = 'Ingen tilgjengelige mapper eller filer.';
    tree.querySelectorAll('[data-indeterminate]').forEach((input) => {
      input.indeterminate = true;
    });
    context.workspaceModeUI();
  };

  const applyFileSelection = (ids, checked) => {
    const ifcIds = new Set(context.listIfcFiles().map((file) => String(file.id)));
    const selectedIfcIds = new Set(
      context.listSelectedIfcFiles().map((file) => String(file.id)),
    );
    const scope = context.workspaceScope();
    let ifcChanged = false;
    let workspaceChanged = false;

    for (const rawId of ids) {
      const id = String(rawId);
      if (ifcIds.has(id)) {
        if (selectedIfcIds.has(id) !== checked) ifcChanged = true;
        if (checked) selectedIfcIds.add(id);
        else selectedIfcIds.delete(id);
      } else if (context.workspaceMode !== 'plan') {
        if (scope.has(rawId) !== checked) workspaceChanged = true;
        if (checked) scope.add(rawId);
        else scope.delete(rawId);
      }
    }

    if (ifcChanged) context.setSelectedIfcFiles([...selectedIfcIds]);
    if (workspaceChanged) context.workspaceSelectionChanged();
    if (!ifcChanged && !workspaceChanged) state.renderTree();
  };

  state.currentFolder = '__ALL__';
  state.expanded = new Set(['__ROOT__']);
  state.folderFilters = new Set();
  state.allExpanded = false;

  return Object.freeze({
    port: Object.freeze({
      makeNode: (...args) => state.makeNode(...args),
      scanFolder: (...args) => state.scanFolder(...args),
      flatten: (...args) => state.flatten(...args),
      descendants: (...args) => state.descendants(...args),
      findNode: (...args) => state.findNode(...args),
      renderTree: (...args) => state.renderTree(...args),
      get currentFolder() {
        return state.currentFolder;
      },
      set currentFolder(value) {
        state.currentFolder = value;
      },
      get expanded() {
        return state.expanded;
      },
      set expanded(value) {
        state.expanded = value;
      },
      get folderFilters() {
        return state.folderFilters;
      },
      set folderFilters(value) {
        state.folderFilters = value;
      },
      get allExpanded() {
        return state.allExpanded;
      },
      set allExpanded(value) {
        state.allExpanded = value;
      },
    }),
    mount() {
      if (controller) return;
      controller = new AbortController();
      const signal = controller.signal;
      const tree = context.$('tree');

      context.$('expandAll').addEventListener(
        'click',
        () => {
          state.allExpanded = !state.allExpanded;
          state.expanded.clear();
          if (state.allExpanded && context.treeRoot) {
            (function add(node) {
              state.expanded.add(node.id);
              node.folders.forEach(add);
            })(context.treeRoot);
          } else {
            state.expanded.add('__ROOT__');
          }
          state.renderTree();
        },
        { signal },
      );

      tree.addEventListener(
        'click',
        (event) => {
          const fileInput = event.target.closest('[data-scope-file]');
          if (fileInput) {
            const id = String(fileInput.dataset.scopeFile);
            if (event.shiftKey && lastFileAnchorId) {
              pendingShiftRange = { id, checked: fileInput.checked };
            } else {
              lastFileAnchorId = id;
              pendingShiftRange = null;
            }
            return;
          }

          const toggle = event.target.closest('[data-toggle]');
          if (!toggle) return;
          const id = toggle.dataset.toggle;
          if (state.expanded.has(id)) state.expanded.delete(id);
          else state.expanded.add(id);
          state.renderTree();
        },
        { signal },
      );

      tree.addEventListener(
        'change',
        (event) => {
          const input = event.target;
          if (input.matches('[data-scope-file]')) {
            const id = String(input.dataset.scopeFile);
            if (pendingShiftRange?.id === id && lastFileAnchorId) {
              const files = [...tree.querySelectorAll('[data-scope-file]:not(:disabled)')];
              const anchorIndex = files.findIndex(
                (file) => String(file.dataset.scopeFile) === lastFileAnchorId,
              );
              const targetIndex = files.indexOf(input);
              const range =
                anchorIndex >= 0 && targetIndex >= 0
                  ? files
                      .slice(Math.min(anchorIndex, targetIndex), Math.max(anchorIndex, targetIndex) + 1)
                      .map((file) => String(file.dataset.scopeFile))
                  : [id];
              const checked = pendingShiftRange.checked;
              pendingShiftRange = null;
              applyFileSelection(range, checked);
              return;
            }
            applyFileSelection([id], input.checked);
            return;
          }

          if (!input.matches('[data-folder-check]')) return;
          const node = state.findNode(context.treeRoot, input.dataset.folderCheck);
          if (!node) return;
          const ifcIds = new Set(context.listIfcFiles().map((file) => String(file.id)));
          const ids = [...new Set(state.descendants(node, []))].filter(
            (id) => context.workspaceMode !== 'plan' || ifcIds.has(String(id)),
          );
          applyFileSelection(ids, input.checked);
        },
        { signal },
      );
    },
    destroy() {
      controller?.abort();
      controller = null;
      lastFileAnchorId = null;
      pendingShiftRange = null;
      context.$('tree').replaceChildren();
    },
  });
}
