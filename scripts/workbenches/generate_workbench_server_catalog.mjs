import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import process from "node:process";
import { assetCatalog } from "../../packages/design-system/dist/catalog.js";

const target = fileURLToPath(
  new URL("../../packages/platform-adapters/src/agent_factory_adapters/workbenches/catalog.json", import.meta.url),
);
const rendered = `${JSON.stringify(assetCatalog, null, 2)}\n`;
if (process.argv.includes("--check")) {
  if (readFileSync(target, "utf8") !== rendered) {
    process.stderr.write("generated Workbench server catalog is stale\n");
    process.exitCode = 1;
  }
} else {
  writeFileSync(target, rendered);
}
