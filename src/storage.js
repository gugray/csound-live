const defaultTitle = "New Csound patch";
const patchesKey = "patches";
const contentKey = "patch";

export class Storage {

  getNewPatchInfo() {
    const tsStr = (+new Date).toString(36);
    const title = this.getUniqueTitle(defaultTitle);
    return [tsStr, title];
  }

  getUniqueTitle(desiredTitle) {
    const patchList = this.loadPatchList();
    let patchIx = 1;
    let title = desiredTitle;
    while (patchList.find(x => x.title == title) !== undefined) {
      ++patchIx;
      title = `${desiredTitle} (${patchIx})`;
    }
    return title;
  }

  savePatch(id, title, content) {
    const lastChanged = new Date().toISOString();
    const patchList = this.loadPatchList();
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
    return itm.lastChanged;
  }

  loadPatchList() {
    let patchList = [];
    const savedStr = localStorage.getItem(patchesKey);
    if (savedStr) {
      try { patchList = JSON.parse(savedStr); }
      catch { }
    }
    patchList.sort((a, b) => b.lastChanged.localeCompare(a.lastChanged));
    return patchList;
  }

  loadPatch(id) {
    const patchList = this.loadPatchList();
    let itm = patchList.find(x => x.id == id);
    if (!itm) return null;
    let content = localStorage.getItem(`${contentKey}-${id}`);
    return { id, title: itm.title, lastChanged: itm.lastChanged, content };
  }

  duplicatePatch(id) {
    const patchList = this.loadPatchList();
    const itm = patchList.find(x => x.id == id);
    const content = localStorage.getItem(`${contentKey}-${id}`);
    const title = this.getUniqueTitle(itm.title);
    const tsStr = (+new Date).toString(36);
    this.savePatch(tsStr, title, content);
    return tsStr;
  }

  deletePatch(id) {
    let patchList = this.loadPatchList();
    patchList = patchList.filter(p => p.id != id);
    localStorage.setItem(patchesKey, JSON.stringify(patchList));
    localStorage.removeItem(`${contentKey}-${id}`);
  }
}
