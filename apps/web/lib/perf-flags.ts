/**
 * Server-side kill switches for performance refactors.
 * Set to "true" to fall back to legacy multi-query paths (rollback / incident).
 */

export function isBulkReorderRpcDisabled(): boolean {
  return process.env.DISABLE_BULK_REORDER_RPC === "true";
}

export function isLayoutCountsFallbackRpcDisabled(): boolean {
  return process.env.DISABLE_LAYOUT_COUNTS_FALLBACK_RPC === "true";
}
