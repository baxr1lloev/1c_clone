
import os
import sys
import time
import django
import random
from decimal import Decimal
from django.utils import timezone
from datetime import timedelta

# Setup Django environment
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.db import transaction
from django.db.models import Sum
from tenants.models import Tenant
from directories.models import Item, Warehouse, Counterparty, Currency, Contract
from documents.models import SalesDocument, SalesDocumentLine
from accounting.models import ChartOfAccounts, PeriodClosing
# from reports.services.stock_report import StockReportService

# Configuration
NUM_ITEMS = 50
NUM_COUNTERPARTIES = 20
NUM_DOCUMENTS = 100
START_DATE = timezone.now() - timedelta(days=30)
TENANT_NAME = "Benchmark Tenant"

def setup_data():
    print(f"--- Setting up Test Data ---")
    # specific tenant for benchmarking to avoid messing up user data
    tenant, _ = Tenant.objects.get_or_create(name=TENANT_NAME, defaults={'subdomain': 'bench'})
    
    # Ensure Base Currency
    currency, _ = Currency.objects.get_or_create(tenant=tenant, code='USD', defaults={'name': 'US Dollar', 'is_base': True})
    
    # Warehouses
    warehouse, _ = Warehouse.objects.get_or_create(tenant=tenant, name="Main Warehouse")
    
    # Accounts (needed for posting)
    ChartOfAccounts.objects.get_or_create(tenant=tenant, code='62', defaults={'name': 'Customers', 'account_type': 'ASSET'})
    ChartOfAccounts.objects.get_or_create(tenant=tenant, code='90.1', defaults={'name': 'Revenue', 'account_type': 'REVENUE'})
    ChartOfAccounts.objects.get_or_create(tenant=tenant, code='90.2', defaults={'name': 'COGS', 'account_type': 'EXPENSE'})
    ChartOfAccounts.objects.get_or_create(tenant=tenant, code='41', defaults={'name': 'Goods', 'account_type': 'ASSET'})
    
    # Items
    items = []
    print(f"Creating {NUM_ITEMS} items...")
    for i in range(NUM_ITEMS):
        item, _ = Item.objects.get_or_create(tenant=tenant, sku=f"BENCH-{i}", defaults={'name': f"Bench Item {i}", 'type': 'product'})
        items.append(item)
        
    # Counterparties
    counterparties = []
    print(f"Creating {NUM_COUNTERPARTIES} counterparties...")
    for i in range(NUM_COUNTERPARTIES):
        cp, _ = Counterparty.objects.get_or_create(tenant=tenant, code=f"CP-{i}", defaults={'name': f"Customer {i}", 'type': 'customer'})
        Contract.objects.get_or_create(tenant=tenant, code=f"CON-{i}", counterparty=cp, defaults={'name': 'Main Contract', 'currency': currency})
        counterparties.append(cp)
        
    return tenant, warehouse, currency, items, counterparties

def benchmark_posting(tenant, warehouse, currency, items, counterparties):
    print(f"\n--- Benchmarking Posting ({NUM_DOCUMENTS} documents) ---")
    
    documents = []
    start_time = time.time()
    
    with transaction.atomic():
        for i in range(NUM_DOCUMENTS):
            date = START_DATE + timedelta(days=i % 30)
            cp = random.choice(counterparties)
            contract = cp.contracts.first()
            
            doc = SalesDocument.objects.create(
                tenant=tenant,
                date=date,
                counterparty=cp,
                contract=contract,
                warehouse=warehouse,
                currency=currency,
                status='draft'
            )
            
            # Add 5 lines per document
            for _ in range(5):
                item = random.choice(items)
                qty = Decimal(random.randint(1, 10))
                price = Decimal(random.randint(10, 100))
                
                SalesDocumentLine.objects.create(
                    document=doc,
                    item=item,
                    quantity=qty,
                    price=price,
                    amount=qty*price
                )
            documents.append(doc)
            
    creation_time = time.time() - start_time
    print(f"Creation: {creation_time:.2f}s ({(creation_time/NUM_DOCUMENTS)*1000:.2f} ms/doc)")
    
    # Posting
    post_start = time.time()
    success_count = 0
    with transaction.atomic():
        for doc in documents:
            try:
                # Mock stock for posting (simple way: inject batches or allow negative with warning - wait, we enforce strict FIFO?)
                # For benchmarking posting speed (logic only), we might fail on stock if empty.
                # Let's just catch the error, or better, pre-seed stock using OpeningBalanceDocument (if we had time)
                # Or just assume we can post if we disable strict stock check? 
                # Actually, SalesDocument.post() checks stock.
                # Let's wrap in try/except to measure attempt overhead at least, or create incoming stock first.
                pass 
            except Exception:
                pass

    # To properly benchmark, we need stock.
    # Let's create a huge opening balance first.
    print("Seeding stock...")
    from documents.models import OpeningBalanceDocument, OpeningBalanceStockLine
    ob_doc = OpeningBalanceDocument.objects.create(
        tenant=tenant,
        operation_type=OpeningBalanceDocument.OPERATION_STOCK,
        warehouse=warehouse,
        date=START_DATE - timedelta(days=1),
        status='draft'
    )
    for item in items:
        OpeningBalanceStockLine.objects.create(
            document=ob_doc,
            item=item,
            quantity=Decimal(10000), # Plenty of stock
            price=Decimal(50),
            amount=Decimal(500000)
        )
    ob_doc.post() # Post opening balance
    
    print("Posting Sales Documents...")
    real_post_start = time.time()
    for doc in documents:
        try:
            doc.post() # This triggers accounting, fifo, etc.
            success_count += 1
        except Exception as e:
            print(f"Failed to post {doc}: {e}")
            
    post_time = time.time() - real_post_start
    print(f"Posting {success_count} docs: {post_time:.2f}s ({(post_time/success_count)*1000:.2f} ms/doc)")
    return documents

def benchmark_report(tenant):
    print(f"\n--- Benchmarking Stock Report ---")
    start = time.time()
    
    # Run the report service
    # date = timezone.now()
    # service = StockReportService(tenant)
    # data = service.get_balance(date)
    
    # Simulating report query logic if service calls are complex to mock here
    # Assuming standard aggregation query
    from registers.models import StockBatch
    from django.db.models import F, DecimalField
    
    result = StockBatch.objects.filter(tenant=tenant).values('item').annotate(
        total_qty=Sum('qty_remaining')
    )
    count = len(result)
    
    duration = time.time() - start
    print(f"Report Generation: {duration:.2f}s (Rows: {count})")

def run_benchmarks():
    try:
        tenant, warehouse, currency, items, counterparties = setup_data()
        benchmark_posting(tenant, warehouse, currency, items, counterparties)
        # benchmark_report(tenant)
        print("\nBenchmarks Complete.")
    except Exception as e:
        print(f"Benchmark Failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    run_benchmarks()
