import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import type * as schema from "./schema.ts"

/** Drizzle DB instance type – pass through context to avoid cross-app imports */
export type Db = PostgresJsDatabase<typeof schema>
export * from "./schema.ts"
