/**
 * Magic-byte signatures for file type validation.
 * Each entry maps a MIME type to its header bytes (hex).
 */
const MAGIC_BYTES: Record<string, string[]> = {
  "image/jpeg": ["ffd8ff"],
  "image/png": ["89504e47"],
  "image/webp": ["52494646"],
  "audio/mpeg": ["494433", "fff3", "fff2", "fff1"],
  "audio/wav": ["52494646"],
  "video/mp4": ["0000001c66747970", "0000002066747970", "0000001866747970"],
  "video/quicktime": ["0000001c66747970", "000000206674797074797065"],
  "application/zip": ["504b0304", "504b0506", "504b0708"],
};

function hexPrefix(bytes: Uint8Array, len: number): string {
  let out = "";
  for (let i = 0; i < Math.min(bytes.length, len); i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

/**
 * Check whether the first 12+ bytes of `buffer` match a known signature
 * for `mimeType`.  Returns `true` if the file header looks correct,
 * `false` if the header is wrong or the MIME type has no known signature.
 */
export function isValidFileHeader(buffer: ArrayBuffer, mimeType: string): boolean {
  const sigs = MAGIC_BYTES[mimeType];
  if (!sigs) return true; // no known signature — skip check
  const bytes = new Uint8Array(buffer);
  const prefix = hexPrefix(bytes, 16).toLowerCase();
  return sigs.some((sig) => prefix.startsWith(sig.toLowerCase()));
}
