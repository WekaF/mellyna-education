-- CreateEnum
CREATE TYPE "ReportPeriodType" AS ENUM ('MONTHLY', 'SEMESTER', 'CUSTOM');

-- CreateTable
CREATE TABLE "MilestoneReport" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "periodType" "ReportPeriodType" NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "snapshotJson" JSONB NOT NULL,
    "sessionSummary" JSONB NOT NULL,
    "generatedById" TEXT NOT NULL,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MilestoneReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MilestoneReport_studentId_createdAt_idx" ON "MilestoneReport"("studentId", "createdAt");

-- AddForeignKey
ALTER TABLE "MilestoneReport" ADD CONSTRAINT "MilestoneReport_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilestoneReport" ADD CONSTRAINT "MilestoneReport_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
