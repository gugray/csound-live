const logComms = true;
const evts = ["mousedown", "mousemove", "mouseup"];
const elmNotes = [];
const maxIndex = 10, maxRatio = 8;
let elmMainJoin, elmMainPlay;
let elmJoinNote, elmBtnJoin, elmBtnLeave;
let elmLeftSliderHost, elmLeftSlider, elmLeftVal;
let elmRightSliderHost, elmRightSlider, elmRightVal;
let socketUrl;
let socket = null;
let noteId = -1;
let indexVal = 1, ratioVal = 1;

init();

function init() {

  socketUrl = window.location.protocol.startsWith("https") ? "wss://" : "ws://";
  socketUrl += document.location.host + "/player";

  if ("ontouchstart" in window)  {
    evts[0] = "touchstart";
    evts[1] = "touchmove";
    evts[2] = "touchend";
  }

  for (let i = 0; i < 8; ++i) {
    const elm = document.querySelector(".note" + i);
    elmNotes.push(elm);
  }
  elmMainJoin = document.querySelector("main.join");
  elmMainPlay = document.querySelector("main.play");
  elmJoinNote = document.querySelector("main.join .info");
  elmBtnJoin = document.querySelector("#btnJoin");
  elmBtnLeave = document.querySelector("#btnLeave");
  elmLeftSliderHost = document.querySelector(".controls .left .slider");
  elmLeftSlider = document.querySelector("#slLeft");
  elmLeftVal = document.querySelector("#valLeft");
  elmRightSliderHost = document.querySelector(".controls .right .slider");
  elmRightSlider = document.querySelector("#slRight");
  elmRightVal = document.querySelector("#valRight");

  elmBtnJoin.addEventListener("click", () => doJoin());
  elmBtnLeave.addEventListener("click", () => doLeave());

  setInterval(() => socketKeepAlive(), 500);
  updateMain();

  initPlayControls();
}

function socketKeepAlive() {
  // Socket exists and is not closed: nothing to do
  if (socket && socket.readyState != 3) return;
  initSocket();
}

function updateMain() {

  elmMainJoin.classList.remove("active");
  elmMainPlay.classList.remove("active");
  elmJoinNote.classList.add("hidden");
  elmBtnJoin.disabled = true;
  for (const elm of elmNotes) elm.classList.remove("me");

  // // DBG: Play screen
  // elmMainPlay.classList.add("active");
  // return;

  // No socket: join screen, enabed button
  if (!socket) {
    elmMainJoin.classList.add("active");
    elmBtnJoin.disabled = false;
  }
  // Socket exists and is connected
  else if (socket.readyState == 1) {
    // If we have noteId: we're playing!
    if (noteId >= 0) {
      elmMainPlay.classList.add("active");
      elmNotes[noteId].classList.add("me");
      updateControlsUI();
      setTimeout(() => sendValues(), 100);
    }
    // We're waiting to join
    else if (noteId == -2) {
      elmMainJoin.classList.add("active");
      elmJoinNote.classList.remove("hidden");
    }
    // We haven't requested to join yet
    else {
      elmMainJoin.classList.add("active");
      elmBtnJoin.disabled = false;
    }
  }
  // Socket in some transitional state
  else {
    elmMainJoin.classList.add("active");
  }
}

function doJoin() {
  if (!socket || socket.readyState != 1) return;
  noteId = -2;
  socket.send("JOIN");
  updateMain();
}

function doLeave() {
  noteId = -1;
  if (socket && socket.readyState < 2) socket.close();
  updateMain();
}

function valToSliderY(val, maxVal) {
  let normPos = 0; // 1 at top, 0 middle, -1 at bottom
  if (val >= 1) normPos = (val - 1) / (maxVal - 1);
  else normPos = val - 1;
  const h = elmLeftSliderHost.clientHeight;
  return h * 0.5 * (1 - normPos);
}

function sliderYToVal(y, slideHeight, maxVal) {
  // 1 at top, 0 middle, -1 at bottom
  const normPos = (slideHeight / 2 - y) / (slideHeight / 2);
  let val;
  if (normPos >= 0) val = 1 + (maxVal - 1) * normPos;
  else val = 1 + normPos;
  return val;
}

