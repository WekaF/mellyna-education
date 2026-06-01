--
-- PostgreSQL database dump
--

\restrict dPlc05xrOQYMThthYA5L8XWIJmR5fj7OKeuhr0ykSTn4MaSXafekt1r74yuxp1f

-- Dumped from database version 14.22 (Homebrew)
-- Dumped by pg_dump version 14.22 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE ONLY public."Student" DROP CONSTRAINT "Student_parentId_fkey";
ALTER TABLE ONLY public."StudentMilestone" DROP CONSTRAINT "StudentMilestone_updatedById_fkey";
ALTER TABLE ONLY public."StudentMilestone" DROP CONSTRAINT "StudentMilestone_studentId_fkey";
ALTER TABLE ONLY public."StudentMilestone" DROP CONSTRAINT "StudentMilestone_milestoneId_fkey";
ALTER TABLE ONLY public."Session" DROP CONSTRAINT "Session_userId_fkey";
ALTER TABLE ONLY public."Schedule" DROP CONSTRAINT "Schedule_classId_fkey";
ALTER TABLE ONLY public."ScheduleParticipant" DROP CONSTRAINT "ScheduleParticipant_studentId_fkey";
ALTER TABLE ONLY public."ScheduleParticipant" DROP CONSTRAINT "ScheduleParticipant_scheduleId_fkey";
ALTER TABLE ONLY public."ProgramEnrollment" DROP CONSTRAINT "ProgramEnrollment_studentId_fkey";
ALTER TABLE ONLY public."Payment" DROP CONSTRAINT "Payment_invoiceId_fkey";
ALTER TABLE ONLY public."PasswordResetToken" DROP CONSTRAINT "PasswordResetToken_userId_fkey";
ALTER TABLE ONLY public."MilestoneReport" DROP CONSTRAINT "MilestoneReport_studentId_fkey";
ALTER TABLE ONLY public."MilestoneReport" DROP CONSTRAINT "MilestoneReport_generatedById_fkey";
ALTER TABLE ONLY public."Media" DROP CONSTRAINT "Media_reportId_fkey";
ALTER TABLE ONLY public."LearningReport" DROP CONSTRAINT "LearningReport_tutorId_fkey";
ALTER TABLE ONLY public."LearningReport" DROP CONSTRAINT "LearningReport_studentId_fkey";
ALTER TABLE ONLY public."LearningReport" DROP CONSTRAINT "LearningReport_scheduleId_fkey";
ALTER TABLE ONLY public."Invoice" DROP CONSTRAINT "Invoice_studentId_fkey";
ALTER TABLE ONLY public."Enrollment" DROP CONSTRAINT "Enrollment_studentId_fkey";
ALTER TABLE ONLY public."Enrollment" DROP CONSTRAINT "Enrollment_programEnrollmentId_fkey";
ALTER TABLE ONLY public."Enrollment" DROP CONSTRAINT "Enrollment_classId_fkey";
ALTER TABLE ONLY public."Class" DROP CONSTRAINT "Class_tutorId_fkey";
ALTER TABLE ONLY public."ClassTutor" DROP CONSTRAINT "ClassTutor_tutorId_fkey";
ALTER TABLE ONLY public."ClassTutor" DROP CONSTRAINT "ClassTutor_classId_fkey";
ALTER TABLE ONLY public."ClassProgram" DROP CONSTRAINT "ClassProgram_classId_fkey";
ALTER TABLE ONLY public."Attendance" DROP CONSTRAINT "Attendance_studentId_fkey";
ALTER TABLE ONLY public."Attendance" DROP CONSTRAINT "Attendance_scheduleId_fkey";
ALTER TABLE ONLY public."Account" DROP CONSTRAINT "Account_userId_fkey";
DROP INDEX public."VerificationToken_token_key";
DROP INDEX public."VerificationToken_identifier_token_key";
DROP INDEX public."User_email_key";
DROP INDEX public."StudentMilestone_studentId_milestoneId_key";
DROP INDEX public."Session_sessionToken_key";
DROP INDEX public."Schedule_recurrenceGroupId_idx";
DROP INDEX public."ScheduleParticipant_scheduleId_studentId_key";
DROP INDEX public."ProgramEnrollment_studentId_status_idx";
DROP INDEX public."PasswordResetToken_token_key";
DROP INDEX public."Milestone_program_order_idx";
DROP INDEX public."MilestoneReport_studentId_createdAt_idx";
DROP INDEX public."LearningReport_studentId_scheduleId_key";
DROP INDEX public."Enrollment_studentId_classId_key";
DROP INDEX public."ClassTutor_classId_tutorId_key";
DROP INDEX public."ClassProgram_classId_program_key";
DROP INDEX public."Attendance_studentId_scheduleId_key";
DROP INDEX public."Account_provider_providerAccountId_key";
ALTER TABLE ONLY public._prisma_migrations DROP CONSTRAINT _prisma_migrations_pkey;
ALTER TABLE ONLY public."User" DROP CONSTRAINT "User_pkey";
ALTER TABLE ONLY public."Student" DROP CONSTRAINT "Student_pkey";
ALTER TABLE ONLY public."StudentMilestone" DROP CONSTRAINT "StudentMilestone_pkey";
ALTER TABLE ONLY public."Session" DROP CONSTRAINT "Session_pkey";
ALTER TABLE ONLY public."Schedule" DROP CONSTRAINT "Schedule_pkey";
ALTER TABLE ONLY public."ScheduleParticipant" DROP CONSTRAINT "ScheduleParticipant_pkey";
ALTER TABLE ONLY public."ProgramEnrollment" DROP CONSTRAINT "ProgramEnrollment_pkey";
ALTER TABLE ONLY public."Payment" DROP CONSTRAINT "Payment_pkey";
ALTER TABLE ONLY public."PasswordResetToken" DROP CONSTRAINT "PasswordResetToken_pkey";
ALTER TABLE ONLY public."Milestone" DROP CONSTRAINT "Milestone_pkey";
ALTER TABLE ONLY public."MilestoneReport" DROP CONSTRAINT "MilestoneReport_pkey";
ALTER TABLE ONLY public."Media" DROP CONSTRAINT "Media_pkey";
ALTER TABLE ONLY public."LearningReport" DROP CONSTRAINT "LearningReport_pkey";
ALTER TABLE ONLY public."Invoice" DROP CONSTRAINT "Invoice_pkey";
ALTER TABLE ONLY public."Enrollment" DROP CONSTRAINT "Enrollment_pkey";
ALTER TABLE ONLY public."DailyPiket" DROP CONSTRAINT "DailyPiket_pkey";
ALTER TABLE ONLY public."Class" DROP CONSTRAINT "Class_pkey";
ALTER TABLE ONLY public."ClassTutor" DROP CONSTRAINT "ClassTutor_pkey";
ALTER TABLE ONLY public."ClassProgram" DROP CONSTRAINT "ClassProgram_pkey";
ALTER TABLE ONLY public."Attendance" DROP CONSTRAINT "Attendance_pkey";
ALTER TABLE ONLY public."Announcement" DROP CONSTRAINT "Announcement_pkey";
ALTER TABLE ONLY public."Account" DROP CONSTRAINT "Account_pkey";
DROP TABLE public._prisma_migrations;
DROP TABLE public."VerificationToken";
DROP TABLE public."User";
DROP TABLE public."StudentMilestone";
DROP TABLE public."Student";
DROP TABLE public."Session";
DROP TABLE public."ScheduleParticipant";
DROP TABLE public."Schedule";
DROP TABLE public."ProgramEnrollment";
DROP TABLE public."Payment";
DROP TABLE public."PasswordResetToken";
DROP TABLE public."MilestoneReport";
DROP TABLE public."Milestone";
DROP TABLE public."Media";
DROP TABLE public."LearningReport";
DROP TABLE public."Invoice";
DROP TABLE public."Enrollment";
DROP TABLE public."DailyPiket";
DROP TABLE public."ClassTutor";
DROP TABLE public."ClassProgram";
DROP TABLE public."Class";
DROP TABLE public."Attendance";
DROP TABLE public."Announcement";
DROP TABLE public."Account";
DROP TYPE public."ScheduleStatus";
DROP TYPE public."Role";
DROP TYPE public."ReportPeriodType";
DROP TYPE public."ProgramEnrollmentStatus";
DROP TYPE public."Program";
DROP TYPE public."PaymentStatus";
DROP TYPE public."MilestoneStatus";
DROP TYPE public."MediaType";
DROP TYPE public."InvoiceStatus";
DROP TYPE public."DayOfWeek";
DROP TYPE public."AttendanceStatus";
--
-- Name: AttendanceStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AttendanceStatus" AS ENUM (
    'PRESENT',
    'ABSENT',
    'SICK',
    'PERMISSION'
);


