#!/usr/bin/env python3
"""
Challenge 11 — The Debug Trace (Log & Artifact Generator)

Build-time script to generate realistic distributed log streams and the target artifact.

SPECIFICATION:
=============================================================================
1. 3 Services:
   - "svc-a" (Edge Gateway Router): ISO 8601 timestamps (YYYY-MM-DDTHH:MM:SS.sssZ). Reference clock (Offset = 0s).
   - "gateway-7" (API Dispatcher): Unix epoch timestamps (float seconds.milliseconds). Clock Offset = +47s ahead.
   - "proc-core" (Backend Processor): Common Log Format (DD/Mon/YYYY:HH:MM:SS +0000). Clock Offset = -23s behind.
2. Volume: ~800 to 1200 log entries per service, mostly routine noise.
3. Correlation Key: "req-corr-9b4e72a1".
4. Correlated Sequence (once clock skew is accounted for):
   - Step 1 (svc-a at T0 + 100s): Ingress dispatch for req-corr-9b4e72a1 to gateway-7.
   - Step 2 (gateway-7 at T0 + 102s): Dispatches trace and leaks static debug path:
     "/artifacts/proc-core/debug-internal-cfg-49a1.txt"
   - Step 3 (proc-core at T0 + 105s): Finalizes batch transaction for req-corr-9b4e72a1.
5. Flag Artifact:
   Saved to /challenges/11-debug-trace/artifacts/proc-core/debug-internal-cfg-49a1.txt
   Flag: ROOT{cl0ck_sk3w_l0g_c0rr3l4t10n_9b4e1a}
=============================================================================
"""

import os
import random
import datetime

FLAG = "ROOT{cl0ck_sk3w_l0g_c0rr3l4t10n_9b4e1a}"
CORRELATION_KEY = "req-corr-9b4e72a1"

BASE_TIME = 1762351200.0 # 2025-11-05 14:00:00 UTC

OFFSET_SVC_A = 0.0
OFFSET_GATEWAY_7 = 47.0 # Clock is 47s ahead
OFFSET_PROC_CORE = -23.0 # Clock is 23s behind

def format_svc_a(epoch_sec):
    dt = datetime.datetime.fromtimestamp(epoch_sec, tz=datetime.timezone.utc)
    return dt.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"

def format_gateway_7(epoch_sec):
    return f"{epoch_sec:.3f}"

def format_proc_core(epoch_sec):
    dt = datetime.datetime.fromtimestamp(epoch_sec, tz=datetime.timezone.utc)
    return dt.strftime("%d/%b/%Y:%H:%M:%S +0000")

NOISE_ENDPOINTS = [
    "/api/v1/health", "/api/v1/metrics", "/api/v2/telemetry/push",
    "/internal/auth/verify", "/api/v1/tenant/quotas", "/cluster/heartbeat",
    "/api/v2/queue/dequeue", "/ingress/route/lookup", "/api/v1/storage/stat"
]

