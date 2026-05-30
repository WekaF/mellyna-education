-- CreateTable
CREATE TABLE "ClassTutor" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "tutorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassTutor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClassTutor_classId_tutorId_key" ON "ClassTutor"("classId", "tutorId");

-- AddForeignKey
ALTER TABLE "ClassTutor" ADD CONSTRAINT "ClassTutor_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassTutor" ADD CONSTRAINT "ClassTutor_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
