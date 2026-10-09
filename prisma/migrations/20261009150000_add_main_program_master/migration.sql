-- CreateTable
CREATE TABLE "MainProgram" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MainProgram_pkey" PRIMARY KEY ("code")
);

-- Seed default main programs
INSERT INTO "MainProgram" ("code", "name", "order", "updatedAt") VALUES
  ('SEMPOA', 'Sempoa', 1, CURRENT_TIMESTAMP),
  ('CALISTUNG', 'Calistung', 2, CURRENT_TIMESTAMP),
  ('ENGLISH', 'English', 3, CURRENT_TIMESTAMP);

-- Class.mainProgram: enum -> text, keep values
ALTER TABLE "Class" ALTER COLUMN "mainProgram" TYPE TEXT USING "mainProgram"::TEXT;

-- Sub-program codes (AHE, EFK, ...) stored as mainProgram already render under "Lainnya"; NULL keeps that
UPDATE "Class" SET "mainProgram" = NULL
WHERE "mainProgram" IS NOT NULL AND "mainProgram" NOT IN (SELECT "code" FROM "MainProgram");

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_mainProgram_fkey"
  FOREIGN KEY ("mainProgram") REFERENCES "MainProgram"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
