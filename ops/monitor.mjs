// Configure a webhook to receive outage/recovery alerts; run from an independent host in production.
const urls = (process.env.MONITOR_URLS || "http://platform:8080/healthz").split(
  ",",
);
const webhook = process.env.ALERT_WEBHOOK_URL;
const states = new Map();
async function check() {
  for (const url of urls) {
    let up = false;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      up = response.ok;
    } catch {}
    const previous = states.get(url);
    states.set(url, up);
    console.log(
      JSON.stringify({
        service: "uptime-monitor",
        url,
        up,
        at: new Date().toISOString(),
      }),
    );
    if (webhook && previous !== up && (previous !== undefined || !up)) {
      try {
        const response = await fetch(webhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: `Flag Heist ${up ? "RECOVERED" : "OUTAGE"}: ${url}`,
          }),
          signal: AbortSignal.timeout(5000),
        });
        if (!response.ok)
          throw new Error(`Alert delivery HTTP ${response.status}`);
      } catch (err) {
        console.error(
          JSON.stringify({
            service: "uptime-monitor",
            alert_error: err.message,
          }),
        );
        states.delete(url);
      }
    }
  }
}
if (!webhook)
  console.warn(
    "ALERT_WEBHOOK_URL is unset: monitor logs health but cannot deliver alerts.",
  );
await check();
setInterval(check, 60000);
