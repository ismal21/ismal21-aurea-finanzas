/**
 * Pool de conexiones a PostgreSQL.
 * Un pool reutiliza conexiones abiertas en lugar de crear una por petición.
 */

import pg from "pg";
import { config } from "../config.js";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

// Si una conexión inactiva del pool falla, no queremos tumbar el proceso.
pool.on("error", (error) => {
  console.error("Error inesperado en una conexión de PostgreSQL:", error);
});
