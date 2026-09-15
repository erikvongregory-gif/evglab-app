import { FLASCHEN_TYPEN, isDoseTyp } from "@/app/(dashboard)/inhalte-erstellen/lib/brewing-knowledge";
import type { HyperrealisticInput } from "@/app/(dashboard)/inhalte-erstellen/lib/schemas";
import { MASTER_PROMPT_SECTIONS } from "./schema";

const CLOSURE_LABEL: Record<string, string> = {
  kronkorken: "Kronkorken",
  buegel: "Bügelverschluss",
  ring_pull: "Stay-Tab / Ring-Pull",
};

export type MasterPromptContext = {
  input: HyperrealisticInput;
  breweryName?: string;
  brandContext?: string;
  hasProductPhoto: boolean;
  hasShapeReference: boolean;
  channel?: string;
  sceneOverride?: string;
  actionOverride?: string;
  peopleOverride?: string;
  moodOverride?: string;
};

/** Deterministischer Master-Prompt in fester Sektionsreihenfolge. */
export function assembleMasterPrompt(ctx: MasterPromptContext): string {
  const { input } = ctx;
  const bottle = FLASCHEN_TYPEN[input.flaschenTyp];
  const glassColor = input.flaschenfarbe;
  const closure = CLOSURE_LABEL[bottle.closure] ?? bottle.closure;
  const clientIntent = input.zusatzWunsch?.trim() || "";
  const scene =
    ctx.sceneOverride?.trim() ||
    clientIntent ||
    `photoreal scene: ${input.szene.replace(/_/g, " ")}`;
  const action = ctx.actionOverride?.trim() || "";
  const people = ctx.peopleOverride?.trim() || peopleFromInput(input);
  const mood = ctx.moodOverride?.trim() || input.stimmungTrend || input.stimmung || "authentic";
  const channel = ctx.channel?.trim() || "Instagram, Website, POS";
  const format = input.aspectRatio || "4:5";
  const productNoun = isDoseTyp(input.flaschenTyp) ? "beverage can" : "beer bottle";

  const refs: string[] = [];
  if (ctx.hasProductPhoto) {
    refs.push(
      "Referenzbild 1: verbindliche Produkt- und Geometriereferenz (exakte Flasche + gedrucktes Etikett). Hintergrund der Referenz verwerfen.",
    );
    refs.push(
      "Referenzbild 1 (Label): verbindliche Etiketten- und Logoreferenz — Schrift und Logo 1:1 erhalten.",
    );
  } else if (ctx.hasShapeReference) {
    refs.push(
      "Referenzbild 1: Form-/Silhouette-Referenz der Flasche (Studio). Kein Etikett von dieser Referenz übernehmen.",
    );
  } else {
    refs.push("Keine Produktfoto-Referenz vorhanden — Generierung sollte blockiert sein.");
  }

  const preserve = [
    ...bottle.preserve,
    "exakte Produktidentität",
    "Logo und Markenfarben",
    ...(ctx.hasProductPhoto ? ["gedruckter Etikettentext buchstabengetreu"] : []),
  ];

  const exclusions = [
    "keine alternative Flaschenform",
    "keine zusätzlichen Etiketten",
    "keine fremden Logos",
    "kein Wasserzeichen",
    "keine deformierten Buchstaben",
    "keine weiteren Flaschen, sofern nicht ausdrücklich verlangt",
    "kein Cutout-/Collage-Look",
    "keine schwebenden Produkte ohne Hände/Untergrund",
    ...(action.toLowerCase().includes("toast") || /anst/i.test(clientIntent)
      ? ["kein Anstoßen nur durch Flasche+Glas ohne Hände"]
      : []),
  ];

  const sections: Record<(typeof MASTER_PROMPT_SECTIONS)[number], string> = {
    "AUFGABE UND VERWENDUNGSZWECK": [
      `Erzeuge ein fotorealistisches Produktmotiv für ${channel}.`,
      `Das Bild wird für ${channel} verwendet.`,
      "Output must look like a real camera photograph, not CGI or catalog cutout.",
    ].join("\n"),
    HAUPTPRODUKT: [
      ctx.hasProductPhoto
        ? `Zeige exakt die in Referenzbild 1 abgebildete ${productNoun}.`
        : `Zeige eine ${bottle.display_name} gemäß Kataloggeometrie (nur wenn Formreferenz vorhanden).`,
      `Produkttyp: ${bottle.display_name}.`,
      `Geometrie: ${bottle.geometry_profile}.`,
      `Glasfarbe: ${glassColor}.`,
      `Verschluss: ${closure}.`,
      `Bewahre Flaschensilhouette, Hals, Schulter, Proportionen, Etikettenposition und Verschlussform.`,
      bottle.forbidden,
    ].join("\n"),
    REFERENZEN: refs.join("\n"),
    "SZENE UND KOMPOSITION": [
      `Szene (verbindlich): ${scene}`,
      action ? `Aktion: ${action}` : "",
      people ? `Personen: ${people}` : "Personen: nur falls die Szene es verlangt.",
      `Stimmung: ${mood}`,
      `Kamerawinkel / Shot: ${input.shotType ?? "A"}`,
      "Produkt vollständig sichtbar, nicht angeschnitten.",
      "If toasting/Prost: visible adult hands holding glasses mid-clink — never floating bottle toasting floating glass.",
    ]
      .filter(Boolean)
      .join("\n"),
    "LICHT UND MATERIAL": [
      `Licht passend zur Szene (${input.tageszeit}).`,
      "Natürliche Reflexionen im Glas; Kondenswasser nur dezent und unregelmäßig.",
      "Schärfentiefe dokumentarisch, nicht alles razor-sharp.",
      "Matched lighting so the product looks physically photographed in THIS scene.",
    ].join("\n"),
    MARKENWIRKUNG: [
      ctx.breweryName ? `Marke/Brauerei: ${ctx.breweryName}.` : "Marke: aus Produktreferenz.",
      ctx.brandContext?.trim() || "Tonalität: authentisch, regional, fotorealistisch.",
      "Verboten: generischer Stock-Look, purple CGI glow, Beauty-Filter.",
    ].join("\n"),
    "TEXT UND ETIKETT": [
      "Erhalte vorhandenen Etikettentext und Logo so genau wie möglich.",
      "Füge keinen weiteren Text, keine Fantasieschrift und keine zusätzlichen Markenzeichen hinzu.",
    ].join("\n"),
    "ZWINGEND BEIBEHALTEN": preserve.map((p) => `- ${p}`).join("\n"),
    "NICHT VERÄNDERN ODER HINZUFÜGEN": exclusions.map((e) => `- ${e}`).join("\n"),
    AUSGABE: [
      "Fotorealistisches kommerzielles Produktfoto.",
      `Format: ${format}.`,
      "Das Produkt vollständig sichtbar und nicht angeschnitten.",
    ].join("\n"),
  };

  return MASTER_PROMPT_SECTIONS.map((title) => `${title}\n\n${sections[title]}`).join("\n\n");
}

function peopleFromInput(input: HyperrealisticInput): string {
  const modus = input.personenModus ?? (input.personImBild ? "D" : "A");
  if (modus === "A") return "keine Personen / keine Hände, außer der Kundenbrief verlangt etwas anderes";
  if (modus === "B") return "eine erwachsene Hand mit Glas";
  if (modus === "E") {
    return `Gruppe (${input.gruppenAnzahl ?? "2"}, ${input.gruppenTyp ?? "gemischt"}, Dynamik ${input.gruppenDynamik ?? "E2"})`;
  }
  return "eine Person in der Szene, ungestellt";
}
