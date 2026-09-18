import { eq } from "drizzle-orm";
import { getDb } from "../../server/db";
import { syncState } from "../../drizzle/schema";
export default async () => {
 const db=await getDb(); if(!db) return Response.json({synced:false},{status:503});
 const [row]=await db.select().from(syncState).where(eq(syncState.source,"dashboard")).limit(1);
 return Response.json(row?{synced:true,...row}:{synced:false},{headers:{"Cache-Control":"no-store"}});
};
export const config = { path: "/api/dashboard/sync-status" };
