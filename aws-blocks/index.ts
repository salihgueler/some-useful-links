import { ApiError, ApiNamespace, AuthCognito, Scope } from "@aws-blocks/blocks";
import {
  ALLOWED_EMAIL_DOMAINS,
  NotEligibleError,
  assertEligibleEmail,
  isEligibleEmail,
  normalizeEmail,
} from "./eligibility";

// For coding agents: Leave these comments in place for future reference.
// Read node_modules/@aws-blocks/blocks/README.md for all available Building Blocks
// Hover over Scope below to see the docstring with complete Building Block index

const scope = new Scope("some-useful-links");
const isProduction = process.env.NODE_ENV === "production";

/**
 * Authentication for Some Useful Links.
 *
 * signInWith: 'email' is a ONE-WAY DOOR. Cognito rejects the alias-shape
 * transition, so changing it later requires recreating the pool and every
 * account in it. It is correct here because eligibility is decided by email
 * domain.
 */
const auth = new AuthCognito(scope, "auth", {
  signInWith: "email",
  selfSignUp: true,
  // Optional TOTP only. EMAIL as an MFA type makes Cognito challenge every
  // sign-in with a mailed code, which would put routine sign-in behind email
  // deliverability into corporate inboxes -- the same dependency that already
  // gates sign-up confirmation. One point of failure there is enough.
  mfa: "optional",
  mfaTypes: ["TOTP"],
  passwordPolicy: {
    minLength: 12,
    requireDigits: true,
    requireSymbols: true,
    requireUppercase: true,
    requireLowercase: true,
  },
  // Shorter than the 400-day default: without corporate SSO there is no
  // offboarding signal, so sessions should not outlive employment for long.
  sessionTtlSeconds: 60 * 60 * 12,
  // Local mock only: surface confirmation codes in the dev server log so
  // sign-up can be exercised without an email provider. Never in production.
  ...(isProduction
    ? {}
    : {
        codeDelivery: async (username: string, code: string, purpose: string) => {
          console.log(`[auth:${purpose}] ${username} -> ${code}`);
        },
      }),
});

/**
 * Request context type, derived from the auth block rather than imported from
 * @aws-blocks/core, which is only an indirect dependency here.
 */
type RequestContext = Parameters<typeof auth.requireAuth>[0];

/**
 * eligibility.ts stays framework-free so it can be reasoned about and tested
 * on its own; the HTTP status is applied here at the API boundary.
 */
function notEligible(message = "This email address is not eligible for an account") {
  return new ApiError(message, 403, { name: "NotEligible" });
}

function eligibleOrThrow(email: string): string {
  try {
    return assertEligibleEmail(email);
  } catch (error) {
    if (error instanceof NotEligibleError) throw notEligible();
    throw error;
  }
}

/**
 * Authenticated AND still eligible.
 *
 * The domain is re-checked on every call rather than trusted from sign-up,
 * so an account created out of band, an address changed after the fact, or a
 * domain later removed from the allowlist all lose access immediately.
 */
async function requireEligible(context: RequestContext) {
  const user = await auth.requireAuth(context);
  const email = normalizeEmail(user.attributes.email ?? user.username);
  if (user.attributes.email_verified === "false") {
    throw notEligible("Confirm your email address first");
  }
  if (!isEligibleEmail(email)) {
    throw notEligible();
  }
  return { user, email };
}

/**
 * Every ApiNamespace method is a PUBLIC RPC endpoint by default.
 *
 * The raw auth state machine (auth.createApi()) is deliberately NOT exported:
 * it exposes signUp directly to the browser, which would bypass the domain
 * allowlist below. Sign-up must go through this namespace.
 */
export const api = new ApiNamespace(scope, "api", (context) => ({
  /** Liveness probe. */
  async health() {
    return { ok: true, service: "some-useful-links" };
  },

  /** Which domains may register, so the UI can say so before submission. */
  async eligibleDomains() {
    return { domains: ALLOWED_EMAIL_DOMAINS };
  },

  async signUp(email: string, password: string) {
    const eligible = eligibleOrThrow(email);
    const result = await auth.signUp(eligible, password, {}, context);
    return { isSignUpComplete: result.isSignUpComplete, nextStep: result.nextStep };
  },

  async confirmSignUp(email: string, code: string) {
    return auth.confirmSignUp(eligibleOrThrow(email), code, context);
  },

  async signIn(email: string, password: string) {
    return auth.signIn(eligibleOrThrow(email), password, context);
  },

  /**
   * Continues a sign-in that returned `continueSignIn`. With this pool's
   * configuration the only challenge reachable is an MFA code (TOTP), so this
   * takes the code directly rather than the full discriminated response union.
   * Add sibling methods if a new challenge type is enabled later.
   */
  async confirmSignIn(session: string, code: string) {
    return auth.confirmSignIn(session, { code }, context);
  },

  async signOut() {
    await auth.signOut(context, { global: true });
    return { ok: true };
  },

  /** Current identity, or 401/403 if not signed in or no longer eligible. */
  async me() {
    const { user, email } = await requireEligible(context);
    return { email, userSub: user.userSub };
  },
}));
