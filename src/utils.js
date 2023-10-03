export function enc(s) {
  return s.replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function fmtTime(ts) {
  const d = new Date(ts);
  let res = d.getFullYear()
    + "‑" + (d.getMonth()+1).toString().padStart(2, "0")
    + "‑" + d.getDate().toString().padStart(2, "0")
    + " " + d.getHours().toString().padStart(2, "0")
    + ":" + d.getMinutes().toString().padStart(2, "0")
  return res;
}

export function getDateStr(date) {
  const dateStr = date.getFullYear() + "-" +
    ("0" + (date.getMonth() + 1)).slice(-2) + "-" +
    ("0" + date.getDate()).slice(-2);
  return dateStr;
}

export function removeMultipleDashes(str) {
  let len = str.length;
  while (true) {
    str = str.replaceAll("--", "-");
    if (str.length == len) break
    len = str.length;
  }
  return str;
}

export function triggerDownload(content, mimeType, fileName) {
  let file;
  let data = [];
  data.push(content);
  let properties = { type: mimeType };
  try {
    file = new File(data, fileName, properties);
  } catch {
    file = new Blob([new Uint8Array(data)], properties);
  }
  let url = URL.createObjectURL(file);
  const elm = document.createElement("a");
  elm.classList.add("hiddendownloadlink");
  document.body.appendChild(elm);
  elm.href = url;
  elm.download = fileName;
  elm.dispatchEvent(new MouseEvent(`click`, {bubbles: true, cancelable: true, view: window}));
  setTimeout(() => {
    URL.revokeObjectURL(url);
    elm.remove();
  }, 100);
}
