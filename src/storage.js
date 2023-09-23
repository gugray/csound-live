const defaultTitle = "New Csound patch";
const patchesKey = "patches";
const contentKey = "patch";

export class Storage {

  getNewPatchInfo() {
    const tsStr = (+new Date).toString(36);
    const patchList = loadPatchList();
    let patchIx = 1;
    let title = defaultTitle;
    while (patchList.find(x => x.title == title) !== undefined) {
      ++patchIx;
      title = `${defaultTitle} (${patchIx})`;
    }
    return [tsStr, title];
  }

  savePatch(id, title, content) {
    const lastChanged = new Date().toISOString();
    const patchList = loadPatchList();
    let itm = patchList.find(x => x.id == id);
    if (itm) {
      itm.title = title;
      itm.lastChanged = lastChanged;
    }
    else {
      itm = { id, title, lastChanged };
      patchList.push(itm);
    }
    localStorage.setItem(patchesKey, JSON.stringify(patchList));
    localStorage.setItem(`${contentKey}-${id}`, content);
  }

  loadPatch(id) {
    const patchList = loadPatchList();
    let itm = patchList.find(x => x.id == id);
    if (!itm) return null;
    let content = localStorage.getItem(`${contentKey}-${id}`);
    return { id, title: itm.title, lastChanged: itm.lastChanged, content };
  }

  hasUnsavedChanges(id, currentContent) {
    const patch = this.loadPatch(id);
    if (!patch) return true;
    else return currentContent != patch.content;
  }
}

function loadPatchList() {
  let patchList = [];
  const savedStr = localStorage.getItem(patchesKey);
  if (savedStr) {
    try { patchList = JSON.parse(savedStr); }
    catch { }
  }
  return patchList;
}