-- CreateEnum
CREATE TYPE "game_format" AS ENUM ('singles', 'doubles');

-- CreateEnum
CREATE TYPE "game_status" AS ENUM ('open', 'cancelled', 'completed');

-- CreateTable
CREATE TABLE "games" (
    "id" UUID NOT NULL,
    "host_id" UUID NOT NULL,
    "court_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "duration_min" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL,
    "format" "game_format" NOT NULL,
    "min_skill_level" "skill_level",
    "status" "game_status" NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_players" (
    "game_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_players_pkey" PRIMARY KEY ("game_id","user_id")
);

-- CreateIndex
CREATE INDEX "games_starts_at_idx" ON "games"("starts_at");

-- CreateIndex
CREATE INDEX "games_host_id_idx" ON "games"("host_id");

-- CreateIndex
CREATE INDEX "game_players_user_id_idx" ON "game_players"("user_id");

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "courts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_players" ADD CONSTRAINT "game_players_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_players" ADD CONSTRAINT "game_players_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Hand-added: Prisma can't express CHECK constraints. The API validates all of
-- this first; these stop bad rows even if a future code path forgets to.
ALTER TABLE "games" ADD CONSTRAINT "games_capacity_matches_format"
  CHECK (("format" = 'singles' AND "capacity" = 2) OR ("format" = 'doubles' AND "capacity" = 4));
ALTER TABLE "games" ADD CONSTRAINT "games_duration_range"
  CHECK ("duration_min" BETWEEN 30 AND 240 AND "duration_min" % 15 = 0);
