import { create } from "zustand";
import { persist } from "zustand/middleware";
import { fetchAccountUsage, isNativeApp, nativeDeleteTokens, nativeHasToken, nativeNotify, pollDeviceLogin, startDeviceLogin } from "@/lib/openai/api";
import { createDemoAccounts, isLandingFreeSample, landingEmail, refreshDemoSnapshot } from "./demo";
import { quotaEvents } from "./transitions";
import {
  AUTO_REFRESH_MS,
  MAXIMUM_ACCOUNTS,
  REFRESH_CONCURRENCY,
  moveAccountOrder,
  orderBySoonestReset,
  type AccountRecord,
  type AccountRefreshState,
  type LoginState,
  type OAuthTokens,
  type QuodexToast,
  type ToastStyle,
} from "./types";

interface QuodexSettings {
  notificationsEnabled: boolean;
}

interface QuodexState {
  hydrated: boolean;
  hasInitialized: boolean;
  accounts: AccountRecord[];
  tokens: Record<string, OAuthTokens>;
  refreshStates: Record<string, AccountRefreshState>;
  removingIDs: string[];
  isRefreshing: boolean;
  isSorting: boolean;
  lastRefreshAt: number | null;
  lastRefreshAttemptAt: number | null;
  now: number;
  toast: QuodexToast | null;
  loginPresented: boolean;
  loginState: LoginState;
  loginTarget: { accountID: string; email: string } | null;
  settings: QuodexSettings;
  demosCleared: boolean;
  hydrate: () => void;
  tick: () => void;
  showToast: (message: string, style?: ToastStyle) => void;
  presentLogin: (accountID?: string) => void;
  cancelLogin: () => void;
  finishLogin: () => void;
  startLogin: () => Promise<void>;
  pollLogin: () => Promise<void>;
  copyLoginCode: () => Promise<void>;
  openLoginPage: () => void;
  copyEmail: (email: string) => Promise<void>;
  refreshAll: (reason?: "manual" | "automatic" | "sort") => Promise<void>;
  refreshOne: (accountID: string) => Promise<void>;
  sortBySoonestReset: () => Promise<void>;
  removeAccount: (accountID: string) => void;
  reorder: (draggedID: string, toIndex: number) => void;
  toggleNotifications: (accountID: string) => Promise<void>;
  restoreDemo: () => void;
  clearDemo: () => void;
  restoreFromIdentities: (identities: { accountID: string; email: string; plan: string }[]) => void;
}

const initialAccounts = nativeSeed() ? [] : createDemoAccounts(Date.now());
const initialRefreshStates = seedStates(initialAccounts, Date.now());
let toastTimer: ReturnType<typeof setTimeout> | null = null;
let pollTimer: ReturnType<typeof setTimeout> | null = null;

function nativeSeed(): boolean {
  return typeof window !== "undefined" && Boolean(window.quodexNative?.isNative);
}

function seedStates(accounts: AccountRecord[], now: number): Record<string, AccountRefreshState> {
  const states: Record<string, AccountRefreshState> = {};
  for (const account of accounts) {
    states[account.id] = account.lastSnapshot
      ? { kind: "current", fetchedAt: account.lastSnapshot.fetchedAt }
      : { kind: "idle" };
  }
  void now;
  return states;
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const field = document.createElement("textarea");
    field.value = value;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.left = "-9999px";
    document.body.appendChild(field);
    field.select();
    document.execCommand("copy");
    document.body.removeChild(field);
  }
}

