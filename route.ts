import { type NextRequest } from "next/server";
import { isUUID } from "@/lib/auth";
import { publicMedia } from "@/lib/social-server";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUUID(id)) return new Response(null, { status: 404 });
  const item = await publicMedia(id);
  if (!item) return new Response(null, { status: 404 });
  const size = item.content.length;
  const headers = new Headers({ "Content-Type": item.mime, "Cache-Control": "public, max-age=60", "X-Content-Type-Options": "nosniff", "Accept-Ranges": "bytes" });
  const range = request.headers.get("range");
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    const start = match?.[1] ? Number(match[1]) : Math.max(0, size - Number(match?.[2] || 0));
    const end = match?.[1] && match[2] ? Math.min(size - 1, Number(match[2])) : size - 1;
    if (!match || start >= size || end < start) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
    headers.set("Content-Length", String(end - start + 1));
    return new Response(new Uint8Array(item.content.subarray(start, end + 1)), { status: 206, headers });
  }
  headers.set("Content-Length", String(size));
  return new Response(new Uint8Array(item.content), { headers });
}
