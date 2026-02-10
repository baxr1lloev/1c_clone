"""
Management command to rebuild stock balances from movements.

Usage:
    python manage.py rebuild_balances
    python manage.py rebuild_balances --tenant=1
"""
from django.core.management.base import BaseCommand
from registers.models import StockBalance
from tenants.models import Tenant


class Command(BaseCommand):
    help = 'Rebuild all stock balances from StockMovement (source of truth)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--tenant',
            type=int,
            help='Rebuild balances for specific tenant ID only',
        )

    def handle(self, *args, **options):
        tenant_id = options.get('tenant')
        
        if tenant_id:
            try:
                tenant = Tenant.objects.get(id=tenant_id)
                self.stdout.write(f"Rebuilding balances for tenant: {tenant}")
                count = StockBalance.rebuild_all(tenant=tenant)
            except Tenant.DoesNotExist:
                self.stdout.write(self.style.ERROR(f"Tenant with ID {tenant_id} not found"))
                return
        else:
            self.stdout.write("Rebuilding balances for ALL tenants...")
            count = StockBalance.rebuild_all()
        
        self.stdout.write(self.style.SUCCESS(f"✅ Successfully rebuilt {count} stock balances"))
