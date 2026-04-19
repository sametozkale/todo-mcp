export {};

declare global {
  interface Window {
    yalp: {
      platform: NodeJS.Platform;
      isDesktop: boolean;
      versions: {
        electron: string;
        chrome: string;
        node: string;
      };
      onThemeChanged: (callback: (theme: 'light' | 'dark') => void) => () => void;
    };
  }
}
