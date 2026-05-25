// CAREERFLOW: Phase 3 — task reminder email template. Plain-text + HTML.
// Pure render function (no I/O) so it can be unit-tested directly. The email
// transport (src/lib/notifications/transports/email.ts) consumes the output.

export interface TaskReminderPayload {
  taskTitle: string;
  taskDescription?: string | null;
  dueDate?: string | null;
  remindAt?: string | null;
  link?: string | null;
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toUTCString();
}

export function renderTaskReminderEmail(payload: TaskReminderPayload): RenderedEmail {
  const subject = `Reminder: ${payload.taskTitle}`;
  const due = formatDate(payload.dueDate);

  const textLines = ["CareerFlow reminder", "", payload.taskTitle];
  if (payload.taskDescription) textLines.push("", payload.taskDescription);
  if (due) textLines.push("", `Due: ${due}`);
  if (payload.link) textLines.push("", `Open: ${payload.link}`);
  const text = textLines.join("\n");

  const htmlParts = [
    `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto">`,
    `<p style="color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:.05em">CareerFlow reminder</p>`,
    `<h2 style="margin:8px 0">${escapeHtml(payload.taskTitle)}</h2>`,
  ];
  if (payload.taskDescription) {
    htmlParts.push(`<p style="color:#374151">${escapeHtml(payload.taskDescription)}</p>`);
  }
  if (due) {
    htmlParts.push(`<p style="color:#6b7280;font-size:14px">Due: ${escapeHtml(due)}</p>`);
  }
  if (payload.link) {
    htmlParts.push(
      `<p><a href="${escapeHtml(payload.link)}" style="color:#2563eb">Open in CareerFlow</a></p>`,
    );
  }
  htmlParts.push(`</div>`);

  return { subject, text, html: htmlParts.join("") };
}
