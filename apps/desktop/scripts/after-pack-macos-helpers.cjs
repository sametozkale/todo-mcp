const fs = require('node:fs');
const path = require('node:path');

function findHelperInfoPlists(appOutDir, appName) {
  const frameworksDir = path.join(
    appOutDir,
    `${appName}.app`,
    'Contents',
    'Frameworks'
  );

  if (!fs.existsSync(frameworksDir)) {
    return [];
  }

  return fs
    .readdirSync(frameworksDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.endsWith('.app'))
    .map((entry) => path.join(frameworksDir, entry.name, 'Contents', 'Info.plist'))
    .filter((plistPath) => fs.existsSync(plistPath));
}

function addOrReplaceBooleanKey(plistContent, key, value) {
  const keyPattern = new RegExp(`<key>${key}<\\/key>\\s*<(true|false)\\/>`);
  const replacement = `<key>${key}</key>\n\t<${value ? 'true' : 'false'}/>`;

  if (keyPattern.test(plistContent)) {
    return plistContent.replace(keyPattern, replacement);
  }

  return plistContent.replace(
    '</dict></plist>',
    `\t${replacement}\n</dict></plist>`
  );
}

function setStringKey(plistContent, key, value) {
  const keyPattern = new RegExp(`<key>${key}<\\/key>\\s*<string>[\\s\\S]*?<\\/string>`);
  const replacement = `<key>${key}</key>\n\t<string>${value}</string>`;

  if (keyPattern.test(plistContent)) {
    return plistContent.replace(keyPattern, replacement);
  }

  return plistContent.replace(
    '</dict></plist>',
    `\t${replacement}\n</dict></plist>`
  );
}

module.exports = async (context) => {
  if (context.electronPlatformName !== 'darwin') {
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const helperPlists = findHelperInfoPlists(context.appOutDir, appName);

  for (const plistPath of helperPlists) {
    const plist = fs.readFileSync(plistPath, 'utf8');

    let updated = plist;
    updated = addOrReplaceBooleanKey(updated, 'LSUIElement', true);
    updated = addOrReplaceBooleanKey(updated, 'LSBackgroundOnly', true);
    updated = setStringKey(updated, 'CFBundleDisplayName', 'YLP Internal Helper');
    updated = setStringKey(updated, 'CFBundleName', 'YLP Internal Helper');

    if (updated !== plist) {
      fs.writeFileSync(plistPath, updated);
    }
  }
};
