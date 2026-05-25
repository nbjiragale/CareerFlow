-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" DATETIME,
    CONSTRAINT "Reminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Reminder_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Activity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "activityName" TEXT NOT NULL,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME,
    "duration" INTEGER,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "metadataJson" TEXT,
    "activityTypeId" TEXT NOT NULL,
    "taskId" TEXT,
    CONSTRAINT "Activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Activity_activityTypeId_fkey" FOREIGN KEY ("activityTypeId") REFERENCES "ActivityType" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Activity_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Activity" ("activityName", "activityTypeId", "createdAt", "description", "duration", "endTime", "id", "startTime", "taskId", "updatedAt", "userId") SELECT "activityName", "activityTypeId", "createdAt", "description", "duration", "endTime", "id", "startTime", "taskId", "updatedAt", "userId" FROM "Activity";
DROP TABLE "Activity";
ALTER TABLE "new_Activity" RENAME TO "Activity";
CREATE UNIQUE INDEX "Activity_taskId_key" ON "Activity"("taskId");
CREATE INDEX "Activity_userId_source_startTime_idx" ON "Activity"("userId", "source", "startTime");
CREATE TABLE "new_ActivityType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ActivityType_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ActivityType" ("createdAt", "createdBy", "description", "id", "label", "updatedAt", "value") SELECT "createdAt", "createdBy", "description", "id", "label", "updatedAt", "value" FROM "ActivityType";
DROP TABLE "ActivityType";
ALTER TABLE "new_ActivityType" RENAME TO "ActivityType";
CREATE UNIQUE INDEX "ActivityType_value_createdBy_key" ON "ActivityType"("value", "createdBy");
CREATE TABLE "new_AiAuditLog" (
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
    CONSTRAINT "AiAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AiAuditLog" ("completionTokens", "costUsd", "createdAt", "emailThreadId", "errorMessage", "feature", "id", "jobId", "model", "msElapsed", "promptTokens", "provider", "status", "totalTokens", "userId") SELECT "completionTokens", "costUsd", "createdAt", "emailThreadId", "errorMessage", "feature", "id", "jobId", "model", "msElapsed", "promptTokens", "provider", "status", "totalTokens", "userId" FROM "AiAuditLog";
DROP TABLE "AiAuditLog";
ALTER TABLE "new_AiAuditLog" RENAME TO "AiAuditLog";
CREATE INDEX "AiAuditLog_userId_createdAt_idx" ON "AiAuditLog"("userId", "createdAt");
CREATE INDEX "AiAuditLog_userId_feature_idx" ON "AiAuditLog"("userId", "feature");
CREATE TABLE "new_AiDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "emailThreadId" TEXT,
    "jobId" TEXT,
    "draftType" TEXT NOT NULL,
    "subject" TEXT,
    "content" TEXT NOT NULL,
    "tone" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AiDraft_emailThreadId_fkey" FOREIGN KEY ("emailThreadId") REFERENCES "EmailThread" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AiDraft_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AiDraft" ("content", "createdAt", "draftType", "emailThreadId", "id", "jobId", "subject", "tone", "userId") SELECT "content", "createdAt", "draftType", "emailThreadId", "id", "jobId", "subject", "tone", "userId" FROM "AiDraft";
DROP TABLE "AiDraft";
ALTER TABLE "new_AiDraft" RENAME TO "AiDraft";
CREATE INDEX "AiDraft_userId_createdAt_idx" ON "AiDraft"("userId", "createdAt");
CREATE INDEX "AiDraft_emailThreadId_idx" ON "AiDraft"("emailThreadId");
CREATE INDEX "AiDraft_jobId_idx" ON "AiDraft"("jobId");
CREATE TABLE "new_ApiKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "encryptedKey" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastUsedAt" DATETIME,
    CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ApiKey" ("createdAt", "encryptedKey", "id", "iv", "label", "last4", "lastUsedAt", "provider", "updatedAt", "userId") SELECT "createdAt", "encryptedKey", "id", "iv", "label", "last4", "lastUsedAt", "provider", "updatedAt", "userId" FROM "ApiKey";
DROP TABLE "ApiKey";
ALTER TABLE "new_ApiKey" RENAME TO "ApiKey";
CREATE INDEX "ApiKey_userId_idx" ON "ApiKey"("userId");
CREATE UNIQUE INDEX "ApiKey_userId_provider_key" ON "ApiKey"("userId", "provider");
CREATE TABLE "new_Automation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "jobBoard" TEXT NOT NULL,
    "keywords" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "matchThreshold" INTEGER NOT NULL DEFAULT 80,
    "scheduleHour" INTEGER NOT NULL,
    "nextRunAt" DATETIME,
    "lastRunAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Automation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Automation_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Automation" ("createdAt", "id", "jobBoard", "keywords", "lastRunAt", "location", "matchThreshold", "name", "nextRunAt", "resumeId", "scheduleHour", "status", "updatedAt", "userId") SELECT "createdAt", "id", "jobBoard", "keywords", "lastRunAt", "location", "matchThreshold", "name", "nextRunAt", "resumeId", "scheduleHour", "status", "updatedAt", "userId" FROM "Automation";
DROP TABLE "Automation";
ALTER TABLE "new_Automation" RENAME TO "Automation";
CREATE INDEX "Automation_userId_idx" ON "Automation"("userId");
CREATE INDEX "Automation_status_nextRunAt_idx" ON "Automation"("status", "nextRunAt");
CREATE TABLE "new_Company" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "logoUrl" TEXT,
    "createdBy" TEXT NOT NULL,
    CONSTRAINT "Company_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Company" ("createdBy", "id", "label", "logoUrl", "value") SELECT "createdBy", "id", "label", "logoUrl", "value" FROM "Company";
DROP TABLE "Company";
ALTER TABLE "new_Company" RENAME TO "Company";
CREATE UNIQUE INDEX "Company_value_createdBy_key" ON "Company"("value", "createdBy");
CREATE TABLE "new_Contact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL,
    "createdBy" TEXT NOT NULL,
    "interviewId" TEXT,
    CONSTRAINT "Contact_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Contact_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Contact" ("createdAt", "createdBy", "email", "id", "interviewId", "name") SELECT "createdAt", "createdBy", "email", "id", "interviewId", "name" FROM "Contact";
DROP TABLE "Contact";
ALTER TABLE "new_Contact" RENAME TO "Contact";
CREATE TABLE "new_ContactInfo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "resumeId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT,
    CONSTRAINT "ContactInfo_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ContactInfo" ("address", "createdAt", "email", "firstName", "headline", "id", "lastName", "phone", "resumeId", "updatedAt") SELECT "address", "createdAt", "email", "firstName", "headline", "id", "lastName", "phone", "resumeId", "updatedAt" FROM "ContactInfo";
DROP TABLE "ContactInfo";
ALTER TABLE "new_ContactInfo" RENAME TO "ContactInfo";
CREATE UNIQUE INDEX "ContactInfo_resumeId_key" ON "ContactInfo"("resumeId");
CREATE TABLE "new_CoverLetter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CoverLetter_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CoverLetter" ("content", "createdAt", "id", "profileId", "title", "updatedAt") SELECT "content", "createdAt", "id", "profileId", "title", "updatedAt" FROM "CoverLetter";
DROP TABLE "CoverLetter";
ALTER TABLE "new_CoverLetter" RENAME TO "CoverLetter";
CREATE TABLE "new_Education" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "institution" TEXT NOT NULL,
    "degree" TEXT NOT NULL,
    "fieldOfStudy" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "description" TEXT,
    "locationId" TEXT NOT NULL,
    "resumeSectionId" TEXT,
    CONSTRAINT "Education_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Education_resumeSectionId_fkey" FOREIGN KEY ("resumeSectionId") REFERENCES "ResumeSection" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Education" ("createdAt", "degree", "description", "endDate", "fieldOfStudy", "id", "institution", "locationId", "resumeSectionId", "startDate", "updatedAt") SELECT "createdAt", "degree", "description", "endDate", "fieldOfStudy", "id", "institution", "locationId", "resumeSectionId", "startDate", "updatedAt" FROM "Education";
DROP TABLE "Education";
ALTER TABLE "new_Education" RENAME TO "Education";
CREATE TABLE "new_EmailClassificationCorrection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "emailThreadId" TEXT NOT NULL,
    "originalLabel" TEXT NOT NULL,
    "correctedLabel" TEXT NOT NULL,
    "originalConfidence" REAL,
    "correctedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailClassificationCorrection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EmailClassificationCorrection_emailThreadId_fkey" FOREIGN KEY ("emailThreadId") REFERENCES "EmailThread" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_EmailClassificationCorrection" ("correctedAt", "correctedLabel", "emailThreadId", "id", "originalConfidence", "originalLabel", "userId") SELECT "correctedAt", "correctedLabel", "emailThreadId", "id", "originalConfidence", "originalLabel", "userId" FROM "EmailClassificationCorrection";
DROP TABLE "EmailClassificationCorrection";
ALTER TABLE "new_EmailClassificationCorrection" RENAME TO "EmailClassificationCorrection";
CREATE UNIQUE INDEX "EmailClassificationCorrection_emailThreadId_key" ON "EmailClassificationCorrection"("emailThreadId");
CREATE INDEX "EmailClassificationCorrection_userId_correctedAt_idx" ON "EmailClassificationCorrection"("userId", "correctedAt");
CREATE TABLE "new_EmailThread" (
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
    CONSTRAINT "EmailThread_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EmailThread_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_EmailThread" ("confidence", "extractedCompany", "extractedRole", "fromAddress", "gmailMessageId", "gmailThreadId", "id", "jobId", "label", "needsReview", "processedAt", "receivedAt", "snippet", "subject", "userId") SELECT "confidence", "extractedCompany", "extractedRole", "fromAddress", "gmailMessageId", "gmailThreadId", "id", "jobId", "label", "needsReview", "processedAt", "receivedAt", "snippet", "subject", "userId" FROM "EmailThread";
DROP TABLE "EmailThread";
ALTER TABLE "new_EmailThread" RENAME TO "EmailThread";
CREATE INDEX "EmailThread_userId_receivedAt_idx" ON "EmailThread"("userId", "receivedAt");
CREATE INDEX "EmailThread_userId_needsReview_idx" ON "EmailThread"("userId", "needsReview");
CREATE INDEX "EmailThread_jobId_idx" ON "EmailThread"("jobId");
CREATE UNIQUE INDEX "EmailThread_userId_gmailThreadId_key" ON "EmailThread"("userId", "gmailThreadId");
CREATE TABLE "new_Interview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL,
    "jobId" TEXT NOT NULL,
    CONSTRAINT "Interview_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Interview" ("createdAt", "id", "jobId") SELECT "createdAt", "id", "jobId" FROM "Interview";
DROP TABLE "Interview";
ALTER TABLE "new_Interview" RENAME TO "Interview";
CREATE TABLE "new_Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "jobUrl" TEXT,
    "description" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL,
    "applied" BOOLEAN NOT NULL DEFAULT false,
    "appliedDate" DATETIME,
    "dueDate" DATETIME,
    "statusId" TEXT NOT NULL,
    "jobTitleId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jobSourceId" TEXT,
    "salaryRange" TEXT,
    "locationId" TEXT,
    "resumeId" TEXT,
    "coverLetterId" TEXT,
    "automationId" TEXT,
    "matchScore" INTEGER,
    "matchData" TEXT,
    "discoveryStatus" TEXT,
    "discoveredAt" DATETIME,
    "evaluationGrade" TEXT,
    "evaluationJson" TEXT,
    "evaluatedAt" DATETIME,
    CONSTRAINT "Job_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Job_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "JobStatus" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Job_jobTitleId_fkey" FOREIGN KEY ("jobTitleId") REFERENCES "JobTitle" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Job_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Job_jobSourceId_fkey" FOREIGN KEY ("jobSourceId") REFERENCES "JobSource" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Job_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Job_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Job_coverLetterId_fkey" FOREIGN KEY ("coverLetterId") REFERENCES "CoverLetter" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Job_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "Automation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Job" ("applied", "appliedDate", "automationId", "companyId", "coverLetterId", "createdAt", "description", "discoveredAt", "discoveryStatus", "dueDate", "evaluatedAt", "evaluationGrade", "evaluationJson", "id", "jobSourceId", "jobTitleId", "jobType", "jobUrl", "locationId", "matchData", "matchScore", "resumeId", "salaryRange", "statusId", "userId") SELECT "applied", "appliedDate", "automationId", "companyId", "coverLetterId", "createdAt", "description", "discoveredAt", "discoveryStatus", "dueDate", "evaluatedAt", "evaluationGrade", "evaluationJson", "id", "jobSourceId", "jobTitleId", "jobType", "jobUrl", "locationId", "matchData", "matchScore", "resumeId", "salaryRange", "statusId", "userId" FROM "Job";
DROP TABLE "Job";
ALTER TABLE "new_Job" RENAME TO "Job";
CREATE INDEX "Job_userId_automationId_idx" ON "Job"("userId", "automationId");
CREATE INDEX "Job_userId_discoveryStatus_idx" ON "Job"("userId", "discoveryStatus");
CREATE TABLE "new_JobSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    CONSTRAINT "JobSource_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_JobSource" ("createdBy", "id", "label", "value") SELECT "createdBy", "id", "label", "value" FROM "JobSource";
DROP TABLE "JobSource";
ALTER TABLE "new_JobSource" RENAME TO "JobSource";
CREATE UNIQUE INDEX "JobSource_value_createdBy_key" ON "JobSource"("value", "createdBy");
CREATE TABLE "new_JobTitle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    CONSTRAINT "JobTitle_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_JobTitle" ("createdBy", "id", "label", "value") SELECT "createdBy", "id", "label", "value" FROM "JobTitle";
DROP TABLE "JobTitle";
ALTER TABLE "new_JobTitle" RENAME TO "JobTitle";
CREATE UNIQUE INDEX "JobTitle_value_createdBy_key" ON "JobTitle"("value", "createdBy");
CREATE TABLE "new_Location" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "stateProv" TEXT,
    "country" TEXT,
    "createdBy" TEXT NOT NULL,
    CONSTRAINT "Location_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Location" ("country", "createdBy", "id", "label", "stateProv", "value") SELECT "country", "createdBy", "id", "label", "stateProv", "value" FROM "Location";
DROP TABLE "Location";
ALTER TABLE "new_Location" RENAME TO "Location";
CREATE UNIQUE INDEX "Location_value_createdBy_key" ON "Location"("value", "createdBy");
CREATE TABLE "new_Note" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Note_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Note_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Note" ("content", "createdAt", "id", "jobId", "updatedAt", "userId") SELECT "content", "createdAt", "id", "jobId", "updatedAt", "userId" FROM "Note";
DROP TABLE "Note";
ALTER TABLE "new_Note" RENAME TO "Note";
CREATE INDEX "Note_jobId_idx" ON "Note"("jobId");
CREATE INDEX "Note_userId_idx" ON "Note"("userId");
CREATE TABLE "new_OAuthToken" (
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
    CONSTRAINT "OAuthToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_OAuthToken" ("accessTokenExpiresAt", "accessTokenIv", "createdAt", "email", "encryptedAccessToken", "encryptedRefreshToken", "id", "lastUsedAt", "provider", "refreshTokenIv", "scope", "updatedAt", "userId") SELECT "accessTokenExpiresAt", "accessTokenIv", "createdAt", "email", "encryptedAccessToken", "encryptedRefreshToken", "id", "lastUsedAt", "provider", "refreshTokenIv", "scope", "updatedAt", "userId" FROM "OAuthToken";
DROP TABLE "OAuthToken";
ALTER TABLE "new_OAuthToken" RENAME TO "OAuthToken";
CREATE INDEX "OAuthToken_userId_idx" ON "OAuthToken"("userId");
CREATE UNIQUE INDEX "OAuthToken_userId_provider_key" ON "OAuthToken"("userId", "provider");
CREATE TABLE "new_Profile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Profile" ("id", "userId") SELECT "id", "userId" FROM "Profile";
DROP TABLE "Profile";
ALTER TABLE "new_Profile" RENAME TO "Profile";
CREATE TABLE "new_Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "question" TEXT NOT NULL,
    "answer" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Question_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Question" ("answer", "createdAt", "createdBy", "id", "question", "updatedAt") SELECT "answer", "createdAt", "createdBy", "id", "question", "updatedAt" FROM "Question";
DROP TABLE "Question";
ALTER TABLE "new_Question" RENAME TO "Question";
CREATE INDEX "Question_createdBy_idx" ON "Question"("createdBy");
CREATE TABLE "new_Resume" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "FileId" TEXT,
    CONSTRAINT "Resume_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Resume_FileId_fkey" FOREIGN KEY ("FileId") REFERENCES "File" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Resume" ("FileId", "createdAt", "id", "profileId", "title", "updatedAt") SELECT "FileId", "createdAt", "id", "profileId", "title", "updatedAt" FROM "Resume";
DROP TABLE "Resume";
ALTER TABLE "new_Resume" RENAME TO "Resume";
CREATE UNIQUE INDEX "Resume_FileId_key" ON "Resume"("FileId");
CREATE TABLE "new_ResumeSection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "resumeId" TEXT NOT NULL,
    "sectionTitle" TEXT NOT NULL,
    "sectionType" TEXT NOT NULL,
    "summaryId" TEXT,
    CONSTRAINT "ResumeSection_summaryId_fkey" FOREIGN KEY ("summaryId") REFERENCES "Summary" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ResumeSection_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ResumeSection" ("id", "resumeId", "sectionTitle", "sectionType", "summaryId") SELECT "id", "resumeId", "sectionTitle", "sectionType", "summaryId" FROM "ResumeSection";
DROP TABLE "ResumeSection";
ALTER TABLE "new_ResumeSection" RENAME TO "ResumeSection";
CREATE UNIQUE INDEX "ResumeSection_summaryId_key" ON "ResumeSection"("summaryId");
CREATE TABLE "new_Tag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    CONSTRAINT "Tag_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Tag" ("createdBy", "id", "label", "value") SELECT "createdBy", "id", "label", "value" FROM "Tag";
DROP TABLE "Tag";
ALTER TABLE "new_Tag" RENAME TO "Tag";
CREATE UNIQUE INDEX "Tag_value_createdBy_key" ON "Tag"("value", "createdBy");
CREATE TABLE "new_Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'in-progress',
    "priority" INTEGER NOT NULL DEFAULT 5,
    "percentComplete" INTEGER NOT NULL DEFAULT 0,
    "dueDate" DATETIME,
    "remindAt" DATETIME,
    "remindedAt" DATETIME,
    "remindChannels" TEXT NOT NULL DEFAULT '["browser"]',
    "activityTypeId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Task_activityTypeId_fkey" FOREIGN KEY ("activityTypeId") REFERENCES "ActivityType" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("activityTypeId", "createdAt", "description", "dueDate", "id", "percentComplete", "priority", "status", "title", "updatedAt", "userId") SELECT "activityTypeId", "createdAt", "description", "dueDate", "id", "percentComplete", "priority", "status", "title", "updatedAt", "userId" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
CREATE INDEX "Task_userId_idx" ON "Task"("userId");
CREATE INDEX "Task_userId_status_idx" ON "Task"("userId", "status");
CREATE INDEX "Task_userId_activityTypeId_idx" ON "Task"("userId", "activityTypeId");
CREATE INDEX "Task_userId_dueDate_idx" ON "Task"("userId", "dueDate");
CREATE INDEX "Task_remindAt_remindedAt_idx" ON "Task"("remindAt", "remindedAt");
CREATE TABLE "new_UserSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "settings" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_UserSettings" ("createdAt", "id", "settings", "updatedAt", "userId") SELECT "createdAt", "id", "settings", "updatedAt", "userId" FROM "UserSettings";
DROP TABLE "UserSettings";
ALTER TABLE "new_UserSettings" RENAME TO "UserSettings";
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");
CREATE TABLE "new_WorkExperience" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "companyId" TEXT NOT NULL,
    "jobTitleId" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "description" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "resumeSectionId" TEXT,
    CONSTRAINT "WorkExperience_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkExperience_jobTitleId_fkey" FOREIGN KEY ("jobTitleId") REFERENCES "JobTitle" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkExperience_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkExperience_resumeSectionId_fkey" FOREIGN KEY ("resumeSectionId") REFERENCES "ResumeSection" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_WorkExperience" ("companyId", "createdAt", "description", "endDate", "id", "jobTitleId", "locationId", "resumeSectionId", "startDate", "updatedAt") SELECT "companyId", "createdAt", "description", "endDate", "id", "jobTitleId", "locationId", "resumeSectionId", "startDate", "updatedAt" FROM "WorkExperience";
DROP TABLE "WorkExperience";
ALTER TABLE "new_WorkExperience" RENAME TO "WorkExperience";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Reminder_userId_status_idx" ON "Reminder"("userId", "status");

-- CreateIndex
CREATE INDEX "Reminder_taskId_idx" ON "Reminder"("taskId");

-- CreateIndex
CREATE INDEX "Reminder_status_createdAt_idx" ON "Reminder"("status", "createdAt");

-- CreateIndex
CREATE INDEX "EmailLog_userId_sentAt_idx" ON "EmailLog"("userId", "sentAt");
