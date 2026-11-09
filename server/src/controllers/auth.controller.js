/**
 * Controladores de autenticación.
 *
 * Rutas que atienden:
 *   POST /api/auth/registro  → crear cuenta
 *   POST /api/auth/login     → iniciar sesión (cookie de sesión)
 *   POST /api/auth/logout    → cerrar sesión
 *   GET  /api/auth/me        → datos del usuario con sesión activa
 */

import bcrypt from "bcrypt";
import { config } from "../config.js";
import { pool } from "../db/pool.js";
import { validarLogin, validarRegistro } from "../utils/validators.js";

const COSTE_BCRYPT = 12;

// Hash de una contraseña que nadie usa. Sirve para que, cuando el correo no
// existe, el servidor tarde prácticamente lo mismo que cuando sí existe.
// Así no se puede deducir qué correos están registrados midiendo tiempos.
const HASH_FICTICIO =
  "$2b$12$Ni3z7uanpuXUQ6SjizPKuuuwRLaBMhTbGCMuNfsPRrPsN9LrhA4yS";

/**
 * Convierte una fila de la base de datos en un usuario público.
 * Nunca incluye password_hash.
 * @param {{ id: number|string, nombre: string, email: string, created_at?: Date }} fila
 */
function usuarioPublico(fila) {
  return {
    id: fila.id,
    nombre: fila.nombre,
    email: fila.email,
  };
}

/**
 * envuelve session.regenerate en una promesa.
 * @param {import("express").Request} req
 */
function regenerarSesion(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => (error ? reject(error) : resolve()));
  });
}

/**
 * envuelve session.save en una promesa.
 * @param {import("express").Request} req
 */
function guardarSesion(req) {
  return new Promise((resolve, reject) => {
    req.session.save((error) => (error ? reject(error) : resolve()));
  });
}

/**
 * POST /api/auth/registro
 */
export async function registrar(req, res) {
  const { errores, datos } = validarRegistro(req.body);

  if (Object.keys(errores).length > 0) {
    return res.status(400).json({
      ok: false,
      message: "Revisa los campos marcados antes de continuar.",
      errors: errores,
    });
  }

  // Comprobación explícita para devolver un 409 claro antes de intentar el INSERT.
  const existente = await pool.query(
    "SELECT id FROM users WHERE lower(email) = $1",
    [datos.email]
  );

  if (existente.rowCount > 0) {
    return res.status(409).json({
      ok: false,
      message: "Ya existe una cuenta con ese correo.",
      errors: { email: "Ya existe una cuenta con ese correo." },
    });
  }

  const passwordHash = await bcrypt.hash(datos.password, COSTE_BCRYPT);

  try {
    const { rows } = await pool.query(
      `INSERT INTO users (nombre, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, nombre, email, created_at`,
      [datos.nombre, datos.email, passwordHash]
    );

    return res.status(201).json({
      ok: true,
      message: "Cuenta creada correctamente. Redirigiendo…",
      user: usuarioPublico(rows[0]),
    });
  } catch (error) {
    // 23505 = violación de índice único. Puede ocurrir si dos peticiones
    // intentan registrar el mismo correo a la vez.
    if (error.code === "23505") {
      return res.status(409).json({
        ok: false,
        message: "Ya existe una cuenta con ese correo.",
        errors: { email: "Ya existe una cuenta con ese correo." },
      });
    }

    throw error;
  }
}

/**
 * POST /api/auth/login
 */
export async function iniciarSesion(req, res) {
  const { errores, datos } = validarLogin(req.body);

  if (Object.keys(errores).length > 0) {
    return res.status(400).json({
      ok: false,
      message: "Revisa los campos marcados antes de continuar.",
      errors: errores,
    });
  }

  const { rows } = await pool.query(
    `SELECT id, nombre, email, password_hash
     FROM users
     WHERE lower(email) = $1`,
    [datos.email]
  );

  const usuario = rows[0];

  // Si el correo no existe, comparamos igualmente contra un hash ficticio
  // para no revelar esa información por el tiempo de respuesta.
  const hash = usuario?.password_hash ?? HASH_FICTICIO;
  const coincide = await bcrypt.compare(datos.password, hash);

  if (!usuario || !coincide) {
    // Un único mensaje para correo inexistente y contraseña errónea:
    // evita la enumeración de usuarios registrados.
    return res.status(401).json({
      ok: false,
      message: "Correo o contraseña incorrectos. Vuelve a intentarlo.",
    });
  }

  // Regenerar la sesión al autenticar evita la fijación de sesión.
  await regenerarSesion(req);

  req.session.user = usuarioPublico(usuario);

  // Cookie de navegador por defecto; si marcó "recordarme", 30 días.
  if (datos.recordarme) {
    req.session.cookie.maxAge = config.duracionSesionRecordadaMs;
  }

  await guardarSesion(req);

  return res.json({
    ok: true,
    message: "Sesión iniciada correctamente.",
    user: req.session.user,
  });
}

/**
 * POST /api/auth/logout
 */
export async function cerrarSesion(req, res) {
  await new Promise((resolve, reject) => {
    req.session.destroy((error) => (error ? reject(error) : resolve()));
  });

  res.clearCookie("aurea.sid");

  return res.json({
    ok: true,
    message: "Sesión cerrada correctamente.",
  });
}

/**
 * GET /api/auth/me
 * Útil para que el frontend sepa si sigue habiendo sesión activa.
 */
export function perfil(req, res) {
  if (!req.session.user) {
    return res.status(401).json({
      ok: false,
      message: "No has iniciado sesión.",
    });
  }

  return res.json({
    ok: true,
    user: req.session.user,
  });
}
