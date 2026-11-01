import test from 'node:test';
import assert from 'node:assert/strict';
import { validateHost, hostAddresses, multiplayerName, parseJoinTarget } from '../src/multiplayer.js';

test('VPN and LAN host addresses are validated without accepting URLs or command arguments', () => {
  for (const address of ['25.1.2.3', '26.1.2.3', '10.1.2.3', '172.31.2.3', '192.168.1.2', '100.100.1.2']) {
    assert.equal(validateHost(` ${address} `), address);
  }
  for (const address of ['', '127.0.0.1', '0.0.0.0', '8.8.8.8', '224.1.2.3', '192.168.1.255', 'localhost', '::1', '25.1.2.3:7777', '25.1.2.3 -log', 'http://25.1.2.3', '25.999.0.1']) {
    assert.throws(() => validateHost(address));
  }
});

test('host addresses show VPN/LAN adapters but omit loopback and unrelated public interfaces', () => {
  const interfaces = {
    Hamachi: [{ family: 'IPv4', internal: false, address: '25.1.2.3' }],
    Ethernet: [{ family: 'IPv4', internal: false, address: '192.168.1.2' }],
    Loopback: [{ family: 'IPv4', internal: true, address: '127.0.0.1' }],
    Public: [{ family: 'IPv4', internal: false, address: '8.8.8.8' }],
    IPv6: [{ family: 'IPv6', internal: false, address: '::1' }]
  };
  assert.deepEqual(hostAddresses(interfaces), [
    { name: 'Hamachi', address: '25.1.2.3' }, { name: 'Ethernet', address: '192.168.1.2' }
  ]);
});

test('multiplayer names persist per installation and distinguish fresh clients', () => {
  const first = multiplayerName(), second = multiplayerName();
  assert.notEqual(first, second);
  assert.match(first, /^[A-Za-z0-9_-]{3,24}$/);
  assert.equal(multiplayerName({ multiplayerName: first }), first);
  assert.match(multiplayerName({ multiplayerName: 'Player' }), /^Player_[a-f0-9]{12}$/);
});

test('clipboard invitations accept only a private address and rank VPN before virtual adapters', () => {
  assert.equal(parseJoinTarget(' FN42:25.2.3.4 '), '25.2.3.4');
  assert.equal(parseJoinTarget('192.168.1.2'), '192.168.1.2');
  for (const input of ['FN42:8.8.8.8','FN42:25.2.3.4:7777','FN42:25.2.3.4 -log','https://25.2.3.4','FN42:FN42:25.2.3.4']) assert.throws(()=>parseJoinTarget(input));
  const adapter = address => [{family:'IPv4',internal:false,address}];
  assert.deepEqual(hostAddresses({ 'VirtualBox Host-Only':adapter('192.168.56.1'), 'Ethernet 2':adapter('10.1.2.3'), 'Wi-Fi':adapter('192.168.1.4'), Hamachi:adapter('25.2.3.4'), Duplicate:adapter('25.2.3.4') }).map(x=>x.name), ['Hamachi','Wi-Fi','Ethernet 2','VirtualBox Host-Only']);
});
