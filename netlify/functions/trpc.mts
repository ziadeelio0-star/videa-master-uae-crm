import type { Config } from "@netlify/functions";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "../../server/routers";
import { createContext } from "../../server/_core/context";
export default async (req: Request) => fetchRequestHandler({endpoint:"/api/trpc",req,router:appRouter,createContext:()=>createContext({req})});
export const config: Config = { path: "/api/trpc/*" };
