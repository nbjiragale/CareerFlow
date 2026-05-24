// CAREERFLOW: built-in keyword classifier used when HUGGINGFACE_SPACE_URL
// is unset. Deliberately low-precision: assigns confidence 0.6, which is
// below the default 0.7 threshold so every result lands in the Needs
// Review queue and the user explicitly confirms each one. The corrections
// feed EmailClassificationCorrection for future fine-tuning.

import {
  normalizeLabel,
  type ClassifierLabel,
} from "./labels";

export interface ClassifierResult {
  label: ClassifierLabel;
  confidence: number;
  company?: string;
  role?: string;
}

const KEYWORD_CONFIDENCE = 0.6;

interface Rule {
  label: ClassifierLabel;
  patterns: RegExp[];
}

// Order matters: first match wins. Stronger signals (Offer, Rejected) go
// before weaker ones (Applied).
const RULES: Rule[] = [
  {
    label: "Offer",
    patterns: [
      /\b(offer letter|job offer|excited to (?:offer|extend)|pleased to offer|formal offer|offer of employment)\b/i,
    ],
  },
  {
    label: "Rejected",
    patterns: [
      /\b(unfortunately[, ]|not moving forward|other applicants?|moved forward with another|decided not to (?:move|proceed)|regret to inform|will not be (?:moving forward|proceeding)|after careful (?:consideration|review)|we have decided)\b/i,
    ],
  },
  {
    label: "Interview",
    patterns: [
      /\b(schedule (?:a )?(?:phone |video |technical )?(?:call|interview|chat)|interview invitation|(?:phone|video|technical|coding) (?:screen|interview)|invite you to (?:interview|chat|meet)|book a time|set up a time)\b/i,
    ],
  },
  {
    label: "NextPhase",
    patterns: [
      /\b(next (?:step|round|phase|stage)|moving you forward|final round|onsite (?:interview|round)|advance(?:d)? to the next)\b/i,
    ],
  },
  {
    label: "Applied",
    patterns: [
      /\b(thank you for (?:applying|your application)|application (?:received|confirmation)|we received your application|received your (?:application|submission)|your application (?:has been|was) received|application to .* received)\b/i,
    ],
  },
];

// Lightweight company / role heuristics (intentionally conservative; the
// keyword classifier is a fallback, not the prod path).
const COMPANY_PATTERNS: RegExp[] = [
  /at\s+([A-Z][A-Za-z0-9&.\- ]{1,40}?)(?:\s+(?:for|on|\.|,|!|\?|$))/,
  /application (?:to|at)\s+([A-Z][A-Za-z0-9&.\- ]{1,40}?)(?:\s|\.|,|!|\?|$)/i,
  /position at\s+([A-Z][A-Za-z0-9&.\- ]{1,40}?)(?:\s|\.|,|!|\?|$)/i,
];

const ROLE_PATTERNS: RegExp[] = [
  /(?:for|the)\s+(?:the\s+)?([A-Z][A-Za-z0-9 \-/]{2,60}?)\s+(?:position|role|opening|job)/,
  /(?:position|role) (?:of|as) (?:an?\s+)?([A-Z][A-Za-z0-9 \-/]{2,60}?)(?:\s|\.|,|!|\?|$)/i,
];

function extractFirst(text: string, patterns: RegExp[]): string | undefined {
  for (const re of patterns) {
    const m = text.match(re);
    if (m && m[1]) {
      const candidate = m[1].trim();
      if (candidate.length >= 2 && candidate.length <= 80) {
        return candidate;
      }
    }
  }
  return undefined;
}

export function classifyKeyword(text: string): ClassifierResult {
  const normalized = text.replace(/\s+/g, " ").trim();
  let label: ClassifierLabel = "NotJobRelated";

  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(normalized))) {
      label = rule.label;
      break;
    }
  }

  const result: ClassifierResult = {
    label,
    confidence: label === "NotJobRelated" ? 0.0 : KEYWORD_CONFIDENCE,
  };

  if (label !== "NotJobRelated") {
    const company = extractFirst(normalized, COMPANY_PATTERNS);
    const role = extractFirst(normalized, ROLE_PATTERNS);
    if (company) result.company = company;
    if (role) result.role = role;
  }

  return result;
}

export function classifyKeywordBatch(texts: string[]): ClassifierResult[] {
  return texts.map(classifyKeyword);
}

// Re-export for callers that don't want to import from `labels` directly.
export { normalizeLabel };
