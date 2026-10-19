// Files: what the editor exports (and backups) are saved and shared; projects are imported from Files / Drive.
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

const safe = (n) => String(n || 'file').replace(/[^\w.\- ]+/g, '_');
/** Save a file (base64) and open the share sheet (Files, Drive, AirDrop, email…). */
export async function shareFile(name, base64, mime) {
  const uri = FileSystem.cacheDirectory + safe(name);
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: mime, dialogTitle: name });
  return uri;
}
export async function shareText(name, text, mime = 'application/json') {
  const uri = FileSystem.cacheDirectory + safe(name);
  await FileSystem.writeAsStringAsync(uri, text);
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: mime, dialogTitle: name });
  return uri;
}
/** Pick a .json project or backup; its text, or null. */
export async function pickText() {
  const r = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
  if (r.canceled || !r.assets?.length) return null;
  return FileSystem.readAsStringAsync(r.assets[0].uri);
}
