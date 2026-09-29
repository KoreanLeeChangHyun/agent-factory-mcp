"""Python transport client for compare_codex.py. Uses real Codex inference."""
import json
import subprocess
import sys
import time


def main(config):
    started = time.perf_counter()
    elapsed = lambda: (time.perf_counter() - started) * 1000
    samples = []
    events = []
    init_ms = None
    base = 0
    turn_sent = None
    thread_ready = None
    first_delta = None
    reply = None
    reply_ms = None
    complete = False
    request_id = 1
    thread_id = None
    pending = "initialize"
    usage = None
    args = config["args"]
    with open(config["stderrPath"], "w", encoding="utf-8") as errors:
        child = subprocess.Popen([config["codex"], *args], cwd=config["cwd"],
                                 stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                 stderr=errors, text=True, bufsize=1)

        def send(method, params, response=True):
            nonlocal request_id, pending
            data = {"method": method, "params": params}
            if response:
                data["id"] = request_id
                request_id += 1
                pending = method
            child.stdin.write(json.dumps(data) + "\n")
            child.stdin.flush()

        def start_thread():
            send("thread/start", {"model": config["model"], "cwd": config["cwd"],
                                 "ephemeral": True, "approvalPolicy": "never",
                                 "sandbox": "read-only"})

        try:
            if config["mode"] == "exec":
                child.stdin.close()
            else:
                send("initialize", {"clientInfo": {"name": "runtime_benchmark", "version": "1.0"},
                                    "capabilities": {"experimentalApi": True}})
            for line in child.stdout:
                event = json.loads(line)
                now = elapsed()
                kind = event.get("method", event.get("type", "response"))
                events.append({"event": kind, "ms": now})
                if event.get("error") or kind in ("error", "turn.failed"):
                    raise RuntimeError(json.dumps(event))
                if config["mode"] == "exec":
                    if kind == "item.completed" and event["item"]["type"] == "agent_message":
                        reply = event["item"]["text"]
                        reply_ms = now
                    if kind == "turn.completed":
                        usage = event.get("usage")
                        samples.append({"case": "exec", "total_ms": now,
                                        "reply_ms": reply_ms, "reply": reply, "usage": usage})
                        complete = True
                    continue
                if "id" in event and "method" in event:
                    raise RuntimeError("Unexpected server request: " + kind)
                if "id" in event:
                    if pending == "initialize":
                        init_ms = now
                        send("initialized", {}, False)
                        start_thread()
                    elif pending == "thread/start":
                        thread_id = event["result"]["thread"]["id"]
                        thread_ready = now - base
                        turn_sent = elapsed()
                        send("turn/start", {"threadId": thread_id,
                                            "effort": config["effort"],
                                            "input": [{"type": "text", "text": config["prompt"]}]})
                    continue
                params = event.get("params", {})
                if params.get("threadId") != thread_id:
                    continue
                if kind == "item/agentMessage/delta" and first_delta is None:
                    first_delta = now - base
                if kind == "thread/tokenUsage/updated":
                    usage = params.get("tokenUsage")
                if kind == "item/completed" and params["item"]["type"] == "agentMessage":
                    reply = params["item"]["text"]
                    reply_ms = now - base
                if kind == "turn/completed":
                    if params["turn"]["status"] != "completed":
                        raise RuntimeError(json.dumps(params["turn"]))
                    samples.append({"case": "app-cold" if not samples else "app-reused",
                                    "total_ms": now - base, "initialize_ms": init_ms if not samples else 0,
                                    "thread_ready_ms": thread_ready, "turn_ms": now - turn_sent,
                                    "first_delta_ms": first_delta, "reply_ms": reply_ms,
                                    "reply": reply, "usage": usage})
                    if len(samples) == 2:
                        complete = True
                        break
                    reply = reply_ms = first_delta = usage = None
                    base = elapsed()
                    start_thread()
            if not complete:
                raise RuntimeError("Process ended before completion")
            if any(s["reply"] is None or s["reply"].strip() != "BENCH_OK" for s in samples):
                raise RuntimeError("Unexpected benchmark reply")
            if config["mode"] == "exec" and child.wait() != 0:
                raise RuntimeError("Nonzero exec exit")
            return {"samples": samples, "events": events}
        finally:
            if child.poll() is None:
                child.terminate()
            child.wait()


if __name__ == "__main__":
    with open(sys.argv[1], encoding="utf-8") as stream:
        print(json.dumps(main(json.load(stream))))
