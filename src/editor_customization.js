import { ViewPlugin, ViewUpdate } from "@codemirror/view";

import { StateField, StateEffect } from "@codemirror/state";
import { Decoration } from "@codemirror/view";
import { EditorView } from "@codemirror/view";
import { Range } from "@codemirror/state";

// Effects can be attached to transactions to communicate with the extension
const addMarks = StateEffect.define();
const filterMarks = StateEffect.define();

export function flash(editor, txt, className) {
  const flashMark = Decoration.mark({
    // attributes: {style: "text-decoration: line-through"},
    class: className,
  });
  editor.dispatch({
    effects: addMarks.of([flashMark.range(txt.from, txt.to)]),
  });
  setTimeout(() => {
    editor.dispatch({
      effects: filterMarks.of((from, to) => to <= txt.from || from >= txt.to)
    });
  }, 500);
}

export const flashPlugin = StateField.define({
  // Start with an empty set of decorations
  create() {
    return Decoration.none;
  },
  // This is called whenever the editor updates. It computes the new set.
  update(value, tr) {
    // Move the decorations to account for document changes
    value = value.map(tr.changes);
    // If this transaction adds or removes decorations, apply those changes
    for (let effect of tr.effects) {
      if (effect.is(addMarks))
        value = value.update({ add: effect.value, sort: true });
      else if (effect.is(filterMarks))
        value = value.update({ filter: effect.value });
    }
    return value;
  },
  // Indicate that this field provides a set of decorations
  provide: (f) => EditorView.decorations.from(f),
});

const blockMarks = [
  [/^\s*instr/, "instr"],
  [/^\s*endin/, "endin"],
  [/^\s*opcode/, "opcode"],
  [/^\s*endop/, "endop"]
];

function isBlockMark(txt) {
  for (let i = 0; i < blockMarks.length; i++) {
    if (txt.match(blockMarks[i][0]) != null) {
      return blockMarks[i][1];
    }
  }
  return null;
}

function findLineWithBlock(editor, start, direction, limit) {
  const doc = editor.state.doc;
  for (let i = start; i != limit; i += direction) {
    let find = isBlockMark(doc.line(i).text);
    if (find != null) {
      return [i, find];
    }
  }
  return null;
}

export function getCommitRange(editor) {
  const state = editor.state;
  const selection = state.selection;
  const doc = state.doc;
  let {from, to} = selection.main;
  let text = state.sliceDoc(from, to);

  let prevBlockMark = findLineWithBlock(editor, doc.lineAt(from).number, -1, 0);
  let nextBlockMark = findLineWithBlock(editor,  doc.lineAt(to).number, 1, doc.lines + 1);

  const isBlock = prevBlockMark != null && nextBlockMark != null &&
    ((prevBlockMark[1] === "instr" && nextBlockMark[1] === "endin") ||
      (prevBlockMark[1] === "opcode" && nextBlockMark[1] === "endop"));

  if (isBlock) {
    from = doc.line(prevBlockMark[0]).from;
    to = doc.line(nextBlockMark[0]).to;
    text = state.sliceDoc(from, to);
  } else {
    const fromLine = doc.lineAt(from);
    from = fromLine.from;
    to = fromLine.to;
    text = fromLine.text;
  }
  return { text, from, to };
}

