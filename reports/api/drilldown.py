"""
Generic drill-down API for reports.
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from documents.models import SalesDocument, PurchaseDocument
from registers.models import StockMovement, SettlementMovement
from accounting.models import AccountingEntry


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
            entries = AccountingEntry.objects.filter(tenant=tenant)
            
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
            
            # Prefetch document content type and object
            entries = entries.select_related('content_type').prefetch_related('document').order_by('-period', '-id')[:100]
            
            data = []
            for e in entries:
                doc = e.document
                doc_number = getattr(doc, 'number', '-') if doc else '-'
                doc_type = e.content_type.model if e.content_type else 'unknown'
                
                # Format description with accounts
                desc = f"{e.debit_account.code} -> {e.credit_account.code}: {e.description or ''}"
                
                data.append({
                    'id': e.object_id if e.object_id else 0, # Document ID
                    'type': doc_type,
                    'number': doc_number,
                    'date': e.date.isoformat() if e.date else None,
                    'amount': float(e.amount),
                    'counterparty_name': '-', # Could try to extract from doc
                    'description': desc
                })
            
            return Response({
                'documents': data,
                'total_amount': sum(d['amount'] for d in data)
            })

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
                'amount': float(d.total) if hasattr(d, 'total') else None,
                'status': d.status
            } for d in docs]
            
            return Response({
                'documents': data,
                'total_amount': sum((d['amount'] or 0) for d in data)
            })

        elif report_type == 'stock':
            # Drill down to stock movements
            movements = StockMovement.objects.filter(tenant=tenant)
            
            if item:
                movements = movements.filter(item_id=item)
            if warehouse:
                movements = movements.filter(warehouse_id=warehouse)
            if movement_type:
                movements = movements.filter(type=movement_type)
            
            # Prefetch content objects (documents) to avoid N+1 queries
            movements = movements.select_related(
                'item', 
                'warehouse', 
                'content_type'
            ).prefetch_related('content_object').order_by('-date')[:100]
            
            data = []
            for m in movements:
                doc = m.content_object
                doc_number = getattr(doc, 'number', '-')
                doc_type = m.content_type.model
                
                # Format description
                description = f"{m.get_type_display()} {m.quantity} {m.item.name}"
                
                data.append({
                    'id': m.object_id,  # Use document ID for navigation
                    'type': doc_type,   # e.g., 'purchasedocument'
                    'number': doc_number,
                    'date': m.date.isoformat() if m.date else None,
                    'amount': float(m.quantity), # Map quantity to amount for the modal
                    'counterparty_name': getattr(doc.counterparty, 'name', '-') if hasattr(doc, 'counterparty') else '-',
                    'description': description
                })
            
            return Response({
                'documents': data,
                'total_amount': sum(d['amount'] for d in data)
            })

        else:
            return Response({'error': 'Unknown report type'}, status=400)
