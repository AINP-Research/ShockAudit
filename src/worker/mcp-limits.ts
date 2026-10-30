/**
 * A stateless Screen 2 call carries the immutable baseline plus the bounded
 * candidate ledger and seventeen-round provenance budget: one initial round
 * plus eight complete native-retrieval/AI-review pairs. This remains well
 * below the Cloudflare request ceiling while allowing that complete session
 * to return.
 */
export const MAX_MCP_BODY_BYTES = 16 * 1024 * 1024;
