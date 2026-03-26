import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('flowdo', {
  // Placeholder for future native integrations.
});

