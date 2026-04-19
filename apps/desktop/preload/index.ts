import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

contextBridge.exposeInMainWorld('yalp', {
  platform: process.platform,
  isDesktop: true,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
  onThemeChanged: (callback: (theme: 'light' | 'dark') => void) => {
    const handler = (_event: IpcRendererEvent, theme: 'light' | 'dark') => {
      callback(theme);
    };
    ipcRenderer.on('theme-changed', handler);
    return () => {
      ipcRenderer.removeListener('theme-changed', handler);
    };
  },
});
