import { gzipSync } from "fflate";

export const SCREEN_02_MAX_CANONICAL_SESSION_BYTES = 2 * 1024 * 1024;
export const SCREEN_02_MAX_STATE_PAYLOAD_CHARACTERS = 256 * 1024;
export const SCREEN_02_MAX_COMPRESSED_STATE_BYTES = Math.floor(
  (SCREEN_02_MAX_STATE_PAYLOAD_CHARACTERS * 3) / 4,
);

export class Screen02StateCapacityError extends Error {
  constructor(
    readonly code: "canonical-capacity" | "compressed-capacity",
    message: string,
  ) {
    super(message);
    this.name = "Screen02StateCapacityError";
  }
}

function base64UrlLength(byteLength: number) {
  return Math.ceil((byteLength * 4) / 3);
}

/**
 * This is the single capacity gate shared by core mutation finalization and
 * state-envelope encoding. A session is not valid current state unless the
 * exact canonical JSON can also cross the bounded component transport.
 */
export function compressScreen02CanonicalState(canonicalJson: string) {
  const raw = new TextEncoder().encode(canonicalJson);
  if (raw.byteLength > SCREEN_02_MAX_CANONICAL_SESSION_BYTES) {
    throw new Screen02StateCapacityError(
      "canonical-capacity",
      `Screen 2 state exceeds the ${SCREEN_02_MAX_CANONICAL_SESSION_BYTES}-byte canonical session limit.`,
    );
  }
  const compressed = gzipSync(raw, { level: 6, mtime: 0 });
  if (
    compressed.byteLength > SCREEN_02_MAX_COMPRESSED_STATE_BYTES ||
    base64UrlLength(compressed.byteLength) >
      SCREEN_02_MAX_STATE_PAYLOAD_CHARACTERS
  ) {
    throw new Screen02StateCapacityError(
      "compressed-capacity",
      `Screen 2 compressed state exceeds the ${SCREEN_02_MAX_COMPRESSED_STATE_BYTES}-byte transport limit.`,
    );
  }
  return { raw, compressed };
}

export function assertScreen02StateEnvelopeCapacity(
  canonicalJson: string,
) {
  compressScreen02CanonicalState(canonicalJson);
}
