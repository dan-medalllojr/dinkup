-- AlterTable
ALTER TABLE "match_results" ADD COLUMN     "corrected_at" TIMESTAMPTZ(6),
ADD COLUMN     "original_score" VARCHAR(60);
