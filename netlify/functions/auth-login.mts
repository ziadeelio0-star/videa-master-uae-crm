import type { Config } from "@netlify/functions";
import { createSession, safeEqual, sessionCookie } from "./_lib/auth.mts";

export default async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const email = Netlify.env.get("CRM_ADMIN_EMAIL") || "";
  const password = Netlify.env.get("CRM_ADMIN_PASSWORD") || "";
  const secret = Netlify.env.get("CRM_SESSION_SECRET") || "";
  const name = Netlify.env.get("CRM_ADMIN_NAME") || "Administrator";
  if (!email || !password || !secret) return Response.json({ error: "CRM login is not configured." }, { status: 503 });
  let body: any;
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid request." }, { status: 400 }); }
  if (!safeEqual(String(body.email || "").trim().toLowerCase(), email.trim().toLowerCase()) || !safeEqual(String(body.password || ""), password)) {
    return Response.json({ error: "Incorrect email or password." }, { status: 401 });
  }
  const token = createSession(email, name, secret);
  return Response.json({ user: { email, name, role: "admin" } }, { headers: { "Set-Cookie": sessionCookie(token), "Cache-Control": "no-store" } });
};

export const config: Config = { path: "/api/auth/login" };
