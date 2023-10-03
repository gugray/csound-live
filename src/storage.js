import JSZip from "jszip";
import { getDateStr, removeMultipleDashes } from "./utils.js";

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

    let baseTitle = desiredTitle;
    let patchIx = 0;
    let re = new RegExp("^(.+) \\((\\d+)\\)$");
    let m = re.exec(baseTitle);
    if (m) {
      baseTitle = m[1];
      patchIx = Number.parseInt(m[2]) + 1;
    }

    const patchList = this.loadPatchList();
    let title = baseTitle;
    if (patchIx != 0) title = `${baseTitle} (${patchIx})`;
    while (patchList.find(x => x.title == title) !== undefined) {
      ++patchIx;
      title = `${baseTitle} (${patchIx})`;
    }
    return title;
  }

  savePatch(id, title, content) {
    const dtNow = new Date().toISOString();
    const patchList = this.loadPatchList();
    let itm = patchList.find(x => x.id == id);
    if (itm) {
      itm.title = title;
      itm.lastChanged = dtNow;
      itm.lastOpened = dtNow;
    }
    else {
      itm = { id, title, lastChanged: dtNow, lastOpened: dtNow };
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
    itm.lastOpened = new Date().toISOString();
    localStorage.setItem(patchesKey, JSON.stringify(patchList));
    let content = localStorage.getItem(`${contentKey}-${id}`);
    return { id, title: itm.title, lastChanged: itm.lastChanged, content };
  }

  getLastPatchId() {
    const patchList = this.loadPatchList();
    if (patchList.length == 0) return null;
    patchList.sort((a, b) => b.lastChanged.localeCompare(a.lastChanged));
    return patchList[0].id;
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

  getAllPatchesZip(callback) {

    // Create "files" to zip
    const patchList = this.loadPatchList();
    let zip = new JSZip();
    for (const p of patchList) {
      const dateStr = getDateStr(new Date(p.lastChanged));
      const titleDashes = removeMultipleDashes(p.title.replaceAll(" ", "-"));
      const name = `${dateStr}-${titleDashes}.orc`;
      const content = localStorage.getItem(`${contentKey}-${p.id}`);
      zip.file(name, content);
    }

    // Generate zip
    zip.generateAsync({type: "blob"}).then(data => callback(data));
  }
}
