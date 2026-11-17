import { describe, expect, it } from "vite-plus/test";
import { addSample, bestSample, type ClockSample, sampleOf } from "./clock";

describe("clock sync", () => {
  it("finds the offset when the message takes as long there as back", () => {
    // The room's clock is 5000 ahead. Asked at 100, the room read 5120, answered at 140.
    expect(sampleOf(100, 140, 5120)).toEqual({ roundTrip: 40, offset: 5000, takenAt: 140 });
  });

  it("is off by at most half the round trip, however lopsided the connection", () => {
    // Same clocks, but all 40 ms were spent on the way there.
    const lopsided = sampleOf(100, 140, 5140);
    expect(Math.abs(lopsided.offset - 5000)).toBeLessThanOrEqual(lopsided.roundTrip / 2);
  });

  it("trusts the quickest exchange", () => {
    const samples = [
      sampleOf(0, 180, 5100),
      sampleOf(200, 212, 5206),
      sampleOf(400, 460, 5440),
    ].reduce(addSample, [] as ReadonlyArray<ClockSample>);
    expect(bestSample(samples)).toMatchObject({ roundTrip: 12, offset: 5000 });
    expect(bestSample([])).toBeNull();
  });

  it("forgets old measurements and keeps only the recent few", () => {
    const old = sampleOf(0, 2, 5001);
    const fresh = sampleOf(400_000, 400_050, 405_025);
    expect(addSample([old], fresh)).toEqual([fresh]);

    const many = Array.from({ length: 30 }, (_, index) => sampleOf(index * 10, index * 10 + 5, 0));
    expect(many.reduce(addSample, [] as ReadonlyArray<ClockSample>)).toHaveLength(12);
  });
});
