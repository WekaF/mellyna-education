-- CreateEnum
CREATE TYPE "Program" AS ENUM ('SEMPOA', 'AHE', 'EFK', 'EYL', 'EFE', 'CALISTUNG', 'ENGLISH');

-- CreateTable
CREATE TABLE "ClassProgram" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "program" "Program" NOT NULL,

    CONSTRAINT "ClassProgram_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClassProgram_classId_program_key" ON "ClassProgram"("classId", "program");

-- AddForeignKey
ALTER TABLE "ClassProgram" ADD CONSTRAINT "ClassProgram_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
