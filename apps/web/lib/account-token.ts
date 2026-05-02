/**
 * Token de ingest por conta MT5.
 * 32 bytes random hex; hash sha256. Web Crypto pra rodar em browser e Edge.
 */

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

export function generateAccountToken(): string {
  const buf = new Uint8Array(32)
  crypto.getRandomValues(buf)
  return bytesToHex(buf)
}

export async function hashAccountToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token)
  const hashBuf = await crypto.subtle.digest("SHA-256", data)
  return bytesToHex(new Uint8Array(hashBuf))
}

export async function verifyAccountToken(
  token: string,
  expectedHashHex: string
): Promise<boolean> {
  const actualHashHex = await hashAccountToken(token)
  if (actualHashHex.length !== expectedHashHex.length) return false
  const a = hexToBytes(actualHashHex)
  const b = hexToBytes(expectedHashHex)
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}
