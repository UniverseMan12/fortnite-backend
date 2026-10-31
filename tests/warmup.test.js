import test from 'node:test';
import assert from 'node:assert/strict';
import { fixWarmupAdmission } from '../scripts/patch-reboot.js';

test('legacy multiplayer admits the first player and removes both controls that can block pawn creation', () => {
  const slider = 'ImGui::SliderInt("Players required to start the match", &WarmupRequiredPlayerCount, 1, 100);';
  const old = `WarmupRequiredPlayerCount = 2;\n${slider}\n${slider}`;
  const patched = fixWarmupAdmission(old);
  assert.match(patched, /WarmupRequiredPlayerCount = 1;/);
  assert.doesNotMatch(patched, /WarmupRequiredPlayerCount = 2|SliderInt/);
  assert.equal(patched.split('Start Bus Countdown').length - 1, 2);
  assert.equal(fixWarmupAdmission(patched), patched);
});
