/**
 * Configuración central del backend.
 * Lee variables de entorno y falla al arrancar si falta algo imprescindible,
 * en lugar de descubrirlo a mitad de una petición.
 */

import process from "node:process";

/**
 * Devuelve una variable obligatoria o lanza un error explicativo.
 * @param {string} nombre
 * @returns {string}
 */
function obligatoria(nombre) {
  const valor = process.env[nombre];

  if (!valor) {
    throw new Error(
      `Falta la variable de entorno ${nombre}. Revisa server/.env (puedes copiar server/.env.example).`
    );
  }

  return valor;
}

const entorno = process.env.NODE_ENV ?? "development";

export const config = {
  puerto: Number(process.env.PORT) || 3000,
  entorno,
  esProduccion: entorno === "production",
  databaseUrl: obligatoria("DATABASE_URL"),
  sessionSecret: obligatoria("SESSION_SECRET"),

  // Duración de la sesión cuando el usuario marca "Mantener mi sesión iniciada".
  duracionSesionRecordadaMs: 30 * 24 * 60 * 60 * 1000, // 30 días
};
