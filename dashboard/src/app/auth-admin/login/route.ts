import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000/api";
const API_KEY = process.env.API_KEY || "";

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    const res = await fetch(`${BACKEND_URL}/auth/admin-login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();

    if (!res.ok || !data.data?.token) {
      return NextResponse.json(data, { status: res.status });
    }

    // Detectar si la conexión es HTTPS (para la flag Secure de la cookie)
    const proto = request.headers.get("x-forwarded-proto") || request.headers.get("x-forwarded-scheme") || "http";
    const isSecure = proto === "https";

    const response = NextResponse.json(data);
    response.cookies.set("token", data.data.token, {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    response.cookies.set("isSuperAdmin", "true", {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  } catch {
    return NextResponse.json(
      { status: "error", message: "Error de conexión con el servidor" },
      { status: 500 }
    );
  }
}
