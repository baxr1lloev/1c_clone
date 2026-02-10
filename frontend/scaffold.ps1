$listRoutes = @(
    "registers/transit",
    "registers/reservations",
    "registers/batches",
    "registers/settlements",
    "registers/stock-movements",
    "accounting/vat/declarations",
    "documents/proforma",
    "documents/transfers",
    "documents/inventory",
    "documents/payments",
    "directories/contacts",
    "directories/exchange-rates",
    "directories/contracts",
    "directories/currencies",
    "settings/users",
    "settings/tenants",
    "settings/audit-logs",
    "settings/plans",
    "taxes/e-invoices",
    "taxes/schemes"
)

$createRoutes = @(
    "accounting/entries",
    "accounting/policies",
    "accounting/vat/declarations",
    "accounting/chart-of-accounts",
    "accounting/closing",
    "documents/sales",
    "documents/sales-orders",
    "documents/purchases",
    "documents/payments",
    "documents/transfers",
    "documents/inventory",
    "documents/correction",
    "directories/counterparties",
    "directories/contracts",
    "directories/items",
    "directories/warehouses",
    "directories/currencies",
    "directories/contacts",
    "directories/exchange-rates",
    "documents/proforma",
    "registers/stock-balance",
    "registers/stock-movements",
    "registers/settlements",
    "registers/transit",
    "registers/reservations",
    "registers/batches",
    "settings/users",
    "settings/roles",
    "settings/tenants",
    "settings/audit-logs",
    "settings/plans",
    "taxes/e-invoices",
    "taxes/schemes"
)

$basePath = "src/app/[locale]/(dashboard)"

# Scaffold List Routes
foreach ($route in $listRoutes) {
    $dir = "$basePath/$route"
    $file = "$dir/page.tsx"
    
    if (!(Test-Path $file)) {
        Write-Host "Creating List Route: $route"
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
        
        $content = @"
import UnderConstruction from '@/components/under-construction';
export default function Page() {
    return <UnderConstruction title=""$route"" module=""Generated"" />;
}
"@
        Set-Content -Path $file -Value $content
    }
}

# Scaffold Create Routes
foreach ($route in $createRoutes) {
    $dir = "$basePath/$route/new"
    $file = "$dir/page.tsx"
    
    if (!(Test-Path $file)) {
        Write-Host "Creating Create Route: $route/new"
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
        
        $content = @"
import UnderConstruction from '@/components/under-construction';
export default function CreatePage() {
    return <UnderConstruction title=""Create $route"" description=""Creation form under construction"" />;
}
"@
        Set-Content -Path $file -Value $content
    }
}
