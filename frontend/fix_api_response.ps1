$files = @(
    "src/app/[locale]/(dashboard)/directories/currencies/page.tsx",
    "src/app/[locale]/(dashboard)/directories/fixed-assets/[id]/page.tsx",
    "src/app/[locale]/(dashboard)/directories/intangible-assets/[id]/page.tsx",
    "src/app/[locale]/(dashboard)/documents/cash-orders/[id]/edit/page.tsx",
    "src/app/[locale]/(dashboard)/documents/cash-orders/[id]/page.tsx",
    "src/app/[locale]/(dashboard)/documents/fa-receipts/[id]/page.tsx",
    "src/app/[locale]/(dashboard)/documents/ia-receipts/[id]/page.tsx",
    "src/app/[locale]/(dashboard)/documents/production/[id]/page.tsx",
    "src/app/[locale]/(dashboard)/documents/sales-orders/[id]/edit/page.tsx",
    "src/app/[locale]/(dashboard)/documents/sales-orders/[id]/page.tsx",
    "src/app/[locale]/(dashboard)/page.tsx",
    "src/app/[locale]/(dashboard)/directories/currencies/currency-classifier-dialog.tsx"
)

foreach ($relativePath in $files) {
    $path = Join-Path (Get-Location) $relativePath
    if (Test-Path $path) {
        $content = Get-Content -LiteralPath $path -Raw
        $newContent = $content -replace 'return response\.data', 'return response' `
            -replace 'return res\.data', 'return res' `
            -replace 'const data = response\.data', 'const data = response' `
            -replace 'const data = res\.data', 'const data = res'
        
        if ($content -ne $newContent) {
            Set-Content -LiteralPath $path -Value $newContent -Encoding UTF8
            Write-Host "Updated $relativePath"
        }
    }
    else {
        Write-Host "File not found: $relativePath"
    }
}
