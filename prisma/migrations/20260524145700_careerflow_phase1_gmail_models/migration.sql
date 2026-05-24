-- CreateTable
CREATE TABLE "OAuthToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "encryptedRefreshToken" TEXT NOT NULL,
    "refreshTokenIv" TEXT NOT NULL,
    "encryptedAccessToken" TEXT,
    "accessTokenIv" TEXT,
    "accessTokenExpiresAt" DATETIME,
    "scope" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastUsedAt" DATETIME,
    CONSTRAINT "OAuthToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmailThread" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "gmailThreadId" TEXT NOT NULL,
    "gmailMessageId" TEXT NOT NULL,
    "jobId" TEXT,
    "label" TEXT NOT NULL,
    "confidence" REAL NOT NULL,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "extractedCompany" TEXT,
    "extractedRole" TEXT,
    "subject" TEXT NOT NULL,
    "snippet" TEXT NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "receivedAt" DATETIME NOT NULL,
    "processedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailThread_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EmailThread_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmailClassificationCorrection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "emailThreadId" TEXT NOT NULL,
    "originalLabel" TEXT NOT NULL,
    "correctedLabel" TEXT NOT NULL,
    "originalConfidence" REAL,
    "correctedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailClassificationCorrection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EmailClassificationCorrection_emailThreadId_fkey" FOREIGN KEY ("emailThreadId") REFERENCES "EmailThread" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "OAuthToken_userId_idx" ON "OAuthToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthToken_userId_provider_key" ON "OAuthToken"("userId", "provider");

-- CreateIndex
CREATE INDEX "EmailThread_userId_receivedAt_idx" ON "EmailThread"("userId", "receivedAt");

-- CreateIndex
CREATE INDEX "EmailThread_userId_needsReview_idx" ON "EmailThread"("userId", "needsReview");

-- CreateIndex
CREATE INDEX "EmailThread_jobId_idx" ON "EmailThread"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailThread_userId_gmailThreadId_key" ON "EmailThread"("userId", "gmailThreadId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailClassificationCorrection_emailThreadId_key" ON "EmailClassificationCorrection"("emailThreadId");

-- CreateIndex
CREATE INDEX "EmailClassificationCorrection_userId_correctedAt_idx" ON "EmailClassificationCorrection"("userId", "correctedAt");