--
-- Name: DayOfWeek; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."DayOfWeek" AS ENUM (
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
    'THURSDAY',
    'FRIDAY',
    'SATURDAY',
    'SUNDAY'
);


--
-- Name: InvoiceStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."InvoiceStatus" AS ENUM (
    'PENDING',
    'PAID',
    'OVERDUE',
    'CANCELLED'
);


--
-- Name: MediaType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."MediaType" AS ENUM (
    'PHOTO',
    'VIDEO'
);


--
-- Name: MilestoneStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."MilestoneStatus" AS ENUM (
    'NOT_STARTED',
    'IN_PROGRESS',
    'COMPLETED'
);


--
-- Name: PaymentStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PaymentStatus" AS ENUM (
    'PENDING',
    'SUCCESS',
    'FAILED',
    'EXPIRED'
);


--
-- Name: Program; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Program" AS ENUM (
    'SEMPOA',
    'AHE',
    'EFK',
    'EYL',
    'EFE',
    'CALISTUNG',
    'ENGLISH'
);


--
-- Name: ProgramEnrollmentStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ProgramEnrollmentStatus" AS ENUM (
    'ACTIVE',
    'COMPLETED',
    'UPGRADED',
    'DROPPED'
);


--
-- Name: ReportPeriodType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ReportPeriodType" AS ENUM (
    'MONTHLY',
    'SEMESTER',
    'CUSTOM'
);


