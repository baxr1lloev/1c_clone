"""
Operational Accounting API Views.

Real-time stock and settlement data for document forms.
Similar to 1C's operational accounting panels.
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.db.models import Sum, F, Value, DecimalField
from django.db.models.functions import Coalesce

from registers.models import StockBalance, StockReservation, SettlementsBalance
from directories.models import Counterparty, Contract, Item, Warehouse


class StockInfoView(APIView):
    """
    GET /api/operational/stock-info/
    
    Returns real-time stock availability for items at a warehouse.
    
    Query params:
        warehouse (int): Warehouse ID
        items (str): Comma-separated item IDs (e.g., "1,2,3")
    
    Response:
        {
            "items": [
                {
                    "item_id": 1,
                    "item_name": "Widget A",
                    "on_stock": 120.0,
                    "reserved": 80.0,
                    "available": 40.0
                },
                ...
            ]
        }
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        tenant = request.user.tenant
        warehouse_id = request.query_params.get('warehouse')
        item_ids_str = request.query_params.get('items', '')
        
        if not warehouse_id:
            return Response(
                {'error': 'warehouse parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            warehouse = Warehouse.objects.get(id=warehouse_id, tenant=tenant)
        except Warehouse.DoesNotExist:
            return Response(
                {'error': 'Warehouse not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Parse item IDs
        item_ids = []
        if item_ids_str:
            try:
                item_ids = [int(x.strip()) for x in item_ids_str.split(',') if x.strip()]
            except ValueError:
                return Response(
                    {'error': 'Invalid items format. Use comma-separated IDs.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Get items
        items_qs = Item.objects.filter(tenant=tenant)
        if item_ids:
            items_qs = items_qs.filter(id__in=item_ids)
        
        result_items = []
        
        for item in items_qs:
            # Get on-stock quantity
            try:
                balance = StockBalance.objects.get(
                    tenant=tenant,
                    warehouse=warehouse,
                    item=item
                )
                on_stock = float(balance.quantity)
            except StockBalance.DoesNotExist:
                on_stock = 0.0
            
            # Get reserved quantity
            reserved = StockReservation.objects.filter(
                tenant=tenant,
                warehouse=warehouse,
                item=item
            ).aggregate(
                total=Coalesce(Sum('quantity'), Value(0), output_field=DecimalField())
            )['total']
            reserved = float(reserved)
            
            # Calculate available
            available = on_stock - reserved
            
            result_items.append({
                'item_id': item.id,
                'item_name': item.name,
                'item_sku': item.sku,
                'on_stock': on_stock,
                'reserved': reserved,
                'available': available
            })
        
        return Response({'items': result_items})


class SettlementInfoView(APIView):
    """
    GET /api/operational/settlement-info/
    
    Returns real-time settlement (debt) data for a counterparty.
    
    Query params:
        counterparty (int): Counterparty ID
        contract (int, optional): Contract ID
        currency (int, optional): Currency ID
    
    Response:
        {
            "counterparty_id": 1,
            "counterparty_name": "ABC Corp",
            "debt_now": 5000.0,
            "credit_limit": 10000.0,
            "credit_remaining": 5000.0,
            "is_over_limit": false
        }
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        tenant = request.user.tenant
        counterparty_id = request.query_params.get('counterparty')
        contract_id = request.query_params.get('contract')
        currency_id = request.query_params.get('currency')
        
        if not counterparty_id:
            return Response(
                {'error': 'counterparty parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            counterparty = Counterparty.objects.get(id=counterparty_id, tenant=tenant)
        except Counterparty.DoesNotExist:
            return Response(
                {'error': 'Counterparty not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get credit limit from counterparty
        credit_limit = float(getattr(counterparty, 'credit_limit', 0) or 0)
        
        # Build filter for settlements
        settle_filter = {
            'tenant': tenant,
            'counterparty': counterparty
        }
        if contract_id:
            settle_filter['contract_id'] = contract_id
        if currency_id:
            settle_filter['currency_id'] = currency_id
        
        # Sum all settlement balances for this counterparty
        debt_now = SettlementsBalance.objects.filter(
            **settle_filter
        ).aggregate(
            total=Coalesce(Sum('amount'), Value(0), output_field=DecimalField())
        )['total']
        debt_now = float(debt_now)
        
        # Calculate credit remaining
        credit_remaining = credit_limit - debt_now if credit_limit > 0 else None
        is_over_limit = debt_now > credit_limit if credit_limit > 0 else False
        
        return Response({
            'counterparty_id': counterparty.id,
            'counterparty_name': counterparty.name,
            'debt_now': debt_now,
            'credit_limit': credit_limit,
            'credit_remaining': credit_remaining,
            'is_over_limit': is_over_limit
        })


class StockPredictionView(APIView):
    """
    POST /api/operational/stock-predict/
    
    Calculate what stock levels will be AFTER posting a document.
    
    Request body:
        {
            "warehouse": 1,
            "lines": [
                {"item": 1, "quantity": 10},
                {"item": 2, "quantity": 5}
            ],
            "operation": "OUT"  // "IN" for purchase, "OUT" for sales
        }
    
    Response:
        {
            "items": [
                {
                    "item_id": 1,
                    "on_stock": 120,
                    "available": 40,
                    "change": -10,
                    "after_posting": 30,
                    "is_negative": false
                }
            ]
        }
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        tenant = request.user.tenant
        warehouse_id = request.data.get('warehouse')
        lines = request.data.get('lines', [])
        operation = request.data.get('operation', 'OUT')
        
        if not warehouse_id:
            return Response(
                {'error': 'warehouse is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            warehouse = Warehouse.objects.get(id=warehouse_id, tenant=tenant)
        except Warehouse.DoesNotExist:
            return Response(
                {'error': 'Warehouse not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        result_items = []
        
        for line in lines:
            item_id = line.get('item')
            quantity = float(line.get('quantity', 0))
            
            if not item_id:
                continue
            
            try:
                item = Item.objects.get(id=item_id, tenant=tenant)
            except Item.DoesNotExist:
                continue
            
            # Get current stock
            try:
                balance = StockBalance.objects.get(
                    tenant=tenant,
                    warehouse=warehouse,
                    item=item
                )
                on_stock = float(balance.quantity)
            except StockBalance.DoesNotExist:
                on_stock = 0.0
            
            # Get reserved
            reserved = StockReservation.objects.filter(
                tenant=tenant,
                warehouse=warehouse,
                item=item
            ).aggregate(
                total=Coalesce(Sum('quantity'), Value(0), output_field=DecimalField())
            )['total']
            reserved = float(reserved)
            available = on_stock - reserved
            
            # Calculate change
            if operation == 'OUT':
                change = -quantity
            else:  # IN
                change = quantity
            
            after_posting = available + change
            
            result_items.append({
                'item_id': item.id,
                'item_name': item.name,
                'on_stock': on_stock,
                'reserved': reserved,
                'available': available,
                'change': change,
                'after_posting': after_posting,
                'is_negative': after_posting < 0
            })
        
        return Response({'items': result_items})


class SettlementPredictionView(APIView):
    """
    POST /api/operational/settlement-predict/
    
    Calculate what debt will be AFTER posting a document.
    
    Request body:
        {
            "counterparty": 1,
            "contract": 1,
            "currency": 1,
            "amount": 3000,
            "operation": "ACCRUAL"  // "ACCRUAL" (increase debt) or "PAYMENT" (decrease)
        }
    
    Response:
        {
            "debt_now": 5000,
            "change": 3000,
            "debt_after": 8000,
            "credit_limit": 10000,
            "is_over_limit": false
        }
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        tenant = request.user.tenant
        counterparty_id = request.data.get('counterparty')
        contract_id = request.data.get('contract')
        currency_id = request.data.get('currency')
        amount = float(request.data.get('amount', 0))
        operation = request.data.get('operation', 'ACCRUAL')
        
        if not counterparty_id:
            return Response(
                {'error': 'counterparty is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            counterparty = Counterparty.objects.get(id=counterparty_id, tenant=tenant)
        except Counterparty.DoesNotExist:
            return Response(
                {'error': 'Counterparty not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        credit_limit = float(getattr(counterparty, 'credit_limit', 0) or 0)
        
        # Get current debt
        settle_filter = {
            'tenant': tenant,
            'counterparty': counterparty
        }
        if contract_id:
            settle_filter['contract_id'] = contract_id
        if currency_id:
            settle_filter['currency_id'] = currency_id
        
        debt_now = SettlementsBalance.objects.filter(
            **settle_filter
        ).aggregate(
            total=Coalesce(Sum('amount'), Value(0), output_field=DecimalField())
        )['total']
        debt_now = float(debt_now)
        
        # Calculate change
        if operation == 'PAYMENT':
            change = -amount
        else:  # ACCRUAL
            change = amount
        
        debt_after = debt_now + change
        is_over_limit = debt_after > credit_limit if credit_limit > 0 else False
        
        return Response({
            'counterparty_id': counterparty.id,
            'counterparty_name': counterparty.name,
            'debt_now': debt_now,
            'change': change,
            'debt_after': debt_after,
            'credit_limit': credit_limit,
            'credit_remaining': credit_limit - debt_after if credit_limit > 0 else None,
            'is_over_limit': is_over_limit
        })
