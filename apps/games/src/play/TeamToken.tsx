import type { Team } from "#/game/game";
import { cx } from "#/ui/cx";

export const teamInitial = (name: string) => {
  const first = name.trim().codePointAt(0);
  return first === undefined ? "?" : String.fromCodePoint(first).toUpperCase();
};

/** A team's round badge: its colour and first letter. */
export function TeamToken({
  team,
  className,
}: {
  readonly team: Pick<Team, "name" | "color">;
  readonly className?: string;
}) {
  return (
    <span aria-hidden="true" className={cx(`team-${team.color}`, "team-token", className)}>
      {teamInitial(team.name)}
    </span>
  );
}
