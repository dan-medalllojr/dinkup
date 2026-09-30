-- CreateEnum
CREATE TYPE "court_setting" AS ENUM ('indoor', 'outdoor', 'covered');

-- CreateTable
CREATE TABLE "courts" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "address" VARCHAR(200) NOT NULL,
    "city" VARCHAR(60) NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "court_count" INTEGER,
    "setting" "court_setting",
    "notes" VARCHAR(300),
    "source" VARCHAR(200) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "courts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "courts_slug_key" ON "courts"("slug");
