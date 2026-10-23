import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { PublicError } from "@/lib/api/errors";
import schema from "@/lib/config/links.schema.json";
import type { PageConfiguration } from "@/lib/config/links.types";

/**
 * Runtime validation for page payloads.
 *
 * `links.schema.json` was previously only enforced at build time by
 * scripts/validate-links.mjs, so API writes could store values the schema
 * forbids (over-long titles, unknown properties, malformed link IDs). This
 * compiles the same schema so the API and the build agree.
 */

/** Rendered as <a href> on public pages. */
const ALLOWED_LINK_PROTOCOLS = ["https:", "http:", "mailto:"] as const;
/** Used as the canonical URL and encoded into share-card QR codes. */
const ALLOWED_PAGE_PROTOCOLS = ["https:", "http:"] as const;

/** Rejected input, safe to report to the caller: no internal detail. */
export class PageValidationError extends PublicError {
  constructor(message: string) {
    super(message, 400);
    this.name = "PageValidationError";
  }
}

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
ajv.addSchema(schema);
const validatePage = ajv.getSchema<PageConfiguration>(`${schema.$id}#/$defs/page`);

function assertSafeUrl(raw: string, allowed: readonly string[], label: string) {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new PageValidationError(`${label} must be an absolute URL`);
  }
  // new URL() accepts javascript:, data: and file:, so check the scheme.
  if (!allowed.includes(parsed.protocol)) {
    throw new PageValidationError(
      `${label} must use ${allowed.join(" or ")} (received "${parsed.protocol}")`,
    );
  }
}

/**
 * Conference logos are stored inline on the page record as data URLs, so the
 * payload has to be checked rather than trusted.
 *
 * SVG is deliberately excluded. It is a document format that can carry script
 * and external references; the raster types cannot. The CSP already permits
 * `img-src data:`, so an accepted value renders without loosening it.
 */
const ALLOWED_LOGO_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

/** Matches the schema's maxLength, kept here so the reason is stated once. */
const MAX_LOGO_CHARS = 262144;

function assertSafeLogo(raw: string) {
  if (raw.length > MAX_LOGO_CHARS) {
    throw new PageValidationError(
      "The logo is too large; use an image under about 190 KB",
    );
  }
  // Canonical base64 only: whole 4-character groups, with "=" padding allowed
  // solely in the final group. Rejects payloads such as "abc=" or "ab===".
  const match =
    /^data:([a-z/+-]+);base64,((?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?)$/.exec(
      raw,
    );
  if (!match || match[2].length === 0) {
    throw new PageValidationError(
      "The logo must be a base64 image data URL",
    );
  }
  const [, mediaType] = match;
  if (!ALLOWED_LOGO_TYPES.includes(mediaType as (typeof ALLOWED_LOGO_TYPES)[number])) {
    throw new PageValidationError(
      `The logo must be one of ${ALLOWED_LOGO_TYPES.join(", ")} (received "${mediaType}")`,
    );
  }
}

/**
 * Validates an untrusted page payload against the JSON Schema and the URL
 * protocol allowlist. Throws PageValidationError on rejection.
 */
export function validatePageInput(input: unknown): PageConfiguration {
  if (!validatePage) {
    throw new Error("The page schema could not be compiled");
  }
  if (!validatePage(input)) {
    const [first] = validatePage.errors ?? [];
    const where = first?.instancePath || "/";
    throw new PageValidationError(
      `${where} ${first?.message ?? "is invalid"}`.trim(),
    );
  }

  // Ajv's call signature declares `data: any`, so TypeScript cannot narrow an
  // `unknown` argument through the guard. The shape is schema-checked above.
  const page = input as PageConfiguration;
  assertSafeUrl(page.meta.url, ALLOWED_PAGE_PROTOCOLS, "meta.url");
  if (page.meta.logo) assertSafeLogo(page.meta.logo);
  for (const link of page.links) {
    assertSafeUrl(link.url, ALLOWED_LINK_PROTOCOLS, `links.${link.id}.url`);
  }
  return page;
}
