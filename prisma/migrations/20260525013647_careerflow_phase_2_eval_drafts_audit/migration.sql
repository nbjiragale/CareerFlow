-- AlterTable
ALTER TABLE "Job" ADD COLUMN "evaluatedAt" DATETIME;
ALTER TABLE "Job" ADD COLUMN "evaluationGrade" TEXT;
ALTER TABLE "Job" ADD COLUMN "evaluationJson" TEXT;

-- CreateTable
CREATE TABLE "AiDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "emailThreadId" TEXT,
    "jobId" TEXT,
    "draftType" TEXT NOT NULL,
    "subject" TEXT,
    "content" TEXT NOT NULL,
    "tone" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AiDraft_emailThreadId_fkey" FOREIGN KEY ("emailThreadId") REFERENCES "EmailThread" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AiDraft_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AiAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "costUsd" REAL NOT NULL DEFAULT 0,
    "msElapsed" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "jobId" TEXT,
    "emailThreadId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AiDraft_userId_createdAt_idx" ON "AiDraft"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AiDraft_emailThreadId_idx" ON "AiDraft"("emailThreadId");

-- CreateIndex
CREATE INDEX "AiDraft_jobId_idx" ON "AiDraft"("jobId");

-- CreateIndex
CREATE INDEX "AiAuditLog_userId_createdAt_idx" ON "AiAuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AiAuditLog_userId_feature_idx" ON "AiAuditLog"("userId", "feature");
