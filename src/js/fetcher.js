// Fetch with timeout and exponential backoff (+ jitter). 4xx other than 429 are not retried.
export async function fetchJson(url, { retries = 3, base = 600, factor = 2, timeout = 8000, fetchImpl } = {}) {
  const f = fetchImpl || globalThis.fetch.bind(globalThis);
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeout);
    try {
      const res = await f(url, { signal: ctl.signal, headers: { accept: "application/json" } });
      clearTimeout(t);
      if (res.ok) return await res.json();
      const err = new Error("HTTP " + res.status);
      if (res.status !== 429 && res.status >= 400 && res.status < 500) {
        err.fatal = true;
        throw err;
      }
      lastErr = err;
    } catch (e) {
      clearTimeout(t);
      if (e.fatal) throw e;
      lastErr = e;
    }
    if (i < retries) await new Promise((r) => setTimeout(r, base * factor ** i + Math.random() * base * 0.25));
  }
  throw lastErr;
}
