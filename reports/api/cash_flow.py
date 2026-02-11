from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Sum
from datetime import datetime, date
from accounting.models import AccountingEntry
from directories.models import CashFlowItem

class CashFlowView(APIView):
    """
    Cash Flow Report API (Otchet o Dvizhenii Denezhnih Sredstv).
    
    Structure:
    1. Operating Activities
       - Inflow
         - From customers
         - Other
       - Outflow
         - To suppliers
         - Salary
         - Taxes
         - Other
       = Net Operating Cash Flow
       
    2. Investing Activities
       - Inflow (Context: Sale of assets)
       - Outflow (Purchase of assets)
       = Net Investing Cash Flow
       
    3. Financing Activities
       - Inflow (Loans, Equity)
       - Outflow (Repayment, Dividends)
       = Net Financing Cash Flow
       
    Total Net Cash Flow = 1 + 2 + 3
    + Opening Balance
    = Closing Balance
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        tenant = request.user.tenant
        
        # Parse dates
        start_date_str = request.GET.get('start_date')
        end_date_str = request.GET.get('end_date')
        
        if start_date_str:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
        else:
            start_date = date(date.today().year, date.today().month, 1)
            
        if end_date_str:
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
        else:
            end_date = date.today()
            
        # Get data
        data = self._get_cash_flow_data(tenant, start_date, end_date)
        
        return Response(data)
    
    def _get_cash_flow_data(self, tenant, start_date, end_date):
        # 1. Accounts involved: 50, 51, 52 (Cash/Bank)
        cash_accounts = ['50', '51', '52', '1010', '1030'] # 10x is new plan
        
        # 2. Get entries where Cash Account is Debit (Inflow) or Credit (Outflow)
        entries = AccountingEntry.objects.filter(
            tenant=tenant,
            date__date__range=[start_date, end_date]
        ).select_related('cash_flow_item')
        
        # 3. Structure
        report = {
            'operating': {'inflow': [], 'outflow': [], 'net': 0},
            'investing': {'inflow': [], 'outflow': [], 'net': 0},
            'financing': {'inflow': [], 'outflow': [], 'net': 0},
            'total_net': 0,
            'opening_balance': 0,
            'closing_balance': 0
        }
        
        # Helper to categorize
        def add_item(section, flow_type, item_name, amount):
            target_list = report[section][flow_type]
            # Find existing or add new
            found = False
            for i in target_list:
                if i['name'] == item_name:
                    i['amount'] += amount
                    found = True
                    break
            if not found:
                target_list.append({'name': item_name, 'amount': amount})
                
            if flow_type == 'inflow':
                report[section]['net'] += amount
                report['total_net'] += amount
            else:
                report[section]['net'] -= amount
                report['total_net'] -= amount

        for entry in entries:
            # Check if it's a cash entry
            is_debit_cash = any(entry.debit_account.code.startswith(p) for p in cash_accounts)
            is_credit_cash = any(entry.credit_account.code.startswith(p) for p in cash_accounts)
            
            if not is_debit_cash and not is_credit_cash:
                continue
                
            if is_debit_cash and is_credit_cash:
                # Cash movement between accounts - ignore for Cash Flow
                continue
            
            amount = float(entry.amount)
            cf_item = entry.cash_flow_item
            
            # Default categorization if no CF Item
            if not cf_item:
                section = 'operating'
                name = 'Uncategorized'
                
                # Try to guess from correspondent account
                if is_debit_cash:
                    # Inflow from...
                    corr_acc = entry.credit_account.code
                    if corr_acc.startswith('62') or corr_acc.startswith('1210'): # Customers
                        name = 'Payment from customers'
                    elif corr_acc.startswith('66') or corr_acc.startswith('67'): # Loans
                        section = 'financing'
                        name = 'Credits and loans'
                else:
                    # Outflow to...
                    corr_acc = entry.debit_account.code
                    if corr_acc.startswith('60') or corr_acc.startswith('3310'): # Suppliers
                        name = 'Payment to suppliers'
                    elif corr_acc.startswith('70') or corr_acc.startswith('6710'): # Salary
                        name = 'Salary'
                    elif corr_acc.startswith('68') or corr_acc.startswith('6410'): # Taxes
                        name = 'Taxes'
            else:
                section = cf_item.activity_type.lower()
                name = cf_item.name
                
            if is_debit_cash:
                add_item(section, 'inflow', name, amount)
            else:
                add_item(section, 'outflow', name, amount)
                
        # Calculate opening balance
        # Need sum of all cash entries before start_date
        # Simple/fast way: query
        opening_debit = AccountingEntry.objects.filter(
            tenant=tenant,
            date__date__lt=start_date,
            debit_account__code__in=cash_accounts # Simplified lookup for now
        ).aggregate(Sum('amount'))['amount__sum'] or 0
        
        # Need correct regex/startswith for account code filtering in production
        # For now assuming exact match or simple startswith logic if we had exact list
        # Re-doing opening balance properly with Q objects for startswith
        from django.db.models import Q
        cash_filter_debit = Q()
        cash_filter_credit = Q()
        for code in cash_accounts:
            cash_filter_debit |= Q(debit_account__code__startswith=code)
            cash_filter_credit |= Q(credit_account__code__startswith=code)
            
        opening_debit = AccountingEntry.objects.filter(
            cash_filter_debit,
            tenant=tenant,
            date__date__lt=start_date
        ).aggregate(Sum('amount'))['amount__sum'] or 0
        
        opening_credit = AccountingEntry.objects.filter(
            cash_filter_credit,
            tenant=tenant,
            date__date__lt=start_date
        ).aggregate(Sum('amount'))['amount__sum'] or 0
        
        report['opening_balance'] = float(opening_debit - opening_credit)
        report['closing_balance'] = report['opening_balance'] + report['total_net']
        
        return report
