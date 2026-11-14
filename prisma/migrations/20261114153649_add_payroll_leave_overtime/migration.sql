-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LeaveSource" AS ENUM ('TUTOR_REQUEST', 'ADMIN_MARKED');

-- CreateEnum
CREATE TYPE "PayrollStatus" AS ENUM ('DRAFT', 'FINALIZED');

-- CreateTable
CREATE TABLE "TutorPayrollRate" (
    "id" TEXT NOT NULL,
    "tutorId" TEXT NOT NULL,
    "dailyRate" INTEGER NOT NULL,
    "onTimeBonusRate" INTEGER NOT NULL,
    "overtimeRatePerHour" INTEGER NOT NULL,
    "extraHandleRate" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TutorPayrollRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TutorLeaveRequest" (
    "id" TEXT NOT NULL,
    "tutorId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "source" "LeaveSource" NOT NULL,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TutorLeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TutorOvertimeEntry" (
    "id" TEXT NOT NULL,
    "tutorId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TutorOvertimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollEntry" (
    "id" TEXT NOT NULL,
    "tutorId" TEXT NOT NULL,
    "periodMonth" TEXT NOT NULL,
    "hariKerja" INTEGER NOT NULL,
    "dailyRateAmount" INTEGER NOT NULL,
    "izinHari" INTEGER NOT NULL,
    "bonusOntimeDays" INTEGER NOT NULL,
    "bonusOntimeAmount" INTEGER NOT NULL,
    "extraTimeHours" DOUBLE PRECISION NOT NULL,
    "extraTimeAmount" INTEGER NOT NULL,
    "extraHandleCount" INTEGER NOT NULL,
    "extraHandleAmount" INTEGER NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "status" "PayrollStatus" NOT NULL DEFAULT 'DRAFT',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizedAt" TIMESTAMP(3),
    "finalizedById" TEXT,

    CONSTRAINT "PayrollEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TutorPayrollRate_tutorId_key" ON "TutorPayrollRate"("tutorId");

-- CreateIndex
CREATE INDEX "TutorLeaveRequest_tutorId_date_idx" ON "TutorLeaveRequest"("tutorId", "date");

-- CreateIndex
CREATE INDEX "TutorLeaveRequest_status_idx" ON "TutorLeaveRequest"("status");

-- CreateIndex
CREATE INDEX "TutorOvertimeEntry_tutorId_date_idx" ON "TutorOvertimeEntry"("tutorId", "date");

-- CreateIndex
CREATE INDEX "PayrollEntry_periodMonth_idx" ON "PayrollEntry"("periodMonth");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollEntry_tutorId_periodMonth_key" ON "PayrollEntry"("tutorId", "periodMonth");

-- AddForeignKey
ALTER TABLE "TutorPayrollRate" ADD CONSTRAINT "TutorPayrollRate_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorLeaveRequest" ADD CONSTRAINT "TutorLeaveRequest_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorLeaveRequest" ADD CONSTRAINT "TutorLeaveRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorOvertimeEntry" ADD CONSTRAINT "TutorOvertimeEntry_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorOvertimeEntry" ADD CONSTRAINT "TutorOvertimeEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollEntry" ADD CONSTRAINT "PayrollEntry_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollEntry" ADD CONSTRAINT "PayrollEntry_finalizedById_fkey" FOREIGN KEY ("finalizedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
