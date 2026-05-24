// CAREERFLOW: classifier dispatcher. If HUGGINGFACE_SPACE_URL is set we
// call CareerSync's `/process_batch` Gradio endpoint via @gradio/client.
// Otherwise we fall back to the built-in keyword classifier so first-run
// works with zero configuration.

import "server-only";

import {
  classifyKeywordBatch,
  type ClassifierResult,
} from "./keyword-classifier";
import { normalizeLabel } from "./labels";

export type ClassifierKind = "huggingface" | "keyword";

export interface ClassifyOptions {
  threshold: number;
}

export interface ClassifyBatchResponse {
  kind: ClassifierKind;
  results: ClassifierResult[];
}

interface HfProcessedResult {
  classification?: {
    label?: string;
    score?: number;
    success?: boolean;
  };
  extraction?: {
    company?: string;
    role?: string;
    success?: boolean;
  } | null;
}

interface HfProcessBatchResponse {
  results?: HfProcessedResult[];
}

const MAX_BATCH_SIZE = 100;
const BATCH_DELAY_MS = 150;

export function isHuggingFaceConfigured(): boolean {
  return Boolean(process.env.HUGGINGFACE_SPACE_URL);
}

export function getActiveClassifierKind(): ClassifierKind {
  return isHuggingFaceConfigured() ? "huggingface" : "keyword";
}

// Lazy import so unit tests that don't touch HF never load @gradio/client.
async function classifyHuggingFace(
  texts: string[],
  threshold: number,
): Promise<ClassifierResult[]> {
  const spaceUrl = process.env.HUGGINGFACE_SPACE_URL;
  if (!spaceUrl) throw new Error("HUGGINGFACE_SPACE_URL not configured");

  const { Client } = await import("@gradio/client");
  const client = await Client.connect(spaceUrl);
  const results: ClassifierResult[] = [];

  for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
    const batch = texts.slice(i, i + MAX_BATCH_SIZE);

    const raw = await client.predict("/process_batch", {
      emails_json: JSON.stringify(batch),
      threshold,
    });

    const parsed: HfProcessBatchResponse =
      typeof raw.data === "string"
        ? JSON.parse(raw.data)
        : (raw.data as HfProcessBatchResponse);

    if (!parsed.results || !Array.isArray(parsed.results)) {
      throw new Error("Invalid /process_batch response shape");
    }

    for (const res of parsed.results) {
      const label = normalizeLabel(res.classification?.label ?? "other");
      const confidence = res.classification?.score ?? 0;
      const result: ClassifierResult = {
        label,
        confidence,
      };
      if (res.extraction?.company) result.company = res.extraction.company;
      if (res.extraction?.role) result.role = res.extraction.role;
      results.push(result);
    }

    if (i + MAX_BATCH_SIZE < texts.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  return results;
}

export async function classifyEmails(
  texts: string[],
  options: ClassifyOptions,
): Promise<ClassifyBatchResponse> {
  if (texts.length === 0) {
    return { kind: getActiveClassifierKind(), results: [] };
  }

  if (isHuggingFaceConfigured()) {
    const results = await classifyHuggingFace(texts, options.threshold);
    return { kind: "huggingface", results };
  }

  return { kind: "keyword", results: classifyKeywordBatch(texts) };
}