def main():
    base_dir = os.path.dirname(__file__)
    logs_dir = os.path.join(base_dir, "logs")
    artifacts_dir = os.path.join(base_dir, "artifacts", "proc-core")
    os.makedirs(logs_dir, exist_ok=True)
    os.makedirs(artifacts_dir, exist_ok=True)

    random.seed(42) # Reproducible log stream

    total_events = 900
    times = [BASE_TIME + i * 2.0 + random.uniform(0.1, 1.8) for i in range(total_events)]

    corr_idx = 450
    t_corr_1 = times[corr_idx]
    t_corr_2 = t_corr_1 + 2.14
    t_corr_3 = t_corr_1 + 5.38

    # ── 1. Generate svc-a logs ────────────────────────────────────────────────
    lines_svc_a = []
    for t in times:
        clock_t = t + OFFSET_SVC_A
        ts_str = format_svc_a(clock_t)
        if abs(t - t_corr_1) < 0.001:
            line = f"[{ts_str}] [INFO] router::ingress: trace={CORRELATION_KEY} method=POST path=/api/v2/internal/batch status=200 dur_ms=18.4 client=10.0.4.12 upstream=gateway-7"
        else:
            cid = f"req-{random.randint(100000, 999999)}"
            ep = random.choice(NOISE_ENDPOINTS)
            code = random.choice([200, 200, 200, 200, 204, 304, 404])
            dur = f"{random.uniform(1.2, 45.0):.1f}"
            line = f"[{ts_str}] [INFO] router::ingress: trace={cid} method=GET path={ep} status={code} dur_ms={dur} client=10.0.{random.randint(1,10)}.{random.randint(1,250)}"
        lines_svc_a.append(line)

    # ── 2. Generate gateway-7 logs ────────────────────────────────────────────
    lines_gateway_7 = []
    for t in times:
        clock_t = t + OFFSET_GATEWAY_7
        ts_str = format_gateway_7(clock_t)
        if abs(t - t_corr_1) < 0.001:
            clock_t2 = t_corr_2 + OFFSET_GATEWAY_7
            ts_str2 = format_gateway_7(clock_t2)
            # The correlated step 2 leaks the target static artifact path
            line = f"{ts_str2} gateway-7 dispatch.cc:184 [DEBUG] cid={CORRELATION_KEY} export_manifest=/artifacts/proc-core/debug-internal-cfg-49a1.txt target=proc-core action=flush_diagnostic"
        else:
            cid = f"req-{random.randint(100000, 999999)}"
            ep = random.choice(NOISE_ENDPOINTS)
            line = f"{ts_str} gateway-7 dispatch.cc:92 [INFO] cid={cid} action=proxy route={ep} latency_ms={random.uniform(0.5, 12.0):.2f}"
        lines_gateway_7.append(line)

    # ── 3. Generate proc-core logs ────────────────────────────────────────────
    lines_proc_core = []
    for t in times:
        clock_t = t + OFFSET_PROC_CORE
        ts_str = format_proc_core(clock_t)
        if abs(t - t_corr_1) < 0.001:
            clock_t3 = t_corr_3 + OFFSET_PROC_CORE
            ts_str3 = format_proc_core(clock_t3)
            line = f"{ts_str3} proc-core worker-03 [INFO] transaction_finalized trace_id={CORRELATION_KEY} state=ARCHIVED records_processed=1"
        else:
            cid = f"req-{random.randint(100000, 999999)}"
            action = random.choice(["cache_evict", "index_rebuild", "commit_batch", "sync_replica"])
            line = f"{ts_str} proc-core worker-{random.randint(1,8):02d} [INFO] {action} trace_id={cid} status=OK"
        lines_proc_core.append(line)

    # Write logs
    with open(os.path.join(logs_dir, "svc-a.log"), "w") as f:
        f.write("\n".join(lines_svc_a) + "\n")
    with open(os.path.join(logs_dir, "gateway-7.log"), "w") as f:
        f.write("\n".join(lines_gateway_7) + "\n")
    with open(os.path.join(logs_dir, "proc-core.log"), "w") as f:
        f.write("\n".join(lines_proc_core) + "\n")

    # Write target artifact containing flag
    artifact_path = os.path.join(artifacts_dir, "debug-internal-cfg-49a1.txt")
    with open(artifact_path, "w") as f:
        f.write("# Veyra Internal System Configuration Dump [Cluster Node proc-core]\n")
        f.write("# Generated automatically during diagnostic flush\n")
        f.write(f"SYSTEM_CLUSTER_FLAG = {FLAG}\n")
        f.write("DEBUG_MODE = true\n")
        f.write("FAILOVER_ENABLED = true\n")

    print(f"[SUCCESS] Challenge 11 generated successfully:")
    print(f"  Logs: {logs_dir}")
    print(f"  Target Artifact: {artifact_path}")
    print(f"  Flag: {FLAG}")

if __name__ == "__main__":
    main()
