"""
API endpoint for period status checking.

Returns whether a period is closed and related metadata for enterprise reliability.
"""

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from accounting.models import PeriodClosing
from datetime import datetime

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def period_status(request):
    """
    Check if period is closed for a given date.
    
    Query params:
        date: ISO date string (YYYY-MM-DD)
    
    Returns:
        {
            "is_closed": bool,
            "period": str | null,  # "October 2024"
            "closed_by": str | null,
            "closed_at": str | null,
            "can_reopen": bool,
            "operational_closed": bool,
            "accounting_closed": bool
        }
    """
    date_str = request.query_params.get('date')
    
    if not date_str:
        return Response(
            {'error': 'date parameter is required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        doc_date = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        period_date = doc_date.replace(day=1).date()
    except (ValueError, AttributeError):
        return Response(
            {'error': 'Invalid date format. Use YYYY-MM-DD'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Get period closing record
    try:
        closing = PeriodClosing.objects.get(
            tenant=request.user.tenant,
            period=period_date
        )
        
        # Check if user can reopen (Chief Accountant or SuperAdmin)
        can_reopen = (
            request.user.is_superuser or
            request.user.groups.filter(name__in=['Chief Accountant', 'SuperAdmin']).exists()
        )
        
        return Response({
            'is_closed': closing.accounting_closed or closing.operational_closed,
            'period': closing.period.strftime('%B %Y'),
            'closed_by': closing.closed_by.get_full_name() if closing.closed_by else None,
            'closed_at': closing.closed_at.isoformat() if closing.closed_at else None,
            'can_reopen': can_reopen,
            'operational_closed': closing.operational_closed,
            'accounting_closed': closing.accounting_closed
        })
        
    except PeriodClosing.DoesNotExist:
        # Period not closed if no record exists
        return Response({
            'is_closed': False,
            'period': None,
            'closed_by': None,
            'closed_at': None,
            'can_reopen': False,
            'operational_closed': False,
            'accounting_closed': False
        })
