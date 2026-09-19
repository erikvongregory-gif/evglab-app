import { notFound } from "next/navigation";
import { MarketingThemeSync } from "../theme-sync";
import { MarketingScreen } from "../screens";
import { SCREEN_META, isMarketingScreenId } from "../fixtures";

export function generateStaticParams() {
  return Object.keys(SCREEN_META).map((screen) => ({ screen }));
}

export default async function MarketingPreviewScreenPage({
  params,
}: {
  params: Promise<{ screen: string }>;
}) {
  const { screen } = await params;
  if (!isMarketingScreenId(screen)) notFound();

  return (
    <>
      <MarketingThemeSync dark={Boolean(SCREEN_META[screen].dark)} />
      <MarketingScreen screen={screen} />
    </>
  );
}
