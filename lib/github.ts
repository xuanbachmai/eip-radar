// GitHub access for ethereum/EIPs: head commit, recursive tree, raw file contents.
// Only two REST API calls per sync (head + tree); file bodies come from raw.githubusercontent.com,
// which is not metered against the REST rate limit, so the pipeline works without a token.

export const REPO = "ethereum/EIPs";
export const BRANCH = "master";

export interface GitHubOptions {
  token?: string;
  fetch?: typeof fetch;
  maxRetries?: number;
  /** Base backoff in ms; doubled per attempt with jitter. */
  backoffMs?: number;
  /** Upper bound on a single wait, including Retry-After / rate-limit reset. */
  maxWaitMs?: number;
  log?: (msg: string) => void;
}

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "GitHubError";
  }
}

export interface Head {
  commitSha: string;
  treeSha: string;
  committedAt?: string;
}

export interface TreeFile {
  path: string;
  eip: number;
  blob: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isRetryable(res: Response): boolean {
  if (res.status === 429 || res.status >= 500) return true;
  // Primary rate limit exhaustion is reported as 403 with remaining = 0.
  return res.status === 403 && res.headers.get("x-ratelimit-remaining") === "0";
}

function waitFor(res: Response | undefined, attempt: number, opts: GitHubOptions): number {
  const base = opts.backoffMs ?? 500;
  const cap = opts.maxWaitMs ?? 60_000;
  const retryAfter = Number(res?.headers.get("retry-after"));
  if (retryAfter > 0) return Math.min(retryAfter * 1000, cap);
  const reset = Number(res?.headers.get("x-ratelimit-reset"));
  if (res?.headers.get("x-ratelimit-remaining") === "0" && reset > 0) {
    return Math.min(Math.max(reset * 1000 - Date.now(), 1000), cap);
  }
  return Math.min(base * 2 ** attempt + Math.random() * base, cap);
}

export async function fetchWithRetry(url: string, init: RequestInit, opts: GitHubOptions = {}): Promise<Response> {
  const f = opts.fetch ?? fetch;
  const max = opts.maxRetries ?? 5;
  for (let attempt = 0; ; attempt++) {
    let res: Response | undefined;
    try {
      res = await f(url, init);
      if (res.ok || !isRetryable(res)) return res;
    } catch (err) {
      if (attempt >= max) throw err;
    }
    if (attempt >= max) return res!;
    const ms = waitFor(res, attempt, opts);
    opts.log?.(`retry ${attempt + 1}/${max} for ${url} in ${Math.round(ms)}ms (${res?.status ?? "network error"})`);
    await sleep(ms);
  }
}

function apiHeaders(token?: string): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "eip-radar",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function getJson<T>(url: string, opts: GitHubOptions): Promise<T> {
  const res = await fetchWithRetry(url, { headers: apiHeaders(opts.token) }, opts);
  if (!res.ok) {
    const hint = res.status === 403 && !opts.token ? " (unauthenticated — set GITHUB_TOKEN)" : "";
    throw new GitHubError(`GET ${url} → ${res.status}${hint}`, res.status);
  }
  return (await res.json()) as T;
}

export async function getHead(opts: GitHubOptions = {}): Promise<Head> {
  const c = await getJson<{ sha: string; commit: { tree: { sha: string }; committer?: { date?: string } } }>(
    `https://api.github.com/repos/${REPO}/commits/${BRANCH}`,
    opts,
  );
  return { commitSha: c.sha, treeSha: c.commit.tree.sha, committedAt: c.commit.committer?.date };
}

export async function getEipTree(treeSha: string, opts: GitHubOptions = {}): Promise<TreeFile[]> {
  const t = await getJson<{ truncated: boolean; tree: { path: string; type: string; sha: string }[] }>(
    `https://api.github.com/repos/${REPO}/git/trees/${treeSha}?recursive=1`,
    opts,
  );
  if (t.truncated) throw new GitHubError("tree listing was truncated");
  const out: TreeFile[] = [];
  for (const e of t.tree) {
    const m = /^EIPS\/eip-(\d+)\.md$/.exec(e.path);
    if (m && e.type === "blob") out.push({ path: e.path, eip: Number(m[1]), blob: e.sha });
  }
  return out.sort((a, b) => a.eip - b.eip);
}

/** Raw file at a pinned commit, so every file in one sync comes from the same tree. */
export async function fetchRaw(commitSha: string, path: string, opts: GitHubOptions = {}): Promise<string> {
  const url = `https://raw.githubusercontent.com/${REPO}/${commitSha}/${path}`;
  const res = await fetchWithRetry(
    url,
    { headers: { "User-Agent": "eip-radar", ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}) } },
    opts,
  );
  if (!res.ok) throw new GitHubError(`GET ${url} → ${res.status}`, res.status);
  return res.text();
}

export async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T, i: number) => Promise<R>) {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!, i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export const fileUrl = (eip: number, ref = BRANCH) => `https://github.com/${REPO}/blob/${ref}/EIPS/eip-${eip}.md`;
export const fileHistoryUrl = (eip: number, ref = BRANCH) =>
  `https://github.com/${REPO}/commits/${ref}/EIPS/eip-${eip}.md`;
export const commitUrl = (sha: string) => `https://github.com/${REPO}/commit/${sha}`;
