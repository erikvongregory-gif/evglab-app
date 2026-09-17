import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  detectMostlyGrayscaleFromBuffer,
  detectPackshotFromBuffer,
  extractRelevantInternalLinks,
  hasStrongReferenceSignal,
  isBrandLogoReferenceCandidate,
  isHardReferenceNoiseCandidate,
  mergeParsedWebsitePages,
  parseWebsiteHtml,
  pickBrandReferenceImages,
  scoreImageCandidate,
  selectCandidatesForDownload,
  type DownloadedImage,
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

  it("rejects logos and crests as reference noise", () => {
    expect(
      isBrandLogoReferenceCandidate("https://augustiner.de/fileadmin/logo/Augustiner_Wappen.png", "Augustiner"),
    ).toBe(true);
    expect(isHardReferenceNoiseCandidate("https://brauerei.de/assets/header-logo.svg", "Logo")).toBe(true);
    const crest = scoreImageCandidate("https://brauerei.de/media/wappen.jpg", "Wappen der Brauerei", "img");
    expect(crest.score).toBeLessThan(0);
  });

  it("requires strong beer context beyond domain or generic alt", () => {
    expect(hasStrongReferenceSignal("https://augustiner-braeu.de/gebaeude.jpg", "Brauerei Augustiner")).toBe(false);
    expect(hasStrongReferenceSignal("https://brauerei.de/biergarten.jpg", "Biergarten mit Freunden")).toBe(true);
    expect(hasStrongReferenceSignal("https://brauerei.de/produkte/hell-flasche.jpg", "Flasche Hell")).toBe(true);
  });

  it("rejects historie and etikett archive paths", () => {
    expect(
      isHardReferenceNoiseCandidate(
        "https://www.augustiner-braeu.de/fileadmin/_processed_/4/3/csm_1840-Georg_Boettger_Sommerbierkeller.jpg",
        "Sommerbierkeller",
      ),
    ).toBe(true);
    expect(
      isHardReferenceNoiseCandidate(
        "https://www.augustiner-braeu.de/fileadmin/_processed_/4/0/csm_1963-Etikett-Pils_f98a0e141e.jpg",
        "Augustiner Pils",
      ),
    ).toBe(true);
  });

  it("prefers product catalog paths in download queue over historie", () => {
    const queue = selectCandidatesForDownload([
      scoreImageCandidate(
        "https://www.augustiner-braeu.de/fileadmin/_processed_/4/3/csm_1840-Georg_Boettger_Sommerbierkeller.jpg",
        "Sommerbierkeller",
        "img",
      ),
      scoreImageCandidate(
        "https://www.augustiner-braeu.de/fileadmin/_processed_/f/1/csm_Augustiner-pils_ce71e2324b.jpg",
        "",
        "img",
      ),
    ]);
    expect(queue.some((c) => c.url.includes("Augustiner-pils"))).toBe(true);
    expect(queue.some((c) => c.url.includes("Georg_Boettger"))).toBe(false);
  });

  it("rejects Bier-bewusst-genießen industry badge", () => {
    expect(
      isHardReferenceNoiseCandidate(
        "https://brauerei.de/media/bier-bewusst-geniessen.png",
        "Bier bewusst genießen",
      ),
    ).toBe(true);
    const scored = scoreImageCandidate(
      "https://brauerei.de/assets/deutsche-braurer-logo.jpg",
      "Die deutschen Brauer",
      "img",
    );
    expect(scored.score).toBeLessThan(0);
    const queue = selectCandidatesForDownload([
      scoreImageCandidate("https://brauerei.de/bier-bewusst.png", "BBG", "img"),
      scoreImageCandidate("https://brauerei.de/hero-biergarten.jpg", "Biergarten", "img"),
    ]);
    expect(queue.some((c) => c.url.includes("bier-bewusst"))).toBe(false);
    expect(queue.some((c) => c.url.includes("biergarten"))).toBe(true);
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

describe("extractRelevantInternalLinks", () => {
  const NAV_HTML = `<html><body>
    <a href="/ueber-uns">Über uns</a>
    <a href="/sortiment">Unsere Biere</a>
    <a href="/impressum">Impressum</a>
    <a href="/datenschutz">Datenschutz</a>
    <a href="/shop/warenkorb">Warenkorb</a>
    <a href="https://extern.de/brauerei">Externe Brauerei</a>
    <a href="/assets/broschuere.pdf">Broschüre (PDF)</a>
    <a href="/kontakt">Kontakt</a>
  </body></html>`;

  it("picks brand-relevant internal pages and skips noise", () => {
    const links = extractRelevantInternalLinks(NAV_HTML, "https://brauerei.de/", 2);
    const urls = links.map((l) => l.url);
    expect(urls).toContain("https://brauerei.de/ueber-uns");
    expect(urls).toContain("https://brauerei.de/sortiment");
    expect(urls.every((u) => !u.includes("impressum"))).toBe(true);
    expect(urls.every((u) => !u.includes("extern.de"))).toBe(true);
    expect(urls.every((u) => !u.endsWith(".pdf"))).toBe(true);
  });

  it("ignores the current page and respects maxLinks", () => {
    const html = `<a href="/">Start</a><a href="/ueber-uns">Über uns</a><a href="/geschichte">Geschichte</a><a href="/biere">Biere</a>`;
    const links = extractRelevantInternalLinks(html, "https://brauerei.de/", 2);
    expect(links).toHaveLength(2);
    expect(links.every((l) => l.url !== "https://brauerei.de/")).toBe(true);
  });

  it("matches umlaut spellings in path and label", () => {
    const links = extractRelevantInternalLinks(`<a href="/über-uns">Mehr erfahren</a>`, "https://brauerei.de/", 2);
    expect(links).toHaveLength(1);
    expect(links[0]?.url).toContain("ber-uns");
  });

  it("ranks lemonade and water catalog pages", () => {
    const html = `<a href="/ueber-uns">Über uns</a><a href="/limonaden">Limonaden</a><a href="/mineralwasser">Mineralwasser</a><a href="/impressum">Impressum</a>`;
    const links = extractRelevantInternalLinks(html, "https://brauerei.de/", 4);
    const urls = links.map((l) => l.url);
    expect(urls).toContain("https://brauerei.de/limonaden");
    expect(urls).toContain("https://brauerei.de/mineralwasser");
    expect(urls.every((u) => !u.includes("impressum"))).toBe(true);
  });
});

describe("mergeParsedWebsitePages", () => {
  it("merges texts with subpage labels and pools deduped image candidates", () => {
    const home = parseWebsiteHtml(SAMPLE_HTML, "https://brauerei.de/");
    const sub = parseWebsiteHtml(
      `<html><head><title>Über uns</title></head><body>
        <h1>Unsere Geschichte seit 1892</h1>
        <p>Wir brauen charaktervolles Bier mit Leidenschaft und Tradition.</p>
        <img src="/images/flasche.png" alt="Flasche Hell" />
        <img src="/images/sudhaus.jpg" alt="Sudhaus der Brauerei" />
      </body></html>`,
      "https://brauerei.de/ueber-uns",
    );

    const merged = mergeParsedWebsitePages([home, sub]);
    expect(merged.pageUrl).toBe("https://brauerei.de/");
    expect(merged.title).toBe("Lang Bräu Freyung");
    expect(merged.textExcerpt).toContain("— Unterseite /ueber-uns —");
    expect(merged.textExcerpt).toContain("Unsere Geschichte seit 1892");
    // Dedupe: identischer Absatz kommt nur einmal vor.
    const occurrences = merged.textExcerpt.split("Wir brauen charaktervolles Bier").length - 1;
    expect(occurrences).toBe(1);
    // Bild-Pool: flasche.png nur einmal, sudhaus.jpg zusätzlich.
    const flascheCount = merged.imageCandidates.filter((c) => c.url.includes("flasche.png")).length;
    expect(flascheCount).toBe(1);
    expect(merged.imageCandidates.some((c) => c.url.includes("sudhaus.jpg"))).toBe(true);
  });

  it("returns single page unchanged", () => {
    const home = parseWebsiteHtml(SAMPLE_HTML, "https://brauerei.de/");
    expect(mergeParsedWebsitePages([home])).toBe(home);
  });
});

function makeImage(partial: Partial<DownloadedImage> & { url: string }): DownloadedImage {
  return {
    alt: "",
    score: 50,
    productScore: 50,
    lifestyleScore: 40,
    isPackshot: false,
    base64: "",
    mediaType: "image/jpeg",
    mime: "image/jpeg",
    sizeBytes: 1000,
    ...partial,
  };
}

describe("pickBrandReferenceImages", () => {
  it("prefers scene images and caps packshots at 1 when scenes exist", () => {
    const images = [
      makeImage({ url: "https://x.de/packshot1.png", isPackshot: true, productScore: 90, score: 90, base64: "pack1" }),
      makeImage({ url: "https://x.de/biergarten.jpg", lifestyleScore: 70, score: 70, base64: "scene1" }),
      makeImage({ url: "https://x.de/packshot2.png", isPackshot: true, productScore: 85, score: 85, base64: "pack2" }),
      makeImage({ url: "https://x.de/terrasse.jpg", lifestyleScore: 60, score: 60, base64: "scene2" }),
      makeImage({ url: "https://x.de/packshot3.png", isPackshot: true, productScore: 80, score: 80, base64: "pack3" }),
    ];
    const picked = pickBrandReferenceImages(images);
    expect(picked[0]?.url).toContain("biergarten");
    expect(picked[1]?.url).toContain("terrasse");
    expect(picked.filter((image) => image.isPackshot)).toHaveLength(1);
    expect(picked.find((image) => image.isPackshot)?.url).toContain("packshot1");
  });

  it("falls back to max 2 packshots when no scenes exist", () => {
    const images = [
      makeImage({
        url: "https://x.de/p1.png",
        isPackshot: true,
        productScore: 90,
        score: 90,
        base64: "pack1",
      }),
      makeImage({
        url: "https://x.de/p2.png",
        isPackshot: true,
        productScore: 80,
        score: 80,
        base64: "pack2",
      }),
      makeImage({
        url: "https://x.de/p3.png",
        isPackshot: true,
        productScore: 70,
        score: 70,
        base64: "pack3",
      }),
    ];
    const picked = pickBrandReferenceImages(images);
    expect(picked).toHaveLength(3);
    expect(picked[0]?.url).toContain("p1");
  });

  it("drops low-score and generic images without beer context", () => {
    const low = [makeImage({ url: "https://x.de/low.jpg", score: 5, base64: "low" })];
    const generic = [
      makeImage({ url: "https://x.de/scheune.jpg", score: 40, lifestyleScore: 40, base64: "scheune" }),
    ];
    const buildingOnly = [
      makeImage({
        url: "https://augustiner.de/gebaeude.jpg",
        alt: "Brauerei Augustiner München",
        score: 55,
        lifestyleScore: 55,
        base64: "building",
      }),
    ];
    const logos = [
      makeImage({
        url: "https://augustiner.de/logo.png",
        alt: "Augustiner Logo",
        score: 80,
        lifestyleScore: 80,
        base64: "logo1",
      }),
      makeImage({
        url: "https://augustiner.de/wappen.png",
        alt: "Wappen",
        score: 75,
        lifestyleScore: 75,
        base64: "logo2",
      }),
    ];
    expect(pickBrandReferenceImages(low)).toHaveLength(0);
    expect(pickBrandReferenceImages(generic)).toHaveLength(0);
    expect(pickBrandReferenceImages(buildingOnly)).toHaveLength(0);
    expect(pickBrandReferenceImages(logos)).toHaveLength(0);
  });

  it("dedupes identical downloads and skips generic scenes without beer signals", () => {
    const dup = makeImage({
      url: "https://x.de/scheune.jpg?v=1",
      alt: "Scheune",
      score: 40,
      lifestyleScore: 40,
    });
    const dup2 = makeImage({
      url: "https://x.de/scheune.jpg?v=2",
      alt: "Scheune",
      score: 40,
      lifestyleScore: 40,
      base64: dup.base64,
    });
    const beer = makeImage({
      url: "https://x.de/biergarten.jpg",
      alt: "Biergarten mit Freunden",
      score: 90,
      lifestyleScore: 95,
      base64: "different-image-bytes",
    });
    const picked = pickBrandReferenceImages([dup, dup2, beer]);
    expect(picked).toHaveLength(1);
    expect(picked[0]?.url).toContain("biergarten");
  });
});

describe("detectMostlyGrayscaleFromBuffer", () => {
  it("flags near-grayscale gate or archive photos", async () => {
    const gray = await sharp({
      create: { width: 64, height: 64, channels: 3, background: { r: 120, g: 118, b: 122 } },
    })
      .jpeg()
      .toBuffer();
    expect(await detectMostlyGrayscaleFromBuffer(gray)).toBe(true);
  });

  it("keeps colorful lifestyle photos", async () => {
    const colorful = await sharp({
      create: { width: 64, height: 64, channels: 3, background: { r: 40, g: 140, b: 70 } },
    })
      .jpeg()
      .toBuffer();
    expect(await detectMostlyGrayscaleFromBuffer(colorful)).toBe(false);
  });
});

describe("detectPackshotFromBuffer", () => {
  async function bottleShape(): Promise<Buffer> {
    return sharp({
      create: { width: 16, height: 40, channels: 3, background: { r: 110, g: 60, b: 20 } },
    })
      .png()
      .toBuffer();
  }

  it("detects a bottle on white background as packshot", async () => {
    const image = await sharp({
      create: { width: 64, height: 64, channels: 3, background: { r: 255, g: 255, b: 255 } },
    })
      .composite([{ input: await bottleShape(), top: 12, left: 24 }])
      .png()
      .toBuffer();
    expect(await detectPackshotFromBuffer(image)).toBe(true);
  });

  it("detects a bottle on transparent background as packshot", async () => {
    const image = await sharp({
      create: { width: 64, height: 64, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([{ input: await bottleShape(), top: 12, left: 24 }])
      .png()
      .toBuffer();
    expect(await detectPackshotFromBuffer(image)).toBe(true);
  });

  it("does not flag scene photos with real backgrounds", async () => {
    const image = await sharp({
      create: { width: 64, height: 64, channels: 3, background: { r: 90, g: 120, b: 70 } },
    })
      .composite([{ input: await bottleShape(), top: 12, left: 24 }])
      .png()
      .toBuffer();
    expect(await detectPackshotFromBuffer(image)).toBe(false);
  });
});
