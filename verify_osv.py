import os
import django
from datetime import date
from decimal import Decimal

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from tenants.models import Tenant
from directories.models import Currency
from accounting.models import AccountingEntry, ChartOfAccounts
from reports.services.account_card_service import AccountCardService
from django.contrib.auth import get_user_model

User = get_user_model()

def run():
    print("Setting up test data...")
    user = User.objects.first()
    if not user:
        print("No user found")
        return
    tenant = user.tenant

    # Accounts
    acc_cash = ChartOfAccounts.objects.get_or_create(tenant=tenant, code='50', defaults={'name': 'Cash', 'account_type': 'ASSET'})[0]
    acc_sales = ChartOfAccounts.objects.get_or_create(tenant=tenant, code='90.1', defaults={'name': 'Revenue', 'account_type': 'REVENUE'})[0]
    
    start_date = date(2025, 3, 1)
    end_date = date(2025, 3, 31)
    
    # Create Entries
    # 1. Opening Balance: Cash +1000 (Before period)
    from django.contrib.contenttypes.models import ContentType
    ct = ContentType.objects.get_for_model(user)
    currency = Currency.objects.first()

    # Clear old entries for test
    AccountingEntry.objects.filter(tenant=tenant, period__year=2025, period__month=3).delete()
    AccountingEntry.objects.filter(tenant=tenant, period__year=2025, period__month=2).delete()

    # Previous period entry (Feb)
    AccountingEntry.objects.create(
        tenant=tenant,
        date=date(2025, 2, 15),
        period=date(2025, 2, 1),
        debit_account=acc_cash,
        credit_account=acc_sales,
        amount=Decimal(1000),
        currency=currency,
        content_type=ct,
        object_id=user.id,
        description="Opening Cash"
    )

    # Current period entry (March)
    # Sale: Cash +500
    AccountingEntry.objects.create(
        tenant=tenant,
        date=date(2025, 3, 10),
        period=start_date,
        debit_account=acc_cash,
        credit_account=acc_sales,
        amount=Decimal(500),
        currency=currency,
        content_type=ct,
        object_id=user.id,
        description="March Sale"
    )
    
    print("Running Account Card report for Cash (50)...")
    report = AccountCardService.get_report(tenant, acc_cash.id, start_date, end_date)
    
    print(f"Opening: {report['opening_balance']}")
    print(f"Total Debit: {report['total_debit']}")
    print(f"Closing: {report['closing_balance']}")
    
    assert report['opening_balance'] == 1000.0, f"Opening should be 1000, got {report['opening_balance']}"
    assert report['total_debit'] == 500.0, f"Total Debit should be 500, got {report['total_debit']}"
    assert report['closing_balance'] == 1500.0, f"Closing should be 1500, got {report['closing_balance']}"
    
    print("\n✅ Verification Successful!")

if __name__ == '__main__':
    run()
