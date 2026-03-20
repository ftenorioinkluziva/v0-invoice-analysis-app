-- Better Auth Schema Migration
-- Tabelas necessárias para autenticação com email/senha e OAuth (Google)
-- Gerado para: better-auth v1.5.x

CREATE TABLE IF NOT EXISTS "user" (
    "id"            TEXT PRIMARY KEY,
    "name"          TEXT NOT NULL,
    "email"         TEXT NOT NULL UNIQUE,
    "emailVerified" BOOLEAN NOT NULL DEFAULT FALSE,
    "image"         TEXT,
    "createdAt"     TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt"     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "session" (
    "id"         TEXT PRIMARY KEY,
    "expiresAt"  TIMESTAMP NOT NULL,
    "token"      TEXT NOT NULL UNIQUE,
    "createdAt"  TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt"  TIMESTAMP NOT NULL DEFAULT NOW(),
    "ipAddress"  TEXT,
    "userAgent"  TEXT,
    "userId"     TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "account" (
    "id"                     TEXT PRIMARY KEY,
    "accountId"              TEXT NOT NULL,
    "providerId"             TEXT NOT NULL,
    "userId"                 TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "accessToken"            TEXT,
    "refreshToken"           TEXT,
    "idToken"                TEXT,
    "accessTokenExpiresAt"   TIMESTAMP,
    "refreshTokenExpiresAt"  TIMESTAMP,
    "scope"                  TEXT,
    "password"               TEXT,
    "createdAt"              TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt"              TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "verification" (
    "id"         TEXT PRIMARY KEY,
    "identifier" TEXT NOT NULL,
    "value"      TEXT NOT NULL,
    "expiresAt"  TIMESTAMP NOT NULL,
    "createdAt"  TIMESTAMP DEFAULT NOW(),
    "updatedAt"  TIMESTAMP DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_session_userId ON "session"("userId");
CREATE INDEX IF NOT EXISTS idx_session_token  ON "session"("token");
CREATE INDEX IF NOT EXISTS idx_account_userId ON "account"("userId");
CREATE INDEX IF NOT EXISTS idx_account_provider ON "account"("providerId", "accountId");
