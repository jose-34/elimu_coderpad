-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'interviewer', 'candidate');

-- CreateEnum
CREATE TYPE "InterviewStatus" AS ENUM ('scheduled', 'active', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "Rating" AS ENUM ('HIRE', 'CONSIDER', 'RISKY', 'PASS');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "first_name" TEXT,
    "last_name" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'interviewer',
    "google_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interviews" (
    "id" TEXT NOT NULL,
    "interviewer_id" TEXT NOT NULL,
    "candidate_name" TEXT NOT NULL,
    "candidate_email" TEXT NOT NULL,
    "session_code" TEXT NOT NULL,
    "status" "InterviewStatus" NOT NULL DEFAULT 'scheduled',
    "scheduled_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "language" TEXT NOT NULL DEFAULT 'python',
    "code_content" TEXT NOT NULL DEFAULT '',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" SERIAL NOT NULL,
    "section" TEXT NOT NULL,
    "question_number" TEXT NOT NULL,
    "question_text" TEXT NOT NULL,
    "scoring_guide" JSONB,
    "max_points" INTEGER NOT NULL DEFAULT 4,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_responses" (
    "id" TEXT NOT NULL,
    "interview_id" TEXT NOT NULL,
    "question_id" INTEGER NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessment_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_summary" (
    "id" TEXT NOT NULL,
    "interview_id" TEXT NOT NULL,
    "scratch_score" INTEGER NOT NULL DEFAULT 0,
    "arduino_score" INTEGER NOT NULL DEFAULT 0,
    "python_score" INTEGER NOT NULL DEFAULT 0,
    "webdev_score" INTEGER NOT NULL DEFAULT 0,
    "teaching_score" INTEGER NOT NULL DEFAULT 0,
    "total_score" INTEGER NOT NULL DEFAULT 0,
    "rating" "Rating",
    "red_flags" BOOLEAN NOT NULL DEFAULT false,
    "strengths" TEXT,
    "concerns" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessment_summary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "interviews_session_code_key" ON "interviews"("session_code");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_responses_interview_id_question_id_key" ON "assessment_responses"("interview_id", "question_id");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_summary_interview_id_key" ON "assessment_summary"("interview_id");

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_interviewer_id_fkey" FOREIGN KEY ("interviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_responses" ADD CONSTRAINT "assessment_responses_interview_id_fkey" FOREIGN KEY ("interview_id") REFERENCES "interviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_responses" ADD CONSTRAINT "assessment_responses_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_summary" ADD CONSTRAINT "assessment_summary_interview_id_fkey" FOREIGN KEY ("interview_id") REFERENCES "interviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
