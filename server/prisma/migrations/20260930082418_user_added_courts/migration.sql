-- AlterTable
ALTER TABLE "courts" ADD COLUMN     "added_by_id" UUID;

-- CreateIndex
CREATE INDEX "courts_added_by_id_idx" ON "courts"("added_by_id");

-- AddForeignKey
ALTER TABLE "courts" ADD CONSTRAINT "courts_added_by_id_fkey" FOREIGN KEY ("added_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
