"""
Balance-as-of-Date Service — Level 7: «Я могу восстановить историю»

Calculates stock and settlement balances as of any historical date.
This proves the system can reconstruct past state.
"""

from datetime import date, datetime
from decimal import Decimal
from django.db.models import Sum, Q, Case, When, F, Value, DecimalField
from django.db.models.functions import Coalesce

from registers.models import StockMovement, SettlementMovement
from directories.models import Item, Warehouse, Counterparty


class BalanceAsOfDateService:
    """
    Calculate balances as of any historical date from movements.
    
    Unlike cached balances (StockBalance), these are calculated from
    movement history and are guaranteed accurate for any date.
    """

    @staticmethod
    def stock_balance_as_of(tenant, as_of_date, warehouse_id=None, item_id=None):
        """
        Calculate stock balance as of a specific date.
        
        Sum all movements up to and including as_of_date.
        
        Returns list of {item, warehouse, quantity} records.
        """
        movements = StockMovement.objects.filter(
            tenant=tenant,
            date__lte=as_of_date
        )

        if warehouse_id:
            movements = movements.filter(warehouse_id=warehouse_id)
        if item_id:
            movements = movements.filter(item_id=item_id)

        # Aggregate: IN adds, OUT subtracts
        balances = movements.values(
            'item_id', 'item__name', 'item__sku',
            'warehouse_id', 'warehouse__name'
        ).annotate(
            qty_in=Coalesce(
                Sum(Case(
                    When(type='IN', then='quantity'),
                    default=Value(0),
                    output_field=DecimalField()
                )), Decimal('0')
            ),
            qty_out=Coalesce(
                Sum(Case(
                    When(type='OUT', then='quantity'),
                    default=Value(0),
                    output_field=DecimalField()
                )), Decimal('0')
            ),
            amount_in=Coalesce(
                Sum(Case(
                    When(type='IN', then='amount'),
                    default=Value(0),
                    output_field=DecimalField()
                )), Decimal('0')
            ),
            amount_out=Coalesce(
                Sum(Case(
                    When(type='OUT', then='amount'),
                    default=Value(0),
                    output_field=DecimalField()
                )), Decimal('0')
            ),
        ).order_by('item__name')

        result = []
        for b in balances:
            qty = b['qty_in'] - b['qty_out']
            amount = b['amount_in'] - b['amount_out']
            if abs(qty) > Decimal('0.001'):  # Skip zero balances
                result.append({
                    'item_id': b['item_id'],
                    'item_name': b['item__name'],
                    'item_sku': b['item__sku'],
                    'warehouse_id': b['warehouse_id'],
                    'warehouse_name': b['warehouse__name'],
                    'quantity': float(qty),
                    'amount': float(amount),
                    'as_of_date': as_of_date.isoformat() if hasattr(as_of_date, 'isoformat') else str(as_of_date),
                })

        return result

    @staticmethod
    def settlement_balance_as_of(tenant, as_of_date, counterparty_id=None):
        """
        Calculate settlement (debt) balance as of a specific date.
        
        Returns list of {counterparty, currency, amount} records.
        """
        movements = SettlementMovement.objects.filter(
            tenant=tenant,
            date__lte=as_of_date
        )

        if counterparty_id:
            movements = movements.filter(counterparty_id=counterparty_id)

        balances = movements.values(
            'counterparty_id', 'counterparty__name',
            'contract_id', 'contract__name',
            'currency_id', 'currency__code'
        ).annotate(
            total_amount=Coalesce(Sum('amount'), Decimal('0'))
        ).order_by('counterparty__name')

        result = []
        for b in balances:
            if abs(b['total_amount']) > Decimal('0.01'):
                result.append({
                    'counterparty_id': b['counterparty_id'],
                    'counterparty_name': b['counterparty__name'],
                    'contract_id': b['contract_id'],
                    'contract_name': b['contract__name'] or '-',
                    'currency_id': b['currency_id'],
                    'currency': b['currency__code'],
                    'amount': float(b['total_amount']),
                    'debt_type': 'receivable' if b['total_amount'] > 0 else 'payable',
                    'as_of_date': as_of_date.isoformat() if hasattr(as_of_date, 'isoformat') else str(as_of_date),
                })

        return result

    @staticmethod
    def stock_item_history(tenant, item_id, warehouse_id=None, start_date=None, end_date=None):
        """
        Get movement history for a specific item with running balance.
        
        This is the full drill-down: report → movements → document.
        """
        movements = StockMovement.objects.filter(
            tenant=tenant,
            item_id=item_id
        ).select_related(
            'item', 'warehouse', 'content_type'
        ).order_by('date', 'created_at')

        if warehouse_id:
            movements = movements.filter(warehouse_id=warehouse_id)
        if start_date:
            movements = movements.filter(date__gte=start_date)
        if end_date:
            movements = movements.filter(date__lte=end_date)

        result = []
        running_qty = Decimal('0')

        for m in movements[:200]:
            if m.type == 'IN':
                running_qty += m.quantity
            else:
                running_qty -= m.quantity

            doc = m.content_object
            doc_number = getattr(doc, 'number', '-') if doc else '-'
            doc_type = m.content_type.model if m.content_type else 'unknown'

            # Map doc_type to frontend URL
            url_map = {
                'salesdocument': f'/documents/sales/{m.object_id}',
                'purchasedocument': f'/documents/purchases/{m.object_id}',
                'transferdocument': f'/documents/transfers/{m.object_id}',
                'inventorydocument': f'/documents/inventory/{m.object_id}',
            }

            result.append({
                'id': m.id,
                'date': m.date.isoformat() if m.date else None,
                'type': m.type,
                'quantity': float(m.quantity) if m.type == 'IN' else float(-m.quantity),
                'amount': float(m.amount) if m.amount else 0,
                'running_balance': float(running_qty),
                'warehouse_name': m.warehouse.name,
                'document_type': doc_type,
                'document_number': doc_number,
                'document_id': m.object_id,
                'document_url': url_map.get(doc_type, ''),
            })

        return result

    @staticmethod
    def settlement_counterparty_history(tenant, counterparty_id, start_date=None, end_date=None):
        """
        Get settlement movement history for a specific counterparty with running balance.
        """
        movements = SettlementMovement.objects.filter(
            tenant=tenant,
            counterparty_id=counterparty_id
        ).select_related(
            'counterparty', 'contract', 'currency', 'content_type'
        ).order_by('date', 'created_at')

        if start_date:
            movements = movements.filter(date__gte=start_date)
        if end_date:
            movements = movements.filter(date__lte=end_date)

        result = []
        running_balance = Decimal('0')

        for m in movements[:200]:
            running_balance += m.amount

            doc = m.document
            doc_number = getattr(doc, 'number', '-') if doc else '-'
            doc_type = m.content_type.model if m.content_type else 'unknown'

            url_map = {
                'salesdocument': f'/documents/sales/{m.object_id}',
                'purchasedocument': f'/documents/purchases/{m.object_id}',
                'paymentdocument': f'/documents/payments/{m.object_id}',
            }

            result.append({
                'id': m.id,
                'date': m.date.isoformat() if m.date else None,
                'amount': float(m.amount),
                'running_balance': float(running_balance),
                'contract_name': m.contract.name if m.contract else '-',
                'currency': m.currency.code if m.currency else '-',
                'document_type': doc_type,
                'document_number': doc_number,
                'document_id': m.object_id,
                'document_url': url_map.get(doc_type, ''),
                'description': m.description if hasattr(m, 'description') else '',
            })

        return result
