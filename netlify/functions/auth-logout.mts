import type { Config } from "@netlify/functions";
import { clearSessionCookie } from "./_lib/auth.mts";
export default async () => Response.json({ success: true }, { headers: { "Set-Cookie": clearSessionCookie(), "Cache-Control": "no-store" } });
export const config: Config = { path: "/api/auth/logout" };
