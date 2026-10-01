/**
 * Prüft den Sortiments-Scan (Sorten, Kategorie, Gebinde, Bild) gegen echte Brauerei-Websites —
 * gleiche Crawl-Pipeline wie /api/brand/analyze-url, ohne Login und ohne Speichern.
 *
 * Einzelne Seiten:  npx tsx --env-file=.env.local scripts/test-brand-catalog.ts https://www.paulaner.de [...]
 * Prüfsatz:         npx tsx --env-file=.env.local scripts/test-brand-catalog.ts --golden [scripts/brand-catalog-golden.json]
 *                   (Exit-Code 1, wenn eine Erwartung verfehlt wird — für die nächtliche GitHub Action)
 */
import { readFileSync } from "node:fs";
import { crawlCatalogPages } from "../src/lib/brand/catalog-crawl";
import { createBrandIntakeSession } from "../src/lib/brand/browser-intake";
import { looksLikeBlockedGatePage } from "../src/lib/brand/consent-gate-dismiss";
import { normalizeWebsiteUrl } from "../src/lib/brand/url-intake";
import { extractBeerVarietiesFromIntake, type SuggestedBeerVariety } from "../src/lib/brand/beer-catalog-intake";
import { downloadCandidateImages, mergeParsedWebsitePages, parseWebsiteHtml } from "../src/lib/brand/website-intake";
import { crawlProductCatalog } from "../src/lib/brand/product-catalog-crawl";
import { detectCatalogWithAi, type CatalogSiteKind } from "../src/lib/brand/catalog-ai";

/** MODE=rule → nur bisherige Regel-Erkennung. */
const MODE = process.env.MODE ?? "ai";

type GoldenSite = {
  url: string;
  minProducts?: number;
  minImageShare?: number;
  expect?: Array<{ name: string; kategorie: string }>;
  forbid?: string[];
  site?: CatalogSiteKind;
};

type ScanOutcome = { beers: SuggestedBeerVariety[]; site: CatalogSiteKind; suggestedUrl: string } | null;

function guessBreweryName(url: string): string {
  const host = new URL(url).hostname.replace(/^www\./, "").split(".")[0] ?? "";
  return host.replace(/-/g, " ");
}

async function scan(rawUrl: string): Promise<ScanOutcome> {
  const url = normalizeWebsiteUrl(rawUrl);
  if (!url) throw new Error(`Ungültige URL: ${rawUrl}`);
  const session = createBrandIntakeSession();
  const started = Date.now();
  try {
    let fetched = await session.fetchHtml(url);
    let homepage = parseWebsiteHtml(fetched.html, fetched.finalUrl);
    if (looksLikeBlockedGatePage(fetched.html, homepage.textExcerpt)) {
      fetched = await session.fetchWithBrowser(url);
      homepage = parseWebsiteHtml(fetched.html, fetched.finalUrl);
    }
    const { pages, rawHtmlByUrl, skipped } = await crawlCatalogPages(fetched, (next) => session.fetchHtml(next));
    if (MODE === "rule") {
      const intake = mergeParsedWebsitePages([homepage, ...pages]);
      const downloadedImages = await downloadCandidateImages(intake.imageCandidates);
      const beers = extractBeerVarietiesFromIntake({
        pages: [homepage, ...pages],
        downloadedImages,
        imageCandidates: intake.imageCandidates,
        breweryName: guessBreweryName(fetched.finalUrl),
        rawHtmlByUrl,
      });
      console.log(`\n=== ${rawUrl} → ${fetched.finalUrl} (Regel-Scan ${((Date.now() - started) / 1000).toFixed(1)} s)`);
      console.log(`Seiten: ${1 + pages.length}, übersprungen: ${skipped.length}, Bilder geladen: ${downloadedImages.length}`);
      console.log(`REGEL: ${beers.length} Sorten, ${beers.filter((beer) => beer.etikettUrl).length} mit Bild`);
      for (const beer of beers) console.log(`  [${beer.produktKategorie}] ${beer.name} — ${beer.etikettUrl || "KEIN BILD"}`);
      return { beers, site: "hersteller", suggestedUrl: "" };
    }

    const aiStarted = Date.now();
    const catalog = await crawlProductCatalog(fetched, rawHtmlByUrl, (next) => session.fetchHtml(next));
    const crawlDone = Date.now();
    const ai = await detectCatalogWithAi({
      apiKey: process.env.ANTHROPIC_API_KEY ?? "",
      websiteUrl: fetched.finalUrl,
      rawHtmlByUrl: { ...rawHtmlByUrl, ...catalog.rawHtmlByUrl },
      fetchPage: (next) => session.fetchHtml(next),
    });
    console.log(`\n=== ${rawUrl} → ${fetched.finalUrl}`);
    console.log(
      `KI: ${ai.beers.length} Sorten (${ai.stats.products} Produkte, +${ai.stats.variants} Gebinde-Varianten), ` +
        `${ai.stats.withImage} mit Bild (${ai.stats.verified} geprüft, ${ai.stats.rescued} per Nachsuche), ` +
        `+${Object.keys(catalog.rawHtmlByUrl).length} Sortimentsseiten, ${ai.stats.cards} Bildkandidaten, ` +
        `Crawl ${((crawlDone - aiStarted) / 1000).toFixed(1)} s, KI ${((Date.now() - crawlDone) / 1000).toFixed(1)} s`,
    );
    if (ai.site !== "hersteller") console.log(`Website-Art: ${ai.site}${ai.suggestedUrl ? ` → besser ${ai.suggestedUrl}` : ""}`);
    for (const beer of ai.beers) {
      console.log(
        `  [${beer.produktKategorie}] ${beer.name} · ${beer.flaschenTyp}/${beer.flaschenfarbe}` +
          `${beer.packagingNeedsReview ? " (Gebinde prüfen)" : ""} · Bild: ${beer.bildStatus ?? "?"}` +
          `${beer.bildAlternativen?.length ? ` (+${beer.bildAlternativen.length} Alternativen)` : ""} — ${beer.etikettUrl || "KEIN BILD"}`,
      );
    }
    return { beers: ai.beers, site: ai.site, suggestedUrl: ai.suggestedUrl };
  } catch (error) {
    console.log(`\n=== ${rawUrl}: FEHLER ${error instanceof Error ? error.message : String(error)}`);
    return null;
  } finally {
    await session.close();
  }
}

