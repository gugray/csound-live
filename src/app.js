import verstr from "./version.txt";
import { EditorView, basicSetup } from "codemirror";
import { flashPlugin, flash, getCommitRange } from "./editor_customization.js";
import { indentWithTab } from "@codemirror/commands"
import { keymap } from "@codemirror/view";
import { csoundMode } from "@hlolli/codemirror-lang-csound";
import { Csound } from "@csound/browser";
import { initialUserCode, orcDefines, csdTemplate } from "./csound_content.js";
import { TitlePanel } from "./title_panel.js";
import { SavedPatchesModal } from "./saved_patches_modal.js";
import { Dispatcher, Events } from "./dispatcher.js";
import { Storage } from "./storage.js";
import {getDateStr, removeMultipleDashes, triggerDownload} from "./utils.js";

// OK navigate-away warning if dirty
// OK saved patches list
// OK clone
// OK re-open latest patch
// OK smarter numbering on clone
// -- log control events
// -- full screen
// -- spectrum analysis inset
// -- p5 panel?

const samples = [
  // ["./samples/kick1.aiff", "kick1.aiff"],
];

const clog = console.log;
const elmVersion = document.getElementById("version");
const elmCsoundLog = document.querySelector(".csound-log");
const elmBtnPlayPause = document.getElementById("btnPlayPause");
const elmBtnSave = document.getElementById("btnSave");
const elmBtnDownload = document.getElementById("btnDownload");
const elmBtnDuplicate = document.getElementById("btnDuplicate");
const elmBtnFullscreen = document.getElementById("btnFullScreen");
const elmBtnLibrary = document.getElementById("btnLibrary");
const elmEditorHost = document.getElementById("editorHost");
const elmModal = document.querySelector(".modal");
const logComms = true; // Log socket events
const dispatcher = new Dispatcher();
const storage = new Storage();
const modal = new SavedPatchesModal(elmModal, dispatcher, storage);
let socketUrl;
let patchExists = false;
let titlePanel, editor;
let editorBlockChange = false;
let csound;
let lastNoteIx = -1;

const patch = {
  id: null,
  lastChanged: new Date().toISOString(),
  title: null,
  content: initialUserCode,
};

void init();

async function init() {

  console.log = onLog;
  elmVersion.innerText = verstr;

  initSocket();

  // Start with new default patch, or load most recent patch
  const lastPatchId = storage.getLastPatchId();
  if (!lastPatchId) [patch.id, patch.title] = storage.getNewPatchInfo();
  else {
    const p = storage.loadPatch(lastPatchId);
    patchExists = true;
    patch.id = p.id;
    patch.content = p.content;
    patch.lastChanged = p.lastChanged;
    patch.title = p.title;
  }

  titlePanel = new TitlePanel(document.getElementById("pnlTitle"), dispatcher, patch.title);
  editor = createEditor();

  document.body.addEventListener("keydown", async e => onKeyDown(e));
  window.addEventListener("beforeunload", e => onBeforeUnload(e));

  elmBtnPlayPause.addEventListener("click", async function () {
    if (!csound) await startCsound();
    else await stopCsound();
    editor.focus();
  });

  elmBtnSave.addEventListener("click", () => savePatch());
  elmBtnSave.disabled = patchExists;
  elmBtnDuplicate.addEventListener("click", () => duplicatePatch(patch.id));
  elmBtnDownload.addEventListener("click", () => downloadPatch());
  elmBtnLibrary.addEventListener("click", () => modal.show());
  elmBtnFullscreen.addEventListener("click", () => document.documentElement.requestFullscreen());
  elmEditorHost.addEventListener("click", () => editor.focus());

  dispatcher.subscribe(Events.focus_patch, () => editor.focus());
  dispatcher.subscribe(Events.change_title, title => changeTitle(title));
  dispatcher.subscribe(Events.duplicate_patch, id => duplicatePatch(id));
  dispatcher.subscribe(Events.open_patch, id => loadPatch(id) );
  dispatcher.subscribe(Events.delete_patch, id => deletePatch(id));

  document.addEventListener("mousemove", async e => {
    if (!csound) return;
    const page = document.documentElement;
    const [w, h] = [page.clientWidth, page.clientHeight];
    let [x, y] = [e.clientX, e.clientY];
    x /= w;
    y /= h;
    const scoreEvent = `i999 0 0.01 ${x} ${y}`;
    await csound.inputMessage(scoreEvent);

    // Alternatively: do this
    // csound.setControlChannel("gkMouseX", x);
    // gkMouseX init 0
    // gkMouseX chnexport "gkMouseX", 3, 2, 0, 0, 1
    // imode: 3: 1=input, 2=output
    // itype: 2: linear scale (3: exponential; 0: default, ignores next params)
    // idft: 0: default value
    // imin: 0: min value
    // imax: 1: max value
  });

  showCurrentContent();
  setTimeout(() => editor.focus(), 200);
}

