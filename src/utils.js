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