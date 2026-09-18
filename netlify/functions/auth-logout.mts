import { clearSessionCookie } from "./_lib/auth.mts";
export default async () => Response.json({ success: true }, { headers: { "Set-Cookie": clearSessionCookie(), "Cache-Control": "no-store" } });
export const config = { path: "/api/auth/logout" };
