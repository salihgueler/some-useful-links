import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const schemaPath = resolve("src/lib/config/links.schema.json");
const dataPath = resolve("src/lib/config/links.json");
const [schema, data] = await Promise.all([
  readFile(schemaPath, "utf8").then(JSON.parse),
  readFile(dataPath, "utf8").then(JSON.parse),
]);

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);

if (!validate(data)) {
  console.error("Link configuration is invalid:");
  for (const error of validate.errors ?? []) {
    console.error(`- ${error.instancePath || "/"} ${error.message}`);
  }
  process.exit(1);
}

const slugs = data.pages.map((page) => page.slug);
if (new Set(slugs).size !== slugs.length) {
  console.error("Link configuration is invalid: page slugs must be unique.");
  process.exit(1);
}

if (!slugs.includes(data.defaultSlug)) {
  console.error("Link configuration is invalid: defaultSlug must match a page.");
  process.exit(1);
}

for (const page of data.pages) {
  const ids = page.links.map((link) => link.id);
  if (new Set(ids).size !== ids.length) {
    console.error(`Link IDs must be unique within page "${page.slug}".`);
    process.exit(1);
  }
}

const linkCount = data.pages.reduce((count, page) => count + page.links.length, 0);
console.log(
  `Validated ${data.pages.length} pages and ${linkCount} links in src/lib/config/links.json.`,
);
