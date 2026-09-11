/** Bundled only into the desktop renderer — OpenAI traffic stays in the main process. */

import type { ChatGPTIdentity } from "../quodex/jwt";
import type { UsageSnapshot } from "../quodex/types";

export async function startDeviceLogin(): Promise<{
  verificationURL: string;
  userCode: string;
  deviceAuthID: string;
  intervalSeconds: number;
}> {
  throw new Error("OpenAI device sign-in runs in the Quodex desktop process, not this window.");
}

export async function pollDeviceLogin(_input?: {
  data: { deviceAuthID: string; userCode: string };
}): Promise<
  | { status: "pending" }
  | { status: "complete"; identity: ChatGPTIdentity; idToken: string; accessToken: string }
> {
  throw new Error("OpenAI device sign-in runs in the Quodex desktop process, not this window.");
}

export async function fetchAccountUsage(_input?: {
  data: { accessToken: string; accountID: string };
}): Promise<
  | { ok: true; snapshot: UsageSnapshot; email: string | null; plan: string | null }
  | { ok: false; code: "login_required" | "invalid"; message: string }
> {
  throw new Error("Usage refresh runs in the Quodex desktop process, not this window.");
}
