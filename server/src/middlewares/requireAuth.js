/**
 * Middlewares de sesión.
 *   - requiereSesion: para la API; responde 401 en JSON.
 *   - requiereSesionPagina: para HTML; redirige al login.
 */

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
export function requiereSesion(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({
      ok: false,
      message: "No has iniciado sesión.",
    });
  }

  return next();
}

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
export function requiereSesionPagina(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/login.html");
  }

  return next();
}
