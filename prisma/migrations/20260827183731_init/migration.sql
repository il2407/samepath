-- CreateEnum
CREATE TYPE "TagKind" AS ENUM ('SKILL', 'DOMAIN', 'TOPIC');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'PAUSED', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('MEMBER', 'MODERATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "AuthProviderType" AS ENUM ('EMAIL');

-- CreateEnum
CREATE TYPE "VerificationPurpose" AS ENUM ('REGISTER', 'LOGIN', 'EMAIL_CHANGE');

-- CreateEnum
CREATE TYPE "ProfileStatus" AS ENUM ('DRAFT', 'PENDING_PRIVACY', 'INCOMPLETE', 'ACTIVE', 'PAUSED');

-- CreateEnum
CREATE TYPE "AvailabilityStatus" AS ENUM ('AVAILABLE', 'PAUSED');

-- CreateEnum
CREATE TYPE "ResumeRetentionPreference" AS ENUM ('DELETE_AFTER_CONFIRMATION', 'KEEP');

-- CreateEnum
CREATE TYPE "EmploymentSource" AS ENUM ('RESUME', 'MANUAL');

-- CreateEnum
CREATE TYPE "ConnectionFormatPreference" AS ENUM ('ONE_ON_ONE', 'GROUP', 'BOTH');

-- CreateEnum
CREATE TYPE "ConnectionCadence" AS ENUM ('ONE_TIME', 'RECURRING', 'BOTH');

-- CreateEnum
CREATE TYPE "ConnectionModePreference" AS ENUM ('ONLINE', 'IN_PERSON', 'BOTH');

-- CreateEnum
CREATE TYPE "ConnectionReason" AS ENUM ('SHARE_JOB_SEARCH', 'ACCOUNTABILITY', 'PROFESSIONAL_DISCUSSION', 'LEARNING_TOGETHER', 'CODING_PRACTICE', 'SYSTEM_DESIGN', 'INTERVIEW_SIMULATION', 'OTHER');

-- CreateEnum
CREATE TYPE "DisplayNamePreference" AS ENUM ('ALIAS', 'FIRST_NAME');

-- CreateEnum
CREATE TYPE "CompanyNormalizationStatus" AS ENUM ('CONFIRMED', 'NEEDS_REVIEW', 'MERGED');

-- CreateEnum
CREATE TYPE "BlockedCompanyReason" AS ENUM ('FORMER_EMPLOYER', 'INTERVIEWING', 'CLIENT_OR_VENDOR', 'OTHER');

-- CreateEnum
CREATE TYPE "PrivacyAuditContext" AS ENUM ('MATCH', 'GROUP', 'SESSION', 'CONNECTION');

-- CreateEnum
CREATE TYPE "PrivacyAuditDecision" AS ENUM ('ALLOW', 'REJECT');

-- CreateEnum
CREATE TYPE "ResumeUploadStatus" AS ENUM ('UPLOADED', 'SCANNING', 'READY', 'REJECTED', 'DELETED');

-- CreateEnum
CREATE TYPE "ResumeJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "ParserSource" AS ENUM ('DETERMINISTIC', 'AI');

-- CreateEnum
CREATE TYPE "ConfirmationType" AS ENUM ('EMPLOYER_CONFIRMED', 'RESUME_DRAFT_CONFIRMED', 'PRIVACY_ONBOARDING_CONFIRMED');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('PROPOSED', 'INTERESTED_BY_A', 'INTERESTED_BY_B', 'MUTUALLY_ACCEPTED', 'PAYMENT_PENDING', 'ACCESS_CHECK', 'ACTIVE', 'DECLINED', 'EXPIRED', 'BLOCKED', 'REPORTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MatchDecisionType" AS ENUM ('INTERESTED', 'NOT_NOW', 'NOT_RELEVANT', 'NEVER_AGAIN', 'REPORT');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('ACTIVE', 'ENDED', 'BLOCKED', 'REPORTED');

-- CreateEnum
CREATE TYPE "ReportCategory" AS ENUM ('SAFETY_CONCERN', 'HARASSMENT', 'SPAM', 'FAKE_PROFILE', 'PRIVACY_CONCERN', 'NO_SHOW', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "GroupMode" AS ENUM ('ONLINE', 'IN_PERSON');

-- CreateEnum
CREATE TYPE "GroupStatus" AS ENUM ('DRAFT', 'OPEN', 'FULL', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "GroupMembershipStatus" AS ENUM ('REQUESTED', 'APPROVED', 'ACTIVE', 'LEFT', 'REMOVED');

-- CreateEnum
CREATE TYPE "GuideFormat" AS ENUM ('ONE_ON_ONE', 'GROUP', 'BOTH');

-- CreateEnum
CREATE TYPE "GuideStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "GuideStepKind" AS ENUM ('AGENDA', 'PROMPT', 'FOLLOWUP');

-- CreateEnum
CREATE TYPE "InterviewStage" AS ENUM ('RECRUITER_SCREEN', 'TECHNICAL_SCREEN', 'CODING', 'SYSTEM_DESIGN', 'BEHAVIORAL', 'HIRING_MANAGER', 'TAKE_HOME', 'FINAL_ROUND', 'OTHER');

-- CreateEnum
CREATE TYPE "InterviewFormat" AS ENUM ('ONLINE', 'ONSITE', 'PAIR_PROGRAMMING', 'WRITTEN_EXERCISE', 'CONVERSATION', 'OTHER');

-- CreateEnum
CREATE TYPE "InterviewOutcome" AS ENUM ('OFFER', 'REJECTED', 'NO_RESPONSE', 'WITHDREW', 'IN_PROGRESS');

-- CreateEnum
CREATE TYPE "ExperienceStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'NEEDS_CHANGES', 'APPROVED', 'SCHEDULED_FOR_PUBLICATION', 'PUBLISHED', 'REJECTED', 'REMOVED', 'WITHDRAWN_BY_AUTHOR');

-- CreateEnum
CREATE TYPE "ModerationActionType" AS ENUM ('APPROVE', 'REQUEST_CHANGES', 'REJECT', 'REMOVE', 'RESTORE');

-- CreateEnum
CREATE TYPE "ValidationType" AS ENUM ('SIMILAR_QUESTION', 'RESEMBLES_PROCESS', 'OUTDATED', 'DUPLICATE', 'CONFIDENTIAL_CONCERN', 'USEFUL');

-- CreateEnum
CREATE TYPE "ContentReportReason" AS ENUM ('PERSONAL_DATA', 'CONFIDENTIAL_INFO', 'FABRICATED', 'DUPLICATE', 'OFFENSIVE', 'OTHER');

-- CreateEnum
CREATE TYPE "TakedownStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CreditReason" AS ENUM ('CONTRIBUTION_APPROVED', 'UNIQUE_QUESTION_BONUS', 'VALIDATION_BONUS', 'CONVERSION', 'REVERSAL', 'ADMIN_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('CREATED', 'PENDING', 'PAID', 'FAILED', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AccessPassStatus" AS ENUM ('PENDING_ACTIVATION', 'ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ActivationEventType" AS ENUM ('FIRST_MUTUAL_CONNECTION', 'FIRST_GROUP_JOIN', 'MANUAL');

-- CreateEnum
CREATE TYPE "AccessPassEventType" AS ENUM ('CREATED', 'ACTIVATED', 'EXTENDED', 'EXPIRED', 'CANCELLED', 'REPLACEMENT_GRANTED');

-- CreateTable
CREATE TABLE "professional_fields" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "labelHe" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "professional_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "target_roles" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "professionalFieldId" TEXT NOT NULL,
    "labelHe" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "target_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seniority_bands" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "labelHe" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "minMonths" INTEGER NOT NULL,
    "maxMonths" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "seniority_bands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "languages" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "labelHe" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,

    CONSTRAINT "languages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "labelHe" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "kind" TEXT NOT NULL,

    CONSTRAINT "regions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "kind" "TagKind" NOT NULL,
    "slug" TEXT NOT NULL,
    "labelHe" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "role" "UserRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_identities" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "AuthProviderType" NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,
    "ipHash" TEXT,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_verifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" "VerificationPurpose" NOT NULL,
    "codeHash" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "requestIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "professional_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "professionalFieldId" TEXT,
    "currentRoleTitle" TEXT,
    "seniorityBandId" TEXT,
    "experienceMonths" INTEGER NOT NULL DEFAULT 0,
    "regionId" TEXT,
    "shortIntro" VARCHAR(400),
    "availabilityStatus" "AvailabilityStatus" NOT NULL DEFAULT 'AVAILABLE',
    "status" "ProfileStatus" NOT NULL DEFAULT 'DRAFT',
    "currentCompanyId" TEXT,
    "currentCompanyConfirmedAt" TIMESTAMP(3),
    "resumeRetentionPreference" "ResumeRetentionPreference" NOT NULL DEFAULT 'DELETE_AFTER_CONFIRMATION',
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "professional_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_target_roles" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "targetRoleId" TEXT NOT NULL,

    CONSTRAINT "profile_target_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_tags" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "profile_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_languages" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "languageId" TEXT NOT NULL,

    CONSTRAINT "profile_languages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employment_positions" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "companyId" TEXT,
    "companyRaw" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "source" "EmploymentSource" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employment_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability_slots" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,

    CONSTRAINT "availability_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connection_preferences" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "peerMinExperienceMonths" INTEGER NOT NULL DEFAULT 0,
    "peerMaxExperienceMonths" INTEGER NOT NULL DEFAULT 240,
    "format" "ConnectionFormatPreference" NOT NULL DEFAULT 'BOTH',
    "cadence" "ConnectionCadence" NOT NULL DEFAULT 'BOTH',
    "mode" "ConnectionModePreference" NOT NULL DEFAULT 'BOTH',
    "languageId" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Jerusalem',
    "reasons" "ConnectionReason"[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "connection_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity_disclosure_preferences" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "preMatchDisplayMode" "DisplayNamePreference" NOT NULL DEFAULT 'ALIAS',
    "aliasText" TEXT,
    "firstName" TEXT,
    "shareFullNamePostMatch" BOOLEAN NOT NULL DEFAULT false,
    "sharePhotoPostMatch" BOOLEAN NOT NULL DEFAULT false,
    "shareLinkedInPostMatch" BOOLEAN NOT NULL DEFAULT false,
    "linkedInUrl" TEXT,
    "sharePreciseLocationPostMatch" BOOLEAN NOT NULL DEFAULT false,
    "shareEmailPostMatch" BOOLEAN NOT NULL DEFAULT false,
    "sharePhonePostMatch" BOOLEAN NOT NULL DEFAULT false,
    "phoneNumber" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "identity_disclosure_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corporate_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "corporate_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "domain" TEXT,
    "corporateGroupId" TEXT,
    "normalizationStatus" "CompanyNormalizationStatus" NOT NULL DEFAULT 'CONFIRMED',
    "mergedIntoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_aliases" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocked_companies" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "reason" "BlockedCompanyReason" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocked_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocked_users" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "blockedUserId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocked_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "privacy_preferences" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "blockEntireCorporateGroup" BOOLEAN NOT NULL DEFAULT true,
    "onboardingCompletedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "privacy_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "privacy_decision_audits" (
    "id" TEXT NOT NULL,
    "subjectUserId" TEXT NOT NULL,
    "candidateUserId" TEXT,
    "context" "PrivacyAuditContext" NOT NULL,
    "contextId" TEXT,
    "decision" "PrivacyAuditDecision" NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "privacy_decision_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resume_uploads" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "status" "ResumeUploadStatus" NOT NULL DEFAULT 'UPLOADED',
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "resume_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resume_extraction_jobs" (
    "id" TEXT NOT NULL,
    "resumeUploadId" TEXT NOT NULL,
    "status" "ResumeJobStatus" NOT NULL DEFAULT 'QUEUED',
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resume_extraction_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resume_extraction_drafts" (
    "id" TEXT NOT NULL,
    "resumeExtractionJobId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "extractedJson" JSONB NOT NULL,
    "parserVersion" TEXT NOT NULL,
    "parserSource" "ParserSource" NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resume_extraction_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_confirmations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ConfirmationType" NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_confirmations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_suggestions" (
    "id" TEXT NOT NULL,
    "userAId" TEXT NOT NULL,
    "userBId" TEXT NOT NULL,
    "profileAId" TEXT NOT NULL,
    "profileBId" TEXT NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'PROPOSED',
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "match_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_score_breakdowns" (
    "id" TEXT NOT NULL,
    "matchSuggestionId" TEXT NOT NULL,
    "targetRoleScore" DOUBLE PRECISION NOT NULL,
    "fieldScore" DOUBLE PRECISION NOT NULL,
    "experienceScore" DOUBLE PRECISION NOT NULL,
    "availabilityScore" DOUBLE PRECISION NOT NULL,
    "skillsScore" DOUBLE PRECISION NOT NULL,
    "languageScore" DOUBLE PRECISION NOT NULL,
    "totalScore" DOUBLE PRECISION NOT NULL,
    "weightsVersion" TEXT NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_score_breakdowns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_decisions" (
    "id" TEXT NOT NULL,
    "matchSuggestionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "decision" "MatchDecisionType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connections" (
    "id" TEXT NOT NULL,
    "matchSuggestionId" TEXT NOT NULL,
    "userAId" TEXT NOT NULL,
    "userBId" TEXT NOT NULL,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connection_messages" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" VARCHAR(4000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "connection_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_statuses" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "markedByUserId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meeting_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reportedUserId" TEXT,
    "connectionId" TEXT,
    "matchSuggestionId" TEXT,
    "groupId" TEXT,
    "category" "ReportCategory" NOT NULL,
    "description" VARCHAR(2000) NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByUserId" TEXT,
    "resolutionNote" TEXT,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "groups" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "professionalFieldId" TEXT,
    "targetRoleId" TEXT,
    "minSeniorityBandId" TEXT,
    "maxSeniorityBandId" TEXT,
    "languageId" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Jerusalem',
    "mode" "GroupMode" NOT NULL DEFAULT 'ONLINE',
    "schedule" TEXT,
    "capacityMin" INTEGER NOT NULL DEFAULT 4,
    "capacityMax" INTEGER NOT NULL DEFAULT 6,
    "status" "GroupStatus" NOT NULL DEFAULT 'DRAFT',
    "theme" TEXT,
    "seriesLength" INTEGER,
    "guideId" TEXT,
    "createdByUserId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_memberships" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "GroupMembershipStatus" NOT NULL DEFAULT 'REQUESTED',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "group_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_waitlist_entries" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedAt" TIMESTAMP(3),

    CONSTRAINT "group_waitlist_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_guides" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "purpose" VARCHAR(1000) NOT NULL,
    "suggestedDurationMinutes" INTEGER NOT NULL,
    "format" "GuideFormat" NOT NULL DEFAULT 'BOTH',
    "category" TEXT,
    "status" "GuideStatus" NOT NULL DEFAULT 'DRAFT',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_guides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_guide_steps" (
    "id" TEXT NOT NULL,
    "guideId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "prompt" VARCHAR(2000) NOT NULL,
    "kind" "GuideStepKind" NOT NULL DEFAULT 'AGENDA',

    CONSTRAINT "session_guide_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_experiences" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "targetRoleId" TEXT,
    "seniorityBandId" TEXT,
    "regionId" TEXT,
    "periodYear" INTEGER NOT NULL,
    "periodQuarter" INTEGER NOT NULL,
    "processDescription" VARCHAR(4000) NOT NULL,
    "whatIWishIKnew" VARCHAR(2000),
    "difficultyRating" INTEGER,
    "usefulnessRating" INTEGER,
    "outcome" "InterviewOutcome",
    "outcomeVisible" BOOLEAN NOT NULL DEFAULT false,
    "status" "ExperienceStatus" NOT NULL DEFAULT 'DRAFT',
    "publishAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "professionalFieldId" TEXT,

    CONSTRAINT "interview_experiences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_experience_stages" (
    "id" TEXT NOT NULL,
    "experienceId" TEXT NOT NULL,
    "stage" "InterviewStage" NOT NULL,
    "format" "InterviewFormat" NOT NULL,
    "approxDurationMinutes" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "interview_experience_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_questions" (
    "id" TEXT NOT NULL,
    "experienceId" TEXT NOT NULL,
    "stageId" TEXT,
    "text" VARCHAR(2000) NOT NULL,
    "isFollowUp" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interview_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_experience_topics" (
    "id" TEXT NOT NULL,
    "experienceId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "interview_experience_topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_question_topics" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "interview_question_topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contribution_reviews" (
    "id" TEXT NOT NULL,
    "experienceId" TEXT NOT NULL,
    "moderatorId" TEXT NOT NULL,
    "action" "ModerationActionType" NOT NULL,
    "notes" VARCHAR(2000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contribution_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contribution_revision_requests" (
    "id" TEXT NOT NULL,
    "experienceId" TEXT NOT NULL,
    "moderatorId" TEXT NOT NULL,
    "message" VARCHAR(2000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "contribution_revision_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contribution_attestations" (
    "id" TEXT NOT NULL,
    "experienceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "attestedOwnExperience" BOOLEAN NOT NULL,
    "attestedTruthful" BOOLEAN NOT NULL,
    "attestedPermitted" BOOLEAN NOT NULL,
    "attestedNoConfidential" BOOLEAN NOT NULL,
    "attestedParaphrased" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contribution_attestations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contribution_validations" (
    "id" TEXT NOT NULL,
    "experienceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ValidationType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contribution_validations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_reports" (
    "id" TEXT NOT NULL,
    "experienceId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reason" "ContentReportReason" NOT NULL,
    "description" VARCHAR(2000),
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "content_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderation_actions" (
    "id" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "moderatorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" VARCHAR(2000),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "takedown_requests" (
    "id" TEXT NOT NULL,
    "experienceId" TEXT,
    "companyId" TEXT,
    "requesterName" TEXT NOT NULL,
    "requesterEmail" TEXT NOT NULL,
    "reason" VARCHAR(2000) NOT NULL,
    "status" "TakedownStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByUserId" TEXT,
    "resolutionNote" TEXT,

    CONSTRAINT "takedown_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_ledger_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" "CreditReason" NOT NULL,
    "sourceExperienceId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_conversions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "creditsSpent" INTEGER NOT NULL,
    "accessDaysGranted" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_conversions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_policies" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "valueJson" JSONB NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reward_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_configurations" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ILS',
    "accessDurationDays" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productConfigId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'fake',
    "providerRef" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ILS',
    "status" "PaymentStatus" NOT NULL DEFAULT 'CREATED',
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_passes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "paymentId" TEXT,
    "productConfigId" TEXT,
    "status" "AccessPassStatus" NOT NULL DEFAULT 'PENDING_ACTIVATION',
    "activationEventType" "ActivationEventType",
    "activatedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "durationDays" INTEGER NOT NULL,
    "bonusDaysFromCredits" INTEGER NOT NULL DEFAULT 0,
    "isReplacement" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "access_passes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_pass_events" (
    "id" TEXT NOT NULL,
    "accessPassId" TEXT NOT NULL,
    "type" "AccessPassEventType" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_pass_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'EMAIL',
    "payload" JSONB,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "professional_fields_code_key" ON "professional_fields"("code");

-- CreateIndex
CREATE UNIQUE INDEX "target_roles_code_key" ON "target_roles"("code");

-- CreateIndex
CREATE INDEX "target_roles_professionalFieldId_idx" ON "target_roles"("professionalFieldId");

-- CreateIndex
CREATE UNIQUE INDEX "seniority_bands_code_key" ON "seniority_bands"("code");

-- CreateIndex
CREATE UNIQUE INDEX "languages_code_key" ON "languages"("code");

-- CreateIndex
CREATE UNIQUE INDEX "regions_code_key" ON "regions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "tags_kind_slug_key" ON "tags"("kind", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "auth_identities_userId_idx" ON "auth_identities"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "auth_identities_provider_providerAccountId_key" ON "auth_identities"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "email_verifications_tokenHash_key" ON "email_verifications"("tokenHash");

-- CreateIndex
CREATE INDEX "email_verifications_userId_purpose_idx" ON "email_verifications"("userId", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "professional_profiles_userId_key" ON "professional_profiles"("userId");

-- CreateIndex
CREATE INDEX "professional_profiles_professionalFieldId_status_idx" ON "professional_profiles"("professionalFieldId", "status");

-- CreateIndex
CREATE INDEX "professional_profiles_currentCompanyId_idx" ON "professional_profiles"("currentCompanyId");

-- CreateIndex
CREATE UNIQUE INDEX "profile_target_roles_profileId_targetRoleId_key" ON "profile_target_roles"("profileId", "targetRoleId");

-- CreateIndex
CREATE UNIQUE INDEX "profile_tags_profileId_tagId_key" ON "profile_tags"("profileId", "tagId");

-- CreateIndex
CREATE UNIQUE INDEX "profile_languages_profileId_languageId_key" ON "profile_languages"("profileId", "languageId");

-- CreateIndex
CREATE INDEX "employment_positions_profileId_idx" ON "employment_positions"("profileId");

-- CreateIndex
CREATE INDEX "employment_positions_companyId_idx" ON "employment_positions"("companyId");

-- CreateIndex
CREATE INDEX "availability_slots_profileId_idx" ON "availability_slots"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "connection_preferences_profileId_key" ON "connection_preferences"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "identity_disclosure_preferences_profileId_key" ON "identity_disclosure_preferences"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "companies_domain_key" ON "companies"("domain");

-- CreateIndex
CREATE INDEX "companies_corporateGroupId_idx" ON "companies"("corporateGroupId");

-- CreateIndex
CREATE INDEX "company_aliases_alias_idx" ON "company_aliases"("alias");

-- CreateIndex
CREATE UNIQUE INDEX "company_aliases_companyId_alias_key" ON "company_aliases"("companyId", "alias");

-- CreateIndex
CREATE INDEX "blocked_companies_companyId_idx" ON "blocked_companies"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "blocked_companies_userId_companyId_key" ON "blocked_companies"("userId", "companyId");

-- CreateIndex
CREATE INDEX "blocked_users_blockedUserId_idx" ON "blocked_users"("blockedUserId");

-- CreateIndex
CREATE UNIQUE INDEX "blocked_users_userId_blockedUserId_key" ON "blocked_users"("userId", "blockedUserId");

-- CreateIndex
CREATE UNIQUE INDEX "privacy_preferences_profileId_key" ON "privacy_preferences"("profileId");

-- CreateIndex
CREATE INDEX "privacy_decision_audits_subjectUserId_createdAt_idx" ON "privacy_decision_audits"("subjectUserId", "createdAt");

-- CreateIndex
CREATE INDEX "resume_uploads_userId_idx" ON "resume_uploads"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "resume_extraction_jobs_resumeUploadId_key" ON "resume_extraction_jobs"("resumeUploadId");

-- CreateIndex
CREATE UNIQUE INDEX "resume_extraction_drafts_resumeExtractionJobId_key" ON "resume_extraction_drafts"("resumeExtractionJobId");

-- CreateIndex
CREATE INDEX "resume_extraction_drafts_userId_idx" ON "resume_extraction_drafts"("userId");

-- CreateIndex
CREATE INDEX "user_confirmations_userId_type_idx" ON "user_confirmations"("userId", "type");

-- CreateIndex
CREATE INDEX "match_suggestions_userAId_status_idx" ON "match_suggestions"("userAId", "status");

-- CreateIndex
CREATE INDEX "match_suggestions_userBId_status_idx" ON "match_suggestions"("userBId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "match_score_breakdowns_matchSuggestionId_key" ON "match_score_breakdowns"("matchSuggestionId");

-- CreateIndex
CREATE UNIQUE INDEX "match_decisions_matchSuggestionId_userId_key" ON "match_decisions"("matchSuggestionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "connections_matchSuggestionId_key" ON "connections"("matchSuggestionId");

-- CreateIndex
CREATE INDEX "connections_userAId_status_idx" ON "connections"("userAId", "status");

-- CreateIndex
CREATE INDEX "connections_userBId_status_idx" ON "connections"("userBId", "status");

-- CreateIndex
CREATE INDEX "connection_messages_connectionId_createdAt_idx" ON "connection_messages"("connectionId", "createdAt");

-- CreateIndex
CREATE INDEX "meeting_statuses_connectionId_idx" ON "meeting_statuses"("connectionId");

-- CreateIndex
CREATE INDEX "reports_status_idx" ON "reports"("status");

-- CreateIndex
CREATE INDEX "reports_reportedUserId_idx" ON "reports"("reportedUserId");

-- CreateIndex
CREATE INDEX "groups_status_idx" ON "groups"("status");

-- CreateIndex
CREATE INDEX "group_memberships_userId_idx" ON "group_memberships"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "group_memberships_groupId_userId_key" ON "group_memberships"("groupId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "group_waitlist_entries_groupId_userId_key" ON "group_waitlist_entries"("groupId", "userId");

-- CreateIndex
CREATE INDEX "session_guide_steps_guideId_order_idx" ON "session_guide_steps"("guideId", "order");

-- CreateIndex
CREATE INDEX "interview_experiences_companyId_status_idx" ON "interview_experiences"("companyId", "status");

-- CreateIndex
CREATE INDEX "interview_experiences_status_publishAt_idx" ON "interview_experiences"("status", "publishAt");

-- CreateIndex
CREATE INDEX "interview_experience_stages_experienceId_order_idx" ON "interview_experience_stages"("experienceId", "order");

-- CreateIndex
CREATE INDEX "interview_questions_experienceId_order_idx" ON "interview_questions"("experienceId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "interview_experience_topics_experienceId_tagId_key" ON "interview_experience_topics"("experienceId", "tagId");

-- CreateIndex
CREATE UNIQUE INDEX "interview_question_topics_questionId_tagId_key" ON "interview_question_topics"("questionId", "tagId");

-- CreateIndex
CREATE INDEX "contribution_reviews_experienceId_idx" ON "contribution_reviews"("experienceId");

-- CreateIndex
CREATE INDEX "contribution_revision_requests_experienceId_idx" ON "contribution_revision_requests"("experienceId");

-- CreateIndex
CREATE UNIQUE INDEX "contribution_attestations_experienceId_key" ON "contribution_attestations"("experienceId");

-- CreateIndex
CREATE UNIQUE INDEX "contribution_validations_experienceId_userId_type_key" ON "contribution_validations"("experienceId", "userId", "type");

-- CreateIndex
CREATE INDEX "content_reports_experienceId_status_idx" ON "content_reports"("experienceId", "status");

-- CreateIndex
CREATE INDEX "moderation_actions_targetType_targetId_idx" ON "moderation_actions"("targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "credit_ledger_entries_idempotencyKey_key" ON "credit_ledger_entries"("idempotencyKey");

-- CreateIndex
CREATE INDEX "credit_ledger_entries_userId_idx" ON "credit_ledger_entries"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "reward_policies_key_key" ON "reward_policies"("key");

-- CreateIndex
CREATE UNIQUE INDEX "product_configurations_key_key" ON "product_configurations"("key");

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotencyKey_key" ON "payments"("idempotencyKey");

-- CreateIndex
CREATE INDEX "payments_userId_idx" ON "payments"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "access_passes_paymentId_key" ON "access_passes"("paymentId");

-- CreateIndex
CREATE INDEX "access_passes_userId_status_idx" ON "access_passes"("userId", "status");

-- CreateIndex
CREATE INDEX "access_pass_events_accessPassId_idx" ON "access_pass_events"("accessPassId");

-- CreateIndex
CREATE INDEX "notification_logs_userId_type_idx" ON "notification_logs"("userId", "type");

-- AddForeignKey
ALTER TABLE "target_roles" ADD CONSTRAINT "target_roles_professionalFieldId_fkey" FOREIGN KEY ("professionalFieldId") REFERENCES "professional_fields"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_verifications" ADD CONSTRAINT "email_verifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_profiles" ADD CONSTRAINT "professional_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_profiles" ADD CONSTRAINT "professional_profiles_professionalFieldId_fkey" FOREIGN KEY ("professionalFieldId") REFERENCES "professional_fields"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_profiles" ADD CONSTRAINT "professional_profiles_seniorityBandId_fkey" FOREIGN KEY ("seniorityBandId") REFERENCES "seniority_bands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_profiles" ADD CONSTRAINT "professional_profiles_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_profiles" ADD CONSTRAINT "professional_profiles_currentCompanyId_fkey" FOREIGN KEY ("currentCompanyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_target_roles" ADD CONSTRAINT "profile_target_roles_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "professional_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_target_roles" ADD CONSTRAINT "profile_target_roles_targetRoleId_fkey" FOREIGN KEY ("targetRoleId") REFERENCES "target_roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_tags" ADD CONSTRAINT "profile_tags_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "professional_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_tags" ADD CONSTRAINT "profile_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_languages" ADD CONSTRAINT "profile_languages_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "professional_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_languages" ADD CONSTRAINT "profile_languages_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "languages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_positions" ADD CONSTRAINT "employment_positions_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "professional_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_positions" ADD CONSTRAINT "employment_positions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_slots" ADD CONSTRAINT "availability_slots_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "professional_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connection_preferences" ADD CONSTRAINT "connection_preferences_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "professional_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connection_preferences" ADD CONSTRAINT "connection_preferences_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "languages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_disclosure_preferences" ADD CONSTRAINT "identity_disclosure_preferences_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "professional_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_corporateGroupId_fkey" FOREIGN KEY ("corporateGroupId") REFERENCES "corporate_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_aliases" ADD CONSTRAINT "company_aliases_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocked_companies" ADD CONSTRAINT "blocked_companies_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocked_companies" ADD CONSTRAINT "blocked_companies_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocked_users" ADD CONSTRAINT "blocked_users_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocked_users" ADD CONSTRAINT "blocked_users_blockedUserId_fkey" FOREIGN KEY ("blockedUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "privacy_preferences" ADD CONSTRAINT "privacy_preferences_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "professional_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "privacy_decision_audits" ADD CONSTRAINT "privacy_decision_audits_subjectUserId_fkey" FOREIGN KEY ("subjectUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "privacy_decision_audits" ADD CONSTRAINT "privacy_decision_audits_candidateUserId_fkey" FOREIGN KEY ("candidateUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_uploads" ADD CONSTRAINT "resume_uploads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_extraction_jobs" ADD CONSTRAINT "resume_extraction_jobs_resumeUploadId_fkey" FOREIGN KEY ("resumeUploadId") REFERENCES "resume_uploads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_extraction_drafts" ADD CONSTRAINT "resume_extraction_drafts_resumeExtractionJobId_fkey" FOREIGN KEY ("resumeExtractionJobId") REFERENCES "resume_extraction_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_extraction_drafts" ADD CONSTRAINT "resume_extraction_drafts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_confirmations" ADD CONSTRAINT "user_confirmations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_suggestions" ADD CONSTRAINT "match_suggestions_userAId_fkey" FOREIGN KEY ("userAId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_suggestions" ADD CONSTRAINT "match_suggestions_userBId_fkey" FOREIGN KEY ("userBId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_suggestions" ADD CONSTRAINT "match_suggestions_profileAId_fkey" FOREIGN KEY ("profileAId") REFERENCES "professional_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_suggestions" ADD CONSTRAINT "match_suggestions_profileBId_fkey" FOREIGN KEY ("profileBId") REFERENCES "professional_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_score_breakdowns" ADD CONSTRAINT "match_score_breakdowns_matchSuggestionId_fkey" FOREIGN KEY ("matchSuggestionId") REFERENCES "match_suggestions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_decisions" ADD CONSTRAINT "match_decisions_matchSuggestionId_fkey" FOREIGN KEY ("matchSuggestionId") REFERENCES "match_suggestions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_decisions" ADD CONSTRAINT "match_decisions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connections" ADD CONSTRAINT "connections_matchSuggestionId_fkey" FOREIGN KEY ("matchSuggestionId") REFERENCES "match_suggestions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connections" ADD CONSTRAINT "connections_userAId_fkey" FOREIGN KEY ("userAId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connections" ADD CONSTRAINT "connections_userBId_fkey" FOREIGN KEY ("userBId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connection_messages" ADD CONSTRAINT "connection_messages_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connection_messages" ADD CONSTRAINT "connection_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_statuses" ADD CONSTRAINT "meeting_statuses_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_statuses" ADD CONSTRAINT "meeting_statuses_markedByUserId_fkey" FOREIGN KEY ("markedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reportedUserId_fkey" FOREIGN KEY ("reportedUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_matchSuggestionId_fkey" FOREIGN KEY ("matchSuggestionId") REFERENCES "match_suggestions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_professionalFieldId_fkey" FOREIGN KEY ("professionalFieldId") REFERENCES "professional_fields"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_targetRoleId_fkey" FOREIGN KEY ("targetRoleId") REFERENCES "target_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_minSeniorityBandId_fkey" FOREIGN KEY ("minSeniorityBandId") REFERENCES "seniority_bands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_maxSeniorityBandId_fkey" FOREIGN KEY ("maxSeniorityBandId") REFERENCES "seniority_bands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "languages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "session_guides"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_waitlist_entries" ADD CONSTRAINT "group_waitlist_entries_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_waitlist_entries" ADD CONSTRAINT "group_waitlist_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_guides" ADD CONSTRAINT "session_guides_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_guide_steps" ADD CONSTRAINT "session_guide_steps_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "session_guides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_experiences" ADD CONSTRAINT "interview_experiences_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_experiences" ADD CONSTRAINT "interview_experiences_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_experiences" ADD CONSTRAINT "interview_experiences_targetRoleId_fkey" FOREIGN KEY ("targetRoleId") REFERENCES "target_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_experiences" ADD CONSTRAINT "interview_experiences_seniorityBandId_fkey" FOREIGN KEY ("seniorityBandId") REFERENCES "seniority_bands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_experiences" ADD CONSTRAINT "interview_experiences_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_experiences" ADD CONSTRAINT "interview_experiences_professionalFieldId_fkey" FOREIGN KEY ("professionalFieldId") REFERENCES "professional_fields"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_experience_stages" ADD CONSTRAINT "interview_experience_stages_experienceId_fkey" FOREIGN KEY ("experienceId") REFERENCES "interview_experiences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_questions" ADD CONSTRAINT "interview_questions_experienceId_fkey" FOREIGN KEY ("experienceId") REFERENCES "interview_experiences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_questions" ADD CONSTRAINT "interview_questions_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "interview_experience_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_experience_topics" ADD CONSTRAINT "interview_experience_topics_experienceId_fkey" FOREIGN KEY ("experienceId") REFERENCES "interview_experiences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_experience_topics" ADD CONSTRAINT "interview_experience_topics_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_question_topics" ADD CONSTRAINT "interview_question_topics_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "interview_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_question_topics" ADD CONSTRAINT "interview_question_topics_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contribution_reviews" ADD CONSTRAINT "contribution_reviews_experienceId_fkey" FOREIGN KEY ("experienceId") REFERENCES "interview_experiences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contribution_reviews" ADD CONSTRAINT "contribution_reviews_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contribution_revision_requests" ADD CONSTRAINT "contribution_revision_requests_experienceId_fkey" FOREIGN KEY ("experienceId") REFERENCES "interview_experiences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contribution_revision_requests" ADD CONSTRAINT "contribution_revision_requests_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contribution_attestations" ADD CONSTRAINT "contribution_attestations_experienceId_fkey" FOREIGN KEY ("experienceId") REFERENCES "interview_experiences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contribution_attestations" ADD CONSTRAINT "contribution_attestations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contribution_validations" ADD CONSTRAINT "contribution_validations_experienceId_fkey" FOREIGN KEY ("experienceId") REFERENCES "interview_experiences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contribution_validations" ADD CONSTRAINT "contribution_validations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_experienceId_fkey" FOREIGN KEY ("experienceId") REFERENCES "interview_experiences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "takedown_requests" ADD CONSTRAINT "takedown_requests_experienceId_fkey" FOREIGN KEY ("experienceId") REFERENCES "interview_experiences"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "takedown_requests" ADD CONSTRAINT "takedown_requests_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "takedown_requests" ADD CONSTRAINT "takedown_requests_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_ledger_entries" ADD CONSTRAINT "credit_ledger_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_ledger_entries" ADD CONSTRAINT "credit_ledger_entries_sourceExperienceId_fkey" FOREIGN KEY ("sourceExperienceId") REFERENCES "interview_experiences"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_conversions" ADD CONSTRAINT "credit_conversions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_productConfigId_fkey" FOREIGN KEY ("productConfigId") REFERENCES "product_configurations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_passes" ADD CONSTRAINT "access_passes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_passes" ADD CONSTRAINT "access_passes_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_passes" ADD CONSTRAINT "access_passes_productConfigId_fkey" FOREIGN KEY ("productConfigId") REFERENCES "product_configurations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_pass_events" ADD CONSTRAINT "access_pass_events_accessPassId_fkey" FOREIGN KEY ("accessPassId") REFERENCES "access_passes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
