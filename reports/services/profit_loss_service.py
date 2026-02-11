from decimal import Decimal
from django.db.models import Sum, Q
from django.utils.translation import gettext_lazy as _
from accounting.models import AccountingEntry, PeriodClosing

class ProfitLossService:
    """
    Service to generate 1C-style Profit & Loss Report.
    Features:
    - Hierarchical structure
    - Drill-down metadata
    - Period comparison (YoY/MoM)
    - "Explainable" formula metadata
    """

    @classmethod
    def get_report(cls, tenant, start_date, end_date, compare_start=None, compare_end=None):
        """
        Generate P&L report data.
        """
        report_data = []
        
        # 1. Revenue (Wyruchka) - Credit 90.1
        revenue = cls._get_turnover(tenant, '90.1', 'credit', start_date, end_date)
        revenue_prev = cls._get_turnover(tenant, '90.1', 'credit', compare_start, compare_end) if compare_start else 0
        
        report_data.append({
            'id': 'revenue',
            'name': _('Выручка (Revenue)'),
            'level': 0,
            'type': 'income', # Green/Neutral
            'amount': float(revenue),
            'amount_prev': float(revenue_prev),
            'change_percent': cls._calc_change(revenue, revenue_prev),
            'formula': 'Credit turnover of 90.1',
            'drill_down_filter': {'account': '90.1', 'type': 'credit'}
        })

        # 2. COGS (Sebestoimost) - Debit 90.2
        cogs = cls._get_turnover(tenant, '90.2', 'debit', start_date, end_date)
        cogs_prev = cls._get_turnover(tenant, '90.2', 'debit', compare_start, compare_end) if compare_start else 0
        
        report_data.append({
            'id': 'cogs',
            'name': _('Себестоимость (COGS)'),
            'level': 0,
            'type': 'expense', # Red if negative, but COGS is naturally negative in P&L logic? 
                               # 1C Logic: Revenue is positive, Expenses are subtracted. 
                               # Let's show expenses as negative numbers for calculation, but maybe display positive with label "Expense"?
                               # User request: "COGS always minus". So we keep it negative.
            'amount': -float(cogs), 
            'amount_prev': -float(cogs_prev),
            'change_percent': cls._calc_change(cogs, cogs_prev),
            'formula': 'Debit turnover of 90.2',
            'drill_down_filter': {'account': '90.2', 'type': 'debit'}
        })

        # 3. Gross Profit (Valovaya Pribyl)
        gross_profit = revenue - cogs
        gross_profit_prev = revenue_prev - cogs_prev
        
        report_data.append({
            'id': 'gross_profit',
            'name': _('Валовая прибыль (Gross Profit)'),
            'level': 0,
            'type': 'total', # Bold
            'amount': float(gross_profit),
            'amount_prev': float(gross_profit_prev),
            'change_percent': cls._calc_change(gross_profit, gross_profit_prev),
            'formula': 'Revenue - COGS',
            'is_calculated': True
        })
        
        # 4. Operating Expenses Group
        # Accounts 20, 26, 44
        op_expenses_accounts = ['20', '26', '44'] 
        op_expenses_total = Decimal(0)
        op_expenses_total_prev = Decimal(0)
        
        # Header for Op Expenses
        report_data.append({
            'id': 'op_expenses',
            'name': _('Операционные расходы (Operating Expenses)'),
            'level': 0,
            'type': 'group_header',
            'amount': 0, # Will be filled? Or just a header. Let's make it a total line later or allow collapsing.
            'is_group': True
        })
        
        for code in op_expenses_accounts:
            amount = cls._get_turnover(tenant, code, 'debit', start_date, end_date)
            amount_prev = cls._get_turnover(tenant, code, 'debit', compare_start, compare_end) if compare_start else 0
            
            if amount == 0 and amount_prev == 0:
                continue
                
            op_expenses_total += amount
            op_expenses_total_prev += amount_prev
            
            # Fetch account name if possible
            # account_name = ...
            
            report_data.append({
                'id': f'exp_{code}',
                'name': f'Expense Account {code}', # Todo: get real name
                'level': 1,
                'type': 'expense',
                'amount': -float(amount),
                'amount_prev': -float(amount_prev),
                'change_percent': cls._calc_change(amount, amount_prev),
                'drill_down_filter': {'account': code, 'type': 'debit'}
            })

        # Total Op Expenses
        report_data.append({
            'id': 'total_op_expenses',
            'name': _('Итого опер. расходы'),
            'level': 0, # Back to root
            'type': 'total',
            'amount': -float(op_expenses_total),
            'amount_prev': -float(op_expenses_total_prev),
            'change_percent': cls._calc_change(op_expenses_total, op_expenses_total_prev),
            'formula': 'Sum of 20, 26, 44',
            'is_calculated': True
        })
        
        # 5. Net Profit
        net_profit = gross_profit - op_expenses_total
        net_profit_prev = gross_profit_prev - op_expenses_total_prev
        
        report_data.append({
            'id': 'net_profit',
            'name': _('Чистая прибыль (Net Income)'),
            'level': 0,
            'type': 'final_total', # Highlighted
            'amount': float(net_profit),
            'amount_prev': float(net_profit_prev),
            'change_percent': cls._calc_change(net_profit, net_profit_prev),
            'formula': 'Gross Profit - Operating Expenses',
            'is_calculated': True
        })

        return report_data

    @staticmethod
    def _get_turnover(tenant, account_code, type_, start_date, end_date):
        qs = AccountingEntry.objects.filter(
            tenant=tenant,
            date__gte=start_date,
            date__lte=end_date
        )
        
        if type_ == 'debit':
            # Sum of amounts where debit_account.code starts with account_code
            return qs.filter(debit_account__code__startswith=account_code).aggregate(Sum('amount'))['amount__sum'] or Decimal(0)
        else:
            return qs.filter(credit_account__code__startswith=account_code).aggregate(Sum('amount'))['amount__sum'] or Decimal(0)

    @staticmethod
    def _calc_change(current, prev):
        if not prev or prev == 0:
            return 0 if current == 0 else 100
        return float(((current - prev) / abs(prev)) * 100)
