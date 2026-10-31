// No timeout while a person is choosing settings; startup itself stays bounded.
export function createReadiness(mode, onPhase, error) {
  let resolve, reject, timer, phase = 'initial', settled = false;
  const ready = new Promise((yes, no) => { resolve = yes; reject = no; });
  ready.catch(() => {});
  const fail = () => { clearTimeout(timer); if (!settled) { settled = true; reject(error()); } };
  const arm = milliseconds => { clearTimeout(timer); timer = setTimeout(fail, milliseconds); };
  arm(7 * 60 * 1000);
  return {
    ready, fail,
    line(value) {
      if (settled) return;
      const line = value.trim();
      if (mode === 'server' && phase === 'initial' && line === 'LAUNCHER_CONFIGURE:server') {
        clearTimeout(timer); phase = 'configure'; onPhase('configure');
      } else if (mode === 'server' && phase === 'configure' && line === 'LAUNCHER_STARTING:server') {
        phase = 'starting'; arm(3 * 60 * 1000); onPhase('starting');
      } else if (line === 'LAUNCHER_READY:' + mode && (mode === 'client' || phase === 'starting')) {
        settled = true; clearTimeout(timer); resolve();
      }
    }
  };
}
