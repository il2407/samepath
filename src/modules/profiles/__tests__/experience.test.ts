import { describe, expect, it } from "vitest";
import {
  calculateExperienceMonths,
  deriveSeniorityBandCode,
  mergeDateRanges,
  monthsBetween,
} from "@/modules/profiles/experience";

describe("monthsBetween", () => {
  it("counts whole completed months", () => {
    expect(monthsBetween(new Date("2020-01-15"), new Date("2020-04-15"))).toBe(3);
  });

  it("rounds down when the end day-of-month hasn't reached the start day-of-month", () => {
    expect(monthsBetween(new Date("2020-01-15"), new Date("2020-04-10"))).toBe(2);
  });
});

describe("mergeDateRanges", () => {
  it("merges two overlapping ranges into one", () => {
    const merged = mergeDateRanges([
      { start: new Date("2020-01-01"), end: new Date("2020-06-01") },
      { start: new Date("2020-04-01"), end: new Date("2020-09-01") },
    ]);
    expect(merged).toEqual([{ start: new Date("2020-01-01"), end: new Date("2020-09-01") }]);
  });

  it("merges touching ranges", () => {
    const merged = mergeDateRanges([
      { start: new Date("2020-01-01"), end: new Date("2020-06-01") },
      { start: new Date("2020-06-01"), end: new Date("2020-09-01") },
    ]);
    expect(merged).toHaveLength(1);
  });

  it("keeps genuinely separate ranges apart", () => {
    const merged = mergeDateRanges([
      { start: new Date("2020-01-01"), end: new Date("2020-03-01") },
      { start: new Date("2020-06-01"), end: new Date("2020-09-01") },
    ]);
    expect(merged).toHaveLength(2);
  });

  it("is order-independent", () => {
    const a = mergeDateRanges([
      { start: new Date("2020-06-01"), end: new Date("2020-09-01") },
      { start: new Date("2020-01-01"), end: new Date("2020-03-01") },
    ]);
    expect(a).toHaveLength(2);
    expect(a[0].start).toEqual(new Date("2020-01-01"));
  });

  it("handles a range fully contained within another", () => {
    const merged = mergeDateRanges([
      { start: new Date("2020-01-01"), end: new Date("2020-12-01") },
      { start: new Date("2020-03-01"), end: new Date("2020-06-01") },
    ]);
    expect(merged).toEqual([{ start: new Date("2020-01-01"), end: new Date("2020-12-01") }]);
  });
});

describe("calculateExperienceMonths — overlapping employment must not be double-counted", () => {
  it("sums non-overlapping positions normally", () => {
    const months = calculateExperienceMonths([
      { startDate: new Date("2018-01-01"), endDate: new Date("2019-01-01") }, // 12
      { startDate: new Date("2019-01-01"), endDate: new Date("2020-01-01") }, // 12
    ]);
    expect(months).toBe(24);
  });

  it("does not add overlapping full-time roles together", () => {
    // A full-time job overlapping a side contract for part of its duration —
    // total experience must be the merged span, not 24+12=36.
    const months = calculateExperienceMonths([
      { startDate: new Date("2018-01-01"), endDate: new Date("2020-01-01") }, // 24 months
      { startDate: new Date("2019-01-01"), endDate: new Date("2019-07-01") }, // fully inside the above
    ]);
    expect(months).toBe(24);
  });

  it("treats a null endDate as ongoing up to `asOf`", () => {
    const months = calculateExperienceMonths(
      [{ startDate: new Date("2022-01-01"), endDate: null }],
      new Date("2024-01-01"),
    );
    expect(months).toBe(24);
  });

  it("merges an ongoing position with a past one that overlaps it", () => {
    const months = calculateExperienceMonths(
      [
        { startDate: new Date("2020-01-01"), endDate: new Date("2022-01-01") },
        { startDate: new Date("2021-06-01"), endDate: null },
      ],
      new Date("2024-01-01"),
    );
    // merged span: 2020-01-01 .. 2024-01-01 = 48 months
    expect(months).toBe(48);
  });

  it("returns 0 for no positions", () => {
    expect(calculateExperienceMonths([])).toBe(0);
  });
});

describe("deriveSeniorityBandCode", () => {
  const bands = [
    { code: "junior", minMonths: 0, maxMonths: 23 },
    { code: "mid", minMonths: 24, maxMonths: 59 },
    { code: "senior", minMonths: 60, maxMonths: 95 },
    { code: "staff", minMonths: 96, maxMonths: null },
  ];

  it("picks the band whose range contains the months", () => {
    expect(deriveSeniorityBandCode(0, bands)).toBe("junior");
    expect(deriveSeniorityBandCode(23, bands)).toBe("junior");
    expect(deriveSeniorityBandCode(24, bands)).toBe("mid");
    expect(deriveSeniorityBandCode(59, bands)).toBe("mid");
    expect(deriveSeniorityBandCode(60, bands)).toBe("senior");
    expect(deriveSeniorityBandCode(96, bands)).toBe("staff");
    expect(deriveSeniorityBandCode(300, bands)).toBe("staff");
  });

  it("clamps negative months to the lowest band", () => {
    expect(deriveSeniorityBandCode(-5, bands)).toBe("junior");
  });

  it("returns null when there are no bands configured", () => {
    expect(deriveSeniorityBandCode(24, [])).toBeNull();
  });
});
