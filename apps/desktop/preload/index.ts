import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('yalp', {
  // Placeholder for future native integrations.
});

