export function validateOptions(value) {
  if (!value || typeof value !== 'object' || !['solo', 'host', 'join'].includes(value.mode)) throw new Error('Choose Solo, Host or Join.');
  if (typeof value.gamePath !== 'string' || !value.gamePath.trim() || value.gamePath.length > 2048) throw new Error('Choose the folder containing FortniteGame and Engine.');
  const host = String(value.host ?? '').trim();
  if (host.length > 64) throw new Error('The host address is too long.');
  return { mode: value.mode, gamePath: value.gamePath.trim(), host };
}

export const links = Object.freeze({
  github: 'https://github.com/UniverseMan12/fortnite-backend',
  releases: 'https://github.com/UniverseMan12/fortnite-backend/releases',
  hamachi: 'https://vpn.net/',
  runtime: 'https://aka.ms/vc14/vc_redist.x64.exe',
  game: 'https://drive.google.com/file/d/1m8VEUcKnxA0UYHt5-txPbRhfbn0OVhEm/view?usp=sharing'
});
