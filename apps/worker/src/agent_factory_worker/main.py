"""Worker CLI; application/task registration is supplied by worker composition."""

import sys

from celery.bin.celery import main as celery_main


def main() -> int:
    # Preserve Celery's explicit -A application selection; never substitute a fixture.
    sys.argv[0] = "agent-factory-worker"
    return celery_main()


if __name__ == "__main__":
    raise SystemExit(main())
