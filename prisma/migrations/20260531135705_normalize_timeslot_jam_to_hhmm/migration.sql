-- Normalize legacy "JAM X" timeSlot format to HH:MM
-- These were created before the timetable UI switched to HH:MM format
-- Without this fix, classes with JAM X slots are invisible in the timetable grid
-- but still counted in stats and included in schedule generation.

UPDATE "Class" SET "timeSlot" = '13:00' WHERE "timeSlot" = 'JAM 1';
UPDATE "Class" SET "timeSlot" = '14:00' WHERE "timeSlot" = 'JAM 2';
UPDATE "Class" SET "timeSlot" = '15:00' WHERE "timeSlot" = 'JAM 3';
UPDATE "Class" SET "timeSlot" = '16:00' WHERE "timeSlot" = 'JAM 4';
UPDATE "Class" SET "timeSlot" = '19:00' WHERE "timeSlot" = 'JAM 7';
