-- CreateEnum
CREATE TYPE "result_status" AS ENUM ('pending', 'confirmed', 'disputed', 'expired');

-- CreateEnum
CREATE TYPE "result_side" AS ENUM ('winner', 'loser');

-- CreateTable
CREATE TABLE "match_results" (
    "id" UUID NOT NULL,
    "game_id" UUID NOT NULL,
    "reported_by_id" UUID NOT NULL,
    "score" VARCHAR(60) NOT NULL,
    "status" "result_status" NOT NULL DEFAULT 'pending',
    "confirmed_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(6),

    CONSTRAINT "match_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_result_players" (
    "result_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "side" "result_side" NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "points_note" VARCHAR(40),
    "leveled_up_to" "skill_level",

    CONSTRAINT "match_result_players_pkey" PRIMARY KEY ("result_id","user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "match_results_game_id_key" ON "match_results"("game_id");

-- CreateIndex
CREATE INDEX "match_results_status_created_at_idx" ON "match_results"("status", "created_at");

-- CreateIndex
CREATE INDEX "match_result_players_user_id_side_idx" ON "match_result_players"("user_id", "side");

-- AddForeignKey
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_reported_by_id_fkey" FOREIGN KEY ("reported_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_confirmed_by_id_fkey" FOREIGN KEY ("confirmed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_result_players" ADD CONSTRAINT "match_result_players_result_id_fkey" FOREIGN KEY ("result_id") REFERENCES "match_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_result_players" ADD CONSTRAINT "match_result_players_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Hand-added: points are 0 or 1 per result, and only winners get them.
ALTER TABLE "match_result_players" ADD CONSTRAINT "match_result_players_points_valid"
  CHECK ("points" IN (0, 1) AND ("side" = 'winner' OR "points" = 0));
-- Skill points never go negative.
ALTER TABLE "users" ADD CONSTRAINT "users_skill_points_non_negative" CHECK ("skill_points" >= 0);
