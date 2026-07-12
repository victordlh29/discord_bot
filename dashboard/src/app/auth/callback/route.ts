import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000/api";

function getCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export async function GET(request: Request) {
  // Discord OAuth redirects via GET (obligatorio). CSRF protegido via state param + SameSite cookie.
  const { searchParams } = new URL(request.url);
  const proto = request.headers.get("x-forwarded-proto") || "http";
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "localhost:3000";
  const origin = `${proto}://${host}`;
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code) {
    return NextResponse.redirect(new URL("/?error=no_code", origin));
  }

  const savedState = getCookie(request, "oauth_state");
  if (!state || !savedState || state !== savedState) {
    return NextResponse.redirect(new URL("/?error=invalid_state", origin));
  }

  try {
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID!,
        client_secret: process.env.DISCORD_CLIENT_SECRET!,
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.NEXT_PUBLIC_DISCORD_REDIRECT_URI!,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      return NextResponse.redirect(new URL("/?error=auth_failed", origin));
    }

    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
      next: { revalidate: 0 },
    });
    const discordUser = await userResponse.json();

    const apiResponse = await fetch(`${BACKEND_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.API_KEY || "",
      },
      body: JSON.stringify({
        discordId: discordUser.id,
        username: discordUser.username,
        avatar: `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`,
      }),
    });

    const apiData = await apiResponse.json();

    if (!apiResponse.ok || !apiData.data?.token) {
      const error = apiData.message || "api_error";
      return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(error)}`, origin));
    }

    // Setear cookie HttpOnly (el backend también la setea, pero aquí lo hacemos
    // server-side para que esté disponible desde el momento del redirect)
    const response = NextResponse.redirect(new URL("/dashboard", origin));
    response.cookies.set("token", apiData.data.token, {
      httpOnly: true,
      secure: proto === "https",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  } catch {
    return NextResponse.redirect(new URL("/?error=server_error", origin));
  }
}
