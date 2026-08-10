-- AlterTable
ALTER TABLE "Drive" ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "notes" TEXT;

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deductible" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Category_userId_sortOrder_idx" ON "Category"("userId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Category_userId_name_key" ON "Category"("userId", "name");

-- CreateIndex
CREATE INDEX "Drive_userId_categoryId_startedAt_idx" ON "Drive"("userId", "categoryId", "startedAt");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Drive" ADD CONSTRAINT "Drive_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill default categories and link existing classified drives
INSERT INTO "Category" ("id", "userId", "name", "deductible", "sortOrder", "createdAt", "updatedAt")
SELECT 'biz_' || u."id", u."id", 'Business', true, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User" u;

INSERT INTO "Category" ("id", "userId", "name", "deductible", "sortOrder", "createdAt", "updatedAt")
SELECT 'per_' || u."id", u."id", 'Personal', false, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User" u;

UPDATE "Drive" AS d
SET "categoryId" = 'biz_' || d."userId"
WHERE d."status" = 'BUSINESS';

UPDATE "Drive" AS d
SET "categoryId" = 'per_' || d."userId"
WHERE d."status" = 'PERSONAL';
