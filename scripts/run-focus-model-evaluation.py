"""Production API evaluation: fresh sessions, one lane/model, no automatic retry."""
import concurrent.futures
import argparse
import datetime
import json
import pathlib
import subprocess
import time
import uuid

ROOT = pathlib.Path("reports/focus-model-evaluation")
CACHE = pathlib.Path(".cache/focus-model-evaluation")
MODELS = ["gpt-6-luna", "muse-spark-1.3-contributor", "mimo-v2.6-flash"]
REMAINING_MODELS = ["glm-5.3-flash", "deepseek-v4.1-flash", "space-bunny-free", "longcat-2.5-preview-free"]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--remaining", action="store_true", help="Run the other four Focus models without overwriting the first benchmark")
    args = parser.parse_args()
    models = REMAINING_MODELS if args.remaining else MODELS
    output = ROOT / ("results-remaining.json" if args.remaining else "results.json")
    if output.exists():
        raise SystemExit(f"Refusing to overwrite existing run: {output}")
    suite = json.loads((ROOT / "questions-and-expected.json").read_text())
    run_id = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    destination = CACHE / run_id
    destination.mkdir(parents=True)
    results = []

    def lane(model):
        lane_results = []
        for case in suite["tests"]:
            key = model + "--" + case["id"]
            payload = {"sessionId": "focus-eval-" + str(uuid.uuid4()), "modelId": model,
                       "pagePath": case["pagePath"], "messages": [{"id": str(uuid.uuid4()), "role": "user",
                       "parts": [{"type": "text", "text": case["question"]}]}]}
            payload_path = destination / (key + ".request.json")
            payload_path.write_text(json.dumps(payload))
            started = time.monotonic()
            response = subprocess.run(["curl", "-sS", "-N", "--max-time", "85", "-w", "\nHTTP_STATUS:%{http_code}\n",
                                      "https://locusaz.vercel.app/api/chat", "-H", "Content-Type: application/json",
                                      "--data-binary", "@" + str(payload_path)], capture_output=True, text=True)
            elapsed = round(time.monotonic() - started, 3)
            (destination / (key + ".sse")).write_text(response.stdout)
            events = []
            for line in response.stdout.splitlines():
                if line.startswith("data: "):
                    try:
                        event = json.loads(line[6:])
                        if isinstance(event, dict):
                            events.append(event)
                    except json.JSONDecodeError:
                        pass
            answer = "".join(e.get("delta", "") for e in events if e.get("type") == "text-delta")
            calls = {e["toolCallId"]: e for e in events if e.get("type") == "tool-input-available"}
            tools = []
            for e in events:
                if e.get("type") == "tool-output-available":
                    c = calls.get(e["toolCallId"], {})
                    tools.append({"name": c.get("toolName"), "input": c.get("input"), "output": e.get("output")})
            errors = [e for e in events if e.get("type") in ["error", "tool-output-error", "tool-input-error"]]
            http = response.stdout.rsplit("HTTP_STATUS:", 1)[-1].strip() if "HTTP_STATUS:" in response.stdout else None
            result = {"caseId": case["id"], "model": model, "elapsedSeconds": elapsed,
                      "httpStatus": http, "curlExitCode": response.returncode, "stderr": response.stderr,
                      "streamFinished": any(e.get("type") == "finish" for e in events),
                      "answer": answer, "errors": errors, "tools": tools,
                      "rawTrace": str(destination / (key + ".sse"))}
            (destination / (key + ".result.json")).write_text(json.dumps(result, indent=2))
            lane_results.append(result)
            print(json.dumps({k: result[k] for k in ["caseId", "model", "elapsedSeconds", "httpStatus", "streamFinished", "errors"]}), flush=True)
            time.sleep(2)
        return lane_results

    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        futures = [executor.submit(lane, model) for model in models]
        for f in concurrent.futures.as_completed(futures):
            results.extend(f.result())
    results.sort(key=lambda r: (models.index(r["model"]), next(i for i, t in enumerate(suite["tests"]) if t["id"] == r["caseId"])))
    output.write_text(json.dumps({"runId": run_id, "endpoint": "https://locusaz.vercel.app/api/chat",
        "method": f"{len(suite['tests'])*len(models)} independent first-turn requests; at most three concurrent lanes, one request per model at a time; no automatic retries. API results include the card data rendered by the site. Browser rendering is not assessed.",
        "models": models, "results": results}, indent=2))
    print("Saved " + str(output), flush=True)


if __name__ == "__main__":
    main()
