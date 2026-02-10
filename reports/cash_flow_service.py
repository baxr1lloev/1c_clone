from decimal import Decimal
from django.db.models import Sum, Q
from django.utils import timezone
from datetime import timedelta

from accounting.models import ChartOfAccounts, AccountingEntry
from registers.models import SettlementsBalance
from documents.models import SalesDocument, PurchaseDocument


from decimal import Decimal
from django.db.models import Sum, Q
from django.utils import timezone
from datetime import timedelta

from accounting.models import ChartOfAccounts, AccountingEntry
from registers.models import SettlementsBalance
from documents.models import SalesDocument, PurchaseDocument


class CashFlowService:
    """Service for Cash Flow analysis and reporting."""
    
    @staticmethod
    def get_cash_flow_statement(tenant, start_date, end_date):
        """
        Generate cash flow statement showing where money came from and went.
        """
        # 1. Get opening balance (cash + bank accounts before start_date)
        opening_balance = CashFlowService._get_cash_balance(tenant, start_date, inclusive=False)
        
        # 2. Get closing balance (cash + bank accounts at end_date)
        closing_balance = CashFlowService._get_cash_balance(tenant, end_date, inclusive=True)
        
        # 3. Get all cash movements during period
        # Identify cash accounts (Assets starting with 5, e.g. 50 Cash, 51 Bank, 52 Currency)
        cash_accounts = ChartOfAccounts.objects.filter(
            tenant=tenant,
            account_type='ASSET',
            code__startswith='5'
        )
        cash_account_ids = set(cash_accounts.values_list('id', flat=True))
        
        # Filter entries where DEBIT OR CREDIT is a cash account
        entries = AccountingEntry.objects.filter(
            Q(debit_account__in=cash_accounts) | Q(credit_account__in=cash_accounts),
            tenant=tenant,
            date__gte=start_date,
            date__lte=end_date
        ).select_related('debit_account', 'credit_account')
        
        # 4. Categorize entries
        inflows = {}
        outflows = {}
        
        for entry in entries:
            amount = entry.amount
            
            is_debit_cash = entry.debit_account_id in cash_account_ids
            is_credit_cash = entry.credit_account_id in cash_account_ids
            
            if is_debit_cash and not is_credit_cash:
                # Inflow (Debit Cash, Credit Source)
                category = CashFlowService._categorize_cash_inflow(entry)
                inflows[category] = inflows.get(category, Decimal('0')) + amount
                
            elif is_credit_cash and not is_debit_cash:
                # Outflow (Credit Cash, Debit Expense/Liability)
                category = CashFlowService._categorize_cash_outflow(entry)
                outflows[category] = outflows.get(category, Decimal('0')) + amount
                
            # If both are cash (Transfer), ignore for Statement purpose (net zero flow)
        
        total_inflow = sum(inflows.values())
        total_outflow = sum(outflows.values())
        net_change = total_inflow - total_outflow
        
        return {
            'period': {'start': start_date, 'end': end_date},
            'opening_balance': opening_balance,
            'inflows': inflows,
            'total_inflow': total_inflow,
            'outflows': outflows,
            'total_outflow': total_outflow,
            'closing_balance': closing_balance,
            'net_change': net_change,
        }
    
    @staticmethod
    def get_cash_position(tenant, as_of_date=None):
        """Get current cash balances by account."""
        if not as_of_date:
            as_of_date = timezone.now().date()
        
        cash_accounts = ChartOfAccounts.objects.filter(
            tenant=tenant,
            account_type='ASSET',
            code__startswith='5'
        ).order_by('code')
        
        balances = []
        total = Decimal('0')
        
        for account in cash_accounts:
            # Debit increases asset, Credit decreases asset
            debits = AccountingEntry.objects.filter(
                tenant=tenant,
                debit_account=account,
                date__lte=as_of_date
            ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
            
            credits = AccountingEntry.objects.filter(
                tenant=tenant,
                credit_account=account,
                date__lte=as_of_date
            ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
            
            balance = debits - credits
            
            if balance != 0:
                balances.append({
                    'account': account,
                    'balance': balance,
                    'currency': tenant.base_currency,  # Assuming base currency for now
                })
                total += balance
        
        return {
            'accounts': balances,
            'total': total,
            'as_of_date': as_of_date,
        }
    
    @staticmethod
    def get_receivables_aging(tenant, as_of_date=None):
        """Get receivables aging."""
        return CashFlowService._get_aging(tenant, as_of_date, is_receivable=True)
    
    @staticmethod
    def get_payables_aging(tenant, as_of_date=None):
        """Get payables aging."""
        return CashFlowService._get_aging(tenant, as_of_date, is_receivable=False)

    @staticmethod
    def _get_aging(tenant, as_of_date, is_receivable=True):
        if not as_of_date:
            as_of_date = timezone.now().date()
            
        filters = {'tenant': tenant}
        if is_receivable:
            filters['amount__gt'] = 0
            doc_model = SalesDocument
        else:
            filters['amount__lt'] = 0
            doc_model = PurchaseDocument
            
        items = SettlementsBalance.objects.filter(**filters).select_related('counterparty', 'contract', 'currency')
        
        aged_items = []
        totals = {k: Decimal('0') for k in ['current', 'days_1_30', 'days_31_60', 'days_61_90', 'days_90_plus']}
        
        for item in items:
            amount = abs(item.amount)
            # Find oldest unpaid doc
            oldest_doc = doc_model.objects.filter(
                tenant=tenant,
                counterparty=item.counterparty,
                status='posted'
            ).order_by('date').first()
            
            days_old = (as_of_date - oldest_doc.date.date()).days if oldest_doc else 0
            
            if days_old <= 0: 
                bucket = 'current'
                label = 'Current'
            elif days_old <= 30: 
                bucket = 'days_1_30'
                label = '1-30 days'
            elif days_old <= 60: 
                bucket = 'days_31_60'
                label = '31-60 days'
            elif days_old <= 90: 
                bucket = 'days_61_90'
                label = '61-90 days'
            else: 
                bucket = 'days_90_plus'
                label = '90+ days'
            
            aged_items.append({
                'counterparty': item.counterparty,
                'amount': amount,
                'currency': item.currency,
                'days_old': days_old,
                'bucket': bucket,
                'bucket_label': label,
            })
            totals[bucket] += amount
            
        return {
            'items': aged_items,
            'totals': totals,
            'total': sum(totals.values()),
            'as_of_date': as_of_date,
        }

    @staticmethod
    def _get_cash_balance(tenant, as_of_date, inclusive=True):
        """Calculate total cash balance."""
        cash_accounts = ChartOfAccounts.objects.filter(
            tenant=tenant,
            account_type='ASSET',
            code__startswith='5'
        )
        
        filter_date = 'date__lte' if inclusive else 'date__lt'
        
        debits = AccountingEntry.objects.filter(
            tenant=tenant,
            debit_account__in=cash_accounts,
            **{filter_date: as_of_date}
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
        
        credits = AccountingEntry.objects.filter(
            tenant=tenant,
            credit_account__in=cash_accounts,
            **{filter_date: as_of_date}
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
        
        return debits - credits

    @staticmethod
    def _categorize_cash_inflow(entry):
        desc = (entry.description or '').lower()
        if 'Payment received' in entry.description: return 'Customer Payments'
        if '62' in entry.credit_account.code: return 'Customer Payments'
        return 'Other Income'

    @staticmethod
    def _categorize_cash_outflow(entry):
        if 'Payment to' in entry.description: return 'Supplier Payments'
        if '60' in entry.debit_account.code: return 'Supplier Payments'
        if 'salary' in (entry.description or '').lower(): return 'Salaries'
        return 'Other Expenses'
