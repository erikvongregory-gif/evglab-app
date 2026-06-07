export const FLASCHEN_TYPEN = {
  euro_longneck_330: {
    label: "Euro-Longneck 0,33 l",
    promptDescription: "slim 330ml Euro longneck beer bottle with elongated neck",
    typicalColors: ["braun", "grün"],
  },
  euro_steinie_330: {
    label: "Steinie 0,33 l",
    promptDescription: "stubby 330ml Steinie beer bottle, short and broad shoulders",
    typicalColors: ["braun"],
  },
  nrw_500: {
    label: "NRW-Flasche 0,5 l",
    promptDescription: "500ml NRW beer bottle, classic German regional shape, slightly tapered neck",
    typicalColors: ["braun"],
  },
  vichy_500: {
    label: "Vichy/Euro 0,5 l",
    promptDescription: "500ml Euro/Vichy beer bottle, straight tall body",
    typicalColors: ["braun", "grün"],
  },
  buegel_500: {
    label: "Bügelflasche 0,5 l",
    promptDescription: "500ml swing-top (Bügelverschluss) beer bottle with porcelain stopper and wire bail",
    typicalColors: ["braun"],
  },
  buegel_330: {
    label: "Bügelflasche 0,33 l",
    promptDescription: "330ml swing-top beer bottle with porcelain stopper",
    typicalColors: ["braun"],
  },
} as const;

export const GLAS_TYPEN = {
  pils_tulpe: {
    label: "Pilstulpe",
    promptDescription: "tall slender Pils tulip glass with thin stem, narrow opening, fine white foam head ca. 2cm",
    bierstile: ["pils", "helles_lager"],
  },
  weizen: {
    label: "Weizenglas",
    promptDescription: "tall curvy 500ml Weizen glass (vase shape), thick foam crown 3-4cm, hazy golden-amber color",
    bierstile: ["hefeweizen", "kristallweizen", "dunkles_weizen"],
  },
  willibecher: {
    label: "Willibecher",
    promptDescription: "classic German Willibecher beer mug (straight tapered glass), 0.5L, with creamy white foam",
    bierstile: ["helles", "export", "kellerbier"],
  },
  masskrug: {
    label: "Maßkrug",
    promptDescription: "1-liter glass Maßkrug beer mug with handle and dimpled facets",
    bierstile: ["helles", "festbier", "maerzen"],
  },
  ipa_teku: {
    label: "Teku / IPA Tulpe",
    promptDescription: "stemmed Teku tasting glass, slightly bulbous body, narrow rim concentrating aroma",
    bierstile: ["ipa", "neipa", "double_ipa", "saison"],
  },
  schwenker: {
    label: "Schwenker / Snifter",
    promptDescription: "stemmed snifter glass for strong beers, bulbous bowl",
    bierstile: ["barley_wine", "imperial_stout", "doppelbock"],
  },
  stange: {
    label: "Stange",
    promptDescription: "tall narrow cylindrical 200ml Kölsch/Alt Stange glass",
    bierstile: ["koelsch", "altbier"],
  },
} as const;

export const STUDIO_PROPS_BY_BIERSTIL = {
  hefeweizen: ["Zitronenscheibe", "frische Weizenähren", "Bananenblätter dezent"],
  kristallweizen: ["Zitronenscheibe", "Weizenähren"],
  pils: ["frische Hopfendolden", "Gerstenähren", "Wassertropfen am Glas"],
  helles_lager: ["Gerstenähren", "Malzkörner verstreut"],
  helles: ["Brezel", "Gerstenähren", "Wiesenblumen dezent"],
  ipa: ["frische Hopfendolden grün", "Zitrusfrüchte (Grapefruit, Orange)", "tropische Früchte"],
  neipa: ["Mango", "Maracuja", "Hopfendolden", "diffuses Sonnenlicht"],
  stout: ["Kaffeebohnen", "dunkle Schokolade", "geröstetes Malz"],
  porter: ["geröstetes Malz", "Kaffeebohnen"],
  bock: ["dunkles Malz", "Eichenholz", "Lederakzente"],
  saison: ["Pfefferkörner", "Koriandersamen", "getrocknete Kräuter"],
  kellerbier: ["unfiltrierte Optik", "Holzfass im Hintergrund", "Gerstenähren"],
  rauchbier: ["geräucherte Malzkörner", "Holzkohleakzente"],
} as const;

export type Bierstil = keyof typeof STUDIO_PROPS_BY_BIERSTIL;
export type FlaschenTyp = keyof typeof FLASCHEN_TYPEN;
export type GlasTyp = keyof typeof GLAS_TYPEN;
