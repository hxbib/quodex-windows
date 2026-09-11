export interface ChatGPTIdentity {
  accountID: string;
  email: string;
  plan: string;
}

function base64UrlDecode(value: string): string | null {
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
    if (typeof atob === "function") return atob(padded);
    return Buffer.from(padded, "base64").toString("utf8");
  } catch {
    return null;
  }
}

function claims(token: string): Record<string, unknown> | null {
  const segments = token.split(".");
  if (segments.length !== 3 || !segments[1]) return null;
  const decoded = base64UrlDecode(segments[1]);
  if (!decoded) return null;
  try {
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function nonEmpty(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function identityFromIdToken(idToken: string): ChatGPTIdentity {
  const parsed = claims(idToken);
  if (!parsed) throw new Error("The sign-in token could not be read.");
  const profile = (parsed["https://api.openai.com/profile"] ?? {}) as Record<string, unknown>;
  const auth = (parsed["https://api.openai.com/auth"] ?? {}) as Record<string, unknown>;
  const accountID = nonEmpty(auth.chatgpt_account_id);
  if (!accountID) throw new Error("The sign-in did not include a ChatGPT account identifier.");
  const email =
    nonEmpty(parsed.email) ??
    nonEmpty(profile.email) ??
    `Account ${accountID.slice(-6)}`;
  const plan = nonEmpty(auth.chatgpt_plan_type) ?? "ChatGPT";
  return { accountID, email, plan };
}

export function expirationFromToken(token: string): number | null {
  const parsed = claims(token);
  if (!parsed) return null;
  const exp = parsed.exp;
  if (typeof exp === "number") return exp * 1000;
  return null;
}
