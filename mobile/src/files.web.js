// Files in the app's web version: downloads and an upload button.
const dl = (name, blob) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove(); };
export async function shareFile(name, base64, mime) { const b = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)); dl(name, new Blob([b], { type: mime })); }
export async function shareText(name, text, mime = 'application/json') { dl(name, new Blob([text], { type: mime })); }
export function pickText() {
  return new Promise((ok) => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.json,application/json'; i.onchange = async () => ok(i.files?.[0] ? await i.files[0].text() : null); i.click(); });
}
