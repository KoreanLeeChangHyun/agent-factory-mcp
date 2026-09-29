"""Run: python3 mcp/tests/support/runtime_comparison/compare.py

Synthetic microbenchmark, NOT an Agent Factory or Codex end-to-end benchmark.
Cold = fresh process wall time (includes imports, work, stdout, process exit).
Warm = file read + JSON parse + aggregation + JSON serialization in a reused
process after warmup. OS file caches may be warm in both cases. No dependencies.
Results and raw samples are printed as JSON; redirect stdout to retain evidence.
"""
import argparse
import json
import platform
import shutil
import statistics
import subprocess
import sys
import tempfile
import time
from pathlib import Path


def positive(value):
    number = int(value)
    if number < 1:
        raise argparse.ArgumentTypeError("must be positive")
    return number


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--samples", type=positive, default=9)
    parser.add_argument("--warmup", type=positive, default=3)
    args = parser.parse_args()
    node = shutil.which("node")
    if node is None:
        parser.error("Node.js is required")
    root = Path(__file__).resolve().parent
    commands = {"python": [sys.executable, str(root / "worker.py")],
                "node": [node, str(root / "worker.mjs")]}
    report = {"python": sys.version.split()[0],
              "node": subprocess.check_output([node, "--version"], text=True).strip(),
              "platform": platform.platform(), "samples": args.samples,
              "warmup": args.warmup,
              "scope": "synthetic local JSON workload; no AI/network; cache may be warm",
              "cases": []}
    with tempfile.TemporaryDirectory(prefix="runtime-comparison-") as directory:
        for size in [0, 1000, 100000]:
            rows = [{"kind": i % 3, "value": i % 97,
                     "text": "합성 이벤트 🚀"} for i in range(size)]
            path = Path(directory) / "events.json"
            path.write_text(json.dumps(rows, ensure_ascii=False), encoding="utf-8")
            quotient, remainder = divmod(size, 97)
            expected = {"count": size,
                        "counts": [(size + 2 - i) // 3 for i in range(3)],
                        "total": quotient * 96 * 97 // 2 + remainder * (remainder - 1) // 2}
            timings = {name: {"cold_wall_ms": [], "warm_work_ms": []} for name in commands}

            def execute(name, samples, warmup):
                start = time.perf_counter_ns()
                output = subprocess.check_output(
                    commands[name] + [str(path), str(samples), str(warmup)], text=True)
                wall = (time.perf_counter_ns() - start) / 1e6
                data = json.loads(output)
                if data["result"] != expected:
                    raise ValueError(f"Incorrect output: {name}, size={size}")
                return wall, data["samples_ms"]

            # Alternate ordering to reduce consistent first/second runtime bias.
            for index in range(args.samples):
                order = list(commands) if index % 2 == 0 else list(reversed(commands))
                for name in order:
                    wall, _ = execute(name, 1, 0)
                    timings[name]["cold_wall_ms"].append(wall)
            for name in commands:
                _, samples = execute(name, args.samples, args.warmup)
                timings[name]["warm_work_ms"] = samples
            for measurements in timings.values():
                measurements["medians_ms"] = {
                    key: statistics.median(values) for key, values in list(measurements.items())}
            report["cases"].append({"rows": size, "input_bytes": path.stat().st_size,
                                    "parity": "pass", "timings": timings})
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
