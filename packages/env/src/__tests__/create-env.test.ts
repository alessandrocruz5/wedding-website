import { describe, expect, it } from "vitest";
import { z } from "zod";
import { baseEnvSchema, createEnv, EnvValidationError } from "../index";

describe("createEnv", () => {
  it("returns parsed values with defaults applied", () => {
    expect(createEnv(baseEnvSchema, {})).toEqual({ NODE_ENV: "development" });
  });

  it("accepts extended schemas", () => {
    const schema = baseEnvSchema.extend({ DATABASE_URL: z.url() });
    const env = createEnv(schema, { NODE_ENV: "test", DATABASE_URL: "postgres://u:p@h/db" });
    expect(env.DATABASE_URL).toBe("postgres://u:p@h/db");
  });

  it("fails fast listing every invalid key", () => {
    const schema = baseEnvSchema.extend({ DATABASE_URL: z.url() });
    let error: unknown;
    try {
      createEnv(schema, { NODE_ENV: "staging" });
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(EnvValidationError);
    const { issues } = error as EnvValidationError;
    expect(issues).toHaveLength(2);
    expect(issues.join("\n")).toMatch(/NODE_ENV/);
    expect(issues.join("\n")).toMatch(/DATABASE_URL/);
  });
});
