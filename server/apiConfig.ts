/**
 * API Configuration management — allows users to store and retrieve
 * API credentials (Manager.io, etc.) directly in the app without
 * needing environment variables or support tickets.
 */

// In-memory cache for API config (survives within a single server process)
const configCache = new Map<string, string>();

/**
 * Get an API config value by key.
 * Falls back to environment variables if not found in cache.
 */
export function getApiConfig(key: string): string | undefined {
  // Check in-memory cache first
  if (configCache.has(key)) {
    return configCache.get(key);
  }
  // Fall back to environment variables
  const envKey = key.toUpperCase().replace(/\./g, "_");
  return process.env[envKey];
}

/**
 * Set an API config value by key (in-memory only for now).
 * In production, this would also persist to the database.
 */
export function setApiConfig(key: string, value: string): void {
  configCache.set(key, value);
}

/**
 * Get all API config keys (for the Settings UI).
 */
export function getApiConfigKeys(): string[] {
  return Array.from(configCache.keys());
}

/**
 * Validate Manager.io credentials by attempting a simple API call.
 */
export async function validateManagerCredentials(
  apiUrl: string,
  apiKey: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch(`${apiUrl}/inventory-items?pageSize=1`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });
    if (response.ok) {
      return { valid: true };
    }
    return {
      valid: false,
      error: `Manager.io returned ${response.status}: ${response.statusText}`,
    };
  } catch (e) {
    return {
      valid: false,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}