function updateControlLabels() {
  let indexStr, ratioStr;
  const iv = Math.max(indexVal, 1 / maxIndex);
  const rv = Math.max(ratioVal, 1 / maxRatio);
  if (indexVal >= 1) indexStr = iv.toFixed(2);
  else indexStr = "1 / " + (1/iv).toFixed(2);
  elmLeftVal.innerText = indexStr;
  if (ratioVal >= 1) ratioStr = rv.toFixed(2);
  else ratioStr = "1 / " + (1/rv).toFixed(2);
  elmRightVal.innerText = ratioStr;
}

function updateControlsUI() {
  elmLeftSlider.style.top = valToSliderY(indexVal, maxIndex) + "px";
  elmRightSlider.style.top = valToSliderY(ratioVal, maxRatio) + "px";
  updateControlLabels();
}

let dragElm = null;
let dragStartY = -1;
let elmStartY = -1;

function initPlayControls() {

  updateControlsUI();

  // mousedown / touchstart
  document.body.addEventListener(evts[0], e => {
    dragElm = e.pageX < document.body.clientWidth / 2
      ? elmLeftSlider : elmRightSlider;
    const elmRect = dragElm.getBoundingClientRect();
    const elmMidY = (elmRect.top + elmRect.bottom) / 2;
    if (Math.abs(e.pageY - elmMidY) > 40) return;
    dragStartY = e.pageY;
    elmStartY = dragElm.offsetTop + dragElm.clientHeight / 2;
    // console.log(elmStartY);
    // console.log(e.pageX + ", " + e.pageY);
    // console.log(elmRightSlider.getBoundingClientRect());
  });

  const getCurrY = e => {
    const hostHeight = dragElm.parentElement.clientHeight;
    const ofs = e.pageY - dragStartY;
    let currY = elmStartY + ofs;
    if (currY < 0) currY = 0;
    else if (currY > hostHeight) currY = hostHeight;
    return currY;
  }

  // mousemove / touchmove
  document.body.addEventListener(evts[1], e => {
    if (dragStartY == -1) return;
    const currY = getCurrY(e);
    dragElm.style.top = currY + "px";

    const maxVal = dragElm == elmLeftSlider ? maxIndex : maxRatio;
    const newVal = sliderYToVal(currY, dragElm.parentElement.clientHeight, maxVal);
    if (dragElm == elmLeftSlider) indexVal = newVal;
    else ratioVal = newVal;
    updateControlLabels();
  });

  // mouseup / touchend
  document.body.addEventListener(evts[2], e => {
    if (dragStartY == -1) return;
    sendValues();
    dragElm = null;
    dragStartY = -1;
    elmStartY = -1;
  });
}

function sendValues() {
  if (!socket || socket.readyState != 1) return;
  const iv = Math.max(indexVal, 1 / maxIndex);
  const rv = Math.max(ratioVal, 1 / maxRatio);
  socket.send(`INDEX ${iv.toFixed(3)}`);
  socket.send(`RATIO ${rv.toFixed(3)}`);
}

function initSocket() {

  socket = new WebSocket(socketUrl);
  socket.addEventListener("open", () => {
    if (logComms) console.log("Socket open");
    updateMain();
  });
  socket.addEventListener("message", async (event) => {
    // const msg = await event.data.text();
    const msg = await event.data;
    if (logComms) console.log(`Message: ${msg}`);
    handleMessage(msg);
  });
  socket.addEventListener("close", () => {
    if (logComms) console.log("Socket closed");
    socket = null;
    noteId = -1;
    updateMain();
  });
}

const reClock = new RegExp("^CLOCK (\\d+)$")
const reNoteId = new RegExp("^NOTEID (\\d+)$")

function handleMessage(msg) {
  let m;
  // CLOCK N
  m = reClock.exec(msg);
  if (m) {
    const noteIx = Number.parseInt(m[1]);
    const noteId = noteIx % 8;
    for (let i = 0; i < elmNotes.length; ++i) {
      const elm = elmNotes[i];
      elm.classList.remove("on");
      if (i == noteId) elm.classList.add("on");
    }
    return;
  }
  // NOTEID N
  m = reNoteId.exec(msg);
  if (m) {
    noteId = Number.parseInt(m[1]);
    updateMain();
    return;
  }
}