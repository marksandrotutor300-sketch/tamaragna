/**
 * Small deterministic checksum used to compare a client battle against the
 * server replay. Not a security primitive - the replay itself is the check.
 */
export function checksum(input: string): string {
  let hash = 1469598103934665603n;
  const prime = 1099511628211n;
  const mask = 0xffffffffffffffffn;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= BigInt(input.charCodeAt(i));
    hash = (hash * prime) & mask;
  }
  return hash.toString(16).padStart(16, "0");
}
