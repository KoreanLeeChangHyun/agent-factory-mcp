"""Start a process with an explicitly selected environment."""

import argparse
import os
import sys
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("process", choices=("api", "worker", "scheduler"))
    parser.add_argument("--env", required=True, choices=("dev", "stg", "prod"))
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    env_file = root / "env" / f"{args.env}.env"
    if not env_file.is_file():
        parser.error(f"Configure the environment file {env_file} first")
    os.chdir(root)
    os.environ["AGENT_FACTORY_ENV_FILE"] = str(env_file)
    os.environ["AGENT_FACTORY_ENVIRONMENT"] = {
        "dev": "local", "stg": "staging", "prod": "production"
    }[args.env]
    if args.process == "api":
        command = [sys.executable, "-m", "uvicorn", "api.main:app",
                   "--host", args.host, "--port", str(args.port)]
    else:
        command = [sys.executable, "-m", "celery", "-A",
                   "agent_factory_worker.celery_app:celery_app",
                   "worker" if args.process == "worker" else "beat", "--loglevel=info"]
    os.execv(sys.executable, command)


if __name__ == "__main__":
    main()