--
-- Name: Role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Role" AS ENUM (
    'SUPER_ADMIN',
    'TUTOR',
    'PARENT'
);


--
-- Name: ScheduleStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ScheduleStatus" AS ENUM (
    'DRAFT',
    'PUBLISHED',
    'COMPLETED',
    'CANCELLED'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Account; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Account" (
    id text NOT NULL,
    "userId" text NOT NULL,
    type text NOT NULL,
    provider text NOT NULL,
    "providerAccountId" text NOT NULL,
    refresh_token text,
    access_token text,
    expires_at integer,
    token_type text,
    scope text,
    id_token text,
    session_state text
);


--
-- Name: Announcement; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Announcement" (
    id text NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    "authorId" text NOT NULL,
    published boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Attendance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Attendance" (
    id text NOT NULL,
    "studentId" text NOT NULL,
    "scheduleId" text NOT NULL,
    status public."AttendanceStatus" DEFAULT 'PRESENT'::public."AttendanceStatus" NOT NULL,
    notes text,
    "markedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Class; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Class" (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    "tutorId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "dayOfWeek" public."DayOfWeek",
    "timeSlot" text,
    "mainProgram" public."Program"
);


--
-- Name: ClassProgram; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ClassProgram" (
    id text NOT NULL,
    "classId" text NOT NULL,
    program public."Program" NOT NULL
);


--
-- Name: ClassTutor; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ClassTutor" (
    id text NOT NULL,
    "classId" text NOT NULL,
    "tutorId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: DailyPiket; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DailyPiket" (
    day text NOT NULL,
    staff text NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Enrollment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Enrollment" (
    id text NOT NULL,
    "studentId" text NOT NULL,
    "classId" text NOT NULL,
    "joinedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "programEnrollmentId" text
);


--
-- Name: Invoice; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Invoice" (
    id text NOT NULL,
    "studentId" text NOT NULL,
    amount integer NOT NULL,
    description text NOT NULL,
    "dueDate" timestamp(3) without time zone NOT NULL,
    status public."InvoiceStatus" DEFAULT 'PENDING'::public."InvoiceStatus" NOT NULL,
    "midtransId" text,
    "paidAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: LearningReport; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."LearningReport" (
    id text NOT NULL,
    "studentId" text NOT NULL,
    "scheduleId" text NOT NULL,
    "tutorId" text NOT NULL,
    content text NOT NULL,
    score integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "parentNotifiedAt" timestamp(3) without time zone
);


