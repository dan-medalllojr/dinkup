-- CreateEnum
CREATE TYPE "skill_level" AS ENUM ('3.0', '3.5', '4.0', '4.5', '5.0');

-- CreateEnum
CREATE TYPE "preferred_format" AS ENUM ('singles', 'doubles', 'either');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "photo_url" TEXT,
    "skill_level" "skill_level" NOT NULL DEFAULT '3.0',
    "preferred_format" "preferred_format" NOT NULL DEFAULT 'either',
    "skill_points" INTEGER NOT NULL DEFAULT 0,
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "sid" VARCHAR NOT NULL,
    "sess" JSON NOT NULL,
    "expire" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "IDX_session_expire" ON "session"("expire");
