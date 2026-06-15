# Stripe-Env auf Vercel (Production) setzen — einmal ausführen nach: npx vercel login
# Nutzung:
#   cd evglab-app
#   npx vercel login
#   npx vercel link   # Projekt: evglab-app
#   .\scripts\setup-vercel-stripe-env.ps1
# Optional Live-Key direkt mitgeben:
#   .\scripts\setup-vercel-stripe-env.ps1 -StripeSecretKey "sk_live_..."

param(
  [string]$StripeSecretKey = "",
  [string]$StripeWebhookSecret = "",
  [switch]$UseTestKeysFromEnvLocal
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

function Read-EnvFile([string]$Path) {
  $map = @{}
  if (-not (Test-Path $Path)) { return $map }
  Get-Content $Path | ForEach-Object {
    if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
      $map[$matches[1]] = $matches[2].Trim().Trim('"')
    }
  }
  return $map
}

function Set-VercelEnv([string]$Name, [string]$Value, [string]$Environment = "production") {
  if ([string]::IsNullOrWhiteSpace($Value)) {
    Write-Host "  überspringe $Name (leer)" -ForegroundColor DarkYellow
    return
  }
  Write-Host "  setze $Name …" -ForegroundColor Cyan
  $Value | npx vercel env add $Name $Environment --force 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "vercel env add fehlgeschlagen für $Name"
  }
}

$local = Read-EnvFile (Join-Path $Root ".env.local")

if (-not $StripeSecretKey) {
  if ($UseTestKeysFromEnvLocal -and $local["STRIPE_SECRET_KEY"]) {
    $StripeSecretKey = $local["STRIPE_SECRET_KEY"]
    Write-Host "Verwende STRIPE_SECRET_KEY aus .env.local (Testmodus)." -ForegroundColor Yellow
  } elseif ($local["STRIPE_SECRET_KEY"] -like "sk_live_*") {
    $StripeSecretKey = $local["STRIPE_SECRET_KEY"]
  }
}

if (-not $StripeSecretKey) {
  Write-Host ""
  Write-Host "Stripe Live Secret Key benötigt (sk_live_…)." -ForegroundColor Yellow
  Write-Host "Öffne: https://dashboard.stripe.com/acct_1TJanRRojElHlMEe/apikeys" -ForegroundColor Gray
  Write-Host "→ Live-Modus → Secret key → Reveal → kopieren" -ForegroundColor Gray
  Write-Host ""
  $StripeSecretKey = Read-Host "sk_live_ Key einfügen (oder Enter für Abbruch)"
  if ([string]::IsNullOrWhiteSpace($StripeSecretKey)) { exit 1 }
}

if (-not $StripeWebhookSecret) {
  $StripeWebhookSecret = $local["STRIPE_WEBHOOK_SECRET"]
}

# Live-Preis-IDs (Fallbacks aus src/lib/billing/stripePrices.ts)
$defaults = @{
  STRIPE_PRICE_START_MONTHLY   = "price_1TUMhBRojElHlMEe7nvvFwyM"
  STRIPE_PRICE_GROWTH_MONTHLY  = "price_1TUMhBRojElHlMEeZhNWLsnq"
  STRIPE_PRICE_PRO_MONTHLY     = "price_1TUMh8RojElHlMEerxH4kFLp"
  STRIPE_PRICE_START_YEARLY    = "price_1TeElhRojElHlMEeaOShHJry"
  STRIPE_PRICE_GROWTH_YEARLY   = "price_1TeElhRojElHlMEeRMLLZnUy"
  STRIPE_PRICE_PRO_YEARLY      = "price_1TeElhRojElHlMEeOuZHA68v"
  STRIPE_PRICE_TOKENS_500      = "price_1TUMhARojElHlMEeVvdClkWU"
  STRIPE_PRICE_TOKENS_2000     = "price_1TUMhBRojElHlMEeblArEqAp"
  STRIPE_ENABLE_AUTOMATIC_TAX  = "false"
}

Write-Host "Setze Stripe-Variablen auf Vercel (Production) …" -ForegroundColor Green
Set-VercelEnv "STRIPE_SECRET_KEY" $StripeSecretKey
if ($StripeWebhookSecret) { Set-VercelEnv "STRIPE_WEBHOOK_SECRET" $StripeWebhookSecret }

foreach ($key in $defaults.Keys) {
  $val = if ($local[$key]) { $local[$key] } else { $defaults[$key] }
  Set-VercelEnv $key $val
}

Write-Host ""
Write-Host "Redeploy auslösen …" -ForegroundColor Green
npx vercel deploy --prod --yes
Write-Host ""
Write-Host "Fertig. Plan-Checkout auf https://app.evglab.com sollte jetzt funktionieren." -ForegroundColor Green
