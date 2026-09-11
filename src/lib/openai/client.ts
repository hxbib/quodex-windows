import { snapshotFromUsage, type ResetCreditsResponse, type UsageAPIResponse } from "../quodex/lanes";

export const CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
export const ISSUER = "https://auth.openai.com";
const USER_AGENT = "Quodex";

const ALLOWED: Record<string, Set<string>> = {
  "auth.openai.com": new Set([
    "/api/accounts/deviceauth/usercode",
    "/api/accounts/deviceauth/token",
    "/oauth/token",
  ]),
  "chatgpt.com": new Set(["/backend-api/wham/usage", "/backend-api/wham/rate-limit-reset-credits"]),
};

function assertAllowed(url: URL) {
  const host = url.host.toLowerCase();
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash) {
    throw new Error("Quodex refused an unapproved network endpoint.");
  }
  if (!ALLOWED[host]?.has(url.pathname)) {
    throw new Error("Quodex refused an unapproved network endpoint.");
  }
}

async function requestJson(options: {
  url: string;
  method?: string;
  body?: string | null;
  contentType?: string;
  authorization?: string;
  accountID?: string;
  accepted?: number[];
}): Promise<{ status: number; json: unknown; text: string; contentType: string }> {
  const url = new URL(options.url);
  assertAllowed(url);
  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": USER_AGENT,
  };
  if (options.body) headers["Content-Type"] = options.contentType ?? "application/json";
  if (options.authorization) headers.Authorization = options.authorization;
  if (options.accountID) headers["ChatGPT-Account-ID"] = options.accountID;

  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers,
    body: options.body ?? undefined,
    redirect: "manual",
    signal: AbortSignal.timeout(20_000),
  });

  const accepted = options.accepted ?? [...Array.from({ length: 100 }, (_, i) => 200 + i)];
  const text = await response.text();
  if (text.length > 2 * 1024 * 1024) {
    throw new Error("The service response was unexpectedly large.");
  }
  if (!accepted.includes(response.status)) {
    if (response.status === 429) {
      throw new Error("OpenAI temporarily rate-limited this usage check. Try again later.");
    }
    throw new Error(`The service returned HTTP ${response.status}.`);
  }
  const contentType = response.headers.get("content-type") ?? "";
  let json: unknown = null;
  if (text && contentType.toLowerCase().includes("application/json")) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }
  return { status: response.status, json, text, contentType };
}

function isUsageChallenge(text: string, url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.host !== "chatgpt.com" || parsed.pathname !== "/backend-api/wham/usage") return false;
  } catch {
    return false;
  }
  const body = text.toLowerCase();
  if (!body) return false;
  const authenticationMarker = [
    "sign in",
    "log in",
    "login",
    "session expired",
    "authentication required",
    "unauthenticated",
    "unauthorized",
    "invalid token",
    "token expired",
  ].some((marker) => body.includes(marker));
  const challengeMarker =
    body.includes("<html") ||
    body.includes("<!doctype") ||
    body.includes('"error"') ||
    body.includes('"detail"') ||
    body.includes('"message"');
  return authenticationMarker && challengeMarker;
}

export async function startDeviceLoginRequest() {
  const { json } = await requestJson({
    url: `${ISSUER}/api/accounts/deviceauth/usercode`,
    method: "POST",
    body: JSON.stringify({ client_id: CLIENT_ID }),
  });
  const payload = (json ?? {}) as {
    device_auth_id?: string;
    user_code?: string;
    usercode?: string;
    interval?: number | string;
  };
  const deviceAuthID = payload.device_auth_id ?? "";
  const userCode = payload.user_code ?? payload.usercode ?? "";
  if (!deviceAuthID || !userCode) throw new Error("The service returned an invalid response.");
  const interval =
    typeof payload.interval === "string"
      ? Number.parseInt(payload.interval, 10) || 5
      : payload.interval ?? 5;
  return {
    verificationURL: `${ISSUER}/codex/device`,
    userCode,
    deviceAuthID,
    intervalSeconds: Math.max(1, interval),
  };
}

