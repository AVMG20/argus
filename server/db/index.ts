import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

const connectionString = process.env.DATABASE_URL ?? 'postgresql://argus:argus@localhost:55329/argus'

const pool = new Pool({ connectionString })

export const db = drizzle({ client: pool, schema })
