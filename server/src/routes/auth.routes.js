/**
 * Rutas de autenticación.
 * Se montan bajo /api/auth desde app.js.
 */

import { Router } from "express";
import {
  cerrarSesion,
  iniciarSesion,
  perfil,
  registrar,
} from "../controllers/auth.controller.js";
import {
  limitadorLogin,
  limitadorRegistro,
} from "../middlewares/rateLimiters.js";

export const authRouter = Router();

authRouter.post("/registro", limitadorRegistro, registrar);
authRouter.post("/login", limitadorLogin, iniciarSesion);
authRouter.post("/logout", cerrarSesion);
authRouter.get("/me", perfil);
