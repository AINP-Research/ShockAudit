export async function readScreen02BoundedResponseText(
  response: Response,
  maximumBytes: number,
) {
  if (!response.body) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const fragments: string[] = [];
  let receivedBytes = 0;

  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      if (
        chunk.value.byteLength > maximumBytes - receivedBytes
      ) {
        try {
          await reader.cancel(
            "Official API response byte limit reached",
          );
        } catch {
          // The byte gate already rejected the response. Cancellation is
          // best-effort because an injected fetch adapter may close first.
        }
        throw new Error(
          "Official API response exceeded the byte limit.",
        );
      }
      receivedBytes += chunk.value.byteLength;
      fragments.push(
        decoder.decode(chunk.value, { stream: true }),
      );
    }
    fragments.push(decoder.decode());
    return fragments.join("");
  } finally {
    reader.releaseLock();
  }
}
