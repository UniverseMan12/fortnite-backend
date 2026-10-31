import net from 'node:net';
import os from 'node:os';
import { randomBytes } from 'node:crypto';

// Hamachi uses 25/8; Radmin uses 26/8. Also support LAN and CGNAT VPNs.
export function validateHost(input) {
  const address = String(input ?? '').trim();
  if (net.isIP(address) !== 4) throw new Error('Enter the host VPN or LAN IPv4 address, without a port.');
  const [a, b, , d] = address.split('.').map(Number);
  const privateAddress = a === 10 || a === 25 || a === 26 ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127);
  if (!privateAddress || d === 255) throw new Error('Use the host Hamachi, Radmin VPN or LAN address.');
  return address;
}

export function hostAddresses(interfaces = os.networkInterfaces()) {
  return Object.entries(interfaces).flatMap(([name, addresses]) =>
    addresses.filter(info => !info.internal && info.family === 'IPv4').flatMap(info => {
      try { return [{ name, address: validateHost(info.address) }]; } catch { return []; }
    }));
}

export function multiplayerName(previous = {}) {
  // Stable per installation, but different on each friend's first launch.
  return /^Player_[a-f0-9]{12}$/.test(previous.multiplayerName ?? '')
    ? previous.multiplayerName : `Player_${randomBytes(6).toString('hex')}`;
}
