-- CreateTable
CREATE TABLE "DailyPiket" (
    "day" TEXT NOT NULL,
    "staff" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyPiket_pkey" PRIMARY KEY ("day")
);
