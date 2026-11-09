/**
 * Punto de entrada del backend.
 * Prepara la base de datos y arranca el servidor HTTP.
 */

import { app } from "./app.js";
import { config } from "./config.js";
import { pool } from "./db/pool.js";
import { prepararBaseDeDatos } from "./db/setup.js";

async function arrancar() {
  try {
    await prepararBaseDeDatos();

    const servidor = app.listen(config.puerto, () => {
      console.log(`Aurea Finanzas escuchando en http://localhost:${config.puerto}`);
      console.log(`Entorno: ${config.entorno}`);
    });

    /**
     * Cierre ordenado: deja de aceptar peticiones y cierra el pool.
     * @param {string} senal
     */
    const cerrar = (senal) => {
      console.log(`\n${senal} recibido. Cerrando servidor…`);

      servidor.close(async () => {
        await pool.end();
        process.exit(0);
      });

      // Si algo se queda colgado, forzamos la salida en 5 segundos.
      setTimeout(() => process.exit(1), 5000).unref();
    };

    process.on("SIGINT", () => cerrar("SIGINT"));
    process.on("SIGTERM", () => cerrar("SIGTERM"));
  } catch (error) {
    console.error("\nNo se pudo arrancar el servidor:");
    console.error(error instanceof Error ? error.message : error);
    console.error(
      "\nComprueba que PostgreSQL esté en marcha y que DATABASE_URL sea correcta."
    );
    await pool.end().catch(() => {});
    process.exit(1);
  }
}

arrancar();
