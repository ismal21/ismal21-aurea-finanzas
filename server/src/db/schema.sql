-- ============================================================================
-- Esquema de la base de datos de Aurea Finanzas
-- Se ejecuta al arrancar el servidor (es idempotente gracias a IF NOT EXISTS).
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id            BIGSERIAL PRIMARY KEY,
  nombre        VARCHAR(60)  NOT NULL,
  email         VARCHAR(120) NOT NULL,
  password_hash TEXT         NOT NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- El correo es único sin distinguir mayúsculas: Ana@correo.com = ana@correo.com.
-- La aplicación ya normaliza a minúsculas, pero el índice lo garantiza también
-- a nivel de base de datos.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx
  ON users (lower(email));

-- ============================================================================
-- Gastos de cada usuario
-- ============================================================================

CREATE TABLE IF NOT EXISTS expenses (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nombre     VARCHAR(80)  NOT NULL,
  categoria  VARCHAR(30)  NOT NULL,
  fecha      DATE         NOT NULL,
  monto      NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Consultas habituales: gastos de un usuario por fecha y por categoría.
CREATE INDEX IF NOT EXISTS expenses_user_fecha_idx
  ON expenses (user_id, fecha DESC);

CREATE INDEX IF NOT EXISTS expenses_user_categoria_idx
  ON expenses (user_id, categoria);
