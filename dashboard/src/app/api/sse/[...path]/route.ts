import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000/api";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await params;
  const path = pathSegments.join("/");
  const searchParams = request.nextUrl.searchParams;
  const token = request.cookies.get("token")?.value;

  if (!token) {
    return NextResponse.json(
      { status: "error", message: "No autenticado" },
      { status: 401 }
    );
  }

  const backendUrl = `${BACKEND_URL}/sse/${path}?${searchParams.toString()}`;

  try {
    const response = await fetch(backendUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal: request.signal,
    });

    if (!response.ok || !response.body) {
      return NextResponse.json(
        { status: "error", message: "Error del backend" },
        { status: response.status }
      );
    }

    return new NextResponse(response.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("SSE proxy error:", error);
    return NextResponse.json(
      { status: "error", message: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
