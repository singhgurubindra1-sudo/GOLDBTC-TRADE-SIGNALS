import { NextResponse } from "next/server";
import { fetchCalendar } from "@/lib/providers/calendar";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const cal = await fetchCalendar();
    return NextResponse.json(cal, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json(
      {
        error: "ForexFactory calendar unreachable",
        detail: (err as Error).message,
        hint: "Allow outbound HTTPS to nfs.faireconomy.media, which publishes the ForexFactory weekly calendar JSON.",
      },
      { status: 502 },
    );
  }
}
