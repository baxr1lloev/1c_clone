"""
Accounting Service - Автоматическое создание проводок

Automatically generates accounting entries from business documents.
This is the bridge between operational accounting (УТ) and financial accounting (Бухгалтерия).
"""
from decimal import Decimal
from django.db import transaction
from django.contrib.contenttypes.models import ContentType
from .models import AccountingEntry, ChartOfAccounts


class AccountingService:
    """
    Service for generating accounting entries from documents.
    
    Philosophy (как в 1С):
    - Every business transaction generates accounting entries
    - Double-entry bookkeeping: Debit = Credit
    - Entries are immutable (use reversal for corrections)
    """
    
    @staticmethod
    def get_or_create_account(tenant, code, name, account_type):
        """
        Helper to get or create account.
        """
        account, created = ChartOfAccounts.objects.get_or_create(
            tenant=tenant,
            code=code,
            defaults={
                'name': name,
                'account_type': account_type,
                'is_active': True
            }
        )
        return account
    
    @staticmethod
    @transaction.atomic
    def create_purchase_entries(purchase_doc, batches_created):
        """
        Generate accounting entries for purchase.
        
        Проводка:
        Дт 41 "Товары на складах" Кт 60 "Расчёты с поставщиками"
        
        Args:
            purchase_doc: PurchaseDocument instance
            batches_created: List of StockBatch instances
        
        Returns:
            AccountingEntry instance
        """
        # Calculate total cost from batches
        total_cost = sum(
            batch.qty_initial * batch.unit_cost 
            for batch in batches_created
        )
        
        # Get accounts
        account_41 = AccountingService.get_or_create_account(
            tenant=purchase_doc.tenant,
            code='41',
            name='Товары на складах',
            account_type='ASSET'
        )
        
        account_60 = AccountingService.get_or_create_account(
            tenant=purchase_doc.tenant,
            code='60',
            name='Расчёты с поставщиками',
            account_type='LIABILITY'
        )
        
        # Create entry
        entry = AccountingEntry.objects.create(
            tenant=purchase_doc.tenant,
            date=purchase_doc.date,
            period=purchase_doc.date.replace(day=1),
            debit_account=account_41,
            credit_account=account_60,
            amount=round(total_cost, 2),
            currency=purchase_doc.tenant.base_currency,
            content_type=ContentType.objects.get_for_model(purchase_doc),
            object_id=purchase_doc.id,
            description=f"Purchase #{purchase_doc.number} from {purchase_doc.counterparty}"
        )
        
        return entry
    
    @staticmethod
    @transaction.atomic
    def create_sales_entries(sales_doc, cogs_amount):
        """
        Generate accounting entries for sale.
        
        Two entries:
        1. Revenue: Дт 62 "Расчёты с покупателями" Кт 90.1 "Выручка"
        2. COGS: Дт 90.2 "Себестоимость продаж" Кт 41 "Товары"
        
        Args:
            sales_doc: SalesDocument instance
            cogs_amount: Decimal - cost of goods sold
        
        Returns:
            tuple: (revenue_entry, cogs_entry)
        """
        # Get accounts
        account_62 = AccountingService.get_or_create_account(
            tenant=sales_doc.tenant,
            code='62',
            name='Расчёты с покупателями',
            account_type='ASSET'
        )
        
        account_90_1 = AccountingService.get_or_create_account(
            tenant=sales_doc.tenant,
            code='90.1',
            name='Выручка',
            account_type='REVENUE'
        )
        
        account_90_2 = AccountingService.get_or_create_account(
            tenant=sales_doc.tenant,
            code='90.2',
            name='Себестоимость продаж',
            account_type='EXPENSE'
        )
        
        account_41 = AccountingService.get_or_create_account(
            tenant=sales_doc.tenant,
            code='41',
            name='Товары на складах',
            account_type='ASSET'
        )
        
        # Entry 1: Revenue
        revenue_entry = AccountingEntry.objects.create(
            tenant=sales_doc.tenant,
            date=sales_doc.date,
            period=sales_doc.date.replace(day=1),
            debit_account=account_62,
            credit_account=account_90_1,
            amount=round(sales_doc.total_amount_base, 2),  # Use base currency amount
            currency=sales_doc.tenant.base_currency,
            content_type=ContentType.objects.get_for_model(sales_doc),
            object_id=sales_doc.id,
            description=f"Sale #{sales_doc.number} to {sales_doc.counterparty} - Revenue"
        )
        
        # Entry 2: COGS
        cogs_entry = AccountingEntry.objects.create(
            tenant=sales_doc.tenant,
            date=sales_doc.date,
            period=sales_doc.date.replace(day=1),
            debit_account=account_90_2,
            credit_account=account_41,
            amount=round(cogs_amount, 2),
            currency=sales_doc.tenant.base_currency,
            content_type=ContentType.objects.get_for_model(sales_doc),
            object_id=sales_doc.id,
            description=f"Sale #{sales_doc.number} - Cost of Goods Sold"
        )
        
        return (revenue_entry, cogs_entry)
    
    @staticmethod
    @transaction.atomic
    def create_payment_entries(payment_doc):
        """
        Generate accounting entries for payment.
        
        Incoming Payment (from customer):
        Дт 51 "Расчётные счета" Кт 62 "Расчёты с покупателями"
        
        Outgoing Payment (to supplier):
        Дт 60 "Расчёты с поставщиками" Кт 51 "Расчётные счета"
        
        Args:
            payment_doc: PaymentDocument instance
        
        Returns:
            AccountingEntry instance
        """
        # Get accounts
        account_51 = AccountingService.get_or_create_account(
            tenant=payment_doc.tenant,
            code='51',
            name='Расчётные счета',
            account_type='ASSET'
        )
        
        if payment_doc.payment_type == 'INCOMING':
            # Customer pays us
            account_62 = AccountingService.get_or_create_account(
                tenant=payment_doc.tenant,
                code='62',
                name='Расчёты с покупателями',
                account_type='ASSET'
            )
            
            entry = AccountingEntry.objects.create(
                tenant=payment_doc.tenant,
                date=payment_doc.date,
                period=payment_doc.date.replace(day=1),
                debit_account=account_51,
                credit_account=account_62,
                amount=payment_doc.amount,
                currency=payment_doc.currency,
                content_type=ContentType.objects.get_for_model(payment_doc),
                object_id=payment_doc.id,
                description=f"Payment received from {payment_doc.counterparty}"
            )
        else:  # OUTGOING
            # We pay supplier
            account_60 = AccountingService.get_or_create_account(
                tenant=payment_doc.tenant,
                code='60',
                name='Расчёты с поставщиками',
                account_type='LIABILITY'
            )
            
            entry = AccountingEntry.objects.create(
                tenant=payment_doc.tenant,
                date=payment_doc.date,
                period=payment_doc.date.replace(day=1),
                debit_account=account_60,
                credit_account=account_51,
                amount=payment_doc.amount,
                currency=payment_doc.currency,
                content_type=ContentType.objects.get_for_model(payment_doc),
                object_id=payment_doc.id,
                description=f"Payment to {payment_doc.counterparty}"
            )
        
        return entry
    
    @staticmethod
    def calculate_profit_loss(tenant, period_start, period_end):
        """
        Calculate Profit & Loss for a period.
        
        P&L = Revenue - COGS - Expenses
        
        Args:
            tenant: Tenant instance
            period_start: date - start of period
            period_end: date - end of period
        
        Returns:
            dict: {
                'revenue': Decimal,
                'cogs': Decimal,
                'gross_profit': Decimal,
                'expenses': Decimal,
                'net_profit': Decimal
            }
        """
        from django.db.models import Sum
        
        # Revenue (credit on account 90.1)
        revenue = AccountingEntry.objects.filter(
            tenant=tenant,
            credit_account__code='90.1',
            date__gte=period_start,
            date__lte=period_end
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
        
        # COGS (debit on account 90.2)
        cogs = AccountingEntry.objects.filter(
            tenant=tenant,
            debit_account__code='90.2',
            date__gte=period_start,
            date__lte=period_end
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
        
        gross_profit = revenue - cogs
        
        # Expenses (debit on expense accounts)
        expenses = AccountingEntry.objects.filter(
            tenant=tenant,
            debit_account__account_type='EXPENSE',
            date__gte=period_start,
            date__lte=period_end
        ).exclude(
            debit_account__code='90.2'  # Exclude COGS
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
        
        net_profit = gross_profit - expenses
        
        return {
            'revenue': revenue,
            'cogs': cogs,
            'gross_profit': gross_profit,
            'expenses': expenses,
            'net_profit': net_profit
        }
    
    @staticmethod
    def validate_accounting_balance(tenant, period=None):
        """
        Validate that all accounting entries balance (Debit = Credit).
        
        Args:
            tenant: Tenant instance
            period: Optional date - check specific period
        
        Returns:
            dict: {
                'is_balanced': bool,
                'total_debit': Decimal,
                'total_credit': Decimal,
                'difference': Decimal
            }
        """
        from django.db.models import Sum
        
        filters = {'tenant': tenant}
        if period:
            filters['period'] = period
        
        entries = AccountingEntry.objects.filter(**filters)
        
        total_debit = entries.aggregate(total=Sum('amount'))['total'] or Decimal('0')
        total_credit = entries.aggregate(total=Sum('amount'))['total'] or Decimal('0')
        
        # In double-entry, debit always equals credit
        # So we check if sum of all entries = 0 when considering signs
        difference = total_debit - total_credit
        
        return {
            'is_balanced': abs(difference) < Decimal('0.01'),  # Allow for rounding
            'total_debit': total_debit,
            'total_credit': total_credit,
            'difference': difference
        }
