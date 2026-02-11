# documents/management/commands/generate_test_data.py
"""
Django management command to generate test data at scale.

Usage:
    python manage.py generate_test_data --movements=3000000
    python manage.py generate_test_data --documents=10000
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from decimal import Decimal
import random
from datetime import timedelta

from directories.models import Counterparty, Item, Warehouse, Currency
from documents.models import SalesDocument, PurchaseDocument, SalesLine, PurchaseLine
from registers.models import StockMovement, SettlementMovement
from users.models import Tenant, User


class Command(BaseCommand):
    help = 'Generate test data for performance benchmarking'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--movements',
            type=int,
            default=100000,
            help='Number of stock movements to generate'
        )
        parser.add_argument(
            '--documents',
            type=int,
            default=5000,
            help='Number of documents to generate'
        )
        parser.add_argument(
            '--tenant-id',
            type=int,
            default=1,
            help='Tenant ID to use'
        )
    
    def handle(self, *args, **options):
        movements_count = options['movements']
        documents_count = options['documents']
        tenant_id = options['tenant_id']
        
        try:
            tenant = Tenant.objects.get(id=tenant_id)
        except Tenant.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'Tenant {tenant_id} does not exist'))
            return
        
        self.stdout.write(self.style.SUCCESS(f'Generating test data for tenant: {tenant.name}'))
        
        # Step 1: Generate directories if needed
        self._ensure_directories(tenant)
        
        # Step 2: Generate documents
        self._generate_documents(tenant, documents_count)
        
        # Step 3: Verify movement count
        actual_movements = StockMovement.objects.filter(tenant=tenant).count()
        self.stdout.write(
            self.style.SUCCESS(
                f'\n✅ Test data generated successfully!'
                f'\n   Documents: {documents_count}'
                f'\n   Stock Movements: {actual_movements:,}'
            )
        )
    
    def _ensure_directories(self, tenant):
        """Ensure enough directories exist for testing"""
        self.stdout.write('Creating directories...')
        
        # Create currencies
        Currency.objects.get_or_create(
            tenant=tenant, code='USD',
            defaults={'name': 'US Dollar', 'symbol': '$'}
        )
        Currency.objects.get_or_create(
            tenant=tenant, code='UZS',
            defaults={'name': 'Uzbek Sum', 'symbol': 'UZS'}
        )
        
        # Create warehouses (50 warehouses for variety)
        for i in range(1, 51):
            Warehouse.objects.get_or_create(
                tenant=tenant,
                code=f'WH-{i:03d}',
                defaults={'name': f'Warehouse #{i}'}
            )
        
        # Create items (1000 items)
        for i in range(1, 1001):
            Item.objects.get_or_create(
                tenant=tenant,
                sku=f'ITEM-{i:04d}',
                defaults={
                    'name': f'Product #{i}',
                    'type': 'product'
                }
            )
        
        # Create counterparties (500)
        for i in range(1, 501):
            Counterparty.objects.get_or_create(
                tenant=tenant,
                code=f'CP-{i:04d}',
                defaults={
                    'name': f'Customer #{i}',
                    'type': 'customer'
                }
            )
        
        self.stdout.write(self.style.SUCCESS('   ✓ Directories ready'))
    
    def _generate_documents(self, tenant, count):
        """Generate sales/purchase documents"""
        self.stdout.write(f'Generating {count:,} documents...')
        
        # Get directories
        warehouses = list(Warehouse.objects.filter(tenant=tenant))
        items = list(Item.objects.filter(tenant=tenant))
        counterparties = list(Counterparty.objects.filter(tenant=tenant))
        usd = Currency.objects.get(tenant=tenant, code='USD')
        
        start_date = timezone.now().date() - timedelta(days=365)  # 1 year of data
        
        batch_size = 100
        for batch_start in range(0, count, batch_size):
            batch_end = min(batch_start + batch_size, count)
            
            with transaction.atomic():
                for i in range(batch_start, batch_end):
                    # Random document type
                    is_sale = random.choice([True, False])
                    
                    # Random date in past year
                    days_ago = random.randint(0, 365)
                    doc_date = start_date + timedelta(days=days_ago)
                    
                    if is_sale:
                        doc = SalesDocument.objects.create(
                            tenant=tenant,
                            number=f'S-{i+1:06d}',
                            date=doc_date,
                            counterparty=random.choice(counterparties),
                            warehouse=random.choice(warehouses),
                            currency=usd,
                            status='posted',
                            is_posted=True
                        )
                        
                        # Random number of lines (1-20)
                        line_count = random.randint(1, 20)
                        for j in range(line_count):
                            SalesLine.objects.create(
                                document=doc,
                                item=random.choice(items),
                                quantity=Decimal(random.randint(1, 100)),
                                price_foreign=Decimal(random.randint(10, 1000)),
                                price_base=Decimal(random.randint(10, 1000))
                            )
                    else:
                        doc = PurchaseDocument.objects.create(
                            tenant=tenant,
                            number=f'P-{i+1:06d}',
                            date=doc_date,
                            counterparty=random.choice(counterparties),
                            warehouse=random.choice(warehouses),
                            currency=usd,
                            status='posted',
                            is_posted=True
                        )
                        
                        line_count = random.randint(1, 20)
                        for j in range(line_count):
                            PurchaseLine.objects.create(
                                document=doc,
                                item=random.choice(items),
                                quantity=Decimal(random.randint(1, 100)),
                                price_foreign=Decimal(random.randint(10, 1000)),
                                price_base=Decimal(random.randint(10, 1000))
                            )
            
            # Progress update
            if (batch_end % 1000) == 0:
                self.stdout.write(f'   ... {batch_end:,}/{count:,} documents created')
        
        self.stdout.write(self.style.SUCCESS(f'   ✓ {count:,} documents created'))
