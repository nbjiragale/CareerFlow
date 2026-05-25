export { getModel, type ProviderType } from "./providers";
export {
  ResumeReviewSchema,
  JobMatchSchema,
  ResumeTailorSchema,
  type ResumeReviewResponse,
  type JobMatchResponse,
  type ResumeTailorResponse,
} from "@/models/ai.schemas";

// Prompts
export {
  RESUME_REVIEW_SYSTEM_PROMPT,
  JOB_MATCH_SYSTEM_PROMPT,
  RESUME_TAILOR_SYSTEM_PROMPT,
  buildResumeReviewPrompt,
  buildJobMatchPrompt,
  buildResumeTailorPrompt,
} from "./prompts";

// Analysis tools
export { AIUnavailableError } from "./tools";

// Resume preprocessing
export {
  preprocessResume,
  convertResumeToText,
  type PreprocessingResult,
  type ResumeMetadata,
  type PreprocessedResume,
} from "./tools/preprocessing";

// Job preprocessing
export {
  preprocessJob,
  convertJobToText,
  type JobPreprocessingResult,
  type JobMetadata,
  type PreprocessedJob,
} from "./tools/preprocessing-job";

// Shared text processing utilities
export {
  removeHtmlTags,
  normalizeWhitespace,
  normalizeBullets,
  normalizeHeadings,
  extractMetadata,
  validateText,
  type TextMetadata,
} from "./tools/text-processing";

export { checkRateLimit } from "./rate-limiter";

// CAREERFLOW: structured-output helpers (fallback-aware wrappers around
// the Vercel AI SDK's generateObject / streamText with Output.object).
export {
  generateStructuredObject,
  structuredObjectToResponse,
  StructuredOutputUnsupportedError,
} from "./structured";
