$files = Get-ChildItem -Recurse -Path src/app -Filter "*.tsx"
foreach ($file in $files) {
    try {
        $content = Get-Content -LiteralPath $file.FullName -Raw
        $newContent = $content -replace '\.data\.results', '.results' -replace '\.data\.count', '.count' -replace '\.data\.next', '.next' -replace '\.data\.previous', '.previous'
        if ($content -ne $newContent) {
            Set-Content -LiteralPath $file.FullName -Value $newContent -Encoding UTF8
            Write-Host "Updated $($file.Name)"
        }
    } catch {
        Write-Host "Error processing $($file.Name): $_"
    }
}
