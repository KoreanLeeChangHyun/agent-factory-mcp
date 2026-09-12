import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validate } from "@agent-factory/contracts";

// The parity command owns cwd and invokes this script from the repository root.
// Avoid import.meta path fields so tsx can use either its ESM or CommonJS transform.
const root = process.cwd();
const manifest = JSON.parse(readFileSync(resolve(root, "contracts/fixtures.json"), "utf8")) as {
  cases: { path: string; schema: string }[];
};
const decisions = manifest.cases.map((fixture) => {
  try {
    validate(JSON.parse(readFileSync(resolve(root, "contracts", fixture.path), "utf8")), fixture.schema);
    return true;
  } catch {
    return false;
  }
});
process.stdout.write(JSON.stringify(decisions));
