import { baseEnvSchema } from "@ww/env";
import { z } from "zod";

/** Runtime connection: the non-owner app role (member of `ww_app`). Never the owner. */
export const dbEnvSchema = baseEnvSchema.extend({ DATABASE_URL: z.url() });

/** Owner connection for migrations and the demo seed only. */
export const migrateEnvSchema = baseEnvSchema.extend({ MIGRATE_DATABASE_URL: z.url() });
