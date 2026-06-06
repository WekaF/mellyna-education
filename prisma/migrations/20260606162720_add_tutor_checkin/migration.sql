-- CreateTable
CREATE TABLE "TutorCheckIn" (
    "id" TEXT NOT NULL,
    "tutorId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "distanceM" DOUBLE PRECISION NOT NULL,
    "isWithinRadius" BOOLEAN NOT NULL,

    CONSTRAINT "TutorCheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TutorCheckIn_tutorId_date_key" ON "TutorCheckIn"("tutorId", "date");

-- AddForeignKey
ALTER TABLE "TutorCheckIn" ADD CONSTRAINT "TutorCheckIn_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
