import { describe, expect, it } from "vite-plus/test";
import {
  addDays,
  bucketKey,
  bucketLabel,
  bucketsBetween,
  isRealDate,
  resolvePeriod,
  today,
} from "./dates";

const all = { from: "2024-03-10", to: "2026-11-02" };

describe("calendar days", () => {
  it("adds days across months, years and leap days", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
  });

  it("knows which days exist", () => {
    expect(isRealDate(2024, 2, 29)).toBe(true);
    expect(isRealDate(2026, 2, 29)).toBe(false);
    expect(isRealDate(2026, 13, 1)).toBe(false);
  });

  it("takes today from the local clock, not UTC", () => {
    expect(today(new Date(2026, 10, 17, 23, 30))).toBe("2026-11-17");
  });
});

describe("buckets", () => {
  it("puts a day in its week (from Monday), month, quarter and year", () => {
    // 2026-11-17 is a Tuesday.
    expect(bucketKey("2026-11-17", "day")).toBe("2026-11-17");
    expect(bucketKey("2026-11-17", "week")).toBe("2026-11-16");
    expect(bucketKey("2026-11-15", "week")).toBe("2026-11-09");
    expect(bucketKey("2026-11-17", "month")).toBe("2026-11");
    expect(bucketKey("2026-11-17", "quarter")).toBe("2026-Q4");
    expect(bucketKey("2026-11-17", "year")).toBe("2026");
  });

  it("lists every bucket of a range, empty ones included", () => {
    expect(bucketsBetween({ from: "2025-11-15", to: "2026-02-03" }, "month")).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
    expect(bucketsBetween({ from: "2025-11-15", to: "2026-02-03" }, "quarter")).toEqual([
      "2025-Q4",
      "2026-Q1",
    ]);
    expect(bucketsBetween({ from: "2026-11-11", to: "2026-11-24" }, "week")).toEqual([
      "2026-11-09",
      "2026-11-16",
      "2026-11-23",
    ]);
    expect(bucketsBetween({ from: "2026-02-27", to: "2026-03-02" }, "day")).toHaveLength(4);
    expect(bucketsBetween({ from: "2024-06-01", to: "2026-01-01" }, "year")).toEqual([
      "2024",
      "2025",
      "2026",
    ]);
  });

  it("labels buckets for an axis", () => {
    expect(bucketLabel("2026-11", "month")).toBe("Nov ’26");
    expect(bucketLabel("2026-Q4", "quarter")).toBe("Q4 ’26");
    expect(bucketLabel("2026-11-16", "week")).toBe("16 Nov");
  });
});

describe("resolvePeriod", () => {
  const resolve = (preset: Parameters<typeof resolvePeriod>[0]["preset"]) =>
    resolvePeriod(
      preset === "custom" ? { preset, from: "2026-05-02", to: "2026-04-01" } : { preset },
      "2026-11-17",
      all,
    );

  it("covers whole months", () => {
    expect(resolve("this-month")).toEqual({ from: "2026-11-01", to: "2026-11-30" });
    expect(resolve("last-month")).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(resolve("last-3-months")).toEqual({ from: "2026-09-01", to: "2026-11-30" });
    expect(resolve("last-12-months")).toEqual({ from: "2025-12-01", to: "2026-11-30" });
  });

  it("covers whole years, and everything", () => {
    expect(resolve("this-year")).toEqual({ from: "2026-01-01", to: "2026-12-31" });
    expect(resolve("last-year")).toEqual({ from: "2025-01-01", to: "2025-12-31" });
    expect(resolve("all")).toEqual(all);
  });

  it("puts a custom range the right way round", () => {
    expect(resolve("custom")).toEqual({ from: "2026-04-01", to: "2026-05-02" });
  });

  it("handles January", () => {
    expect(resolvePeriod({ preset: "last-month" }, "2026-01-15", all)).toEqual({
      from: "2025-12-01",
      to: "2025-12-31",
    });
  });
});
