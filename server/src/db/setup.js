/**
 * Crea las tablas necesarias si no existen.
 * Se llama una vez al arrancar el servidor.
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { pool } from "./pool.js";

const rutaEsquema = fileURLToPath(new URL("./schema.sql", import.meta.url));

export async function prepararBaseDeDatos() {
  const esquema = await readFile(rutaEsquema, "utf8");
  await pool.query(esquema);
}
