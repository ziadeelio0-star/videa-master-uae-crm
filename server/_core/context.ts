import type { User } from "../../drizzle/schema";
import { createHmac, timingSafeEqual } from "node:crypto";
export type TrpcContext = { req: Request; user: User | null };
function parseSession(req: Request) {
  const secret = process.env.CRM_SESSION_SECRET || "";
  if (!secret) return null;
  const raw = (req.headers.get("cookie") || "").split(";").map(v=>v.trim()).find(v=>v.startsWith("vm_crm_session="))?.split("=").slice(1).join("=");
  if (!raw) return null;
  try {
    const [payload, signature] = decodeURIComponent(raw).split(".");
    if (!payload || !signature) return null;
    const expected = createHmac("sha256", secret).update(payload).digest("base64url");
    const a=Buffer.from(signature), b=Buffer.from(expected);
    if (a.length!==b.length || !timingSafeEqual(a,b)) return null;
    const data=JSON.parse(Buffer.from(payload,"base64url").toString("utf8"));
    if (!data.exp || data.exp < Math.floor(Date.now()/1000)) return null;
    const now=new Date();
    return {id:0,openId:"local:"+String(data.email).toLowerCase(),name:data.name,email:data.email,loginMethod:"local",role:"admin",createdAt:now,updatedAt:now,lastSignedIn:now} as User;
  } catch { return null; }
}
export async function createContext(opts:{req:Request}):Promise<TrpcContext>{ return {req:opts.req,user:parseSession(opts.req)}; }
