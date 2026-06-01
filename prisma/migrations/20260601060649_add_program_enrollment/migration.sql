-- CreateEnum
CREATE TYPE "ProgramEnrollmentStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'UPGRADED', 'DROPPED');

-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN     "programEnrollmentId" TEXT;

-- CreateTable
CREATE TABLE "ProgramEnrollment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "program" "Program" NOT NULL,
    "status" "ProgramEnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProgramEnrollment_studentId_status_idx" ON "ProgramEnrollment"("studentId", "status");

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_programEnrollmentId_fkey" FOREIGN KEY ("programEnrollmentId") REFERENCES "ProgramEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramEnrollment" ADD CONSTRAINT "ProgramEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
