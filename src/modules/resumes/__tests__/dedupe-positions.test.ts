import { describe, expect, it } from "vitest";
import { dedupePositionsByCompany, type DedupablePosition } from "@/modules/resumes/dedupe-positions";

function pos(overrides: Partial<DedupablePosition>): DedupablePosition {
  return { companyId: "c1", companyName: "Acme", title: "Dev", startMonth: "2018-01", endMonth: "2019-01", isCurrent: false, ...overrides };
}

describe("dedupePositionsByCompany", () => {
  it("merges several previous roles at one company into one entry spanning all of them", () => {
    const result = dedupePositionsByCompany([
      pos({ title: "Developer", startMonth: "2016-03", endMonth: "2018-02" }),
      pos({ title: "Team Lead", startMonth: "2018-02", endMonth: "2020-06" }),
    ]);
    expect(result).toEqual([pos({ title: "Team Lead", startMonth: "2016-03", endMonth: "2020-06" })]);
  });

  it("keeps different companies separate and in original order", () => {
    const result = dedupePositionsByCompany([
      pos({ companyId: "a", companyName: "A" }),
      pos({ companyId: "b", companyName: "B" }),
      pos({ companyId: "a", companyName: "A", startMonth: "2015-01" }),
    ]);
    expect(result.map((p) => p.companyId)).toEqual(["a", "b"]);
    expect(result[0].startMonth).toBe("2015-01");
  });

  it("folds earlier roles at the current employer into the current entry", () => {
    const result = dedupePositionsByCompany([
      pos({ title: "Senior Dev", startMonth: "2021-01", endMonth: null, isCurrent: true }),
      pos({ title: "Dev", startMonth: "2019-05", endMonth: "2021-01" }),
    ]);
    expect(result).toEqual([pos({ title: "Senior Dev", startMonth: "2019-05", endMonth: null, isCurrent: true })]);
  });

  it("falls back to a normalized company name when there is no id", () => {
    const result = dedupePositionsByCompany([
      pos({ companyId: "", companyName: "Big  Corp" }),
      pos({ companyId: "", companyName: "big corp", startMonth: "2010-01" }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].startMonth).toBe("2010-01");
  });

  it("never lets an empty start month win", () => {
    const result = dedupePositionsByCompany([pos({ startMonth: "" }), pos({ startMonth: "2017-04" })]);
    expect(result[0].startMonth).toBe("2017-04");
  });
});