function createEditor() {

  const customKeymap = keymap.of([
    { key: "Cmd-Enter", run: evalChange, },
    { key: "Ctrl-Enter", run: evalChange, },
    { key: "Cmd-d", run: toggleQRCode, },
    { key: "Ctrl-d", run: toggleQRCode, },
  ]);

  return new EditorView({
    extensions: [
      customKeymap,
      basicSetup,
      keymap.of([indentWithTab]),
      csoundMode({ fileType: "orc" }),
      flashPlugin,
      EditorView.updateListener.of(onChange)
    ],
    parent: elmEditorHost,
  });
}

function deletePatch(id) {
  if (id == patch.id) {
    alert("Cannot delete the patch you are currently editing");
    return;
  }
  storage.deletePatch(id);
  modal.updatePatchList();
}

function savePatch() {
  patch.content = getPatchContent();
  patch.lastChanged = storage.savePatch(patch.id, patch.title, patch.content);
  patchExists = true;
  elmBtnSave.disabled = true;
  elmBtnDuplicate.disabled = false;
  dispatcher.dispatch(Events.patch_saved);
}

function duplicatePatch(id) {
  patch.content = getPatchContent();
  const newId = storage.duplicatePatch(id);
  // If "saved patches" modal is open and current patch is dirty: just refresh list
  if (modal.isOpen() && titlePanel.isDirty()) {
    modal.updatePatchList();
    return;
  }
  // Open new patch
  void loadPatch(newId);
}

async function loadPatch(id) {
  if (csound) await stopCsound();
  const p = storage.loadPatch(id);
  patchExists = true;
  patch.id = p.id;
  patch.content = p.content;
  patch.lastChanged = p.lastChanged;
  patch.title = p.title;
  titlePanel.setTitle(p.title);
  showCurrentContent();
  if (modal.isOpen()) modal.close();
  editor.focus();
  elmBtnSave.disabled = true;
  elmBtnDuplicate.disabled = false;
}

function changeTitle(title) {
  patch.title = title;
  savePatch();
}

function downloadPatch() {
  patch.content = getPatchContent();
  const d = titlePanel.isDirty() ? new Date() : new Date(patch.lastChanged);
  const dateStr = getDateStr(d);
  let titleDashes = patch.title.replaceAll(" ", "-");
  let fname = `${dateStr}-${titleDashes}.orc`;
  fname = removeMultipleDashes(fname);
  triggerDownload(patch.content, "text/plain", fname);
}

function getFullCode(userCode) {
  let res = csdTemplate;
  res = res.replace("{{orc-defines}}", orcDefines);
  res = res.replace("{{instruments}}", userCode);
  return res;
}

function onChange(event) {
  if (editorBlockChange) return;
  if (!event.docChanged) return;
  elmBtnSave.disabled = false;
  elmBtnDuplicate.disabled = true;
  dispatcher.dispatch(Events.patch_changed);
}

function getPatchContent() {
  return editor.state.doc.toString();
}

function showCurrentContent() {
  editorBlockChange = true;
  editor.dispatch({
    changes: {from: 0, to: editor.state.doc.length, insert: patch.content}
  });
  editorBlockChange = false;
}

async function stopCsound() {
  await csound.stop();
  elmBtnPlayPause.classList.remove("on");
  csound = undefined;
}

async function loadAsset(fileURL, fileName) {
  const response = await fetch(fileURL);
  const abuf = await response.arrayBuffer();
  await csound.fs.writeFile(fileName, new Uint8Array(abuf));
}

