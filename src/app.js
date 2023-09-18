import { EditorView, basicSetup } from "codemirror";
import { flashPlugin, flash, getCommitRange } from "./editor_customization.js";
import { keymap } from "@codemirror/view";
import { csoundMode } from "@hlolli/codemirror-lang-csound";
import { Csound } from "@csound/browser";

const clog = console.log;
console.log = onLog;

// -- eat tab, shift-tab
// -- tweak auto-ident?
// OK re-eval only instrument / line; also flash?
// -- save code on each (successful) eval
// -- steal+adapt clock from steven yi or sungmin

const elmCsoundLog = document.querySelector(".csound-log");
const elmBtnPlayPause = document.getElementById("btnPlayPause");
const elmEditorHost = document.getElementById("editorHost");
let editor;
let currentUserCode = initialUserCode;
let csoundInstance;

const orcDefines = `
sr = 48000
ksmps = 64 // sr/kr
nchnls = 2
0dbfs = 1
`;

const codeTemplate = `
<CsoundSynthesizer>
<CsOptions>
-odac -m0
</CsOptions>
<CsInstruments>
{{orc-defines}}
{{instruments}}
</CsInstruments>
<CsScore>
</CsScore>
</CsoundSynthesizer>`;

const initialUserCode = `gisine ftgen 1, 0, 1024, 10, 1

instr 1
 aSin  poscil  0.25, 440
       out     aSin
endin

event_i "i", 1, 0, 1
`;

function getFullCode(userCode) {
  let res = codeTemplate;
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
  if (e.key == "Escape" && csoundInstance) {
    await stopCsound();
    e.preventDefault();
    return false;
  }
});

async function stopCsound() {
  await csoundInstance.stop();
  elmBtnPlayPause.classList.remove("on");
  csoundInstance = undefined;
}

async function startCsound() {
  elmBtnPlayPause.classList.add("on");
  csoundInstance = await Csound();
  const compileResult = await csoundInstance.compileCsdText(getFullCode(currentUserCode));
  if (compileResult != 0) {
    csoundInstance = undefined;
    return;
  }
  csoundInstance.removeAllListeners("message");
  csoundInstance.addListener("message", msg => onMessage(msg, false));
  await csoundInstance.once("stop", () => csoundInstance = undefined );
  await csoundInstance.start();
}

async function evalChange() {
  if (!csoundInstance) return;
  let commitRange = getCommitRange(editor);
  let compileRes = await csoundInstance.compileOrc(commitRange.text);
  if (compileRes == 0) flash(editor, commitRange, "cm-highlight-good");
  else flash(editor, commitRange, "cm-highlight-bad");
  // await csoundInstance.evalCode(currentUserCode);
  return true;
}

elmBtnPlayPause.addEventListener("click", async function () {
  if (!csoundInstance) await startCsound();
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