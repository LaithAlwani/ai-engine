"use client";

import { useCallback, useEffect, useState } from "react";

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
};

// Promise-based confirmation. Usage:
//   const { confirm, dialog } = useConfirm();
//   if (await confirm({ title, message, destructive: true })) { ...delete... }
//   return (<>…{dialog}</>);
export function useConfirm() {
  const [state, setState] = useState<
    (ConfirmOptions & { resolve: (v: boolean) => void }) | null
  >(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => setState({ ...opts, resolve }));
  }, []);

  const close = useCallback(
    (result: boolean) => {
      state?.resolve(result);
      setState(null);
    },
    [state],
  );

  const dialog = state ? (
    <ConfirmDialog options={state} onClose={close} />
  ) : null;

  return { confirm, dialog };
}

function ConfirmDialog({
  options,
  onClose,
}: {
  options: ConfirmOptions;
  onClose: (result: boolean) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose(false);
      if (e.key === "Enter") onClose(true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={() => onClose(false)}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-sm rounded-xl border border-line-strong bg-surface p-6 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-xl text-bone">{options.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {options.message}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={() => onClose(false)}
            className="h-10 rounded-full px-4 text-sm text-muted transition-colors hover:text-bone"
          >
            Cancel
          </button>
          <button
            autoFocus
            onClick={() => onClose(true)}
            className={`h-10 rounded-full px-5 text-sm font-medium transition-colors ${
              options.destructive
                ? "bg-ember-deep text-bone hover:bg-ember"
                : "bg-ember text-[#160b04] hover:bg-flare"
            }`}
          >
            {options.confirmLabel ?? "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
