import crypto from 'crypto';

/**
 * Prodamus HMAC-SHA256 signature algorithm.
 *
 * PHP reference (Prodamus Hmac class):
 *   1. Recursively sort keys with ksort
 *   2. Cast all leaf values to string (array_walk_recursive + strval)
 *   3. json_encode the sorted structure
 *   4. hash_hmac('sha256', json, secretKey)
 *
 * PHP's json_encode escapes '/' as '\\/' by default.
 * We replicate this with a post-replace.
 */

type ProdamusData = Record<string, unknown>;

/** Recursively sort object keys and cast leaf values to string. */
function sortAndStringify(data: unknown): unknown {
  if (data === null || data === undefined) return '';

  if (Array.isArray(data)) {
    return data.map(sortAndStringify);
  }

  if (typeof data === 'object') {
    const sorted: Record<string, unknown> = {};
    const keys = Object.keys(data as Record<string, unknown>).sort();
    for (const key of keys) {
      sorted[key] = sortAndStringify((data as Record<string, unknown>)[key]);
    }
    return sorted;
  }

  // Leaf value → string (replicates PHP strval)
  return String(data);
}

/** Create HMAC-SHA256 signature for Prodamus data. */
export function createSignature(data: ProdamusData, secretKey: string): string {
  const sorted = sortAndStringify(data);
  // PHP json_encode escapes '/' as '\\/' by default — replicate this
  const json = JSON.stringify(sorted).replace(/\//g, '\\/');
  return crypto.createHmac('sha256', secretKey).update(json).digest('hex');
}

/** Verify Prodamus HMAC signature using timing-safe comparison. */
export function verifySignature(data: ProdamusData, secretKey: string, receivedSign: string): boolean {
  const expected = createSignature(data, secretKey);
  try {
    const sigBuf = Buffer.from(receivedSign, 'hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    if (sigBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expectedBuf);
  } catch {
    return false;
  }
}
