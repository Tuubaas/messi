import { Link, createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";
import { AccountsSettings } from "#/settings/AccountsSettings";
import { CategoriesSettings } from "#/settings/CategoriesSettings";
import { GeneralSettings } from "#/settings/GeneralSettings";
import { RulesSettings } from "#/settings/RulesSettings";
import { PageHeader } from "#/ui/controls";

const TABS = ["accounts", "categories", "rules", "general"] as const;

const TAB_LABELS: Record<(typeof TABS)[number], string> = {
  accounts: "Accounts",
  categories: "Categories",
  rules: "Rules",
  general: "General",
};

const Search = Schema.Struct({ tab: Schema.optional(Schema.Literals(TABS)) });

export const Route = createFileRoute("/settings")({
  validateSearch: Schema.toStandardSchemaV1(Search),
  component: SettingsPage,
});

function SettingsPage() {
  const { tab = "accounts" } = Route.useSearch();
  return (
    <>
      <PageHeader title="Settings" />
      <nav aria-label="Settings" className="mb-5 flex gap-1 border-b border-line">
        {TABS.map((value) => (
          <Link
            key={value}
            to="/settings"
            search={{ tab: value }}
            aria-current={value === tab ? "page" : undefined}
            className={
              value === tab
                ? "-mb-px border-b-2 border-accent px-3 py-2 text-sm font-medium"
                : "-mb-px border-b-2 border-transparent px-3 py-2 text-sm text-ink-2 hover:text-ink"
            }
          >
            {TAB_LABELS[value]}
          </Link>
        ))}
      </nav>
      {tab === "accounts" ? <AccountsSettings /> : null}
      {tab === "categories" ? <CategoriesSettings /> : null}
      {tab === "rules" ? <RulesSettings /> : null}
      {tab === "general" ? <GeneralSettings /> : null}
    </>
  );
}
