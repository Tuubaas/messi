import { type ReactNode, useEffect, useRef } from "react";

/**
 * A modal on the browser's own `<dialog>`: it traps focus, closes on Escape and dims the
 * page without any extra code. Clicking outside closes it too.
 */
export function Dialog({
  open,
  onClose,
  title,
  width,
  children,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  /** Names the dialog for screen readers; the visible heading is up to `children`. */
  readonly title: string;
  readonly width?: string;
  readonly children: ReactNode;
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
      className="dialog"
      style={width === undefined ? undefined : { maxWidth: width, width: "calc(100% - 2rem)" }}
      onClose={onClose}
      onClick={(event) => {
        // The dialog element itself is only hit through its backdrop: content sits in the div.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="p-6 sm:p-7">{children}</div>
    </dialog>
  );
}
