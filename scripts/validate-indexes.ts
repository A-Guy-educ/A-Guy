import fs from "node:fs";
import path from "node:path";
import Ajv from "ajv";

const REPO_ROOT = process.cwd();
const SCHEMA_DIR = path.join(REPO_ROOT, ".ai-docs", "schemas");
const INDEX_DIR = path.join(REPO_ROOT, ".ai-docs", "indexes");

type SchemaName =
  | "readme-index.schema.json"
  | "route-index.schema.json"
  | "collection-slug-map.schema.json";

function readJson(p: string) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function main() {
  const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });

  const pairs: Array<{ schema: SchemaName; file: string }> = [
    { schema: "readme-index.schema.json", file: "readme-index.json" },
    { schema: "route-index.schema.json", file: "route-index.json" },
    { schema: "collection-slug-map.schema.json", file: "collection-slug-map.json" },
  ];

  let failed = 0;

  for (const p of pairs) {
    const schemaPath = path.join(SCHEMA_DIR, p.schema);
    const filePath = path.join(INDEX_DIR, p.file);

    if (!fs.existsSync(schemaPath)) {
      console.error(`Missing schema: ${path.relative(REPO_ROOT, schemaPath)}`);
      failed++;
      continue;
    }

    if (!fs.existsSync(filePath)) {
      console.error(`Missing index file: ${path.relative(REPO_ROOT, filePath)}`);
      failed++;
      continue;
    }

    const schema = readJson(schemaPath);
    const data = readJson(filePath);

    const validate = ajv.compile(schema);
    const ok = validate(data);

    if (!ok) {
      failed++;
      console.error(`Invalid: ${path.relative(REPO_ROOT, filePath)}`);
      for (const err of validate.errors || []) {
        console.error(`  - ${err.instancePath || "/"} ${err.message}`);
      }
    }
  }

  if (failed > 0) {
    console.error(`Indexes validation failed: ${failed} file(s) invalid/missing`);
    process.exit(1);
  }

  console.log("Indexes validation: OK");
}

main();
