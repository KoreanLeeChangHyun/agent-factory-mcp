"""Synthetic JSON event workload; no application or network access."""
import json
import sys
import time
from pathlib import Path


def work(path):
    rows = json.loads(Path(path).read_text(encoding="utf-8"))
    counts = [0, 0, 0]
    total = 0
    for row in rows:
        counts[row["kind"]] += 1
        total += row["value"]
    return json.dumps({"count": len(rows), "counts": counts, "total": total},
                      separators=(",", ":"))


if __name__ == "__main__":
    samples = []
    outputs = []
    for i in range(int(sys.argv[2]) + int(sys.argv[3])):
        start = time.perf_counter_ns()
        result = work(sys.argv[1])
        elapsed = (time.perf_counter_ns() - start) / 1e6
        outputs.append(result)
        if i >= int(sys.argv[3]):
            samples.append(elapsed)
    assert len(set(outputs)) == 1
    print(json.dumps({"result": json.loads(outputs[0]), "samples_ms": samples}))
