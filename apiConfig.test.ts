import { describe, it, expect, beforeEach } from "vitest";
import {
  getApiConfig,
  setApiConfig,
  getApiConfigKeys,
  validateManagerCredentials,
} from "./apiConfig";

describe("apiConfig", () => {
  beforeEach(() => {
    // Clear any cached values
    // (In a real test, we'd need to export a clear function)
  });

  it("should set and get API config values", () => {
    setApiConfig("test.key", "test-value");
    expect(getApiConfig("test.key")).toBe("test-value");
  });

  it("should return undefined for non-existent keys", () => {
    expect(getApiConfig("nonexistent.key")).toBeUndefined();
  });

  it("should list all config keys", () => {
    setApiConfig("key1", "value1");
    setApiConfig("key2", "value2");
    const keys = getApiConfigKeys();
    expect(keys).toContain("key1");
    expect(keys).toContain("key2");
  });

  it("should validate Manager.io credentials with invalid URL", async () => {
    const result = await validateManagerCredentials(
      "http://invalid-url-that-does-not-exist.local/api2",
      "invalid-key"
    );
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("should return error for empty credentials", async () => {
    const result = await validateManagerCredentials("", "");
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });
});
