import { useState } from "react";
import { saveSettings } from "#/api/functions";
import { useLedgerMutation, useWorkspace } from "#/api/queries";
import { formatMoney } from "#/domain/money";
import { Button, Card, Field, TextInput } from "#/ui/controls";

/** Currency and my share of shared spending. */
export function GeneralSettings() {
  const { settings, email } = useWorkspace();
  const [currency, setCurrency] = useState(settings.currency);
  const [sharePercent, setSharePercent] = useState(String(settings.sharePercent));
  const save = useLedgerMutation(saveSettings, ["workspace"]);

  const share = Number(sharePercent);
  const valid =
    /^[A-Z]{3}$/.test(currency) &&
    sharePercent.trim() !== "" &&
    Number.isInteger(share) &&
    share >= 0 &&
    share <= 100;
  let sample: string;
  try {
    sample = valid ? formatMoney(-123456, currency) : "–";
  } catch {
    // Three letters that are no currency.
    sample = "–";
  }

  return (
    <Card className="max-w-xl p-4">
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (valid) save.mutate({ data: { currency, sharePercent: share } });
        }}
      >
        <Field
          label="Currency"
          hint={`Three-letter code, for example SEK, EUR or USD. Amounts look like ${sample}.`}
        >
          <TextInput
            className="max-w-28 uppercase"
            value={currency}
            maxLength={3}
            onChange={(event) => setCurrency(event.target.value.toUpperCase())}
          />
        </Field>
        <Field
          label="My share of shared transactions (%)"
          hint="Used by views set to count only my share of shared spending."
        >
          <TextInput
            className="max-w-28"
            type="number"
            min={0}
            max={100}
            step={1}
            value={sharePercent}
            onChange={(event) => setSharePercent(event.target.value)}
          />
        </Field>
        <div className="flex items-center justify-between gap-3">
          <p className="truncate text-xs text-ink-2">Signed in as {email}</p>
          <Button type="submit" variant="primary" disabled={!valid || save.isPending}>
            {save.isPending ? "Saving…" : save.isSuccess ? "Saved" : "Save"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
