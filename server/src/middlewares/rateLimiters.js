/**
 * Limitadores de peticiones para frenar ataques de fuerza bruta.
 * express-rate-limit devuelve 429, que el frontend ya sabe interpretar.
 */

import { rateLimit } from "express-rate-limit";

const mensajeDemasiadosIntentos =
  "Demasiados intentos. Espera un momento antes de volver a probar.";

/**
 * Login: máximo 10 intentos fallidos cada 15 minutos por IP.
 * Los inicios de sesión correctos no consumen cupo.
 */
export const limitadorLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      ok: false,
      message: mensajeDemasiadosIntentos,
    });
  },
});

/**
 * Registro: máximo 20 cuentas cada hora por IP.
 * Evita que alguien cree usuarios en masa.
 */
export const limitadorRegistro = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      ok: false,
      message: "Demasiados registros desde esta conexión. Inténtalo más tarde.",
    });
  },
});
