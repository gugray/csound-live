import verstr from "./version.txt";
import { EditorView, basicSetup } from "codemirror";
import { flashPlugin, flash, getCommitRange } from "./editor_customization.js";
import { indentWithTab } from "@codemirror/commands"
import { keymap } from "@codemirror/view";
import { csoundMode } from "@hlolli/codemirror-lang-csound";
import { Csound } from "@csound/browser";
import { initialUserCode, orcDefines, csdTemplate } from "./csound_content.js";
import { TitlePanel } from "./title_panel.js";
import { Dispatcher, Events } from "./dispatcher.js";
import { Storage } from "./storage.js";

// -- navigate-away warning if dirty
// -- saved patches list
// -- structure app :)
// -- spectrum analysis inset
// -- p5 panel?

const samples = [
  // ["./samples/kick1.aiff", "kick1.aiff"],
];

const clog = console.log;
console.log = onLog;

const elmVersion = document.getElementById("version");
const elmCsoundLog = document.querySelector(".csound-log");
const elmBtnPlayPause = document.getElementById("btnPlayPause");
const elmBtnSave = document.getElementById("btnSave");
const elmBtnDownload = document.getElementById("btnDownload");
const elmEditorHost = document.getElementById("editorHost");
const dispatcher = new Dispatcher();
const storage = new Storage();
let titlePanel, editor;
let editorBlockChange = false;
let cs; // Csound instance

const patch = {
  id: null,
  lastChanged: new Date().toISOString(),
  title: null,
  content: initialUserCode,
};

[patch.id, patch.title] = storage.getNewPatchInfo();
elmVersion.innerText = verstr;
titlePanel = new TitlePanel(document.getElementById("pnlTitle"), dispatcher, patch.title);
elmBtnSave.addEventListener("click", () => savePatch());
elmBtnDownload.addEventListener("click", () => downloadPatch());
dispatcher.subscribe(Events.focus_patch, () => editor.focus());
dispatcher.subscribe(Events.change_title, title => changeTitle(title));

function savePatch() {
  patch.content = getPatchContent();
  storage.savePatch(patch.id, patch.title, patch.content);
  elmBtnSave.disabled = true;
  dispatcher.dispatch(Events.patch_saved);
}

function changeTitle(title) {
  patch.title = title;
  savePatch();
}

function downloadPatch() {
  patch.content = getPatchContent();
  const hasUnsavedChanges = storage.hasUnsavedChanges(patch.id, patch.content);

  const d = hasUnsavedChanges ? new Date() : new Date(patch.lastChanged);
  const dateStr = d.getFullYear() + "-" +
    ("0" + (d.getMonth() + 1)).slice(-2) + "-" +
    ("0" + d.getDate()).slice(-2);
  let titleDashes = patch.title.replaceAll(" ", "-");
  let fname = `${dateStr}-${titleDashes}.orc`;
  let file;
  let data = [];
  data.push(getPatchContent());
  let properties = {type: 'text/plain'};
  try { file = new File(data, fname, properties); }
  catch { file = new Blob(data, properties); }
  let url = URL.createObjectURL(file);
  const elm = document.createElement("a");
  elm.href = url;
  elm.download = fname;
  elm.dispatchEvent(new MouseEvent("click"));
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
  dispatcher.dispatch(Events.patch_changed);
}

function getPatchContent() {
  return editor.state.doc.toString();
}

const customKeymap = keymap.of([
  { key: "Cmd-Enter", run: evalChange, },
  { key: "Ctrl-Enter", run: evalChange, },
]);

editor = new EditorView({
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

editorBlockChange = true;
editor.dispatch({
  changes: { from: 0, to: editor.state.doc.length, insert: patch.content }
});
editorBlockChange = false;

setTimeout(() => {
  editor.focus();
}, 200);

elmEditorHost.addEventListener("click", () => editor.focus());

document.body.addEventListener("keydown", async e => {
  let handled = false;
  if (e.key == "Escape" && cs) {
    await stopCsound();
    handled = true;
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
});

async function stopCsound() {
  await cs.stop();
  elmBtnPlayPause.classList.remove("on");
  cs = undefined;
}

async function loadAsset(fileURL, fileName) {
  const response = await fetch(fileURL);
  const abuf = await response.arrayBuffer();
  await cs.fs.writeFile(fileName, new Uint8Array(abuf));
};

async function startCsound() {

  cs = await Csound();
  if (!cs) return;
  elmBtnPlayPause.classList.add("on");

  // Load assets
  for (const sample of samples)
    await loadAsset(sample[0], sample[1]);

  // Compile full initial code
  patch.content = getPatchContent();
  const compileResult = await cs.compileCsdText(getFullCode(patch.content));
  if (compileResult != 0) {
    elmBtnPlayPause.classList.remove("on");
    cs = undefined;
    return;
  }

  // Tweaks
  cs.removeAllListeners("message");
  cs.addListener("message", msg => onMessage(msg, false));
  await cs.once("stop", () => cs = undefined );
  await cs.start();
}

async function evalChange() {
  if (!cs) return;
  patch.content = getPatchContent();
  let commitRange = getCommitRange(editor);
  let compileRes = await cs.compileOrc(commitRange.text);
  if (compileRes == 0) flash(editor, commitRange, "cm-highlight-good");
  else flash(editor, commitRange, "cm-highlight-bad");
  return true;
}

elmBtnPlayPause.addEventListener("click", async function () {
  if (!cs) await startCsound();
  else await stopCsound();
  editor.focus();
});

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

document.addEventListener("mousemove", async e => {
  if (!cs) return;
  const page = document.documentElement;
  const [w, h] = [page.clientWidth, page.clientHeight];
  let [x, y] = [e.clientX, e.clientY];
  x /= w;
  y /= h;
  const scoreEvent = `i999 0 0.01 ${x} ${y}`;
  await cs.inputMessage(scoreEvent);
});
