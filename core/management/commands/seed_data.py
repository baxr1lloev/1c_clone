from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db import transaction
class Command(BaseCommand):
    help = 'Seeds database with 1C-style demo data'

    def handle(self, *args, **kwargs):
        self.stdout.write("Seeding data...")
        
        # Move imports inside to isolate failure
        from tenants.models import Tenant
        from directories.models import Currency, Counterparty, Item, Warehouse, ItemCategory, BankAccount, Contract
        from accounting.models import ChartOfAccounts, AccountingEntry, PeriodClosing
        from documents.models import SalesDocument, SalesDocumentLine, PurchaseDocument, PurchaseDocumentLine
        
        # 1. Get or Create Tenant
        self.stdout.write("Creating Tenant...")
        # Check if any tenant exists first
        tenant = Tenant.objects.first()
        if not tenant:
            tenant, _ = Tenant.objects.get_or_create(
                company_name="Demo Company", 
                defaults={'default_language': 'en', 'inn': '999999999'}
            )
            self.stdout.write(f"Created Tenant: {tenant}")
        else:
            self.stdout.write(f"Using existing Tenant: {tenant}")
            # Ensure base currency linkage later if needed
        
        # 2. Currencies
        self.stdout.write("Creating Currencies...")
        usd, _ = Currency.objects.get_or_create(code='USD', defaults={'name': 'US Dollar', 'is_base': True})
        eur, _ = Currency.objects.get_or_create(code='EUR', defaults={'name': 'Euro', 'is_base': False})
        uzs, _ = Currency.objects.get_or_create(code='UZS', defaults={'name': 'Uzbek Sum', 'is_base': False})
        
        # Set base currency
        if not tenant.base_currency:
             tenant.base_currency = usd
             tenant.save()

        # 3. Chart of Accounts (Standard 1C Plan)
        self.stdout.write("Creating Chart of Accounts...")
        accounts_data = [
            ('1010', 'Cash in Hand', 'ASSET'),
            ('1030', 'Bank Accounts', 'ASSET'),
            ('1210', 'Accounts Receivable (Customers)', 'ASSET'),
            ('3310', 'Accounts Payable (Suppliers)', 'LIABILITY'),
            ('4100', 'Goods in Warehouse', 'ASSET'),
            ('6010', 'Revenue from Sales', 'REVENUE'),
            ('7010', 'Cost of Goods Sold', 'EXPENSE'),
            # Aliases for code used in services
            ('41', 'Goods (Generic)', 'ASSET'),
            ('60', 'Suppliers (Generic)', 'LIABILITY'),
            ('62', 'Customers (Generic)', 'ASSET'),
            ('90.1', 'Revenue (Generic)', 'REVENUE'),
            ('90.2', 'COGS (Generic)', 'EXPENSE'),
        ]
        
        for code, name, type_ in accounts_data:
            ChartOfAccounts.objects.get_or_create(
                tenant=tenant, 
                code=code, 
                defaults={'name': name, 'account_type': type_}
            )

        # 4. Warehouses
        self.stdout.write("Creating Warehouses...")
        main_wh, _ = Warehouse.objects.get_or_create(
            tenant=tenant,
            name="Main Warehouse",
            defaults={'warehouse_type': 'PHYSICAL'}
        )
        
        # 5. Items (Goods & Services)
        self.stdout.write("Creating Items...")
        cat_goods, _ = ItemCategory.objects.get_or_create(tenant=tenant, name="Electronics")
        cat_services, _ = ItemCategory.objects.get_or_create(tenant=tenant, name="Services")
        
        item_iphone, _ = Item.objects.get_or_create(
            tenant=tenant,
            sku="IPHONE-15",
            defaults={'name': 'iPhone 15 Pro', 'item_type': 'GOODS', 'category': cat_goods, 'purchase_price': 900, 'selling_price': 1200}
        )
        
        item_service, _ = Item.objects.get_or_create(
            tenant=tenant,
            sku="DELIVERY",
            defaults={'name': 'Express Delivery', 'item_type': 'SERVICE', 'category': cat_services, 'purchase_price': 0, 'selling_price': 50}
        )

        # 6. Counterparties
        self.stdout.write("Creating Counterparties...")
        supplier, _ = Counterparty.objects.get_or_create(
            tenant=tenant,
            inn="123456789",
            defaults={'name': 'Apple Distro Inc.', 'type': 'VENDOR'}
        )
        
        customer, _ = Counterparty.objects.get_or_create(
            tenant=tenant,
            inn="987654321",
            defaults={'name': 'Tech Store LLC', 'type': 'CUSTOMER'}
        )
        
        # 7. Contracts
        self.stdout.write("Creating Contracts...")
        contract_buy, _ = Contract.objects.get_or_create(
            tenant=tenant,
            counterparty=supplier,
            number="SUP-2024-001",
            defaults={'date': timezone.now().date(), 'currency': usd, 'contract_type': 'PURCHASE'}
        )
        
        contract_sell, _ = Contract.objects.get_or_create(
            tenant=tenant,
            counterparty=customer,
            number="SAL-2024-001",
            defaults={'date': timezone.now().date(), 'currency': usd, 'contract_type': 'SALES'}
        )
        
        # 8. Bank Account
        self.stdout.write("Creating Bank Accounts...")
        bank_acc, _ = BankAccount.objects.get_or_create(
            tenant=tenant,
            name="Main Operating Account",
            defaults={
                'bank_name': 'Chase Bank', 
                'account_number': 'US1234567890', 
                'currency': usd,
                # 'chart_account' link might be needed if model supports it, but standard uses code 1030
            }
        )
        
        # 9. Ensure Period is Open
        current_period = timezone.now().date().replace(day=1)
        PeriodClosing.objects.get_or_create(
            tenant=tenant,
            period=current_period,
            defaults={'status': 'OPEN', 'operational_closed': False, 'accounting_closed': False}
        )

        self.stdout.write(self.style.SUCCESS('Successfully seeded database!'))
