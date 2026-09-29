// Same synthetic workload as worker.py. No application or network access.
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';

function work(path) {
  const rows = JSON.parse(readFileSync(path, 'utf8'));
  const counts = [0, 0, 0];
  let total = 0;
  for (const row of rows) {
    counts[row.kind] += 1;
    total += row.value;
  }
  return JSON.stringify({ count: rows.length, counts, total });
}

const samples = [];
const outputs = [];
for (let i = 0; i < Number(process.argv[3]) + Number(process.argv[4]); i++) {
  const start = performance.now();
  const result = work(process.argv[2]);
  const elapsed = performance.now() - start;
  outputs.push(result);
  if (i >= Number(process.argv[4])) samples.push(elapsed);
}
if (new Set(outputs).size !== 1) throw new Error('Non-deterministic output');
console.log(JSON.stringify({ result: JSON.parse(outputs[0]), samples_ms: samples }));
