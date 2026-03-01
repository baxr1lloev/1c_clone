import os
import django
import sys

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from tenants.models import Tenant
from directories.models import Item, Currency
from registers.models import ItemPrice
from decimal import Decimal
import datetime

def run_tests():
    print("--- Starting Srez Poslednix Test ---")
    tenant, _ = Tenant.objects.get_or_create(name="Test Tenant", schema_name="test")
    currency, _ = Currency.objects.get_or_create(code="USD", defaults={"name": "US Dollar"})
    item, _ = Item.objects.get_or_create(tenant=tenant, name="Test Item", sku="TEST-1")

    # Clean previous
    ItemPrice.objects.filter(item=item).delete()

    p1 = ItemPrice.objects.create(
        tenant=tenant, item=item, date=datetime.date(2024, 1, 1),
        price=Decimal('100.00'), currency=currency, price_type='SELLING'
    )
    print(f"Set Price: {p1.price} on {p1.date}")

    p2 = ItemPrice.objects.create(
        tenant=tenant, item=item, date=datetime.date(2024, 1, 15),
        price=Decimal('120.00'), currency=currency, price_type='SELLING'
    )
    print(f"Set Price: {p2.price} on {p2.date}")

    res1 = ItemPrice.get_latest_price(item, date=datetime.date(2024, 1, 10))
    print(f"Srez Poslednix on 10.01.2024 (Expected 100.00): {res1['price'] if res1 else 'None'}")

    res2 = ItemPrice.get_latest_price(item, date=datetime.date(2024, 1, 16))
    print(f"Srez Poslednix on 16.01.2024 (Expected 120.00): {res2['price'] if res2 else 'None'}")
    print("--- Test Complete ---")

if __name__ == '__main__':
    run_tests()
