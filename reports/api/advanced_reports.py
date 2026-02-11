"""
API views for advanced reports:
- Reconciliation check
- Balance as of date (stock + settlements)
- Settlement history (counterparty drill-down)
- Stock item history (item drill-down)
"""

from datetime import date, datetime
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from reports.reconciliation_service import ReconciliationService
from reports.balance_as_of_date import BalanceAsOfDateService


class ReconciliationView(APIView):
    """
    GET /api/v1/reports/reconciliation/
    
    Full reconciliation check: register vs accounting balances.
    Level 6: «Остатки сходятся везде»
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        tenant = request.user.tenant
        check_type = request.query_params.get('type', 'full')

        if check_type == 'stock':
            return Response(ReconciliationService.check_stock_vs_accounting(tenant))
        elif check_type == 'settlements':
            return Response(ReconciliationService.check_settlements_vs_accounting(tenant))
        elif check_type == 'consistency':
            return Response(ReconciliationService.check_movement_consistency(tenant))
        else:
            return Response(ReconciliationService.full_reconciliation(tenant))


class StockBalanceAsOfDateView(APIView):
    """
    GET /api/v1/reports/stock-as-of-date/?date=2026-01-31&warehouse=1&item=5
    
    Level 7: «Я могу восстановить историю»
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        tenant = request.user.tenant
        as_of = request.query_params.get('date')
        warehouse_id = request.query_params.get('warehouse')
        item_id = request.query_params.get('item')

        if not as_of:
            as_of = date.today()
        else:
            as_of = datetime.strptime(as_of, '%Y-%m-%d').date()

        result = BalanceAsOfDateService.stock_balance_as_of(
            tenant, as_of,
            warehouse_id=warehouse_id,
            item_id=item_id
        )

        return Response({
            'as_of_date': as_of.isoformat(),
            'items': result,
            'total_items': len(result),
        })


class SettlementBalanceAsOfDateView(APIView):
    """
    GET /api/v1/reports/settlements-as-of-date/?date=2026-01-31&counterparty=3
    
    Level 7: Historical settlement balance.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        tenant = request.user.tenant
        as_of = request.query_params.get('date')
        counterparty_id = request.query_params.get('counterparty')

        if not as_of:
            as_of = date.today()
        else:
            as_of = datetime.strptime(as_of, '%Y-%m-%d').date()

        result = BalanceAsOfDateService.settlement_balance_as_of(
            tenant, as_of,
            counterparty_id=counterparty_id
        )

        total_receivable = sum(r['amount'] for r in result if r['amount'] > 0)
        total_payable = sum(abs(r['amount']) for r in result if r['amount'] < 0)

        return Response({
            'as_of_date': as_of.isoformat(),
            'counterparties': result,
            'total_receivable': total_receivable,
            'total_payable': total_payable,
            'net': total_receivable - total_payable,
        })


class StockItemHistoryView(APIView):
    """
    GET /api/v1/reports/stock-history/?item=5&warehouse=1&start=2026-01-01&end=2026-01-31
    
    Level 7: Full movement chain for any item with running balance.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        tenant = request.user.tenant
        item_id = request.query_params.get('item')
        warehouse_id = request.query_params.get('warehouse')
        start_date = request.query_params.get('start')
        end_date = request.query_params.get('end')

        if not item_id:
            return Response({'error': 'item parameter is required'}, status=400)

        result = BalanceAsOfDateService.stock_item_history(
            tenant, item_id,
            warehouse_id=warehouse_id,
            start_date=start_date,
            end_date=end_date
        )

        return Response({
            'movements': result,
            'total_movements': len(result),
        })


class SettlementCounterpartyHistoryView(APIView):
    """
    GET /api/v1/reports/settlement-history/?counterparty=3&start=2026-01-01&end=2026-01-31
    
    Level 7: Full settlement movement chain for a counterparty.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        tenant = request.user.tenant
        counterparty_id = request.query_params.get('counterparty')
        start_date = request.query_params.get('start')
        end_date = request.query_params.get('end')

        if not counterparty_id:
            return Response({'error': 'counterparty parameter is required'}, status=400)

        result = BalanceAsOfDateService.settlement_counterparty_history(
            tenant, counterparty_id,
            start_date=start_date,
            end_date=end_date
        )

        return Response({
            'movements': result,
            'total_movements': len(result),
        })