export const useQuodexStore = create<QuodexState>()(
  persist(
    (set, get) => ({
      hydrated: true,
      hasInitialized: true,
      accounts: initialAccounts,
      tokens: {},
      refreshStates: initialRefreshStates,
      removingIDs: [],
      isRefreshing: false,
      isSorting: false,
      lastRefreshAt: null,
      lastRefreshAttemptAt: null,
      now: Date.now(),
      toast: null,
      loginPresented: false,
      loginState: { kind: "idle" },
      loginTarget: null,
      settings: { notificationsEnabled: true },
      demosCleared: false,

      hydrate: () => {
        const now = Date.now();
        if (isNativeApp()) {
          set({
            hydrated: true,
            hasInitialized: true,
            accounts: get().accounts,
            tokens: {},
            now,
          });
          return;
        }
        if (get().demosCleared) {
          const live = get().accounts
            .filter((account) => !account.isDemo && !isLandingFreeSample(account))
            .map((account) => ({ ...account, email: landingEmail(account.email) }));
          set({
            hydrated: true,
            hasInitialized: true,
            accounts: live,
            tokens: {},
            refreshStates: seedStates(live, now),
            now,
          });
          return;
        }
        const live = get().accounts
          .filter((account) => !account.isDemo && !isLandingFreeSample(account))
          .map((account) => ({ ...account, email: landingEmail(account.email) }));
        const demos = createDemoAccounts(now);
        const paid = live.filter((account) => displayIsPaid(account.plan));
        const unpaid = live.filter((account) => !displayIsPaid(account.plan));
        const accounts = [...paid, ...demos, ...unpaid];
        set({
          hydrated: true,
          hasInitialized: true,
          accounts,
          tokens: {},
          refreshStates: seedStates(accounts, now),
          demosCleared: false,
          now,
        });
      },

      tick: () => set({ now: Date.now() }),

      showToast: (message, style = "info") => {
        if (toastTimer) clearTimeout(toastTimer);
        const toast = { id: crypto.randomUUID(), message, style };
        set({ toast });
        toastTimer = setTimeout(() => {
          if (get().toast?.id === toast.id) set({ toast: null });
        }, style === "warning" ? 5200 : 2800);
      },

      presentLogin: (accountID) => {
        const account = accountID ? get().accounts.find((item) => item.id === accountID) : null;
        set({
          loginPresented: true,
          loginState: { kind: "idle" },
          loginTarget: account ? { accountID: account.id, email: account.email } : null,
        });
      },

      cancelLogin: () => {
        if (pollTimer) clearTimeout(pollTimer);
        pollTimer = null;
        set({ loginPresented: false, loginState: { kind: "idle" }, loginTarget: null });
      },

      finishLogin: () => {
        if (pollTimer) clearTimeout(pollTimer);
        pollTimer = null;
        set({ loginPresented: false, loginState: { kind: "idle" }, loginTarget: null });
      },

      startLogin: async () => {
        if (!isNativeApp()) {
          set({
            loginState: {
              kind: "failed",
              message: "Real ChatGPT sign-in is disabled in this browser preview. Download Quodex for Windows — sessions there are sealed with DPAPI.",
            },
          });
          return;
        }
        set({ loginState: { kind: "requestingCode" } });
        try {
          const login = await startDeviceLogin();
          await copyText(login.userCode);
          set({ loginState: { kind: "waiting", ...login } });
          if (isNativeApp() && window.quodexNative) {
            await window.quodexNative.openExternal(login.verificationURL);
          } else {
            window.open(login.verificationURL, "_blank", "noopener,noreferrer");
          }
        } catch (error) {
          set({
            loginState: {
              kind: "failed",
              message:
                error instanceof Error
                  ? error.message
                  : "Could not start OpenAI device sign-in.",
            },
          });
        }
      },

      pollLogin: async () => {
        if (!isNativeApp()) return;
        const { loginState, loginTarget, accounts } = get();
        if (loginState.kind !== "waiting") return;
        try {
          const result = await pollDeviceLogin({
            deviceAuthID: loginState.deviceAuthID,
            userCode: loginState.userCode,
          });
          if (result.status === "pending") return;
          if (result.status !== "complete" || !result.identity) {
            throw new Error("The service returned an invalid response.");
          }
          const identity = result.identity;
          if (loginTarget && identity.accountID !== loginTarget.accountID) {
            throw new Error(
              `This sign-in belongs to ${identity.email}, not ${loginTarget.email}. No session was changed.`,
            );
          }

          const existing = accounts.find((account) => account.id === identity.accountID);
          let nextAccounts = accounts;
          if (existing) {
            nextAccounts = accounts.map((account) =>
              account.id === identity.accountID
                ? { ...account, email: identity.email, plan: identity.plan, isDemo: false }
                : account,
            );
          } else {
            if (accounts.length >= MAXIMUM_ACCOUNTS) {
              throw new Error("Quodex supports up to 100 accounts.");
            }
            const incoming: AccountRecord = {
              id: identity.accountID,
              email: identity.email,
              plan: identity.plan,
              addedAt: Date.now(),
              lastSnapshot: null,
              resetNotificationsEnabled: false,
              lastKnownBankedResetCount: null,
              isDemo: false,
            };
            if (incoming.plan.toLowerCase() === "free") {
              nextAccounts = [...accounts, incoming];
            } else {
              let insertAt = 0;
              for (let i = 0; i < accounts.length; i += 1) {
                if (displayIsPaid(accounts[i]?.plan ?? "free")) insertAt = i + 1;
              }
              nextAccounts = [...accounts.slice(0, insertAt), incoming, ...accounts.slice(insertAt)];
            }
          }

          set({
            accounts: nextAccounts,
            tokens: {},
            refreshStates: {
              ...get().refreshStates,
              [identity.accountID]: { kind: "idle" },
            },
            loginState: {
              kind: "complete",
              message: loginTarget
                ? `Session refreshed for ${identity.email}.`
                : existing
                  ? "Existing login refreshed — no duplicate was created."
                  : `${identity.email} was added.`,
            },
          });
          await get().refreshOne(identity.accountID);
        } catch (error) {
          set({
            loginState: {
              kind: "failed",
              message: error instanceof Error ? error.message : "Sign-in did not finish.",
            },
          });
        }
      },

      copyLoginCode: async () => {
        const { loginState, showToast } = get();
        if (loginState.kind !== "waiting") return;
        await copyText(loginState.userCode);
        showToast("Code copied to the clipboard.", "success");
      },

      openLoginPage: () => {
        const { loginState } = get();
        if (loginState.kind !== "waiting") return;
        if (isNativeApp() && window.quodexNative) {
          void window.quodexNative.openExternal(loginState.verificationURL);
        }
      },

      copyEmail: async (email) => {
        await copyText(email);
        get().showToast(`Copied ${email} to clipboard.`, "success");
      },

      refreshAll: async (reason = "manual") => {
        const { accounts, lastRefreshAttemptAt, isRefreshing, showToast } = get();
        if (accounts.length === 0 || isRefreshing) return;
        if (
          reason === "automatic" &&
          lastRefreshAttemptAt &&
          Date.now() - lastRefreshAttemptAt < AUTO_REFRESH_MS
        ) {
          return;
        }
        if (reason === "manual") {
          showToast(
            accounts.length === 1
              ? `Refreshing ${accounts[0]?.email} usage limits.`
              : `Refreshing all ${accounts.length} accounts’ usage limits.`,
            "info",
          );
        }
        if (reason === "sort") {
          showToast("Refreshing all accounts before sorting.", "info");
        }
        set({ isRefreshing: true, lastRefreshAttemptAt: Date.now() });
        try {
          await mapPool(get().accounts, REFRESH_CONCURRENCY, (account) => refreshAccount(account.id, set, get));
          set({ lastRefreshAt: Date.now() });
        } finally {
          set({ isRefreshing: false });
        }
      },

      refreshOne: async (accountID) => {
        const account = get().accounts.find((item) => item.id === accountID);
        if (!account || get().refreshStates[accountID]?.kind === "refreshing") return;
        if (get().refreshStates[accountID]?.kind === "requiresLogin") return;
        get().showToast(`Refreshing ${account.email} usage limits.`, "info");
        await refreshAccount(accountID, set, get);
      },

      sortBySoonestReset: async () => {
        if (get().accounts.length === 0 || get().isSorting) return;
        set({ isSorting: true });
        try {
          await get().refreshAll("sort");
          const ordered = orderBySoonestReset(get().accounts, Date.now());
          const lookup = new Map(get().accounts.map((account) => [account.id, account]));
          set({
            accounts: ordered
              .map((id) => lookup.get(id))
              .filter((account): account is AccountRecord => Boolean(account)),
          });
          get().showToast("Accounts sorted by soonest reset.", "success");
        } finally {
          set({ isSorting: false });
        }
      },

      removeAccount: (accountID) => {
        const { accounts, tokens, refreshStates } = get();
        const nextTokens = { ...tokens };
        delete nextTokens[accountID];
        const nextStates = { ...refreshStates };
        delete nextStates[accountID];
        void nativeDeleteTokens(accountID);
        const remaining = accounts.filter((account) => account.id !== accountID);
        set({
          accounts: remaining,
          tokens: nextTokens,
          refreshStates: nextStates,
          demosCleared: remaining.length === 0 ? true : get().demosCleared,
        });
        get().showToast("Account removed from Quodex.", "success");
      },

      reorder: (draggedID, toIndex) => {
        const ids = get().accounts.map((account) => account.id);
        const next = moveAccountOrder(ids, draggedID, toIndex);
        if (!next) return;
        const lookup = new Map(get().accounts.map((account) => [account.id, account]));
        set({
          accounts: next
            .map((id) => lookup.get(id))
            .filter((account): account is AccountRecord => Boolean(account)),
        });
      },

      toggleNotifications: async (accountID) => {
        const account = get().accounts.find((item) => item.id === accountID);
        if (!account) return;
        if (get().refreshStates[accountID]?.kind === "requiresLogin") {
          get().showToast("Sign in again before enabling reset alerts.", "warning");
          return;
        }
        if (!account.resetNotificationsEnabled && !isNativeApp() && "Notification" in window) {
          const permission = await Notification.requestPermission();
          if (permission !== "granted") {
            get().showToast("Notifications are blocked in this browser.", "warning");
            return;
          }
        }
        set({
          accounts: get().accounts.map((item) =>
            item.id === accountID
              ? { ...item, resetNotificationsEnabled: !item.resetNotificationsEnabled }
              : item,
          ),
        });
        const enabled = get().accounts.find((item) => item.id === accountID)?.resetNotificationsEnabled;
        get().showToast(
          enabled
            ? `Reset alerts turned on for ${account.email}.`
            : `Reset alerts turned off for ${account.email}.`,
          "success",
        );
      },

      restoreDemo: () => {
        if (isNativeApp()) return;
        const demos = createDemoAccounts(Date.now());
        const live = get().accounts.filter((account) => !account.isDemo);
        const accounts = [...live.filter((account) => displayIsPaid(account.plan)), ...demos, ...live.filter((account) => !displayIsPaid(account.plan))];
        set({
          accounts,
          refreshStates: { ...get().refreshStates, ...seedStates(demos, Date.now()) },
          hasInitialized: true,
          demosCleared: false,
        });
        get().showToast("Sample accounts restored.", "success");
      },

      clearDemo: () => {
        const live = get().accounts.filter((account) => !account.isDemo);
        const states = { ...get().refreshStates };
        for (const account of get().accounts) {
          if (account.isDemo) delete states[account.id];
        }
        set({ accounts: live, refreshStates: states, demosCleared: live.length === 0 });
        get().showToast("Sample accounts removed.", "success");
      },

      restoreFromIdentities: (identities) => {
        if (!identities.length) return;
        const have = new Set(get().accounts.map((account) => account.id));
        const now = Date.now();
        const added: AccountRecord[] = [];
        for (const identity of identities) {
          if (have.has(identity.accountID)) continue;
          added.push({
            id: identity.accountID,
            email: identity.email,
            plan: identity.plan,
            addedAt: now,
            lastSnapshot: null,
            resetNotificationsEnabled: false,
            lastKnownBankedResetCount: null,
          });
        }
        if (added.length === 0) return;
        const accounts = [...get().accounts, ...added];
        set({
          accounts,
          refreshStates: { ...get().refreshStates, ...seedStates(added, now) },
          hasInitialized: true,
        });
      },
    }),
    {
      name: "quodex-win-v1",
      version: 4,
      partialize: (state) => ({
        hasInitialized: state.hasInitialized,
        accounts: state.accounts.map((account) => ({
          ...account,
          isDemo: account.isDemo || account.id.startsWith("demo-"),
        })),
        tokens: {},
        lastRefreshAt: state.lastRefreshAt,
        lastRefreshAttemptAt: state.lastRefreshAttemptAt,
        settings: state.settings,
        demosCleared: state.demosCleared,
      }),
      migrate: (persisted) => {
        const data = persisted && typeof persisted === "object" ? (persisted as Record<string, unknown>) : {};
        const raw = Array.isArray(data.accounts) ? data.accounts : [];
        const accounts = raw
          .filter((item) => {
            if (!item || typeof item !== "object") return false;
            return !isLandingFreeSample(item as AccountRecord);
          })
          .map((item) => {
            const account = item as AccountRecord;
            if (isNativeApp()) return account;
            return { ...account, email: landingEmail(account.email) };
          });
        return { ...data, tokens: {}, accounts };
      },
      skipHydration: true,
    },
  ),
);

