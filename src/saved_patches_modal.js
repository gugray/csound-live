import { Dispatcher, Events } from "./dispatcher.js";
import { Storage } from "./storage.js";
import { enc, fmtTime } from "./enc.js";

export class SavedPatchesModal {
  constructor(elmHost, dispatcher, storage) {
    this.storage = storage;
    this.dispatcher = dispatcher;
    this.elmHost = elmHost;
    this.elmClose = elmHost.querySelector(".close");
    this.elmTable = elmHost.querySelector("table");
    this.elmTableBody = elmHost.querySelector("tbody");
    init(this);
    this.updatePatchList();
  }

  close() {
    this.elmHost.classList.remove("visible");
    this.dispatcher.dispatch(Events.modal_closed);
  }

  updatePatchList() {
    this.elmTableBody.remove();
    this.elmTableBody = document.createElement("TBODY");
    this.elmTable.appendChild(this.elmTableBody);

    const patches = this.storage.loadPatchList();
    let tableBodyHtml = "";
    for (const p of patches) {
      let html = patchHtml;
      html = html.replaceAll("{title}", enc(p.title));
      html = html.replaceAll("{id}", enc(p.id));
      html = html.replaceAll("{lastChanged}", fmtTime(p.lastChanged));
      tableBodyHtml += html;
    }
    this.elmTableBody.innerHTML = tableBodyHtml;
    this.elmTableBody.addEventListener("click", e => onPatchClick(this, e));
  }
}

function init(obj) {
  obj.elmHost.classList.add("visible");
  obj.elmHost.addEventListener("click", e => {
    if (e.target == obj.elmHost) obj.close();
  });
  obj.elmClose.addEventListener("click", () => obj.close());
}

function onPatchClick(obj, e) {
  let trg = e.target;
  let id = null, cmd = null;
  while (trg != obj.elmTableBody) {
    if (trg.tagName == "TR") {
      id = trg.dataset["id"];
      break;
    }
    else if (trg.classList.contains("title")) cmd = Events.open_patch;
    else if (trg.classList.contains("duplicatePatch")) cmd = Events.duplicate_patch;
    else if (trg.classList.contains("deletePatch")) cmd = "deleteReveal";
    else if (trg.tagName == "SPAN") cmd = Events.delete_patch;
    trg = trg.parentElement;
  }
  if (!cmd) return;
  if (cmd == "deleteReveal") {
    const elmSpan =  trg.querySelector("span");
    elmSpan.classList.add("visible");
    setTimeout(() => elmSpan.classList.remove("visible"), 2000);
    return;
  }
  obj.dispatcher.dispatch(cmd, id);
}

const patchHtml = `
<tr data-id="{id}">
  <td class="title" title="Open patch">{title}</td>
  <td>{lastChanged}</td>
  <td>
    <button class="duplicatePatch" title="Duplicate patch">
      <svg><use href="#icon-copy"></use></svg>
    </button>
    <button class="deletePatch" title="Delete patch">
      <svg><use href="#icon-trash"></use></svg>
    </button>
    <span>Yes, delete</span>
  </td>
</tr>
`;

