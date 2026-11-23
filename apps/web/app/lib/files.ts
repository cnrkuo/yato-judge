/** "812 B", "4.5 KB", "12 MB": sizes as people read them (1 KB = 1024 bytes). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

/** RFC 5987 encoding: `encodeURIComponent` leaves `'()*` alone, which the header syntax reserves. */
const encodeHeaderValue = (value: string) =>
  encodeURIComponent(value).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

/**
 * `Content-Disposition` that downloads a file under `filename`, whatever
 * characters it holds: an ASCII stand-in for old clients, the exact name
 * (UTF-8, percent-encoded) for the rest. Quotes, line breaks and
 * non-ASCII characters can never break out of the header.
 */
export function downloadDisposition(filename: string): string {
  const ascii = filename.replace(/[^\w.-]/g, '_') || 'download';
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeHeaderValue(filename)}`;
}
