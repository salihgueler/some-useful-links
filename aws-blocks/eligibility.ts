/**
 * Sign-up eligibility: only Amazon corporate email addresses may hold accounts.
 *
 * Public link pages stay readable by anyone; this gates account creation and
 * every owner-scoped operation.
 *
 * The allowlist is an EXACT set of full domains, deliberately not a pattern:
 *   - `endsWith("amazon.com")`     would admit `evil-amazon.com`
 *   - `includes("amazon.")`        would admit `amazon.attacker.net`
 *   - `amazon.<second>.<tld>`      would admit `amazon.evil.com`, a subdomain
 *                                  anyone owning evil.com can create
 *   - `amazon.<anyTld>`            would admit any TLD Amazon has not
 *                                  defensively registered
 *
 * Note what this check is and is not. It decides who may ATTEMPT to hold an
 * account. Proof that the address is real comes from Cognito's email
 * confirmation code, which is the actual control. Both are required.
 */

export const ALLOWED_EMAIL_DOMAINS: readonly string[] = [
  "amazon.com",
  "amazon.co.uk",
  "amazon.de",
  "amazon.fr",
];

/** ASCII only, so punycode and Unicode lookalikes of "amazon" cannot pass. */
const LOCAL_PART = /^[a-z0-9](?:[a-z0-9._%+-]{0,62}[a-z0-9])?$/;
const DOMAIN = /^[a-z0-9.-]+$/;

export class NotEligibleError extends Error {
  constructor(message = "This email address is not eligible for an account") {
    super(message);
    this.name = "NotEligibleError";
  }
}

/** Lowercases and NFKC-normalises; does not validate. */
export function normalizeEmail(raw: string): string {
  return raw.normalize("NFKC").trim().toLowerCase();
}

export function isEligibleEmail(candidate: string): boolean {
  const email = normalizeEmail(candidate);
  if (/\s/.test(email)) return false;

  const at = email.lastIndexOf("@");
  if (at < 1 || at === email.length - 1) return false;

  const local = email.slice(0, at);
  const domain = email.slice(at + 1);

  if (!LOCAL_PART.test(local)) return false;
  if (!DOMAIN.test(domain)) return false;

  // Exact membership. A subdomain such as eu.amazon.com does not match unless
  // it is listed explicitly.
  return ALLOWED_EMAIL_DOMAINS.includes(domain);
}

/** Returns the normalised address, or throws NotEligibleError. */
export function assertEligibleEmail(raw: string): string {
  const email = normalizeEmail(raw);
  if (!isEligibleEmail(email)) throw new NotEligibleError();
  return email;
}
