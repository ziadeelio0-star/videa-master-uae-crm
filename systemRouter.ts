import { z } from "zod";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),

  // API Configuration — allows users to manage credentials in-app
  getApiConfig: adminProcedure
    .input(z.object({ key: z.string() }).optional())
    .query(async ({ input }) => {
      const { getApiConfig, getApiConfigKeys } = await import("../apiConfig");
      if (input?.key) {
        const value = getApiConfig(input.key);
        return { [input.key]: value ?? null };
      }
      const keys = getApiConfigKeys();
      const result: Record<string, string | null> = {};
      for (const k of keys) {
        result[k] = getApiConfig(k) ?? null;
      }
      return result;
    }),

  setApiConfig: adminProcedure
    .input(z.object({ key: z.string(), value: z.string() }))
    .mutation(async ({ input }) => {
      const { setApiConfig, validateManagerCredentials } = await import("../apiConfig");
      setApiConfig(input.key, input.value);
      // If setting Manager.io credentials, validate them
      if (input.key === "manager.api.url" || input.key === "manager.api.key") {
        const { getApiConfig } = await import("../apiConfig");
        const url = getApiConfig("manager.api.url");
        const key = getApiConfig("manager.api.key");
        if (url && key) {
          const validation = await validateManagerCredentials(url, key);
          return { success: true, validation };
        }
      }
      return { success: true };
    }),

  validateManagerCredentials: adminProcedure
    .input(z.object({ apiUrl: z.string(), apiKey: z.string() }))
    .mutation(async ({ input }) => {
      const { validateManagerCredentials } = await import("../apiConfig");
      return await validateManagerCredentials(input.apiUrl, input.apiKey);
    }),
});
