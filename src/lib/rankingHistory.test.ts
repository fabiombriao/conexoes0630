import { describe, expect, it } from "vitest";
import { getHistoricalRankingMonths } from "@/lib/rankingHistory";

describe("getHistoricalRankingMonths", () => {
  it("deduplicates months, excludes the current month and sorts newest first", () => {
    const result = getHistoricalRankingMonths(
      [
        "2026-03-01",
        "2026-04-01",
        "2026-04-01",
        "2026-02-01",
        "2026-01-01",
        "",
      ],
      "2026-04-01",
    );

    expect(result).toEqual(["2026-03-01", "2026-02-01", "2026-01-01"]);
  });

  it("returns an empty list when there are no past months", () => {
    expect(getHistoricalRankingMonths(["2026-04-01", "2026-04-01"], "2026-04-01")).toEqual([]);
  });
});
