import { app, BrowserWindow, Menu, nativeTheme, shell } from 'electron';
import type { BrowserWindowConstructorOptions } from 'electron';
import * as path from 'node:path';

const isDev = process.env.NODE_ENV === 'development';
const WEB_DEV_URL = 'http://localhost:3001';
const WEB_PROD_URL = 'https://www.yalp.work';
const DESKTOP_ENTRY_PATH = '/login';
const DESKTOP_BLOCKED_PUBLIC_PATHS = new Set([
  '/',
  '/why-i-built',
  '/roadmap',
  '/privacy',
  '/terms',
]);

let mainWindow: BrowserWindow | null = null;

function normalizePathname(pathname: string): string {
  if (!pathname) return '/';
  if (pathname === '/') return '/';
  return pathname.replace(/\/+$/, '');
}

function isDesktopAppHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === 'yalp.work' ||
    hostname === 'www.yalp.work'
  );
}

function getDesktopBaseUrl(): string {
  return isDev ? WEB_DEV_URL : WEB_PROD_URL;
}

function getDesktopLoginUrl(origin?: string): string {
  if (origin) return `${origin}${DESKTOP_ENTRY_PATH}`;
  return `${getDesktopBaseUrl()}${DESKTOP_ENTRY_PATH}`;
}

function shouldForceDesktopAppPath(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!isDesktopAppHost(parsed.hostname)) return false;
    const path = normalizePathname(parsed.pathname);
    return DESKTOP_BLOCKED_PUBLIC_PATHS.has(path);
  } catch {
    return false;
  }
}

function enforceDesktopEntryPath(currentUrl: string) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (!shouldForceDesktopAppPath(currentUrl)) return;
  try {
    const parsed = new URL(currentUrl);
    const loginUrl = getDesktopLoginUrl(parsed.origin);
    if (parsed.pathname === DESKTOP_ENTRY_PATH) return;
    void mainWindow.loadURL(loginUrl);
  } catch {
    void mainWindow.loadURL(getDesktopLoginUrl());
  }
}

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

  await mainWindow.loadURL(getDesktopLoginUrl());

  mainWindow.webContents.on('did-navigate', (_event, url) => {
    enforceDesktopEntryPath(url);
  });

  mainWindow.webContents.on('did-navigate-in-page', (_event, url) => {
    enforceDesktopEntryPath(url);
  });

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
