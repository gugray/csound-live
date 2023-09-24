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

  setTitle(title) {
    this.elmInput.value = title;
    this.elmChanges.classList.remove("visible");
  }

  isDirty() {
    return this.elmChanges.classList.contains("visible");
  }
}

function updateTitle(obj) {
  const currTitle = obj.elmInput.value;
  if (currTitle != obj.origTitle)
    obj.dispatcher.dispatch(Events.change_title, currTitle);
  delete obj.origTitle;
  obj.dispatcher.dispatch(Events.focus_patch);
}

function wireUp(obj) {

  obj.elmInput.addEventListener("focus", () => {
    if (!obj.origTitle) obj.origTitle = obj.elmInput.value;
  });

  obj.elmPanel.addEventListener("focusout", e => {
    const focusInPanel = obj.elmPanel.matches(':focus-within');
    if (focusInPanel) return;
    if (obj.hasOwnProperty("origTitle")) {
      obj.elmInput.value = obj.origTitle;
      delete obj.origTitle;
    }
  });

  obj.dispatcher.subscribe(Events.patch_changed, () => {
    obj.elmChanges.classList.add("visible");
  });

  obj.dispatcher.subscribe(Events.patch_saved, () => {
    obj.elmChanges.classList.remove("visible");
  });

  obj.elmPanel.addEventListener("keydown", (e) => {
    if (e.key == "Escape") {
      obj.dispatcher.dispatch(Events.focus_patch);
      e.preventDefault();
      e.stopPropagation();
    }
    else if (e.key == "Enter") {
      updateTitle(obj);
      e.preventDefault();
      e.stopPropagation();
    }
  });

  obj.elmCancel.addEventListener("click", () => {
    // This triggers focousout, which resets input's value to original
    obj.dispatcher.dispatch(Events.focus_patch);
  });

  obj.elmOK.addEventListener("click", () => updateTitle(obj));
}