function checkGolden(site: GoldenSite, outcome: ScanOutcome): string[] {
  if (!outcome) return ["Scan fehlgeschlagen"];
  const failures: string[] = [];
  const { beers } = outcome;
  if (site.site && outcome.site !== site.site) failures.push(`Website-Art ${outcome.site}, erwartet ${site.site}`);
  if (site.minProducts && beers.length < site.minProducts) {
    failures.push(`${beers.length} Sorten, erwartet mindestens ${site.minProducts}`);
  }
  if (site.minImageShare && beers.length > 0) {
    const share = beers.filter((beer) => beer.etikettUrl).length / beers.length;
    if (share < site.minImageShare) {
      failures.push(`Bildquote ${(share * 100).toFixed(0)} %, erwartet ${(site.minImageShare * 100).toFixed(0)} %`);
    }
  }
  for (const expected of site.expect ?? []) {
    const hit = beers.find((beer) => beer.name.toLowerCase().includes(expected.name.toLowerCase()));
    if (!hit) failures.push(`„${expected.name}“ fehlt`);
    else if (hit.produktKategorie !== expected.kategorie) {
      failures.push(`„${hit.name}“ ist ${hit.produktKategorie}, erwartet ${expected.kategorie}`);
    }
  }
  for (const word of site.forbid ?? []) {
    const hit = beers.find((beer) => beer.name.toLowerCase().includes(word.toLowerCase()));
    if (hit) failures.push(`Falschtreffer „${hit.name}“`);
  }
  return failures;
}

async function runGolden(file: string) {
  const golden = JSON.parse(readFileSync(file, "utf8")) as { sites: GoldenSite[] };
  const report: Array<{ url: string; failures: string[] }> = [];
  for (const site of golden.sites) {
    const outcome = await scan(site.url);
    const failures = checkGolden(site, outcome);
    report.push({ url: site.url, failures });
    console.log(failures.length ? `  ✗ ${failures.join(" · ")}` : "  ✓ alle Erwartungen erfüllt");
  }
  const failed = report.filter((entry) => entry.failures.length);
  console.log(`\n${report.length - failed.length}/${report.length} Websites bestanden.`);
  for (const entry of failed) console.log(`✗ ${entry.url}: ${entry.failures.join(" · ")}`);
  process.exitCode = failed.length ? 1 : 0;
}

const args = process.argv.slice(2);
void (async () => {
  if (args[0] === "--golden") {
    await runGolden(args[1] ?? "scripts/brand-catalog-golden.json");
    return;
  }
  if (!args.length) {
    console.error("Bitte mindestens eine URL oder --golden angeben.");
    process.exitCode = 1;
    return;
  }
  for (const url of args) await scan(url);
})();
