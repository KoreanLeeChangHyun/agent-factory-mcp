"""Compare Python and TypeScript validator decisions for the same fixtures."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

from agent_factory_contracts import ContractValidationError, validate

ROOT = Path(__file__).resolve().parents[1]


def python_decisions() -> list[bool]:
    manifest = json.loads((ROOT / "contracts/fixtures.json").read_text())
    decisions = []
    for fixture in manifest["cases"]:
        document = json.loads((ROOT / "contracts" / fixture["path"]).read_text())
        try:
            validate(document, fixture["schema"])
            decisions.append(True)
        except ContractValidationError:
            decisions.append(False)
    return decisions


def main() -> int:
    expected = python_decisions()
    completed = subprocess.run(
        ["pnpm", "exec", "tsx", "scripts/validate_workbench_contracts_ts.ts"],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    actual = json.loads(completed.stdout)
    if actual != expected:
        raise SystemExit(f"validator decision mismatch: python={expected!r}, typescript={actual!r}")
    declared = [
        fixture["valid"]
        for fixture in json.loads((ROOT / "contracts/fixtures.json").read_text())["cases"]
    ]
    if expected != declared:
        raise SystemExit(f"validator decisions disagree with fixture expectations: {expected!r}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
