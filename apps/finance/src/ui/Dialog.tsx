import { type ReactNode, useEffect, useRef } from "react";

/** A modal built on the browser's own `<dialog>`: focus trap, Escape and backdrop included. */
export function Dialog({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  readonly open: boolean;
  readonly title: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog === null) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className="m-auto w-[min(34rem,calc(100vw-2rem))] rounded-xl border border-line bg-surface p-0 shadow-xl"
    >
      {open ? (
        <div className="flex max-h-[calc(100dvh-4rem)] flex-col">
          <h2 className="border-b border-line px-5 py-3.5 text-base font-semibold">{title}</h2>
          <div className="flex flex-col gap-4 overflow-y-auto px-5 py-4">{children}</div>
          {footer === undefined ? null : (
            <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">
              {footer}
            </div>
          )}
        </div>
      ) : null}
    </dialog>
  );
}
