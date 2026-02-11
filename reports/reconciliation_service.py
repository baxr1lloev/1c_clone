"""
Reconciliation Service — Level 6: «Остатки сходятся везде»

Compares register balances vs accounting balances to find discrepancies.
If register says stock = 100 and accounting account 41 says 100 → OK.
If different → panic/discrepancy.

This is critical for accountant trust.
"""

from decimal import Decimal
from django.db.models import Sum, Q, F
from django.db.models.functions import Coalesce

from registers.models import StockBalance, SettlementsBalance, StockMovement, SettlementMovement
from accounting.models import AccountingEntry, ChartOfAccounts
from directories.models import Warehouse, Item, Counterparty


class ReconciliationService:
    """
    Cross-checks register balances against accounting (journal) balances.
    
    Checks:
    1. Stock register total vs account 41xx (Товары)
    2. Settlement register total vs accounts 60xx/62xx (Поставщики/Покупатели)
    3. Internal consistency of movements vs cached balances
    """

    @staticmethod
    def check_stock_vs_accounting(tenant):
        """
        Compare stock register balance with accounting account 41 (Товары на складах).
        
        Returns:
            dict with register_total, accounting_total, difference, details[]
        """
        # 1. Get total from StockBalance register (cache)
        register_total = StockBalance.objects.filter(
            tenant=tenant
        ).aggregate(
            total_qty=Coalesce(Sum('quantity'), Decimal('0')),
            total_amount=Coalesce(Sum('amount'), Decimal('0'))
        )

        # 2. Get total from StockMovement (source of truth)
        movements_in = StockMovement.objects.filter(
            tenant=tenant, type='IN'
        ).aggregate(total=Coalesce(Sum('quantity'), Decimal('0')))
        
        movements_out = StockMovement.objects.filter(
            tenant=tenant, type='OUT'
        ).aggregate(total=Coalesce(Sum('quantity'), Decimal('0')))
        
        movement_net = movements_in['total'] - movements_out['total']

        # 3. Get total from accounting entries (account 41xx - Товары)
        stock_accounts = ChartOfAccounts.objects.filter(
            tenant=tenant,
            code__startswith='41'
        ).values_list('id', flat=True)

        accounting_debit = AccountingEntry.objects.filter(
            tenant=tenant,
            debit_account_id__in=stock_accounts
        ).aggregate(total=Coalesce(Sum('amount'), Decimal('0')))

        accounting_credit = AccountingEntry.objects.filter(
            tenant=tenant,
            credit_account_id__in=stock_accounts
        ).aggregate(total=Coalesce(Sum('amount'), Decimal('0')))

        accounting_balance = accounting_debit['total'] - accounting_credit['total']

        # 4. Per-item breakdown for discrepancy analysis
        items_details = []
        stock_balances = StockBalance.objects.filter(
            tenant=tenant
        ).select_related('item', 'warehouse').order_by('item__name')

        for sb in stock_balances[:50]:  # Limit to 50 for performance
            items_details.append({
                'item_id': sb.item_id,
                'item_name': sb.item.name,
                'warehouse_id': sb.warehouse_id,
                'warehouse_name': sb.warehouse.name,
                'register_qty': float(sb.quantity),
                'register_amount': float(sb.amount),
            })

        return {
            'register_cache_qty': float(register_total['total_qty']),
            'register_cache_amount': float(register_total['total_amount']),
            'movement_net_qty': float(movement_net),
            'cache_vs_movement_diff': float(register_total['total_qty'] - movement_net),
            'accounting_balance': float(accounting_balance),
            'register_vs_accounting_diff': float(register_total['total_amount'] - accounting_balance),
            'is_reconciled': abs(register_total['total_amount'] - accounting_balance) < Decimal('0.01'),
            'items': items_details,
        }

    @staticmethod
    def check_settlements_vs_accounting(tenant):
        """
        Compare settlement register vs accounting accounts 60/62.
        
        Account 62 = Покупатели (receivables) — positive = they owe us
        Account 60 = Поставщики (payables) — positive = we owe them
        """
        # 1. Settlement register totals
        settlement_data = SettlementsBalance.objects.filter(
            tenant=tenant
        ).aggregate(
            total_amount=Coalesce(Sum('amount'), Decimal('0'))
        )

        # Per-counterparty breakdown
        per_counterparty = SettlementsBalance.objects.filter(
            tenant=tenant
        ).values(
            'counterparty_id', 'counterparty__name', 'currency__code'
        ).annotate(
            total=Sum('amount')
        ).order_by('-total')[:50]

        # 2. Accounting: Account 62 (Receivables - Покупатели)
        receivable_accounts = ChartOfAccounts.objects.filter(
            tenant=tenant, code__startswith='62'
        ).values_list('id', flat=True)

        recv_debit = AccountingEntry.objects.filter(
            tenant=tenant, debit_account_id__in=receivable_accounts
        ).aggregate(total=Coalesce(Sum('amount'), Decimal('0')))

        recv_credit = AccountingEntry.objects.filter(
            tenant=tenant, credit_account_id__in=receivable_accounts
        ).aggregate(total=Coalesce(Sum('amount'), Decimal('0')))

        receivables_balance = recv_debit['total'] - recv_credit['total']

        # 3. Accounting: Account 60 (Payables - Поставщики) 
        payable_accounts = ChartOfAccounts.objects.filter(
            tenant=tenant, code__startswith='60'
        ).values_list('id', flat=True)

        pay_debit = AccountingEntry.objects.filter(
            tenant=tenant, debit_account_id__in=payable_accounts
        ).aggregate(total=Coalesce(Sum('amount'), Decimal('0')))

        pay_credit = AccountingEntry.objects.filter(
            tenant=tenant, credit_account_id__in=payable_accounts
        ).aggregate(total=Coalesce(Sum('amount'), Decimal('0')))

        payables_balance = pay_credit['total'] - pay_debit['total']

        counterparties = []
        for cp in per_counterparty:
            counterparties.append({
                'counterparty_id': cp['counterparty_id'],
                'counterparty_name': cp['counterparty__name'],
                'currency': cp['currency__code'],
                'register_amount': float(cp['total']),
            })

        return {
            'register_total': float(settlement_data['total_amount']),
            'receivables_balance': float(receivables_balance),
            'payables_balance': float(payables_balance),
            'accounting_net': float(receivables_balance - payables_balance),
            'is_reconciled': abs(settlement_data['total_amount'] - (receivables_balance - payables_balance)) < Decimal('0.01'),
            'counterparties': counterparties,
        }

    @staticmethod
    def check_movement_consistency(tenant):
        """
        Verify that StockBalance cache matches actual StockMovement sums.
        If they differ, means cache is stale and rebuild is needed.
        """
        # Per warehouse+item comparison
        discrepancies = []
        
        balances = StockBalance.objects.filter(tenant=tenant).select_related('item', 'warehouse')
        
        for bal in balances[:100]:
            in_total = StockMovement.objects.filter(
                tenant=tenant, warehouse=bal.warehouse, item=bal.item, type='IN'
            ).aggregate(q=Coalesce(Sum('quantity'), Decimal('0')))
            
            out_total = StockMovement.objects.filter(
                tenant=tenant, warehouse=bal.warehouse, item=bal.item, type='OUT'
            ).aggregate(q=Coalesce(Sum('quantity'), Decimal('0')))
            
            movement_qty = in_total['q'] - out_total['q']
            
            if abs(bal.quantity - movement_qty) > Decimal('0.001'):
                discrepancies.append({
                    'item_id': bal.item_id,
                    'item_name': bal.item.name,
                    'warehouse_id': bal.warehouse_id,
                    'warehouse_name': bal.warehouse.name,
                    'cache_qty': float(bal.quantity),
                    'movement_qty': float(movement_qty),
                    'difference': float(bal.quantity - movement_qty),
                })

        return {
            'total_checked': balances.count(),
            'discrepancies_count': len(discrepancies),
            'is_consistent': len(discrepancies) == 0,
            'discrepancies': discrepancies,
        }

    @staticmethod
    def full_reconciliation(tenant):
        """Run all reconciliation checks and return unified result."""
        stock = ReconciliationService.check_stock_vs_accounting(tenant)
        settlements = ReconciliationService.check_settlements_vs_accounting(tenant)
        consistency = ReconciliationService.check_movement_consistency(tenant)

        all_ok = stock['is_reconciled'] and settlements['is_reconciled'] and consistency['is_consistent']

        return {
            'overall_status': 'OK' if all_ok else 'DISCREPANCY',
            'stock_check': stock,
            'settlements_check': settlements,
            'consistency_check': consistency,
        }
