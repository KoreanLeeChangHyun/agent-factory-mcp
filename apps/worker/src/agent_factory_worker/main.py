from __future__ import annotations

import argparse
import json

from agent_factory_adapters import FixtureWorkbenchRepository
from agent_factory_core import GetReferenceWorkbench


def smoke() -> dict[str, object]:
    definition = GetReferenceWorkbench(FixtureWorkbenchRepository()).execute()
    return {"status": "ok", "workbench": definition["descriptor"]["id"]}


def main() -> int:
    parser = argparse.ArgumentParser(description="Agent Factory stage-1 worker entrypoint")
    parser.add_argument(
        "--smoke", action="store_true", help="validate the reference fixture and exit"
    )
    args = parser.parse_args()
    if not args.smoke:
        parser.error(
            "stage 1 supports only --smoke; durable worker execution is not yet configured"
        )
    print(json.dumps(smoke(), sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
