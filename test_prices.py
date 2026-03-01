import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from tenants.models import Tenant
from directories.models import Item, Currency
from registers.models import ItemPrice
from decimal import Decimal
import datetime

# Setup test data
tenant, _ = Tenant.objects.get_or_create(name="Test Tenant", schema_name="test")
currency, _ = Currency.objects.get_or_create(code="USD", defaults={"name": "US Dollar"})
item, _ = Item.objects.get_or_create(tenant=tenant, name="Test Item", sku="TEST-1")

print("Cleanup old prices...")
ItemPrice.objects.filter(item=item).delete()

print(f"Creating prices for {item.name}:")
p1 = ItemPrice.objects.create(
    tenant=tenant, item=item, date=datetime.date(2024, 1, 1),
    price=Decimal('100.00'), currency=currency, price_type='SELLING'
)
print(f"  - {p1.date}: {p1.price} {p1.currency.code}")

p2 = ItemPrice.objects.create(
    tenant=tenant, item=item, date=datetime.date(2024, 1, 15),
    price=Decimal('120.00'), currency=currency, price_type='SELLING'
)
print(f"  - {p2.date}: {p2.price} {p2.currency.code}")

print("\nTesting get_latest_price (Srez Poslednix):")
res1 = ItemPrice.get_latest_price(item, date=datetime.date(2024, 1, 10))
if res1:
    print(f"Price on 10.01.2024: {res1['price']} (Expected 100.00) - SUCCESS" if res1['price'] == Decimal('100.00') else "FAILED")

res2 = ItemPrice.get_latest_price(item, date=datetime.date(2024, 1, 16))
if res2:
    print(f"Price on 16.01.2024: {res2['price']} (Expected 120.00) - SUCCESS" if res2['price'] == Decimal('120.00') else "FAILED")

res3 = ItemPrice.get_latest_price(item, date=datetime.date(2023, 12, 31))
if res3 is None:
    print("Price on 31.12.2023: None (Expected None) - SUCCESS")

