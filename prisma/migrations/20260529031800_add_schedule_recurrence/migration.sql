-- AlterTable
ALTER TABLE "Schedule" ADD COLUMN     "isRecurring" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "recurrenceGroupId" TEXT,
ADD COLUMN     "recurrenceWeeks" INTEGER;

-- CreateIndex
CREATE INDEX "Schedule_recurrenceGroupId_idx" ON "Schedule"("recurrenceGroupId");
