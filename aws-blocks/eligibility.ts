/**
 * Sign-up eligibility: any address with a plausible email shape may hold an
 * account. There is no domain allowlist.
 *
 * Public link pages stay readable by anyone; this gates account creation and
 * every owner-scoped operation.
 *
 * This check only rejects input that cannot be an email address, so obvious
 * garbage fails fast with a clear error instead of a Cognito exception. Proof
 * that the address is real, and belongs to the person signing up, comes from
 * Cognito's email confirmation code. That code is the actual control.
 */

/** Anything except whitespace and "@"; RFC 5321 caps the local part at 64. */
const LOCAL_PART = /^[^\s@]{1,64}$/;
/**
 * Dot-separated labels of letters, digits and hyphens, with at least one dot.
 * Internationalised domains arrive as punycode (xn--...), which this accepts.
 */
const DOMAIN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,63}$/;

export class NotEligibleError extends Error {
  constructor(message = "Enter a valid email address") {
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

  return LOCAL_PART.test(email.slice(0, at)) && DOMAIN.test(email.slice(at + 1));
}

/** Returns the normalised address, or throws NotEligibleError. */
export function assertEligibleEmail(raw: string): string {
  const email = normalizeEmail(raw);
  if (!isEligibleEmail(email)) throw new NotEligibleError();
  return email;
}
