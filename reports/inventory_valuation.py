"""
Inventory Valuation Report View

Calculates total inventory value using FIFO batch costs
"""

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Sum, F, DecimalField, Count, Avg
from decimal import Decimal

from registers.models import StockBatch


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def inventory_valuation_report(request):
    """
    Get inventory valuation using FIFO batch costs
    
    Query params:
    - warehouse: Filter by warehouse ID
    - item: Filter by item ID
    """
    tenant = request.user.tenant
    
    # Base queryset - only batches with remaining quantity
    batches = StockBatch.objects.filter(
        tenant=tenant,
        qty_remaining__gt=0
    )
    
    # Apply filters
    warehouse_id = request.GET.get('warehouse')
    if warehouse_id:
        batches = batches.filter(warehouse_id=warehouse_id)
    
    item_id = request.GET.get('item')
    if item_id:
        batches = batches.filter(item_id=item_id)
    
    # Group by item and warehouse
    items = batches.values(
        'item_id',
        'item__name',
        'item__sku',
        'warehouse__name'
    ).annotate(
        total_quantity=Sum('qty_remaining'),
        total_value=Sum(F('qty_remaining') * F('unit_cost'), output_field=DecimalField()),
        average_cost=Avg('unit_cost'),
        batches_count=Count('id')
    ).order_by('item__name', 'warehouse__name')
    
    # Calculate summary
    summary = batches.aggregate(
        total_items=Count('item_id', distinct=True),
        total_quantity=Sum('qty_remaining'),
        total_value=Sum(F('qty_remaining') * F('unit_cost'), output_field=DecimalField()),
        average_cost=Avg('unit_cost')
    )
    
    # Format response
    items_list = []
    for item in items:
        items_list.append({
            'item_id': item['item_id'],
            'item_name': item['item__name'],
            'item_sku': item['item__sku'] or '',
            'warehouse_name': item['warehouse__name'],
            'total_quantity': float(item['total_quantity'] or 0),
            'average_cost': float(item['average_cost'] or 0),
            'total_value': float(item['total_value'] or 0),
            'batches_count': item['batches_count']
        })
    
    return Response({
        'items': items_list,
        'summary': {
            'total_items': summary['total_items'] or 0,
            'total_quantity': float(summary['total_quantity'] or 0),
            'total_value': float(summary['total_value'] or 0),
            'average_cost': float(summary['average_cost'] or 0)
        }
    })
