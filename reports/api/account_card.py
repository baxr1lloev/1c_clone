from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from accounting.models import AccountingEntry, ChartOfAccounts
from django.db.models import Sum, Q

class AccountCardView(APIView):
    """
    API for Account Card (Карточка счета) report.
    Returns chronological list of entries for a specific account.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        tenant = request.user.tenant
        account_id = request.query_params.get('account')
        start_date = request.query_params.get('start')
        end_date = request.query_params.get('end')

        if not account_id:
            return Response({'error': 'Account ID is required'}, status=400)

        # Get opening balance (TODO: Calculate real opening balance)
        # For now, start with 0 or fetch from TrialBalance if exists
        opening_balance = 0 
        
        entries = AccountingEntry.objects.filter(
            tenant=tenant,
            date__gte=start_date,
            date__lte=end_date
        ).filter(
            Q(debit_account_id=account_id) | Q(credit_account_id=account_id)
        ).select_related(
            'debit_account', 'credit_account', 'content_type'
        ).prefetch_related('document').order_by('date', 'created_at')

        data = []
        current_balance = opening_balance

        for e in entries:
            is_debit = str(e.debit_account_id) == str(account_id)
            
            debit_amt = e.amount if is_debit else 0
            credit_amt = e.amount if not is_debit else 0
            
            # Update balance (Asset/Expense: Debit+, Credit-)
            # Liability/Equity/Revenue: Credit+, Debit-
            # Need to know account type. 
            # For simplicity in UI, we often just show Debit/Credit columns and separate Balance.
            # But standard logic:
            # Active account: Bal = Bal + Dt - Kt
            # Passive account: Bal = Bal + Kt - Dt
            
            # We need account object to know type
            account = e.debit_account if is_debit else e.credit_account
            # Wait, account_id is fixed.
            
            # Simple assumption for now: Running balance arithmetic depends on account type.
            # Let's fetch the account type first.
            
             # ... (Optimization: fetch account once outside loop)
            pass

        # Re-query with account type
        target_account = ChartOfAccounts.objects.get(id=account_id, tenant=tenant)
        is_passive = target_account.account_type in ['LIABILITY', 'EQUITY', 'REVENUE']
        
        current_balance = opening_balance

        for e in entries:
            doc = e.document
            doc_number = getattr(doc, 'number', '-') if doc else '-'
            doc_type = e.content_type.model if e.content_type else 'unknown'

            is_debit = e.debit_account_id == int(account_id)
            
            debit_amount = float(e.amount) if is_debit else 0
            credit_amount = float(e.amount) if not is_debit else 0
            
            if is_passive:
                current_balance += (credit_amount - debit_amount)
            else:
                current_balance += (debit_amount - credit_amount)

            # Analytics / Description
            corr_account = e.credit_account if is_debit else e.debit_account
            description = f"Coreresp: {corr_account.code}. {e.description or ''}"

            data.append({
                'id': e.id,
                'date': e.date.isoformat(),
                'document_id': e.object_id if e.object_id else 0,
                'document_type': doc_type,
                'document_number': doc_number,
                'description': description,
                'debit': debit_amount,
                'credit': credit_amount,
                'balance': float(current_balance)
            })

        return Response(data)
