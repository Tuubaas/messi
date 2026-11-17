/**
 * Keeps a screen's clock in step with its room's, so "when was the button pressed" means
 * the same instant on every phone no matter how slow its connection is.
 *
 * The method is the one network time uses: send the local time, get the room's time back,
 * and assume the message took as long there as back. An exchange that was quick leaves
 * little room for that assumption to be wrong, so the quickest recent one is the one to trust.
 */

export interface ClockSample {
  /** How long the exchange took, there and back. */
  readonly roundTrip: number;
  /** What to add to the local clock to get the room's clock. */
  readonly offset: number;
  /** Local time the answer came back. */
  readonly takenAt: number;
}

const KEPT_SAMPLES = 12;
/** Clocks drift apart slowly; a sample older than this is no longer worth trusting. */
const FRESH_FOR_MS = 180_000;

/** One exchange: asked at `sent`, answered at `received` (local), the room's clock read `roomTime`. */
export const sampleOf = (sent: number, received: number, roomTime: number): ClockSample => {
  const roundTrip = Math.max(0, received - sent);
  return { roundTrip, offset: roomTime - (sent + roundTrip / 2), takenAt: received };
};

export const addSample = (
  samples: ReadonlyArray<ClockSample>,
  sample: ClockSample,
): ReadonlyArray<ClockSample> =>
  [...samples.filter((old) => sample.takenAt - old.takenAt < FRESH_FOR_MS), sample].slice(
    -KEPT_SAMPLES,
  );

/** The quickest exchange on record, or `null` before the first answer. */
export const bestSample = (samples: ReadonlyArray<ClockSample>): ClockSample | null =>
  samples.length === 0
    ? null
    : samples.reduce((best, next) => (next.roundTrip < best.roundTrip ? next : best));
