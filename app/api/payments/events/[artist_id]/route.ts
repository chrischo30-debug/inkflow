import { registerSseClient } from "@/lib/sse-registry";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ artist_id: string }> },
) {
  const { artist_id } = await params;

  const encoder = new TextEncoder();
  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: string) => {
        try {
          controller.enqueue(encoder.encode(data));
        } catch {
          // controller already closed
        }
      };

      cleanup = registerSseClient(artist_id, send);

      // Send an initial comment to establish the connection
      send(": connected\n\n");

      // Keep-alive ping every 30 s
      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keep-alive\n\n"));
        } catch {
          clearInterval(keepAlive);
        }
      }, 30_000);

      req.signal.addEventListener("abort", () => {
        clearInterval(keepAlive);
        cleanup?.();
        try { controller.close(); } catch { /* already closed */ }
      });
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
