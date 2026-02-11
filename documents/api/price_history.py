# documents/api/price_history.py
"""
API endpoints for price history and drill-down.

GET /api/documents/items/{item_id}/price-history/
GET /api/documents/sales-lines/{line_id}/price-source/
"""

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404

from directories.models import Item
from documents.price_tracking.price_source_tracker import PriceSourceTracker


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def item_price_history(request, item_id):
    """
    Get price history for an item.
    
    Response:
        [
            {
                "date": "2024-01-15",
                "price": "150.00",
                "document_type": "sale",
                "document_number": "S-00123",
                "document_id": 123,
                "counterparty_name": "Customer #1"
            },
            ...
        ]
    """
    item = get_object_or_404(Item, id=item_id, tenant=request.user.tenant)
    
    limit = int(request.GET.get('limit', 20))
    history = PriceSourceTracker.get_price_history(item, limit=limit)
    
    # Format dates as strings
    for entry in history:
        entry['date'] = entry['date'].isoformat()
        entry['price'] = str(entry['price'])
    
    return Response(history)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def line_price_source(request, line_id):
    """
    Get price source details for a specific line.
    
    Note: This is a placeholder until we properly understand the line model structure.
    For now, just return price history for the item.
    
    Response:
        {
            "source_type": "manual",
            "price_history": [...]
        }
    """
    # TODO: Implement after understanding actual line model structure
    # For now, return a basic response
    return Response({
        'source_type': 'manual',
        'price_history': [],
        'message': 'Price source tracking requires database migration - coming soon'
    })
