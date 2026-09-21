import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL_POOLED ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL_POOLED or DATABASE_URL must be configured.");
}

/** The pooled connection is for short, stateless requests in the running app. */
export const db = drizzle({ client: neon(connectionString), schema });
