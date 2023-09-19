import { EditorView, basicSetup } from "codemirror";
import { flashPlugin, flash, getCommitRange } from "./editor_customization.js";
import { indentWithTab } from "@codemirror/commands"
import { keymap } from "@codemirror/view";
import { csoundMode } from "@hlolli/codemirror-lang-csound";
import { Csound } from "@csound/browser";
import { initialUserCode, orcDefines, csdTemplate } from "./csound_content.js";

const clog = console.log;
console.log = onLog;

// OK eat tab, shift-tab
// XX tweak auto-ident?
// OK re-eval only instrument / line; also flash?
// OK steal+adapt clock from steven yi or sungmin
// OK inject (normalized) mouse X and Y
// OK inject mouse coords without re-parsing (OOM)
// OK cache bustig on includes
// -- build pipeline
// -- save, download, rename
// -- saved patches list
// -- structure app :)
// -- spectrum analysis inset


const elmCsoundLog = document.querySelector(".csound-log");
const elmBtnPlayPause = document.getElementById("btnPlayPause");
const elmEditorHost = document.getElementById("editorHost");
let editor;
let currentUserCode = initialUserCode;
let cs; // Csound instance

const samples = [
  // ["./samples/kick1.aiff", "kick1.aiff"],
];

function getFullCode(userCode) {
  let res = csdTemplate;
  res = res.replace("{{orc-defines}}", orcDefines);
  res = res.replace("{{instruments}}", userCode);
  return res;
}

function onChange(event) {
  currentUserCode = event.state.doc.toString();
}

const customKeymap = keymap.of([
  {
    key: "Cmd-Enter",
    run: evalChange,
  },
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

editor.dispatch({
  changes: { from: 0, to: editor.state.doc.length, insert: initialUserCode }
});

setTimeout(() => {
  editor.focus();
}, 200);

elmEditorHost.addEventListener("click", () => editor.focus());

document.body.addEventListener("keydown", async e => {
  if (e.key == "Escape" && cs) {
    await stopCsound();
    e.preventDefault();
    return false;
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

  elmBtnPlayPause.classList.add("on");
  cs = await Csound();

  // Load assets
  for (const sample of samples)
    await loadAsset(sample[0], sample[1]);

  // Compile full initial code
  const compileResult = await cs.compileCsdText(getFullCode(currentUserCode));
  if (compileResult != 0) {
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
  let commitRange = getCommitRange(editor);
  let compileRes = await cs.compileOrc(commitRange.text);
  if (compileRes == 0) flash(editor, commitRange, "cm-highlight-good");
  else flash(editor, commitRange, "cm-highlight-bad");
  // await cs.evalCode(currentUserCode);
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
