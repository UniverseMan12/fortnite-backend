const $ = id => document.getElementById(id);
let mode = 'solo', busy = false;
const titles = { play: 'Your next drop starts here.', setup: 'Make it yours.', activity: 'Behind every good drop.' };
const notes = {
  solo: 'Choose a playlist in Reboot, then click Start server. Press Play in Fortnite.',
  host: 'Friends use your VPN IP to join. When everyone is on the island, click Start Bus Countdown in Reboot.',
  join: 'Use the same VPN network and Fortnite 4.2 build. Press Play after your host is ready.'
};
function showPage(name) {
  document.querySelectorAll('.page').forEach(el => { el.hidden = el.id !== 'page-' + name; });
  document.querySelectorAll('.nav').forEach(el => el.classList.toggle('active', el.dataset.page === name));
  $('page-title').textContent = titles[name];
}
function selectMode(value) {
  mode = value;
  document.querySelectorAll('.mode').forEach(el => { const selected = el.dataset.mode === mode; el.classList.toggle('selected', selected); el.setAttribute('aria-pressed', selected); });
  $('join-row').hidden = mode !== 'join'; $('mode-note').textContent = notes[mode];
}
function updateFolder() {
  const value = $('game-path').value.trim();
  $('install-title').textContent = value ? 'Fortnite installation selected' : 'Connect your game';
  $('install-subtitle').textContent = value ? 'FortniteGame + Engine · verified when you launch' : 'Choose the folder containing FortniteGame and Engine.';
}
function showError(error) { $('error-banner').textContent = error.message || String(error); $('error-banner').hidden = false; }
async function safely(action) { try { return await action(); } catch (error) { showError(error); } }
function render(state) {
  busy = state.busy;
  for (const el of document.querySelectorAll('.mode, #game-path, #host-address, #browse, #check, #prepare, #launch')) el.disabled = busy;
  $('launch').hidden = busy; $('stop').hidden = !busy; $('stop').disabled = state.phase === 'stopping';
  $('top-status').textContent = busy ? 'SESSION ACTIVE' : state.phase === 'error' ? 'NEEDS ATTENTION' : 'STANDBY';
  $('status-heading').textContent = busy ? 'SESSION IN PROGRESS' : state.phase === 'error' ? 'LET’S GET THIS SORTED' : state.phase === 'complete' ? 'CHECKS COMPLETE' : 'ALL SYSTEMS STANDING BY';
  $('status-message').textContent = state.message;
  document.querySelector('.session-status').classList.toggle('working', busy);
  $('activity-count').textContent = state.events.length;
  if (state.events.length) {
    $('activity-list').replaceChildren(...state.events.map(event => {
      const row = document.createElement('div'); row.className = 'event ' + (event.state || event.type);
      const time = document.createElement('time'); time.textContent = new Date(event.time).toLocaleTimeString('en-GB');
      const icon = document.createElement('span'); icon.className = 'event-icon'; icon.textContent = event.type === 'failure' || event.state === 'error' ? '✕' : event.state === 'ok' ? '✓' : '•';
      const text = document.createElement('span'); text.textContent = event.message; row.append(time, icon, text); return row;
    }));
    $('activity-list').scrollTop = $('activity-list').scrollHeight;
  }
  if (state.phase === 'error') showError(state.message);
  $('addresses').hidden = !state.addresses.length;
  $('addresses').replaceChildren(...state.addresses.map(address => {
    const item = document.createElement('div'); item.className = 'address';
    const title = document.createElement('strong'); title.textContent = address.name;
    const ip = document.createElement('span'); ip.textContent = address.address;
    item.append(title, ip); return item;
  }));
}
async function start(action) {
  $('error-banner').hidden = true;
  if (!$('game-path').value.trim()) { showPage('setup'); $('game-path').focus(); throw new Error('Choose your Fortnite folder first.'); }
  if (action === 'launch' && mode === 'join' && !$('host-address').value.trim()) { showPage('play'); $('host-address').focus(); throw new Error('Enter your host’s VPN or LAN IPv4 address.'); }
  await window.launcher.start(action, { mode, gamePath: $('game-path').value, host: $('host-address').value });
  if (action === 'launch') showPage('play'); else showPage('activity');
}
document.querySelectorAll('[data-page]').forEach(el => el.addEventListener('click', () => showPage(el.dataset.page)));
document.querySelectorAll('[data-mode]').forEach(el => el.addEventListener('click', () => selectMode(el.dataset.mode)));
document.querySelectorAll('[data-link]').forEach(el => el.addEventListener('click', () => safely(() => window.launcher.link(el.dataset.link))));
$('edit-folder').onclick = () => { showPage('setup'); $('game-path').focus(); };
$('game-path').oninput = updateFolder;
$('browse').onclick = () => safely(async () => { const selected = await window.launcher.browse(); if (selected) { $('game-path').value = selected; updateFolder(); } });
for (const [button, action] of [['launch','launch'], ['check','check'], ['prepare','prepare']]) $(button).onclick = () => safely(() => start(action));
$('stop').onclick = () => safely(() => window.launcher.stop());
$('open-logs').onclick = () => safely(() => window.launcher.logs());
$('minimize').onclick = () => safely(() => window.launcher.minimize());
$('close').onclick = () => safely(() => window.launcher.close());
window.launcher.subscribe(render);
safely(async () => {
  const initial = await window.launcher.initial();
  $('app-version').textContent = initial.version;
  $('game-path').value = initial.settings.gamePath || '';
  $('host-address').value = initial.settings.host || '';
  selectMode(['solo','host','join'].includes(initial.settings.mode) ? initial.settings.mode : 'solo');
  updateFolder(); render(initial);
});
