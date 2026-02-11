from decimal import Decimal
from django.db.models import Sum, Q, F
from accounting.models import AccountingEntry, ChartOfAccounts

class AccountCardService:
    """
    Service for 'Account Card' (Kartochka Scheta) report.
    Shows all movements for a specific account within a period, 
    plus opening and closing balances.
    """

    @classmethod
    def get_report(cls, tenant, account_id, start_date, end_date):
        account = ChartOfAccounts.objects.get(id=account_id, tenant=tenant)
        
        # 1. Opening Balance (before start_date)
        # Active accounts: Dr - Cr
        # Passive accounts: Cr - Dr
        
        opening_dr = AccountingEntry.objects.filter(
            tenant=tenant,
            debit_account=account,
            date__lt=start_date
        ).aggregate(Sum('amount'))['amount__sum'] or Decimal(0)
        
        opening_cr = AccountingEntry.objects.filter(
            tenant=tenant,
            credit_account=account,
            date__lt=start_date
        ).aggregate(Sum('amount'))['amount__sum'] or Decimal(0)
        
        # Determine strict opening balance based on account type
        # But for the report, we usually show a running balance.
        # Let's calculate initial balance based on type.
        
        initial_balance = Decimal(0)
        if account.account_type in ['ASSET', 'EXPENSE']:
            initial_balance = opening_dr - opening_cr
        else: # LIABILITY, EQUITY, REVENUE
            initial_balance = opening_cr - opening_dr
            
        # 2. Entries within period
        entries_qs = AccountingEntry.objects.filter(
            tenant=tenant,
            date__gte=start_date,
            date__lte=end_date
        ).filter(
            Q(debit_account=account) | Q(credit_account=account)
        ).select_related('debit_account', 'credit_account', 'content_type').order_by('date', 'created_at')
        
        report_entries = []
        current_balance = initial_balance
        
        total_debit = Decimal(0)
        total_credit = Decimal(0)
        
        for entry in entries_qs:
            is_debit = (entry.debit_account_id == account.id)
            
            debit_amt = entry.amount if is_debit else Decimal(0)
            credit_amt = Decimal(0) if is_debit else entry.amount
            
            # Update running balance
            if account.account_type in ['ASSET', 'EXPENSE']:
                current_balance += debit_amt - credit_amt
            else:
                current_balance += credit_amt - debit_amt
            
            total_debit += debit_amt
            total_credit += credit_amt
            
            # Source document URL
            doc_url = entry.get_document_url()
            doc_str = str(entry.document) if entry.document else f"Entry #{entry.id}"
            
            # Corresponding account (Kor. schet)
            corr_acc = entry.credit_account.code if is_debit else entry.debit_account.code
            
            report_entries.append({
                'id': entry.id,
                'date': entry.date.isoformat(),
                'document': doc_str,
                'document_url': doc_url, # For drill-down
                'corr_account': corr_acc,
                'debit': float(debit_amt),
                'credit': float(credit_amt),
                'current_balance': float(current_balance),
                'description': entry.description
            })
            
        return {
            'account_code': account.code,
            'account_name': account.name,
            'opening_balance': float(initial_balance),
            'total_debit': float(total_debit),
            'total_credit': float(total_credit),
            'closing_balance': float(current_balance),
            'entries': report_entries
        }
