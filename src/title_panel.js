import { Events } from "./dispatcher.js";

export class TitlePanel {

  constructor(elmPanel, dispatcher, patchTitle) {
    this.dispatcher = dispatcher;
    this.elmPanel = elmPanel;
    this.elmInput = elmPanel.querySelector("input");
    this.elmChanges = elmPanel.querySelector("span");
    this.elmBorder = elmPanel.querySelector(".titleBorder");
    this.elmCancel = elmPanel.querySelector(".cancel");
    this.elmOK = elmPanel.querySelector(".ok");
    this.elmInput.value = patchTitle;

    wireUp(this);
  }
}

function updateTitle(tp) {
  const currTitle = tp.elmInput.value;
  if (currTitle != tp.origTitle)
    tp.dispatcher.dispatch(Events.change_title, currTitle);
  delete tp.origTitle;
  tp.dispatcher.dispatch(Events.focus_patch);
}

function wireUp(tp) {

  tp.elmInput.addEventListener("focus", () => {
    if (!tp.origTitle) tp.origTitle = tp.elmInput.value;
  });

  tp.elmPanel.addEventListener("focusout", e => {
    const focusInPanel = tp.elmPanel.matches(':focus-within');
    if (focusInPanel) return;
    if (tp.hasOwnProperty("origTitle")) {
      tp.elmInput.value = tp.origTitle;
      delete tp.origTitle;
    }
  });

  tp.dispatcher.subscribe(Events.patch_changed, () => {
    tp.elmChanges.classList.add("visible");
  });

  tp.dispatcher.subscribe(Events.patch_saved, () => {
    tp.elmChanges.classList.remove("visible");
  });

  tp.elmPanel.addEventListener("keydown", (e) => {
    if (e.key == "Escape") {
      tp.dispatcher.dispatch(Events.focus_patch);
      e.preventDefault();
      e.stopPropagation();
    }
    else if (e.key == "Enter") {
      updateTitle(tp);
      e.preventDefault();
      e.stopPropagation();
    }
  });

  tp.elmCancel.addEventListener("click", () => {
    // This triggers focousout, which resets input's value to original
    tp.dispatcher.dispatch(Events.focus_patch);
  });

  tp.elmOK.addEventListener("click", () => updateTitle(tp));
}