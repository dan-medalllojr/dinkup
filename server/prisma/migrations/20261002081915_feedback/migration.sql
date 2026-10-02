-- CreateEnum
CREATE TYPE "feedback_kind" AS ENUM ('bug', 'court', 'idea', 'other');

-- CreateTable
CREATE TABLE "feedback" (
    "id" UUID NOT NULL,
    "kind" "feedback_kind" NOT NULL,
    "message" VARCHAR(1000) NOT NULL,
    "contact" VARCHAR(200),
    "court_id" UUID,
    "user_id" UUID,
    "user_agent" VARCHAR(300),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feedback_created_at_idx" ON "feedback"("created_at");

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "courts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
