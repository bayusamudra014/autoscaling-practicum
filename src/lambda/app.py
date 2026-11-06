import json, os, time, uuid

# ---- Init phase: runs once per replica (execution environment) ----
INIT_TYPE = os.environ.get("AWS_LAMBDA_INITIALIZATION_TYPE", "on-demand")
time.sleep(float(os.environ.get("INIT_DELAY", "0")))   # simulate slow startup
ENV_ID = uuid.uuid4().hex[:8]                            # one ID per replica
invocations = 0

MAX_BUSY = 5   # seconds; keep it below the function timeout


def handler(event, context):
    global invocations
    invocations += 1
    qs = event.get("queryStringParameters") or {}
    busy = min(float(qs.get("busy", 1)), MAX_BUSY)

    start = time.perf_counter()
    time.sleep(busy)   # hold this replica: it can't take another request until done
    duration_ms = round((time.perf_counter() - start) * 1000)

    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps({
            "env_id": ENV_ID,
            "init_type": INIT_TYPE,
            "invocations_in_this_env": invocations,
            "busy_s": busy,
            "duration_ms": duration_ms,
        }),
    }