// CAREERFLOW: ported from Tomiwajin/CareerSync `app/api/process-emails/route.ts`
// `extractEmailBody`. Decodes Gmail base64url message payloads and strips
// HTML to a plain-text body suitable for classification. Bodies are never
// persisted (PRD §13 privacy); only the truncated text is passed to the
// classifier.

import type { gmail_v1 } from "googleapis";

function decode(data: string): string {
  // Gmail uses base64url; Node's Buffer base64 accepts both with the right substitutions.
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  try {
    return Buffer.from(normalized, "base64").toString("utf-8");
  } catch {
    return "";
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractEmailBody(
  payload: gmail_v1.Schema$MessagePart | undefined | null,
): string {
  if (!payload) return "";

  const walk = (part: gmail_v1.Schema$MessagePart): string => {
    let text = "";
    if (part.body?.data) {
      const decoded = decode(part.body.data);
      if (part.mimeType?.includes("text/html")) {
        text += stripHtml(decoded) + "\n";
      } else if (part.mimeType?.includes("text/plain")) {
        text += decoded.replace(/\s+/g, " ").trim() + "\n";
      }
    }
    if (part.parts) {
      for (const child of part.parts) {
        text += walk(child);
      }
    }
    return text;
  };

  return walk(payload).trim();
}
