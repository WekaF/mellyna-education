-- CreateTable
CREATE TABLE "ScheduleParticipant" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleParticipant_scheduleId_studentId_key" ON "ScheduleParticipant"("scheduleId", "studentId");

-- AddForeignKey
ALTER TABLE "ScheduleParticipant" ADD CONSTRAINT "ScheduleParticipant_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleParticipant" ADD CONSTRAINT "ScheduleParticipant_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
