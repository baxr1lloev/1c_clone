# documents/api/reposting_views.py
"""
API endpoints for reposting and register rebuilding.
"""

from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.utils.dateparse import parse_datetime
from datetime import datetime

from documents.reposting_service import RepostingService
from accounting.models import PeriodClosing


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def repost_period(request):
    """
    POST /documents/api/repost-period/
    
    Body:
    {
        "period_start": "2024-01-01",
        "period_end": "2024-01-31",
        "document_types": ["sales", "purchase"]  // optional
    }
    
    Permissions: Requires Accountant role or higher
    """
    # Check permissions
    if not request.user.role in ['owner', 'accountant']:
        return Response(
            {'error': 'Only owners and accountants can repost documents'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    # Parse dates
    period_start = request.data.get('period_start')
    period_end = request.data.get('period_end')
    document_types = request.data.get('document_types')
    
    if not period_start or not period_end:
        return Response(
            {'error': 'period_start and period_end are required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        period_start = parse_datetime(period_start) or datetime.fromisoformat(period_start)
        period_end = parse_datetime(period_end) or datetime.fromisoformat(period_end)
    except ValueError as e:
        return Response(
            {'error': f'Invalid date format: {e}'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Check period not closed
    if PeriodClosing.is_period_closed(period_start, request.tenant):
        return Response(
            {'error': 'Cannot repost closed period. Reopen period first.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Perform reposting
    try:
        result = RepostingService.repost_period(
            tenant=request.tenant,
            period_start=period_start,
            period_end=period_end,
            document_types=document_types,
            user=request.user
        )
        
        return Response(result)
    
    except Exception as e:
        return Response(
            {'error': f'Reposting failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def rebuild_fifo(request):
    """
    POST /documents/api/rebuild-fifo/
    
    Body:
    {
        "warehouse_id": 123,  // optional
        "item_id": 456,       // optional
        "cutoff_date": "2024-01-01"  // optional
    }
    """
    # Check permissions
    if not request.user.role in ['owner', 'accountant']:
        return Response(
            {'error': 'Only owners and accountants can rebuild FIFO'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    warehouse_id = request.data.get('warehouse_id')
    item_id = request.data.get('item_id')
    cutoff_date = request.data.get('cutoff_date')
    
    # Get objects
    warehouse = None
    item = None
    
    if warehouse_id:
        from directories.models import Warehouse
        try:
            warehouse = Warehouse.objects.get(id=warehouse_id, tenant=request.tenant)
        except Warehouse.DoesNotExist:
            return Response(
                {'error': 'Warehouse not found'},
                status=status.HTTP_404_NOT_FOUND
            )
    
    if item_id:
        from directories.models import Item
        try:
            item = Item.objects.get(id=item_id, tenant=request.tenant)
        except Item.DoesNotExist:
            return Response(
                {'error': 'Item not found'},
                status=status.HTTP_404_NOT_FOUND
            )
    
    if cutoff_date:
        try:
            cutoff_date = parse_datetime(cutoff_date) or datetime.fromisoformat(cutoff_date)
        except ValueError as e:
            return Response(
                {'error': f'Invalid date format: {e}'},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    # Rebuild
    try:
        result = RepostingService.rebuild_fifo_batches(
            tenant=request.tenant,
            warehouse=warehouse,
            item=item,
            cutoff_date=cutoff_date
        )
        
        return Response(result)
    
    except Exception as e:
        return Response(
            {'error': f'FIFO rebuild failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def verify_determinism(request):
    """
    POST /documents/api/verify-determinism/
    
    Test that reposting produces identical results.
    
    Body:
    {
        "period_start": "2024-01-01",
        "period_end": "2024-01-31",
        "iterations": 3  // optional, default 3
    }
    """
    # Check permissions
    if not request.user.role in ['owner', 'accountant']:
        return Response(
            {'error': 'Only owners and accountants can verify determinism'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    period_start = request.data.get('period_start')
    period_end = request.data.get('period_end')
    iterations = request.data.get('iterations', 3)
    
    try:
        period_start = parse_datetime(period_start) or datetime.fromisoformat(period_start)
        period_end = parse_datetime(period_end) or datetime.fromisoformat(period_end)
    except ValueError as e:
        return Response(
            {'error': f'Invalid date format: {e}'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        result = RepostingService.verify_determinism(
            tenant=request.tenant,
            period_start=period_start,
            period_end=period_end,
            iterations=iterations
        )
        
        return Response(result)
    
    except Exception as e:
        return Response(
            {'error': f'Verification failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
