/** btoa expects latin1; encodeURIComponent produces UTF-8 percent escapes. */
export function base64EncodeUtf8(input: string): string {
  return btoa(unescape(encodeURIComponent(input)));
}
