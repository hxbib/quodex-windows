import { useEffect } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, LoaderCircle, ShieldCheck, UserPlus } from "lucide-react";
import { isNativeApp } from "@/lib/openai/api";
import { loginFootnote } from "@/lib/quodex/copy";
import { useQuodexStore } from "@/lib/quodex/store";
import { downloadWindowsApp, SITE } from "@/lib/site";

export function LoginView() {
  const loginState = useQuodexStore((s) => s.loginState);
  const loginTarget = useQuodexStore((s) => s.loginTarget);
  const startLogin = useQuodexStore((s) => s.startLogin);
  const cancelLogin = useQuodexStore((s) => s.cancelLogin);
  const finishLogin = useQuodexStore((s) => s.finishLogin);
  const copyLoginCode = useQuodexStore((s) => s.copyLoginCode);
  const openLoginPage = useQuodexStore((s) => s.openLoginPage);
  const pollLogin = useQuodexStore((s) => s.pollLogin);

  useEffect(() => {
    if (!isNativeApp()) return;
    if (loginState.kind !== "waiting") return;
    const id = window.setInterval(() => {
      void pollLogin();
    }, Math.max(1, loginState.intervalSeconds) * 1000);
    void pollLogin();
    return () => window.clearInterval(id);
  }, [loginState, pollLogin]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 px-4 py-3">
        <button type="button" className="circle-btn" onClick={cancelLogin} aria-label="Back to accounts">
          <ArrowLeft size={14} />
        </button>
        <h2 className="flex-1 text-center text-[14px] font-semibold">
          {loginTarget ? "Sign in again" : "Add ChatGPT account"}
        </h2>
        <span className="size-7" />
      </header>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
        {!isNativeApp() ? (
          <>
            <Download className="text-win-accent" size={40} strokeWidth={1.4} />
            <h3 className="text-[18px] font-semibold">Real sign-in lives in the Windows app</h3>
            <p className="max-w-md text-[13px] leading-relaxed text-win-muted">
              This website is a live Windows 11 desktop with sample accounts. Download the installer to sign in with OpenAI’s device code — tokens stay in a DPAPI vault on your PC.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" className="fluent-btn fluent-btn-accent" onClick={downloadWindowsApp}>
                {SITE.downloadLabel}
              </button>
              <button type="button" className="fluent-btn" onClick={cancelLogin}>
                Keep exploring samples
              </button>
            </div>
          </>
        ) : null}
        {isNativeApp() && loginState.kind === "idle" ? (
          <>
            <UserPlus className="text-win-accent" size={44} strokeWidth={1.4} />
            <h3 className="text-[18px] font-semibold">
              {loginTarget ? "Refresh this session" : "Sign in with a one-time code"}
            </h3>
            {loginTarget ? <p className="text-[13px] font-semibold">{loginTarget.email}</p> : null}
            <p className="max-w-md text-[13px] leading-relaxed text-win-muted">
              {loginTarget
                ? `A secure OpenAI page will open. Sign in as ${loginTarget.email}, then enter the code shown here. A different account will be rejected without changing any session.`
                : "A secure OpenAI page will open in your system browser. Sign in to the account you want to track, then enter the code shown here."}
            </p>
            <button type="button" className="fluent-btn fluent-btn-accent" onClick={() => void startLogin()}>
              Start sign-in
            </button>
          </>
        ) : null}
        {isNativeApp() && loginState.kind === "requestingCode" ? (
          <>
            <LoaderCircle className="animate-spin text-win-accent" size={36} />
            <p className="text-[15px] font-semibold">Requesting a secure sign-in code…</p>
          </>
        ) : null}
        {isNativeApp() && loginState.kind === "waiting" ? (
          <>
            <ShieldCheck className="text-win-accent" size={40} strokeWidth={1.4} />
            <h3 className="text-[16px] font-semibold">Enter this code</h3>
            <p className="rounded-win bg-white/8 px-5 py-3 font-mono text-[28px] font-bold tracking-[0.18em]">
              {loginState.userCode}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" className="fluent-btn" onClick={() => void copyLoginCode()}>
                Copy code
              </button>
              <button type="button" className="fluent-btn fluent-btn-accent" onClick={openLoginPage}>
                Open login page
              </button>
            </div>
            <p className="text-[12px] text-win-subtle">Waiting for OpenAI to confirm sign-in…</p>
          </>
        ) : null}
        {isNativeApp() && loginState.kind === "complete" ? (
          <>
            <CheckCircle2 className="text-win-ok" size={44} />
            <h3 className="text-[18px] font-semibold">Account ready</h3>
            <p className="max-w-md text-[13px] text-win-muted">{loginState.message}</p>
            <button type="button" className="fluent-btn fluent-btn-accent" onClick={finishLogin}>
              Done
            </button>
          </>
        ) : null}
        {isNativeApp() && loginState.kind === "failed" ? (
          <>
            <AlertTriangle className="text-amber-400" size={42} />
            <h3 className="text-[18px] font-semibold">Sign-in did not finish</h3>
            <p className="max-w-md text-[13px] text-win-muted">{loginState.message}</p>
            <div className="flex gap-2">
              <button type="button" className="fluent-btn" onClick={cancelLogin}>
                Cancel
              </button>
              <button type="button" className="fluent-btn fluent-btn-accent" onClick={() => void startLogin()}>
                Try again
              </button>
            </div>
          </>
        ) : null}
      </div>
      <p className="px-5 py-4 text-center text-[11px] leading-relaxed text-win-subtle">{loginFootnote()}</p>
    </div>
  );
}
