import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";
import { Id, IsoDate, Owner, PERIOD_PRESETS } from "#/domain/model";
import { TransactionsPage } from "#/transactions/TransactionsPage";

/** The filters, in the address: a filtered list can be bookmarked and linked to. */
const Search = Schema.Struct({
  q: Schema.optional(Schema.String),
  period: Schema.optional(Schema.Literals(PERIOD_PRESETS)),
  /** A custom range, when both are set. */
  from: Schema.optional(IsoDate),
  to: Schema.optional(IsoDate),
  account: Schema.optional(Id),
  category: Schema.optional(Schema.Union([Id, Schema.Literal("none")])),
  owner: Schema.optional(Owner),
});

export const Route = createFileRoute("/transactions")({
  validateSearch: Schema.toStandardSchemaV1(Search),
  component: TransactionsPage,
});
