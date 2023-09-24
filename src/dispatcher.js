export const Events = {
  patch_changed: "patch_changed",
  patch_saved: "patch_saved",
  focus_patch: "focus_patch",
  change_title: "change_title",
  modal_closed: "modal_closed",
  delete_patch: "delete_patch",
  duplicate_patch: "duplicate_patch",
  open_patch: "open_patch",
}

export class Dispatcher {

  constructor() {
    this.elm = document.createComment("dispatcher-event-bus-element");
    this.queue = [];
    this.pos = 0;
  }

  dispatch(eventName, data) {
    this.queue.push({name: eventName, data});
    if (this.queue.length != 1) return;
    while (this.pos < this.queue.length) {
      const msg = this.queue[this.pos];
      this.elm.dispatchEvent(new CustomEvent(msg.name, {detail: msg.data }));
      ++this.pos;
    }
    this.pos = 0;
    this.queue.length = 0;
  }

  subscribe(eventName, handler) {
    this.elm.addEventListener(eventName, ({detail}) => handler(detail));
  }

  unsubscribe(eventName, handler) {
    this.elm.removeEventListener(eventName, handler);
  }
}
