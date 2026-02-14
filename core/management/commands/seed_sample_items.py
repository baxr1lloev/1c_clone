"""
Create sample nomenclature (items) so you can see and select them in Sales and Purchases.

Run from project root:
    python manage.py seed_sample_items

Optional: limit to one tenant
    python manage.py seed_sample_items --tenant 1
"""
from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    help = "Create sample items (nomenclature) so you can see them in Sales / Purchases"

    def add_arguments(self, parser):
        parser.add_argument(
            "--tenant",
            type=int,
            default=None,
            help="Tenant ID. If not set, adds items for every tenant that has no items.",
        )

    def handle(self, *args, **options):
        from tenants.models import Tenant
        from directories.models import Item, ItemCategory

        tenant_id = options.get("tenant")
        if tenant_id:
            try:
                tenants = [Tenant.objects.get(pk=tenant_id)]
            except Tenant.DoesNotExist:
                self.stdout.write(self.style.ERROR(f"Tenant with id={tenant_id} not found."))
                return
        else:
            tenants = list(Tenant.objects.all())

        if not tenants:
            self.stdout.write(self.style.ERROR("No tenants in the database. Create a tenant first."))
            return

        created_any = False
        with transaction.atomic():
            for tenant in tenants:
                if Item.objects.filter(tenant=tenant).exists():
                    self.stdout.write(f"Tenant '{tenant.company_name}' already has items. Skipping.")
                    continue

                self.stdout.write(f"Creating sample items for tenant: {tenant.company_name}")

                cat, _ = ItemCategory.objects.get_or_create(
                    tenant=tenant,
                    name="Goods",
                    defaults={"code": "GOODS", "parent": None},
                )
                cat_services, _ = ItemCategory.objects.get_or_create(
                    tenant=tenant,
                    name="Services",
                    defaults={"code": "SRV", "parent": None},
                )

                samples = [
                    {
                        "sku": "ITEM-001",
                        "name": "Sample Product A",
                        "item_type": "GOODS",
                        "category": cat,
                        "unit": "pcs",
                        "purchase_price": 10,
                        "selling_price": 15,
                    },
                    {
                        "sku": "ITEM-002",
                        "name": "Sample Product B",
                        "item_type": "GOODS",
                        "category": cat,
                        "unit": "pcs",
                        "purchase_price": 25,
                        "selling_price": 35,
                    },
                    {
                        "sku": "ITEM-003",
                        "name": "Office Supplies",
                        "item_type": "GOODS",
                        "category": cat,
                        "unit": "pcs",
                        "purchase_price": 5,
                        "selling_price": 8,
                    },
                    {
                        "sku": "SVC-001",
                        "name": "Delivery Service",
                        "item_type": "SERVICE",
                        "category": cat_services,
                        "unit": "pcs",
                        "purchase_price": 0,
                        "selling_price": 20,
                    },
                ]

                for data in samples:
                    Item.objects.get_or_create(
                        tenant=tenant,
                        sku=data["sku"],
                        defaults={
                            "name": data["name"],
                            "item_type": data["item_type"],
                            "category": data["category"],
                            "unit": data["unit"],
                            "purchase_price": data["purchase_price"],
                            "selling_price": data["selling_price"],
                        },
                    )
                    self.stdout.write(f"  + {data['name']} ({data['sku']})")

                created_any = True

        if created_any:
            self.stdout.write(
                self.style.SUCCESS(
                    "Done. Open Sales (Realization) or Purchases and choose an item in the document lines."
                )
            )
        else:
            self.stdout.write("No new items created (all tenants already have items or no tenants).")