function displayIsPaid(plan: string): boolean {
  return plan.trim().toLowerCase() !== "free";
}

async function mapPool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  if (items.length === 0) return;
  let cursor = 0;
  const run = async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      const item = items[index];
      if (item !== undefined) await worker(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
}

type SetState = (
  partial: Partial<QuodexState> | ((state: QuodexState) => Partial<QuodexState>),
) => void;
type GetState = () => QuodexState;

async function refreshAccount(accountID: string, set: SetState, get: GetState) {
  const account = get().accounts.find((item) => item.id === accountID);
  if (!account) return;
  set({
    refreshStates: { ...get().refreshStates, [accountID]: { kind: "refreshing" } },
  });
  if (account.isDemo) {
    const updated = refreshDemoSnapshot(account);
    const fetchedAt = updated.lastSnapshot?.fetchedAt ?? Date.now();
    set({
      accounts: get().accounts.map((item) => (item.id === accountID ? updated : item)),
      refreshStates: { ...get().refreshStates, [accountID]: { kind: "current", fetchedAt } },
    });
    return;
  }
  if (!(await nativeHasToken(accountID))) {
    set({
      refreshStates: { ...get().refreshStates, [accountID]: { kind: "requiresLogin" } },
    });
    return;
  }
  try {
    const result = await fetchAccountUsage({
      accountID,
    });
    if (!result.ok) {
      set({
        refreshStates: {
          ...get().refreshStates,
          [accountID]:
            result.code === "login_required"
              ? { kind: "requiresLogin" }
              : { kind: "failed", message: result.message },
        },
      });
      return;
    }
    set({
      accounts: get().accounts.map((item) =>
        item.id === accountID
          ? {
              ...item,
              email: result.email || item.email,
              plan: result.plan || item.plan,
              lastSnapshot: result.snapshot,
              lastKnownBankedResetCount: result.snapshot.bankedResets?.count ?? item.lastKnownBankedResetCount,
            }
          : item,
      ),
      refreshStates: {
        ...get().refreshStates,
        [accountID]: { kind: "current", fetchedAt: result.snapshot.fetchedAt },
      },
    });
    if (!account.isDemo) {
      for (const event of quotaEvents({
        email: result.email || account.email,
        previous: account,
        next: result.snapshot,
        bellEnabled: account.resetNotificationsEnabled,
      })) {
        void nativeNotify(event.title, event.body);
      }
    }
  } catch (error) {
    set({
      refreshStates: {
        ...get().refreshStates,
        [accountID]: {
          kind: "failed",
          message: error instanceof Error ? error.message : "Update failed",
        },
      },
    });
  }
}
