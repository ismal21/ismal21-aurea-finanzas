/**
 * Configuración de la aplicación Express.
 * Aquí se declaran middlewares, rutas y el servido de archivos estáticos.
 * El arranque del servidor vive en index.js (separado para poder testear app).
 */

import path from "node:path";
import express from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { config } from "./config.js";
import { pool } from "./db/pool.js";
import { authRouter } from "./routes/auth.routes.js";
import { gastosRouter } from "./routes/gastos.routes.js";
import { errorHandler, notFound } from "./middlewares/errorHandler.js";
import { requiereSesionPagina } from "./middlewares/requireAuth.js";

const PgSession = connectPgSimple(session);

export const app = express();

// No revelar que usamos Express en las cabeceras.
app.disable("x-powered-by");

// Parsear el cuerpo JSON. El límite evita peticiones gigantes.
app.use(express.json({ limit: "16kb" }));

// Cabeceras básicas de seguridad.
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  next();
});

// Sesiones guardadas en PostgreSQL (no en memoria del proceso).
app.use(
  session({
    store: new PgSession({
      pool,
      tableName: "session",
      createTableIfMissing: true,
    }),
    name: "aurea.sid",
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: config.esProduccion,
      // Sin maxAge la cookie dura lo que la pestaña del navegador.
      // El login la alarga a 30 días si el usuario marca "recordarme".
      maxAge: null,
    },
  })
);

// API.
app.use("/api/auth", authRouter);
app.use("/api/gastos", gastosRouter);

// La página de gastos solo se entrega si hay sesión. Si no, redirige al login
// antes de que el navegador llegue a cargar el HTML.
app.get("/gastos.html", requiereSesionPagina);

// Frontend: Express sirve la misma carpeta public/ que ya tienes.
// Al compartir origen (localhost:3000), no hace falta CORS y las rutas
// relativas /api/... del JavaScript siguen funcionando tal cual.
const carpetaPublica = path.join(import.meta.dirname, "..", "..", "public");
app.use(express.static(carpetaPublica));

// 404 y manejo central de errores, siempre al final.
app.use(notFound);
app.use(errorHandler);
