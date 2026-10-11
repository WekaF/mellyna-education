-- CreateEnum
CREATE TYPE "ReportAccessStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- DropIndex
DROP INDEX "TutorCheckIn_tutorId_date_key";

-- AlterTable
ALTER TABLE "TutorCheckIn" ADD COLUMN     "accuracyM" DOUBLE PRECISION,
ADD COLUMN     "scheduleId" TEXT;

-- CreateTable
CREATE TABLE "ReportAccessRequest" (
    "id" TEXT NOT NULL,
    "tutorId" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ReportAccessStatus" NOT NULL DEFAULT 'PENDING',
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,

    CONSTRAINT "ReportAccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReportAccessRequest_status_idx" ON "ReportAccessRequest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ReportAccessRequest_tutorId_scheduleId_key" ON "ReportAccessRequest"("tutorId", "scheduleId");

-- CreateIndex
CREATE INDEX "TutorCheckIn_tutorId_date_idx" ON "TutorCheckIn"("tutorId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "TutorCheckIn_tutorId_scheduleId_key" ON "TutorCheckIn"("tutorId", "scheduleId");

-- AddForeignKey
ALTER TABLE "TutorCheckIn" ADD CONSTRAINT "TutorCheckIn_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportAccessRequest" ADD CONSTRAINT "ReportAccessRequest_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportAccessRequest" ADD CONSTRAINT "ReportAccessRequest_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportAccessRequest" ADD CONSTRAINT "ReportAccessRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

