import { app, BrowserWindow, Menu, nativeTheme, shell } from 'electron';
import type { BrowserWindowConstructorOptions } from 'electron';
import * as path from 'node:path';

const isDev = process.env.NODE_ENV === 'development';
const WEB_DEV_URL = 'http://localhost:3001';
const WEB_PROD_URL = 'https://www.yalp.work';

let mainWindow: BrowserWindow | null = null;

function isAllowedNavigationHost(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
  if (hostname === 'yalp.work' || hostname === 'www.yalp.work') return true;
  if (hostname.endsWith('.supabase.co')) return true;

  const oauthHosts = new Set([
    'accounts.google.com',
    'oauth2.googleapis.com',
    'www.googleapis.com',
    'login.microsoftonline.com',
    'github.com',
  ]);
  if (oauthHosts.has(hostname)) return true;

  if (hostname.endsWith('.google.com')) {
    return (
      hostname.startsWith('accounts.') ||
      hostname.includes('oauth') ||
      hostname.startsWith('www.googleapis.')
    );
  }

  return false;
}

function isAllowedNavigationUrl(url: string): boolean {
  if (
    url.startsWith('devtools://') ||
    url.startsWith('chrome-devtools://') ||
    url.startsWith('about:') ||
    url.startsWith('blob:') ||
    url.startsWith('data:')
  ) {
    return true;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'file:') return true;
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    return isAllowedNavigationHost(parsed.hostname);
  } catch {
    return false;
  }
}

async function createMainWindow() {
  const options: BrowserWindowConstructorOptions = {
    width: 1120,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    title: 'Yalp',
    backgroundColor: '#fafafa',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  };

  if (process.platform === 'darwin') {
    options.titleBarStyle = 'hiddenInset';
    options.trafficLightPosition = { x: 16, y: 18 };
    options.vibrancy = 'sidebar';
    options.visualEffectState = 'active';
  }

  mainWindow = new BrowserWindow(options);

  if (isDev) {
    await mainWindow.loadURL(WEB_DEV_URL);
  } else {
    await mainWindow.loadURL(WEB_PROD_URL);
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('mailto:')) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

Menu.setApplicationMenu(null);

nativeTheme.on('updated', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(
      'theme-changed',
      nativeTheme.shouldUseDarkColors ? 'dark' : 'light',
    );
  }
});

void app.whenReady().then(() => {
  void createMainWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    void createMainWindow();
  }
});

app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    if (isAllowedNavigationUrl(navigationUrl)) return;
    event.preventDefault();
    if (navigationUrl.startsWith('http://') || navigationUrl.startsWith('https://')) {
      void shell.openExternal(navigationUrl);
    }
  });
});
