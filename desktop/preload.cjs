const { contextBridge, ipcRenderer } = require('electron');
const invoke = async (name, ...args) => {
  const result = await ipcRenderer.invoke('launcher:' + name, ...args);
  if (!result.ok) throw new Error(result.error);
  return result.value;
};
contextBridge.exposeInMainWorld('launcher', {
  initial: () => invoke('initial'), browse: () => invoke('browse'),
  start: (action, options) => invoke('start', action, options), stop: () => invoke('stop'),
  link: key => invoke('link', key), logs: () => invoke('logs'),
  minimize: () => invoke('minimize'), close: () => invoke('close'),
  subscribe: callback => { const handler = (_event, state) => callback(state); ipcRenderer.on('launcher:state', handler); return () => ipcRenderer.removeListener('launcher:state', handler); }
});