export async function pollDeviceLoginRequest(data: { deviceAuthID: string; userCode: string }) {
  const { status, json } = await requestJson({
    url: `${ISSUER}/api/accounts/deviceauth/token`,
    method: "POST",
    body: JSON.stringify({
      device_auth_id: data.deviceAuthID,
      user_code: data.userCode,
    }),
    accepted: [...Array.from({ length: 100 }, (_, i) => 200 + i), 403, 404],
  });
  if (status !== 200) return { status: "pending" as const };

  const authorization = (json ?? {}) as {
    authorization_code?: string;
    code_verifier?: string;
  };
  if (!authorization.authorization_code || !authorization.code_verifier) {
    throw new Error("The service returned an invalid response.");
  }

  const form = new URLSearchParams({
    grant_type: "authorization_code",
    code: authorization.authorization_code,
    redirect_uri: `${ISSUER}/deviceauth/callback`,
    client_id: CLIENT_ID,
    code_verifier: authorization.code_verifier,
  });

  const exchanged = await requestJson({
    url: `${ISSUER}/oauth/token`,
    method: "POST",
    body: form.toString(),
    contentType: "application/x-www-form-urlencoded",
  });
  const tokens = (exchanged.json ?? {}) as {
    id_token?: string;
    access_token?: string;
    refresh_token?: string;
  };
  if (!tokens.id_token || !tokens.access_token) {
    throw new Error("The service returned an invalid response.");
  }
  // Refresh tokens are discarded. Quodex never retries an expired ChatGPT session.
  void tokens.refresh_token;
  return {
    status: "complete" as const,
    idToken: tokens.id_token,
    accessToken: tokens.access_token,
  };
}

export async function fetchAccountUsageRequest(data: { accessToken: string; accountID: string }) {
  const usageResult = await requestJson({
    url: "https://chatgpt.com/backend-api/wham/usage",
    authorization: `Bearer ${data.accessToken}`,
    accountID: data.accountID,
    accepted: [...Array.from({ length: 100 }, (_, i) => 200 + i), 401, 403],
  });

  if (usageResult.status === 401 || usageResult.status === 403) {
    return {
      ok: false as const,
      code: "login_required" as const,
      message:
        "This session expired or was rejected. Sign in again; Quodex never retries expired tokens.",
    };
  }
  if (isUsageChallenge(usageResult.text, "https://chatgpt.com/backend-api/wham/usage")) {
    return {
      ok: false as const,
      code: "login_required" as const,
      message: "This session is no longer valid. Sign in again; Quodex never retries expired tokens.",
    };
  }
  if (!usageResult.json) {
    return { ok: false as const, code: "invalid" as const, message: "The service returned an invalid response." };
  }

  let resets: ResetCreditsResponse | null = null;
  let resetLookupFailed = false;
  try {
    const resetResult = await requestJson({
      url: "https://chatgpt.com/backend-api/wham/rate-limit-reset-credits",
      authorization: `Bearer ${data.accessToken}`,
      accountID: data.accountID,
      accepted: [...Array.from({ length: 100 }, (_, i) => 200 + i), 401, 403],
    });
    if (resetResult.status === 401 || resetResult.status === 403) {
      return {
        ok: false as const,
        code: "login_required" as const,
        message:
          "This session expired or was rejected. Sign in again; Quodex never retries expired tokens.",
      };
    }
    resets = (resetResult.json ?? null) as ResetCreditsResponse | null;
  } catch {
    resetLookupFailed = true;
  }

  const usage = usageResult.json as UsageAPIResponse;
  const snapshot = snapshotFromUsage(usage, resets, resetLookupFailed);
  return {
    ok: true as const,
    snapshot,
    email: usage.email ?? null,
    plan: usage.plan_type ?? null,
  };
}
