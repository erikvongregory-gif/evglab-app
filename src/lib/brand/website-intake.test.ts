import { describe, expect, it } from "vitest";
import {
  parseWebsiteHtml,
  scoreImageCandidate,
  selectCandidatesForDownload,
} from "@/lib/brand/website-intake";

const SAMPLE_HTML = `<!DOCTYPE html>
<html>
<head>
  <title>Lang Bräu Freyung</title>
  <meta name="description" content="Traditionelle Brauerei im Bayerischen Wald." />
  <meta property="og:title" content="Lang Bräu – Craft seit 1892" />
  <meta property="og:description" content="Handwerklich gebrautes Bier." />
  <meta property="og:image" content="https://brauerei.de/assets/hero.jpg" />
  <meta property="og:site_name" content="Lang Bräu" />
</head>
<body>
  <h1>Willkommen bei Lang Bräu</h1>
  <p>Wir brauen charaktervolles Bier mit Leidenschaft und Tradition.</p>
  <h2>Unsere Biere</h2>
  <img src="/images/flasche.png" alt="Flasche Hell" />
  <img src="/media/wm-2026-keyvisual-banner.jpg" alt="WM 2026 Partner" />
  <img src="/media/social_wall_2025_desktop.jpg" alt="social wall desktop" />
</body>
</html>`;

describe("website-intake", () => {
  it("extracts title, meta and headings", () => {
    const result = parseWebsiteHtml(SAMPLE_HTML, "https://brauerei.de/");
    expect(result.title).toBe("Lang Bräu Freyung");
    expect(result.textExcerpt).toContain("Traditionelle Brauerei");
    expect(result.textExcerpt).toContain("Willkommen bei Lang Bräu");
    expect(result.textBlocks.some((b) => b.includes("Site-Name: Lang Bräu"))).toBe(true);
  });

  it("collects image candidates with scores", () => {
    const result = parseWebsiteHtml(SAMPLE_HTML, "https://brauerei.de/");
    const urls = result.imageCandidates.map((c) => c.url);
    expect(urls).toContain("https://brauerei.de/images/flasche.png");
    expect(urls).toContain("https://brauerei.de/media/social_wall_2025_desktop.jpg");
  });

  it("ranks beer product images above campaign banners", () => {
    const product = scoreImageCandidate("https://brauerei.de/produkte/hell-flasche.jpg", "Flasche Hell", "img");
    const campaign = scoreImageCandidate("https://brauerei.de/kampagnen/wm-2026-banner.jpg", "WM 2026", "img");
    expect(product.score).toBeGreaterThan(campaign.score);
  });

  it("boosts social wall lifestyle collages", () => {
    const socialWall = scoreImageCandidate(
      "https://brauerei.de/media/social_wall_2025_desktop.jpg",
      "social wall desktop",
      "img",
    );
    const generic = scoreImageCandidate("https://brauerei.de/media/random-123.jpg", "", "img");
    expect(socialWall.lifestyleScore).toBeGreaterThan(generic.lifestyleScore);
    expect(socialWall.score).toBeGreaterThan(100);
  });

  it("forces social wall into download queue", () => {
    const parsed = parseWebsiteHtml(SAMPLE_HTML, "https://brauerei.de/");
    const queue = selectCandidatesForDownload(parsed.imageCandidates);
    expect(queue.some((c) => c.url.includes("social_wall"))).toBe(true);
  });
});
