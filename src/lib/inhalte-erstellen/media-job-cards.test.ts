import { describe, expect, it } from "vitest";
import {
  isMediaIdForJob,
  leadingMediaForJobs,
  mediaIdForJobVariant,
  shouldShowJobCard,
} from "./media-job-cards";

describe("media job cards", () => {
  it("maps job variants to persisted media ids", () => {
    expect(mediaIdForJobVariant("job-1", 0)).toBe("gen-job-1-0");
    expect(isMediaIdForJob("gen-job-1-1", "job-1")).toBe(true);
    expect(isMediaIdForJob("gen-job-2-0", "job-1")).toBe(false);
  });

  it("keeps a running job visible even if leftover media ids exist", () => {
    expect(
      shouldShowJobCard({ jobId: "job-1", status: "reserved", images: [] }, ["gen-old-0"]),
    ).toBe(true);
  });

  it("hides a completed job once matching media are present", () => {
    expect(
      shouldShowJobCard(
        { jobId: "job-1", status: "completed", images: [{ imageUrl: "a" }, { imageUrl: "b" }] },
        ["gen-job-1-0", "gen-job-1-1"],
      ),
    ).toBe(false);
  });

  it("never shows a failed job in the media library", () => {
    expect(shouldShowJobCard({ jobId: "job-1", status: "failed", images: [] }, [])).toBe(false);
    expect(shouldShowJobCard({ jobId: "job-1", status: "failed", images: [] }, ["gen-job-1-0"])).toBe(false);
  });

  it("keeps a partial job until its persisted variants appear", () => {
    expect(
      shouldShowJobCard(
        { jobId: "job-1", status: "completed", images: [{ imageUrl: "a" }] },
        [],
      ),
    ).toBe(true);
    expect(
      shouldShowJobCard(
        { jobId: "job-1", status: "completed", images: [{ imageUrl: "a" }] },
        ["gen-job-1-0"],
      ),
    ).toBe(false);
  });

  it("puts matching media first without duplicating the rest", () => {
    const items = [
      { id: "gen-other-0" },
      { id: "gen-job-1-1" },
      { id: "gen-job-1-0" },
    ];
    const { leading, seen } = leadingMediaForJobs([{ jobId: "job-1" }], items);
    expect(leading.map((item) => item.id)).toEqual(["gen-job-1-1", "gen-job-1-0"]);
    expect([...seen]).toEqual(["gen-job-1-1", "gen-job-1-0"]);
  });
});
