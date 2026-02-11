
import os
import django
from decimal import Decimal
from datetime import date, datetime, timedelta

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from documents.models import SalesDocument, SalesDocumentLine
from accounting.models import ChartOfAccounts, AccountingEntry, PeriodClosing, PeriodClosingLog, TrialBalance
from directories.models import Item, Counterparty, Contract, Warehouse, Project

User = get_user_model()

def run_verification():
    print("🔐 Starting Level 10: Full Trust Verification...\n")
    
    # Setup
    user = User.objects.first()
    if not user:
        user = User.objects.create_superuser('admin_audit', 'admin@example.com', 'password')
    
    tenant = user.tenant
    today = date.today()
    last_month = (today.replace(day=1) - timedelta(days=1)).replace(day=1)
    
    # 1. IMMUTABILITY CHECK
    print("🛡️  Checking Immutability (Period Closing)...")
    
    currency = tenant.base_currency
    if not currency:
        from directories.models import Currency
        currency = Currency.objects.filter(code='RUB').first()
        if not currency:
             currency = Currency.objects.create(code='RUB', name='Russian Ruble', symbol='₽')

    # Ensure required directories exist
    counterparty = Counterparty.objects.first()
    if not counterparty:
        counterparty = Counterparty.objects.create(name='Test Customer', tenant=tenant)
        
    contract = Contract.objects.filter(counterparty=counterparty).first()
    if not contract:
        contract = Contract.objects.create(contract_number='MSG-001', date=today, counterparty=counterparty, tenant=tenant, currency=currency)

    warehouse = Warehouse.objects.first()
    if not warehouse:
        warehouse = Warehouse.objects.create(name='Main Warehouse', tenant=tenant)

    # Create a test document in last month
    doc = SalesDocument.objects.create(
        tenant=tenant,
        date=datetime.combine(last_month, datetime.min.time()),
        counterparty=counterparty,
        contract=contract,
        warehouse=warehouse,
        currency=currency,
        created_by=user
    )
    
    # Close the period
    closing, _ = PeriodClosing.objects.get_or_create(tenant=tenant, period=last_month)
    if closing.status != 'CLOSED':
        print(f"   Closing period {last_month}...")
        closing.close_period(user, reason="Audit Test")
    
    # Try to post the document (SHOULD FAIL)
    try:
        print(f"   Attempting to post document in closed period {last_month}...")
        doc.post()
        print("   ❌ FAIL: Document posted in closed period!")
    except ValidationError as e:
        print("   ✅ PASS: Document posting blocked by closed period.")
        
    # Try to manually create entry (SHOULD FAIL)
    try:
        print("   Attempting to manually create entry in closed period...")
        entry = AccountingEntry(
            tenant=tenant,
            date=datetime.combine(last_month, datetime.min.time()),
            period=last_month,
            debit_account=ChartOfAccounts.objects.first(),
            credit_account=ChartOfAccounts.objects.last(),
            amount=Decimal('100.00'),
            currency=currency,
            content_type=django.contrib.contenttypes.models.ContentType.objects.get_for_model(doc),
            object_id=doc.id
        )
        entry.save()
        print("   ❌ FAIL: AccountingEntry created in closed period!")
    except ValidationError as e:
        print("   ✅ PASS: AccountingEntry creation blocked by closed period.")

    # 2. AUDITABILITY CHECK
    print("\n📜 Checking Auditability...")
    logs = PeriodClosingLog.objects.filter(period_closing=closing, action='CLOSE')
    if logs.exists():
        log = logs.first()
        print(f"   ✅ PASS: Period closing logged by {log.user} at {log.timestamp}")
    else:
        print("   ❌ FAIL: No audit log found for period closing!")

    # Reopen for cleanup
    try:
        closing.reopen(user, reason="Audit Verification Cleanup", force=True)
        print("   INFO: Period reopened for cleanup.")
    except Exception as e:
        print(f"   Warning: Could not reopen period: {e}")

    # 3. CONSISTENCY CHECK
    print("\n⚖️  Checking Consistency (Trial Balance vs entries)...")
    
    # Recalculate Trial Balance for last month
    TrialBalance.calculate_for_period(tenant, last_month)
    
    # Fetch all entries
    entries_debit = AccountingEntry.objects.filter(tenant=tenant, period=last_month).values('debit_account').annotate(
        total=django.db.models.Sum('amount')
    )
    entries_credit = AccountingEntry.objects.filter(tenant=tenant, period=last_month).values('credit_account').annotate(
        total=django.db.models.Sum('amount')
    )
    
    # Check specific account if available
    acc = ChartOfAccounts.objects.first()
    if acc:
        tb = TrialBalance.objects.filter(tenant=tenant, period=last_month, account=acc).first()
        if tb:
             # Manually sum
            debit_sum = sum(x['total'] for x in entries_debit if x['debit_account'] == acc.id)
            credit_sum = sum(x['total'] for x in entries_credit if x['credit_account'] == acc.id)
            
            print(f"   Account {acc.code}:")
            print(f"     TB Turnover Debit: {tb.turnover_debit} | Actual: {debit_sum}")
            print(f"     TB Turnover Credit: {tb.turnover_credit} | Actual: {credit_sum}")
            
            if abs(tb.turnover_debit - debit_sum) < 0.01 and abs(tb.turnover_credit - credit_sum) < 0.01:
                print("   ✅ PASS: Trial Balance matches Actual Entries.")
            else:
                print("   ❌ FAIL: Discrepancy detected!")
        else:
             print("   Info: No Trial Balance record for first account.")

    # 4. TRANSPARENCY CHECK
    print("\n🔍 Checking Transparency (Drill-down metadata)...")
    entry = AccountingEntry.objects.filter(tenant=tenant).first()
    if entry:
        url = entry.get_document_url()
        if url:
             print(f"   ✅ PASS: Drill-down URL generated: {url}")
        else:
             print("   ⚠️ WARNING: No URL generated for entry (might be manual op or missing map).")
    else:
        print("   Info: No entries to check specific drill-down.")

    print("\n✨ Level 10 Verification Complete.")

if __name__ == '__main__':
    run_verification()
