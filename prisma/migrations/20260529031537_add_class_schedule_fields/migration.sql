-- CreateEnum
CREATE TYPE "DayOfWeek" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- AlterTable
ALTER TABLE "Class" ADD COLUMN     "dayOfWeek" "DayOfWeek",
ADD COLUMN     "timeSlot" TEXT;
