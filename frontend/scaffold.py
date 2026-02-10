import os

base_path = "src/app/[locale]/(dashboard)"

list_routes = [
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
]

create_routes = [
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
]

list_template = """import UnderConstruction from '@/components/under-construction';

export default function Page() {
    return <UnderConstruction title="__TITLE__" module="Generated List" />;
}
"""

create_template = """import UnderConstruction from '@/components/under-construction';

export default function CreatePage() {
    return <UnderConstruction title="Create __TITLE__" description="Creation form under construction" />;
}
"""

def create_file(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if not os.path.exists(path):
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Created: {path}")
    else:
        print(f"Exists: {path}")

# Create List Routes
for route in list_routes:
    path = os.path.join(base_path, route, "page.tsx")
    title = route.split('/')[-1].replace('-', ' ').title()
    create_file(path, list_template.replace("__TITLE__", title))

# Create Create Routes
for route in create_routes:
    path = os.path.join(base_path, route, "new", "page.tsx")
    title = route.split('/')[-1].replace('-', ' ').title()
    create_file(path, create_template.replace("__TITLE__", title))
