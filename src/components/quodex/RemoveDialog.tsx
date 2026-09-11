import { useDesktopStore } from "@/lib/desktop/store";
import { isNativeApp } from "@/lib/openai/api";
import { removeCopy } from "@/lib/quodex/copy";
import { useQuodexStore } from "@/lib/quodex/store";

export function RemoveDialog() {
  const removeTarget = useDesktopStore((s) => s.removeTarget);
  const setRemoveTarget = useDesktopStore((s) => s.setRemoveTarget);
  const recycleAccount = useDesktopStore((s) => s.recycleAccount);
  const accounts = useQuodexStore((s) => s.accounts);
  const removeAccount = useQuodexStore((s) => s.removeAccount);
  const account = accounts.find((item) => item.id === removeTarget);
  if (!account) return null;

  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-black/35 px-4">
      <div className="w-full max-w-md rounded-win border border-win-stroke-strong mica p-5 shadow-[var(--shadow-flyout)]">
        <h2 className="text-[18px] font-semibold">Remove account?</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-win-muted">{removeCopy(account.email)}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="fluent-btn" onClick={() => setRemoveTarget(null)}>
            Cancel
          </button>
          <button
            type="button"
            className="fluent-btn"
            style={{ background: "var(--color-win-danger)", color: "#fff", borderColor: "transparent" }}
            onClick={() => {
              if (!isNativeApp()) {
                recycleAccount({
                  id: account.id,
                  email: account.email,
                  plan: account.plan,
                  removedAt: Date.now(),
                });
              }
              removeAccount(account.id);
              setRemoveTarget(null);
            }}
          >
            Remove {account.email}
          </button>
        </div>
      </div>
    </div>
  );
}
