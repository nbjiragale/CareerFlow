// CAREERFLOW: ported from Tomiwajin/CareerSync `lib/email-utils.ts`
// (MIT licensed). Used only for sender-exclusion filtering, NOT for
// classification. Supports exact, @domain, *@domain wildcard, and
// substring matches.

export function shouldExcludeEmail(
  emailAddress: string,
  excludedEmails: string[],
): boolean {
  if (!excludedEmails || excludedEmails.length === 0) {
    return false;
  }

  const normalizedEmail = emailAddress.toLowerCase().trim();
  const extractedEmail =
    normalizedEmail.match(/<(.+)>/)?.[1] || normalizedEmail;

  return excludedEmails.some((excludedEmail) => {
    const normalizedExcluded = excludedEmail.toLowerCase().trim();
    if (!normalizedExcluded) return false;

    if (extractedEmail === normalizedExcluded) return true;

    if (
      normalizedExcluded.startsWith("@") &&
      extractedEmail.endsWith(normalizedExcluded)
    ) {
      return true;
    }

    if (normalizedExcluded.startsWith("*@")) {
      const domain = normalizedExcluded.substring(2);
      return extractedEmail.endsWith(`@${domain}`);
    }

    return extractedEmail.includes(normalizedExcluded);
  });
}
