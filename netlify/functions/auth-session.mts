import type { Config } from "@netlify/functions";
import { parseCookie, verifySession } from "./_lib/auth.mts";

export default async (req: Request) => {
  const secret = Netlify.env.get("CRM_SESSION_SECRET") || "";
  const user = secret ? verifySession(parseCookie(req.headers.get("cookie")), secret) : null;
  return Response.json({ user: user ? { email: user.email, name: user.name, role: user.role } : null }, { status: user ? 200 : 401, headers: { "Cache-Control": "no-store" } });
};
export const config: Config = { path: "/api/auth/session" };
