import { EditorView, basicSetup } from "codemirror";
import { csoundMode } from "@hlolli/codemirror-lang-csound";
import { Csound } from "@csound/browser";

const clog = console.log;
console.log = onLog;

const triggerEvent = "ontouchstart" in document.documentElement ? "touchend" : "click";
const elmCsoundLog = document.querySelector(".csound-log");
let modifiedCode = initialCode;
let csoundInstance;

const initialCode = `<CsoundSynthesizer>
<CsOptions>
-odac
</CsOptions>
<CsInstruments>
instr 1
 aSin  poscil  0dbfs/4, 440
       out     aSin
endin
</CsInstruments>
<CsScore>
i 1 0 1
</CsScore>
</CsoundSynthesizer>`;

const onChange = (event) => {
  modifiedCode = event.state.doc.toString();
};

const editor = new EditorView({
  extensions: [
    basicSetup,
    csoundMode(),
    EditorView.updateListener.of(onChange)
  ],
  parent: document.getElementById("editorHost")
});

editor.dispatch({
  changes: { from: 0, to: editor.state.doc.length, insert: initialCode }
});

document
  .querySelector("#btnPlayPause")
  .addEventListener(triggerEvent, async function () {
    // Playing
    if (csoundInstance) {
      await csoundInstance.stop();
      csoundInstance = undefined;
      return;
    }
    // Not playing
    csoundInstance = await Csound();
    const compileResult = await csoundInstance.compileCsdText(modifiedCode);
    if (compileResult != 0) {
      csoundInstance = undefined;
      return;
    }
    csoundInstance.removeAllListeners("message");
    csoundInstance.addListener("message", msg => onMessage(msg, false));
    await csoundInstance.once("stop", () => csoundInstance = undefined );
    await csoundInstance.start();
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