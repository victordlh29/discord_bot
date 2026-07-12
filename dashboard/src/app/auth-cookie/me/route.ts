import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000/api";

export async function POST(request: Request) {
  const token = request.headers.get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("token="))
    ?.slice(6);

  if (!token) {
    return NextResponse.json({ status: "error", message: "No token" }, { status: 401 });
  }

  try {
    const response = await fetch(`${BACKEND_URL}/auth/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ status: "error", message: "Server error" }, { status: 500 });
  }
}
