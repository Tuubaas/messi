import { Link } from "@tanstack/react-router";
import { buttonClass } from "#/ui/Button";
import { Icon } from "#/ui/Icon";
import { Logo } from "#/ui/Logo";

export function AdminHeader({ email }: { readonly email: string }) {
  return (
    <header className="mx-auto flex max-w-5xl items-center gap-3 px-5 py-5 sm:px-8">
      <Link to="/admin" className="rounded-full">
        <Logo className="text-xl" />
      </Link>
      <span className="rounded-full bg-white/8 px-2.5 py-1 text-xs font-extrabold uppercase tracking-wider text-ink-200">
        Admin
      </span>
      <span className="ml-auto hidden truncate text-sm text-ink-400 sm:block">{email}</span>
      <Link
        to="/"
        className={buttonClass({ variant: "ghost", size: "sm", className: "ml-auto sm:ml-0" })}
      >
        Play view
        <Icon name="external" />
      </Link>
    </header>
  );
}
