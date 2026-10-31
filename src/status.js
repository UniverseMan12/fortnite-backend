export const folderPrompt = 'Folder containing FortniteGame and Engine: ';

export function statusLine(message, state = 'info', color = Boolean(process.stdout.isTTY)) {
  const styles = { ok: ['\u2713', 32], error: ['\u2717', 31], pending: ['\u2022', 33], info: ['\u2022', 36] };
  const [symbol, code] = styles[state] || styles.info;
  const line = symbol + ' ' + message;
  return color ? '\u001b[' + code + 'm' + line + '\u001b[0m' : line;
}
export function showStatus(message, state) { console.log(statusLine(message, state)); }
