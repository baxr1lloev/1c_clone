
import os
import sys
import django
import traceback

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from tenants.models import Tenant
from directories.models import Warehouse

try:
    print("Creating Tenant...")
    tenant, _ = Tenant.objects.get_or_create(name="DebugTenant", defaults={'subdomain': 'debug'})
    print(f"Tenant: {tenant}")
    
    print("Creating Warehouse...")
    warehouse, created = Warehouse.objects.get_or_create(tenant=tenant, name="DebugWarehouse")
    print(f"Warehouse: {warehouse}, Created: {created}")

except Exception as e:
    print(f"FULL ERROR MESSAGE: {str(e)}")
    traceback.print_exc()
