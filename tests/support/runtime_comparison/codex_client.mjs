// Node.js transport client for compare_codex.py. Uses real Codex inference.
import { spawn } from 'node:child_process';
import { readFileSync, openSync, closeSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { performance } from 'node:perf_hooks';

const config = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const started = performance.now();
const elapsed = () => performance.now() - started;
const errorFd = openSync(config.stderrPath, 'w');
const child = spawn(config.codex, config.args, { cwd: config.cwd, stdio: ['pipe', 'pipe', errorFd] });
const lines = createInterface({ input: child.stdout });
let requestId = 1, pending = 'initialize', threadId = null;
let base = 0, initMs = null, turnSent = null, threadReady = null;
let firstDelta = null, reply = null, replyMs = null, usage = null;
let complete = false;
const samples = [], events = [];
// Attach listeners immediately, including failures before the first stdout line.
let processError = null;
const closed = new Promise(resolve => {
  child.on('error', error => { processError = error; });
  child.on('close', (code, signal) => resolve({ code, signal }));
});
child.stdin.on('error', error => { processError = error; child.kill(); });
function send(method, params, response = true) {
  const data = { method, params };
  if (response) { data.id = requestId++; pending = method; }
  child.stdin.write(JSON.stringify(data) + '\n');
}
function startThread() {
  send('thread/start', { model: config.model, cwd: config.cwd, ephemeral: true,
    approvalPolicy: 'never', sandbox: 'read-only' });
}
try {
  if (config.mode === 'exec') child.stdin.end();
  else send('initialize', { clientInfo: { name: 'runtime_benchmark', version: '1.0' },
    capabilities: { experimentalApi: true } });
  for await (const line of lines) {
    const event = JSON.parse(line), now = elapsed();
    const kind = event.method ?? event.type ?? 'response';
    events.push({ event: kind, ms: now });
    if (event.error || kind === 'error' || kind === 'turn.failed') throw new Error(JSON.stringify(event));
    if (config.mode === 'exec') {
      if (kind === 'item.completed' && event.item.type === 'agent_message') {
        reply = event.item.text; replyMs = now;
      }
      if (kind === 'turn.completed') {
        samples.push({ case: 'exec', total_ms: now, reply_ms: replyMs, reply, usage: event.usage });
        complete = true;
      }
      continue;
    }
    if (event.id !== undefined && event.method) throw new Error('Unexpected server request: ' + kind);
    if (event.id !== undefined) {
      if (pending === 'initialize') {
        initMs = now; send('initialized', {}, false); startThread();
      } else if (pending === 'thread/start') {
        threadId = event.result.thread.id; threadReady = now - base; turnSent = elapsed();
        send('turn/start', { threadId, effort: config.effort,
          input: [{ type: 'text', text: config.prompt }] });
      }
      continue;
    }
    const params = event.params ?? {};
    if (params.threadId !== threadId) continue;
    if (kind === 'item/agentMessage/delta' && firstDelta === null) firstDelta = now - base;
    if (kind === 'thread/tokenUsage/updated') usage = params.tokenUsage;
    if (kind === 'item/completed' && params.item.type === 'agentMessage') {
      reply = params.item.text; replyMs = now - base;
    }
    if (kind === 'turn/completed') {
      if (params.turn.status !== 'completed') throw new Error(JSON.stringify(params.turn));
      samples.push({ case: samples.length === 0 ? 'app-cold' : 'app-reused', total_ms: now - base,
        initialize_ms: samples.length === 0 ? initMs : 0, thread_ready_ms: threadReady,
        turn_ms: now - turnSent, first_delta_ms: firstDelta, reply_ms: replyMs, reply, usage });
      if (samples.length === 2) { complete = true; break; }
      reply = replyMs = firstDelta = usage = null;
      base = elapsed(); startThread();
    }
  }
  if (processError) throw processError;
  if (!complete) throw new Error('Process ended before completion');
  if (samples.some(s => s.reply?.trim() !== 'BENCH_OK')) throw new Error('Unexpected benchmark reply');
  if (config.mode === 'exec' && (await closed).code !== 0) throw new Error('Nonzero exec exit');
  console.log(JSON.stringify({ samples, events }));
} finally {
  lines.close();
  if (child.exitCode === null && child.signalCode === null) child.kill();
  await closed;
  closeSync(errorFd);
}
