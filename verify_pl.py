import os
import django
from datetime import date
from decimal import Decimal

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from tenants.models import Tenant
from directories.models import Currency
from accounting.models import AccountingEntry, PeriodClosing, ChartOfAccounts
from reports.services.profit_loss_service import ProfitLossService
from django.contrib.auth import get_user_model

User = get_user_model()

def run():
    print("Setting up test data...")
    # Get or create tenant
    user = User.objects.first()
    if not user:
        print("No user found")
        return
    tenant = user.tenant

    # Ensure accounts exist
    acc_90_1 = ChartOfAccounts.objects.get_or_create(tenant=tenant, code='90.1', defaults={'name': 'Revenue', 'account_type': 'REVENUE'})[0]
    acc_90_2 = ChartOfAccounts.objects.get_or_create(tenant=tenant, code='90.2', defaults={'name': 'COGS', 'account_type': 'EXPENSE'})[0]
    acc_62 = ChartOfAccounts.objects.get_or_create(tenant=tenant, code='62', defaults={'name': 'Customers', 'account_type': 'ASSET'})[0]
    acc_41 = ChartOfAccounts.objects.get_or_create(tenant=tenant, code='41', defaults={'name': 'Goods', 'account_type': 'ASSET'})[0]
    
    # Create Entries for Current Period (2025-02)
    start_date = date(2025, 2, 1)
    end_date = date(2025, 2, 28)
    
    # Revenue: Dt 62 Kt 90.1 = 1000
    from django.contrib.contenttypes.models import ContentType
    ct = ContentType.objects.get_for_model(user) # Dummy
    
    currency = Currency.objects.first()
    
    def create_entry(dt_acc, kt_acc, amount, d):
        AccountingEntry.objects.create(
            tenant=tenant,
            date=d,
            period=d.replace(day=1),
            debit_account=dt_acc,
            credit_account=kt_acc,
            amount=Decimal(amount),
            currency=currency,
            content_type=ct,
            object_id=user.id
        )

    # Clear old entries for this period to avoid double counting if re-run
    AccountingEntry.objects.filter(tenant=tenant, period=start_date).delete()

    create_entry(acc_62, acc_90_1, 1000, start_date)
    create_entry(acc_90_2, acc_41, 600, start_date) # COGS

    print("Running report...")
    report = ProfitLossService.get_report(tenant, start_date, end_date)
    
    print("\n--- P&L Report ---")
    for item in report:
        indent = "  " * item['level']
        print(f"{indent}{item['name']}: {item['amount']}")
        
    # Verify values
    revenue_item = next(i for i in report if i['id'] == 'revenue')
    cogs_item = next(i for i in report if i['id'] == 'cogs')
    gross_profit = next(i for i in report if i['id'] == 'gross_profit')
    
    assert revenue_item['amount'] == 1000.0, f"Revenue should be 1000, got {revenue_item['amount']}"
    assert cogs_item['amount'] == -600.0, f"COGS should be -600, got {cogs_item['amount']}"
    assert gross_profit['amount'] == 400.0, f"Gross Profit should be 400, got {gross_profit['amount']}"
    
    print("\n✅ Verification Successful!")

if __name__ == '__main__':
    run()
