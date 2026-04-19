const { notarize } = require("@electron/notarize");
const path = require("node:path");

function hasAppleIdCredentials() {
  return (
    Boolean(process.env.APPLE_ID) &&
    Boolean(process.env.APPLE_APP_SPECIFIC_PASSWORD) &&
    Boolean(process.env.APPLE_TEAM_ID)
  );
}

function hasApiKeyCredentials() {
  return (
    Boolean(process.env.APPLE_API_KEY) &&
    Boolean(process.env.APPLE_API_KEY_ID) &&
    Boolean(process.env.APPLE_API_ISSUER)
  );
}

module.exports = async function afterSign(context) {
  if (context.electronPlatformName !== "darwin") return;

  if (!hasAppleIdCredentials() && !hasApiKeyCredentials()) {
    console.warn(
      "[notarize] Skipping notarization: set APPLE_ID + APPLE_APP_SPECIFIC_PASSWORD + APPLE_TEAM_ID or APPLE_API_KEY + APPLE_API_KEY_ID + APPLE_API_ISSUER."
    );
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);

  const options = {
    appBundleId: context.packager.appInfo.id,
    appPath,
  };

  if (hasApiKeyCredentials()) {
    await notarize({
      ...options,
      key: process.env.APPLE_API_KEY,
      keyId: process.env.APPLE_API_KEY_ID,
      issuer: process.env.APPLE_API_ISSUER,
    });
    return;
  }

  await notarize({
    ...options,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
    teamId: process.env.APPLE_TEAM_ID,
  });
};
