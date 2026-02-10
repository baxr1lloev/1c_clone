"""
Generic drill-down API for reports.
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from documents.models import SalesDocument, PurchaseDocument
from registers.models import StockMovement, SettlementMovement, JournalEntry


class ReportDrillDownView(APIView):
    """
    Generic drill-down endpoint for reports.
    Returns source documents/movements based on report type and filters.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, report_type):
        tenant = request.user.tenant
        
        # Get filter parameters
        account = request.query_params.get('account')
        counterparty = request.query_params.get('counterparty')
        item = request.query_params.get('item')
        warehouse = request.query_params.get('warehouse')
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        period = request.query_params.get('period')
        side = request.query_params.get('side')  # 'debit' or 'credit'
        movement_type = request.query_params.get('type')  # 'IN' or 'OUT'

        if report_type == 'trial-balance':
            # Drill down to journal entries for an account
            entries = JournalEntry.objects.filter(tenant=tenant)
            
            if account:
                if side == 'debit':
                    entries = entries.filter(debit_account=account)
                elif side == 'credit':
                    entries = entries.filter(credit_account=account)
                else:
                    entries = entries.filter(
                        Q(debit_account=account) | Q(credit_account=account)
                    )
            
            if period:
                entries = entries.filter(period=period)
            
            entries = entries.select_related('document_content_type').order_by('-period', '-id')[:100]
            
            data = [{
                'id': e.id,
                'period': e.period,
                'debit_account': e.debit_account,
                'credit_account': e.credit_account,
                'amount': float(e.amount),
                'description': e.description,
                'document_type': e.document_content_type.model if e.document_content_type else None,
                'document_id': e.document_object_id
            } for e in entries]
            
            return Response({'entries': data})

        elif report_type == 'sales':
            # Drill down to sales documents
            docs = SalesDocument.objects.filter(tenant=tenant)
            
            if counterparty:
                docs = docs.filter(counterparty_id=counterparty)
            if start_date:
                docs = docs.filter(date__gte=start_date)
            if end_date:
                docs = docs.filter(date__lte=end_date)
            
            docs = docs.order_by('-date')[:100]
            
            data = [{
                'id': d.id,
                'number': d.number,
                'date': d.date.isoformat() if d.date else None,
                'counterparty_id': d.counterparty_id,
                'counterparty_name': d.counterparty.name if d.counterparty else None,
                'total': float(d.total) if hasattr(d, 'total') else None,
                'status': d.status
            } for d in docs]
            
            return Response({'documents': data})

        elif report_type == 'stock':
            # Drill down to stock movements
            movements = StockMovement.objects.filter(tenant=tenant)
            
            if item:
                movements = movements.filter(item_id=item)
            if warehouse:
                movements = movements.filter(warehouse_id=warehouse)
            if movement_type:
                movements = movements.filter(type=movement_type)
            
            movements = movements.select_related('item', 'warehouse').order_by('-date')[:100]
            
            data = [{
                'id': m.id,
                'date': m.date.isoformat() if m.date else None,
                'item_id': m.item_id,
                'item_name': m.item.name,
                'warehouse_id': m.warehouse_id,
                'warehouse_name': m.warehouse.name,
                'quantity': float(m.quantity),
                'type': m.type
            } for m in movements]
            
            return Response({'movements': data})

        else:
            return Response({'error': 'Unknown report type'}, status=400)