async function startCsound() {

  csound = await Csound();
  if (!csound) return;
  elmBtnPlayPause.classList.add("on");

  // Load assets
  for (const sample of samples)
    await loadAsset(sample[0], sample[1]);

  // Compile full initial code
  patch.content = getPatchContent();
  const compileResult = await csound.compileCsdText(getFullCode(patch.content));
  if (compileResult != 0) {
    elmBtnPlayPause.classList.remove("on");
    csound = undefined;
    return;
  }

  // Tweaks
  csound.removeAllListeners("message");
  csound.addListener("message", msg => onMessage(msg, false));
  await csound.once("stop", () => csound = undefined );
  await csound.start();
}

async function evalChange() {
  if (!csound) return;
  patch.content = getPatchContent();
  let commitRange = getCommitRange(editor);
  let compileRes = await csound.compileOrc(commitRange.text);
  if (compileRes == 0) flash(editor, commitRange, "cm-highlight-good");
  else flash(editor, commitRange, "cm-highlight-bad");
  return true;
}

function onLog(msg) {
  const tr = (new Error()).stack;
  if (tr.includes("triggerMessage")) onMessage(msg, true);
  else clog(msg);
}

function onMessage(msg, isError) {
  const elmLine = document.createElement("span");
  if (isError) elmLine.classList.add("error");
  elmLine.innerText = msg;
  elmCsoundLog.appendChild(elmLine);
  elmCsoundLog.appendChild(document.createElement("br"));
  elmCsoundLog.scrollTop = elmCsoundLog.scrollHeight;
}

async function onKeyDown(e) {
  let handled = false;
  if (e.key == "Escape") {
    handled = true;
    if (modal.isOpen()) modal.close();
    else if (csound) await stopCsound();
    else handled = false;
  }
  else if (e.ctrlKey || e.metaKey) {
    if (e.key == "s") {
      savePatch();
      handled = true;
    }
  }
  if (handled) {
    e.preventDefault();
    e.stopPropagation();
  }
}

function toggleQRCode() {
  const elm = document.getElementById("qr-overlay");
  if (elm.classList.contains("visible")) elm.classList.remove("visible");
  else elm.classList.add("visible");
  return true;
}

function onBeforeUnload(e) {
  patch.content = getPatchContent();
  if (titlePanel.isDirty()) {
    e.preventDefault();
    e.returnValue = "Unsaved changes";
  }
}

function initSocket() {

  if (location.hostname === "localhost" || location.hostname === "127.0.0.1")
    socketUrl = "ws://localhost:9300/synth";
  else
    socketUrl = "wss://cosound.jealousmarkup.xyz/synth";

  let interval;
  let socket = new WebSocket(socketUrl);
  socket.addEventListener("open", () => {
    if (logComms) console.log("Socket open");
    interval = setInterval(async function () {
      if (!csound) return;
      const currentNoteIx = await csound.getControlChannel("noteIx");
      if (currentNoteIx == lastNoteIx) return;
      lastNoteIx = currentNoteIx;
      socket.send(`CLOCK ${currentNoteIx}`);
    }, 10);
  });
  socket.addEventListener("message", (event) => {
    const msg = event.data;
    if (logComms) console.log(`Message: ${msg}`);
    handleMessage(msg);
  });
  socket.addEventListener("close", () => {
    if (logComms) console.log("Socket closed");
    clearInterval(interval);
    interval = null;
    socket = null;
  });
}

const reSetVal = new RegExp("^NOTE (\\d+) +(RATIO|INDEX)(.+)$");

function handleMessage(msg) {
  let m;
  // NOTE N RATIO N
  // NOTE N INDEX N
  m = reSetVal.exec(msg);
  if (m) {
    let instr;
    if (m[2] == "RATIO") instr = "setRatio";
    else if (m[2] == "INDEX") instr = "setIndex";
    else return;
    if (!csound) return;
    const noteId = Number.parseInt(m[1]);
    const val = Number.parseFloat(m[3]);
    const scoreEvent = `i "${instr}" 0 0.01 ${noteId} ${val}`;
    void csound.inputMessage(scoreEvent);
    return;
  }
}
