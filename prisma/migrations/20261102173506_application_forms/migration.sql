-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('SUBMITTED', 'SHORTLISTED', 'WAITLISTED', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ApplicationKind" AS ENUM ('STUDENT', 'TEAM');

-- AlterEnum
ALTER TYPE "OtpPurpose" ADD VALUE 'APPLY';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Permission" ADD VALUE 'REVIEW_APPLICATIONS';
ALTER TYPE "Permission" ADD VALUE 'MANAGE_APPLICATIONS';

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'APPLICANT_CHECKER';

-- CreateTable
CREATE TABLE "ApplicationForm" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "kind" "ApplicationKind" NOT NULL DEFAULT 'STUDENT',
    "seasonId" TEXT,
    "questions" JSONB NOT NULL DEFAULT '[]',
    "isOpen" BOOLEAN NOT NULL DEFAULT false,
    "closesAt" TIMESTAMP(3),
    "allowEdit" BOOLEAN NOT NULL DEFAULT true,
    "confirmation" TEXT,
    "openedById" TEXT,
    "openedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "answers" JSONB NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "avgScore" DOUBLE PRECISION,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "locale" TEXT NOT NULL DEFAULT 'az',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "notifiedStatus" "ApplicationStatus",
    "notifiedAt" TIMESTAMP(3),
    "userId" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationReview" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationForm_slug_key" ON "ApplicationForm"("slug");

-- CreateIndex
CREATE INDEX "ApplicationForm_isOpen_idx" ON "ApplicationForm"("isOpen");

-- CreateIndex
CREATE INDEX "Application_formId_status_idx" ON "Application"("formId", "status");

-- CreateIndex
CREATE INDEX "Application_email_idx" ON "Application"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Application_formId_email_key" ON "Application"("formId", "email");

-- CreateIndex
CREATE INDEX "ApplicationReview_reviewerId_idx" ON "ApplicationReview"("reviewerId");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationReview_applicationId_reviewerId_key" ON "ApplicationReview"("applicationId", "reviewerId");

-- AddForeignKey
ALTER TABLE "ApplicationForm" ADD CONSTRAINT "ApplicationForm_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_formId_fkey" FOREIGN KEY ("formId") REFERENCES "ApplicationForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationReview" ADD CONSTRAINT "ApplicationReview_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationReview" ADD CONSTRAINT "ApplicationReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