--
-- Name: Media; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Media" (
    id text NOT NULL,
    "reportId" text NOT NULL,
    url text NOT NULL,
    type public."MediaType" NOT NULL,
    filename text NOT NULL,
    size integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Milestone; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Milestone" (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    program public."Program" NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: MilestoneReport; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MilestoneReport" (
    id text NOT NULL,
    "studentId" text NOT NULL,
    "periodType" public."ReportPeriodType" NOT NULL,
    "periodLabel" text NOT NULL,
    "periodStart" timestamp(3) without time zone NOT NULL,
    "periodEnd" timestamp(3) without time zone NOT NULL,
    notes text,
    "snapshotJson" jsonb NOT NULL,
    "sessionSummary" jsonb NOT NULL,
    "generatedById" text NOT NULL,
    "notifiedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: PasswordResetToken; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PasswordResetToken" (
    id text NOT NULL,
    token text NOT NULL,
    "userId" text NOT NULL,
    expires timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Payment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Payment" (
    id text NOT NULL,
    "invoiceId" text NOT NULL,
    amount integer NOT NULL,
    method text,
    status public."PaymentStatus" DEFAULT 'PENDING'::public."PaymentStatus" NOT NULL,
    "snapToken" text,
    "snapUrl" text,
    "midtransData" jsonb,
    "paidAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ProgramEnrollment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ProgramEnrollment" (
    id text NOT NULL,
    "studentId" text NOT NULL,
    program public."Program" NOT NULL,
    status public."ProgramEnrollmentStatus" DEFAULT 'ACTIVE'::public."ProgramEnrollmentStatus" NOT NULL,
    "startedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "endedAt" timestamp(3) without time zone,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Schedule; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Schedule" (
    id text NOT NULL,
    "classId" text NOT NULL,
    date timestamp(3) without time zone NOT NULL,
    "startTime" text NOT NULL,
    "endTime" text NOT NULL,
    topic text,
    location text,
    status public."ScheduleStatus" DEFAULT 'DRAFT'::public."ScheduleStatus" NOT NULL,
    "publishedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "isRecurring" boolean DEFAULT false NOT NULL,
    "recurrenceGroupId" text,
    "recurrenceWeeks" integer
);


--
-- Name: ScheduleParticipant; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ScheduleParticipant" (
    id text NOT NULL,
    "scheduleId" text NOT NULL,
    "studentId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Session" (
    id text NOT NULL,
    "sessionToken" text NOT NULL,
    "userId" text NOT NULL,
    expires timestamp(3) without time zone NOT NULL
);


--
-- Name: Student; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Student" (
    id text NOT NULL,
    name text NOT NULL,
    "birthDate" timestamp(3) without time zone,
    grade text,
    notes text,
    "parentId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL
);


--
-- Name: StudentMilestone; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."StudentMilestone" (
    id text NOT NULL,
    "studentId" text NOT NULL,
    "milestoneId" text NOT NULL,
    status public."MilestoneStatus" DEFAULT 'NOT_STARTED'::public."MilestoneStatus" NOT NULL,
    "completedAt" timestamp(3) without time zone,
    notes text,
    "updatedById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: User; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."User" (
    id text NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    "emailVerified" timestamp(3) without time zone,
    password text,
    phone text,
    role public."Role" DEFAULT 'PARENT'::public."Role" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    suspended boolean DEFAULT false NOT NULL
);


--
-- Name: VerificationToken; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."VerificationToken" (
    identifier text NOT NULL,
    token text NOT NULL,
    expires timestamp(3) without time zone NOT NULL
);


--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


--
-- Data for Name: Account; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Account" (id, "userId", type, provider, "providerAccountId", refresh_token, access_token, expires_at, token_type, scope, id_token, session_state) FROM stdin;
\.


--
-- Data for Name: Announcement; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Announcement" (id, title, content, "authorId", published, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Attendance; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Attendance" (id, "studentId", "scheduleId", status, notes, "markedAt") FROM stdin;
\.


--
-- Data for Name: Class; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Class" (id, name, description, "tutorId", "createdAt", "updatedAt", "dayOfWeek", "timeSlot", "mainProgram") FROM stdin;
seed-class-1	Matematika Dasar	Kelas matematika untuk SD kelas 4-6	cmpp1qz5s0001pyqg9h9c2zq2	2026-05-28 05:22:41.667	2026-06-01 06:41:36.476	MONDAY	08:00	SEMPOA
\.


--
-- Data for Name: ClassProgram; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ClassProgram" (id, "classId", program) FROM stdin;
\.


--
-- Data for Name: ClassTutor; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ClassTutor" (id, "classId", "tutorId", "createdAt") FROM stdin;
\.


--
-- Data for Name: DailyPiket; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."DailyPiket" (day, staff, "updatedAt") FROM stdin;
Senin	ANI, LISA, DANI	2026-05-31 07:28:43.059
Selasa	LISA, ELA	2026-05-31 07:28:43.146
Rabu	ELA, VIN, DANI	2026-05-31 07:28:43.147
Kamis	—	2026-05-31 07:28:43.149
Jum'at	ANI, LISA, VIN	2026-05-31 07:28:43.151
Sabtu	DANI, ELA	2026-05-31 07:28:43.153
Minggu	ANI, LISA, VIN	2026-05-31 07:28:43.154
\.


--
-- Data for Name: Enrollment; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Enrollment" (id, "studentId", "classId", "joinedAt", "programEnrollmentId") FROM stdin;
cmptnyark0003pyp3ljcjrs0x	seed-student-1	seed-class-1	2026-05-31 10:55:19.037	\N
\.


--
-- Data for Name: Invoice; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Invoice" (id, "studentId", amount, description, "dueDate", status, "midtransId", "paidAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: LearningReport; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."LearningReport" (id, "studentId", "scheduleId", "tutorId", content, score, "createdAt", "updatedAt", "parentNotifiedAt") FROM stdin;
\.


--
-- Data for Name: Media; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Media" (id, "reportId", url, type, filename, size, "createdAt") FROM stdin;
\.


--
-- Data for Name: Milestone; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Milestone" (id, name, description, program, "order", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: MilestoneReport; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."MilestoneReport" (id, "studentId", "periodType", "periodLabel", "periodStart", "periodEnd", notes, "snapshotJson", "sessionSummary", "generatedById", "notifiedAt", "createdAt") FROM stdin;
\.


--
-- Data for Name: PasswordResetToken; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."PasswordResetToken" (id, token, "userId", expires, "createdAt") FROM stdin;
\.


--
-- Data for Name: Payment; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Payment" (id, "invoiceId", amount, method, status, "snapToken", "snapUrl", "midtransData", "paidAt", "createdAt") FROM stdin;
\.


--
-- Data for Name: ProgramEnrollment; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ProgramEnrollment" (id, "studentId", program, status, "startedAt", "endedAt", notes, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Schedule; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Schedule" (id, "classId", date, "startTime", "endTime", topic, location, status, "publishedAt", "createdAt", "updatedAt", "isRecurring", "recurrenceGroupId", "recurrenceWeeks") FROM stdin;
cmptnxsb90001pyp30p7ggcp5	seed-class-1	2026-05-31 17:00:00	08:00	08:45	Sesi Belajar  - Rutin	Ruang Belajar Mellyna	PUBLISHED	2026-05-31 10:54:55.122	2026-05-31 10:54:55.124	2026-05-31 10:54:55.124	f	\N	\N
\.


--
-- Data for Name: ScheduleParticipant; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ScheduleParticipant" (id, "scheduleId", "studentId", "createdAt") FROM stdin;
\.


--
-- Data for Name: Session; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Session" (id, "sessionToken", "userId", expires) FROM stdin;
\.


--
-- Data for Name: Student; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Student" (id, name, "birthDate", grade, notes, "parentId", "createdAt", "updatedAt", "isActive") FROM stdin;
seed-student-1	Andi Pratama	\N	Kelas 5 SD	\N	cmpp1qzio0002pyqgnyungzw8	2026-05-28 05:22:41.626	2026-05-28 05:22:41.626	t
\.


--
-- Data for Name: StudentMilestone; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."StudentMilestone" (id, "studentId", "milestoneId", status, "completedAt", notes, "updatedById", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."User" (id, name, email, "emailVerified", password, phone, role, "createdAt", "updatedAt", suspended) FROM stdin;
cmpp1qygk0000pyqg3r6uxlsl	Super Admin	admin@mellyna.id	\N	$2b$12$RVJek13ZvZjtp7eTlPwJb.mavLEyvpExjH1Z/PTIlNgz9xGgxaa/e	6281234567890	SUPER_ADMIN	2026-05-28 05:22:40.238	2026-05-28 05:22:40.238	f
cmpp1qz5s0001pyqg9h9c2zq2	Pak Budi	tutor@mellyna.id	\N	$2b$12$1fxZie8bAg9GhYiGND.0lOdpmxXTJQVat/HVK34VOvDDf.n3N.z3O	6281234567891	TUTOR	2026-05-28 05:22:41.152	2026-05-28 05:22:41.152	f
cmpp1qzio0002pyqgnyungzw8	Bu Sari	parent@mellyna.id	\N	$2b$12$J4ar4I9q5j6rfeTNVqizDOAodeOLlQ/Y72BSDK95/2TVjO7QQKvme	6281234567892	PARENT	2026-05-28 05:22:41.611	2026-05-28 05:22:41.611	f
\.


--
-- Data for Name: VerificationToken; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."VerificationToken" (identifier, token, expires) FROM stdin;
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
30d5fcb3-6f06-4664-a066-4f979d3da6b6	e5afbf9ee0745c1b1a5a3f6083329db9de65bcf1213d33a5abdc6a91e8e05ea2	2026-05-28 12:22:21.677154+07	20260528052220_init	\N	\N	2026-05-28 12:22:20.33643+07	1
bceab3a6-ca44-4fcc-9df8-fc4fd90880fe	f5e91520247173886aa8666501182bba47de169c86985601f6a23f4948e1845f	2026-05-31 14:28:29.397284+07	20260528154036_add_schedule_participants	\N	\N	2026-05-31 14:28:29.340915+07	1
c726a1d8-626f-4e12-b773-51bfcf2a916d	c4fee080abb5214af71851f79ca3e90c2376cc8ac819b21e2f85849455b8863f	2026-06-01 13:06:49.546055+07	20260601060649_add_program_enrollment	\N	\N	2026-06-01 13:06:49.525722+07	1
0d362398-ee07-4cdf-9b63-e3427a0e3aaa	bcf24c773280a8e676a60c675d2526dca6debd5f69f6f2e5ff59b1f117ac6dbb	2026-05-31 14:28:29.399411+07	20260529015338_add_student_active_status	\N	\N	2026-05-31 14:28:29.397694+07	1
82fd688e-4ffb-4780-a066-3cdd91ae1d13	fb091432e93057e0d835ecfba3fc3ac1e1cfd19db0a11864b3542dc9ebcc9bb2	2026-05-31 14:28:29.401176+07	20260529015511_add_user_suspended	\N	\N	2026-05-31 14:28:29.399861+07	1
414292dc-aaa8-419e-8b7d-ffe4f1752b48	f02f443093609c1891f515ee57da1d1bd52564c355a63dd49f4779ac08ea4572	2026-05-31 14:28:29.404263+07	20260529031537_add_class_schedule_fields	\N	\N	2026-05-31 14:28:29.401533+07	1
628ad67b-b647-48f8-a6be-ac1ea4050b8b	657f00b3b4706134bfb9ed8f89dcb43905f404aa2e72be783aaea1f0a9c9ecc0	2026-06-01 13:41:22.118059+07	20260531154322_add_main_program_to_class	\N	\N	2026-06-01 13:41:22.101594+07	1
b9a7c55c-9b04-4384-aa2f-79b9fa96ae52	3892f06378c4f4eee5bb2810c09ce4316d2a85002f4bb740ef95305bbf224ce7	2026-05-31 14:28:29.407492+07	20260529031800_add_schedule_recurrence	\N	\N	2026-05-31 14:28:29.404634+07	1
54b62b78-ada2-4ef4-ac8e-5321949dbfdb	af9b4a8083f77cf00e1098b77d4e11d3c03278ab88cfefd2d9f99e5f4414e197	2026-05-31 14:28:29.412304+07	20260529034110_add_daily_piket	\N	\N	2026-05-31 14:28:29.407829+07	1
7b84fc10-522e-4dc1-b69f-9aac9a9f85a1	82e69a62a0d3086c974e587bb97d777c0ee01aa70ae27384a402f08ccbddaaf5	2026-05-31 14:28:29.419457+07	20260529065138_add_class_programs	\N	\N	2026-05-31 14:28:29.412666+07	1
5aa24da6-b2be-4ddb-82a5-061141a5747f	81d25d94eb3b48653eef9ffb7530121f34824b4facd5ed30be3b66e2a75a5e6a	2026-06-01 13:41:22.145014+07	20260531162234_add_milestone_reports	\N	\N	2026-06-01 13:41:22.118973+07	1
09c97212-5f5b-427c-9d16-bc6aaa5a258b	0134d981bbbc177a58540bde1e163b44437cf6f3076b5c0fb378949b83ec668c	2026-05-31 14:28:29.423273+07	20260529065200_remove_class_subject	\N	\N	2026-05-31 14:28:29.419856+07	1
e49f2f94-8697-4223-b2d8-9b9e408e2de5	66f401d93b9c2837024e6df70703fcaa09aa612d16a559851ee10d46ab5956d2	2026-05-31 14:28:29.424695+07	20260530021939_add_parent_notified_at_to_learning_report	\N	\N	2026-05-31 14:28:29.423575+07	1
0ec78cef-d4a2-4f94-9398-4cf2195f1b15	f456d36f281d9be46f329e4b158b179cbb55388a74751130c64589e2ae18bd70	2026-05-31 14:28:29.42931+07	20260530073219_add_class_tutor	\N	\N	2026-05-31 14:28:29.425009+07	1
f579515d-a1a3-4ed8-a081-0a9c5169f3dc	73898de3219b29a8146304d983766c9669df867fd0c88705c8dabd42646f20fd	2026-06-01 13:41:22.152643+07	20260531175336_add_password_reset_token	\N	\N	2026-06-01 13:41:22.146124+07	1
00b5bc77-a0d8-4fa5-87a6-f19213f3fac1	fae3fa9f39e783bf178be3487094a923e934e0739aa9de0ea3afb992912a65a8	2026-05-31 14:28:29.430656+07	20260531135705_normalize_timeslot_jam_to_hhmm	\N	\N	2026-05-31 14:28:29.429627+07	1
a55ee6b8-55c2-401c-8c3c-6b9db3382096	e9cb7e0aa76cca1cbcd8a565fa3be351d0153d3f870755be467e83950132900a	2026-05-31 14:29:56.656842+07	20260531072956_add_milestones	\N	\N	2026-05-31 14:29:56.6429+07	1
\.


--
-- Name: Account Account_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Account"
    ADD CONSTRAINT "Account_pkey" PRIMARY KEY (id);


--
-- Name: Announcement Announcement_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Announcement"
    ADD CONSTRAINT "Announcement_pkey" PRIMARY KEY (id);


--
-- Name: Attendance Attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Attendance"
    ADD CONSTRAINT "Attendance_pkey" PRIMARY KEY (id);


--
-- Name: ClassProgram ClassProgram_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ClassProgram"
    ADD CONSTRAINT "ClassProgram_pkey" PRIMARY KEY (id);


--
-- Name: ClassTutor ClassTutor_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ClassTutor"
    ADD CONSTRAINT "ClassTutor_pkey" PRIMARY KEY (id);


--
-- Name: Class Class_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Class"
    ADD CONSTRAINT "Class_pkey" PRIMARY KEY (id);


--
-- Name: DailyPiket DailyPiket_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DailyPiket"
    ADD CONSTRAINT "DailyPiket_pkey" PRIMARY KEY (day);


--
-- Name: Enrollment Enrollment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Enrollment"
    ADD CONSTRAINT "Enrollment_pkey" PRIMARY KEY (id);


--
-- Name: Invoice Invoice_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Invoice"
    ADD CONSTRAINT "Invoice_pkey" PRIMARY KEY (id);


--
-- Name: LearningReport LearningReport_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LearningReport"
    ADD CONSTRAINT "LearningReport_pkey" PRIMARY KEY (id);


--
-- Name: Media Media_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Media"
    ADD CONSTRAINT "Media_pkey" PRIMARY KEY (id);


--
-- Name: MilestoneReport MilestoneReport_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MilestoneReport"
    ADD CONSTRAINT "MilestoneReport_pkey" PRIMARY KEY (id);


--
-- Name: Milestone Milestone_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Milestone"
    ADD CONSTRAINT "Milestone_pkey" PRIMARY KEY (id);


--
-- Name: PasswordResetToken PasswordResetToken_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PasswordResetToken"
    ADD CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY (id);


--
-- Name: Payment Payment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Payment"
    ADD CONSTRAINT "Payment_pkey" PRIMARY KEY (id);


--
-- Name: ProgramEnrollment ProgramEnrollment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProgramEnrollment"
    ADD CONSTRAINT "ProgramEnrollment_pkey" PRIMARY KEY (id);


--
-- Name: ScheduleParticipant ScheduleParticipant_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ScheduleParticipant"
    ADD CONSTRAINT "ScheduleParticipant_pkey" PRIMARY KEY (id);


--
-- Name: Schedule Schedule_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Schedule"
    ADD CONSTRAINT "Schedule_pkey" PRIMARY KEY (id);


--
-- Name: Session Session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Session"
    ADD CONSTRAINT "Session_pkey" PRIMARY KEY (id);


--
-- Name: StudentMilestone StudentMilestone_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StudentMilestone"
    ADD CONSTRAINT "StudentMilestone_pkey" PRIMARY KEY (id);


--
-- Name: Student Student_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Student"
    ADD CONSTRAINT "Student_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: Account_provider_providerAccountId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON public."Account" USING btree (provider, "providerAccountId");


--
-- Name: Attendance_studentId_scheduleId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Attendance_studentId_scheduleId_key" ON public."Attendance" USING btree ("studentId", "scheduleId");


--
-- Name: ClassProgram_classId_program_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ClassProgram_classId_program_key" ON public."ClassProgram" USING btree ("classId", program);


--
-- Name: ClassTutor_classId_tutorId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ClassTutor_classId_tutorId_key" ON public."ClassTutor" USING btree ("classId", "tutorId");


--
-- Name: Enrollment_studentId_classId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Enrollment_studentId_classId_key" ON public."Enrollment" USING btree ("studentId", "classId");


--
-- Name: LearningReport_studentId_scheduleId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "LearningReport_studentId_scheduleId_key" ON public."LearningReport" USING btree ("studentId", "scheduleId");


--
-- Name: MilestoneReport_studentId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MilestoneReport_studentId_createdAt_idx" ON public."MilestoneReport" USING btree ("studentId", "createdAt");


--
-- Name: Milestone_program_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Milestone_program_order_idx" ON public."Milestone" USING btree (program, "order");


--
-- Name: PasswordResetToken_token_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON public."PasswordResetToken" USING btree (token);


--
-- Name: ProgramEnrollment_studentId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ProgramEnrollment_studentId_status_idx" ON public."ProgramEnrollment" USING btree ("studentId", status);


--
-- Name: ScheduleParticipant_scheduleId_studentId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ScheduleParticipant_scheduleId_studentId_key" ON public."ScheduleParticipant" USING btree ("scheduleId", "studentId");


--
-- Name: Schedule_recurrenceGroupId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Schedule_recurrenceGroupId_idx" ON public."Schedule" USING btree ("recurrenceGroupId");


--
-- Name: Session_sessionToken_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Session_sessionToken_key" ON public."Session" USING btree ("sessionToken");


--
-- Name: StudentMilestone_studentId_milestoneId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "StudentMilestone_studentId_milestoneId_key" ON public."StudentMilestone" USING btree ("studentId", "milestoneId");


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: VerificationToken_identifier_token_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON public."VerificationToken" USING btree (identifier, token);


--
-- Name: VerificationToken_token_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "VerificationToken_token_key" ON public."VerificationToken" USING btree (token);


--
-- Name: Account Account_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Account"
    ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Attendance Attendance_scheduleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Attendance"
    ADD CONSTRAINT "Attendance_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES public."Schedule"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Attendance Attendance_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Attendance"
    ADD CONSTRAINT "Attendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."Student"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ClassProgram ClassProgram_classId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ClassProgram"
    ADD CONSTRAINT "ClassProgram_classId_fkey" FOREIGN KEY ("classId") REFERENCES public."Class"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ClassTutor ClassTutor_classId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ClassTutor"
    ADD CONSTRAINT "ClassTutor_classId_fkey" FOREIGN KEY ("classId") REFERENCES public."Class"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ClassTutor ClassTutor_tutorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ClassTutor"
    ADD CONSTRAINT "ClassTutor_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Class Class_tutorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Class"
    ADD CONSTRAINT "Class_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Enrollment Enrollment_classId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Enrollment"
    ADD CONSTRAINT "Enrollment_classId_fkey" FOREIGN KEY ("classId") REFERENCES public."Class"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Enrollment Enrollment_programEnrollmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Enrollment"
    ADD CONSTRAINT "Enrollment_programEnrollmentId_fkey" FOREIGN KEY ("programEnrollmentId") REFERENCES public."ProgramEnrollment"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Enrollment Enrollment_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Enrollment"
    ADD CONSTRAINT "Enrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."Student"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Invoice Invoice_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Invoice"
    ADD CONSTRAINT "Invoice_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."Student"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: LearningReport LearningReport_scheduleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LearningReport"
    ADD CONSTRAINT "LearningReport_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES public."Schedule"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: LearningReport LearningReport_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LearningReport"
    ADD CONSTRAINT "LearningReport_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."Student"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: LearningReport LearningReport_tutorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LearningReport"
    ADD CONSTRAINT "LearningReport_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Media Media_reportId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Media"
    ADD CONSTRAINT "Media_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES public."LearningReport"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MilestoneReport MilestoneReport_generatedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MilestoneReport"
    ADD CONSTRAINT "MilestoneReport_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: MilestoneReport MilestoneReport_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MilestoneReport"
    ADD CONSTRAINT "MilestoneReport_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."Student"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PasswordResetToken PasswordResetToken_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PasswordResetToken"
    ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Payment Payment_invoiceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Payment"
    ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES public."Invoice"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ProgramEnrollment ProgramEnrollment_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProgramEnrollment"
    ADD CONSTRAINT "ProgramEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."Student"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ScheduleParticipant ScheduleParticipant_scheduleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ScheduleParticipant"
    ADD CONSTRAINT "ScheduleParticipant_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES public."Schedule"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ScheduleParticipant ScheduleParticipant_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ScheduleParticipant"
    ADD CONSTRAINT "ScheduleParticipant_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."Student"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Schedule Schedule_classId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Schedule"
    ADD CONSTRAINT "Schedule_classId_fkey" FOREIGN KEY ("classId") REFERENCES public."Class"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Session Session_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Session"
    ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: StudentMilestone StudentMilestone_milestoneId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StudentMilestone"
    ADD CONSTRAINT "StudentMilestone_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES public."Milestone"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: StudentMilestone StudentMilestone_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StudentMilestone"
    ADD CONSTRAINT "StudentMilestone_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."Student"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: StudentMilestone StudentMilestone_updatedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StudentMilestone"
    ADD CONSTRAINT "StudentMilestone_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Student Student_parentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Student"
    ADD CONSTRAINT "Student_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict dPlc05xrOQYMThthYA5L8XWIJmR5fj7OKeuhr0ykSTn4MaSXafekt1r74yuxp1f

