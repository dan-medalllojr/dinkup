-- CreateTable
CREATE TABLE "game_comments" (
    "id" UUID NOT NULL,
    "game_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "body" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "game_comments_game_id_created_at_idx" ON "game_comments"("game_id", "created_at");

-- AddForeignKey
ALTER TABLE "game_comments" ADD CONSTRAINT "game_comments_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_comments" ADD CONSTRAINT "game_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Hand-added: no blank comments, even if a future code path skips validation.
ALTER TABLE "game_comments" ADD CONSTRAINT "game_comments_body_not_blank"
  CHECK (length(btrim("body")) BETWEEN 1 AND 500);
