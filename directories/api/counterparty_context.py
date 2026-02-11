from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db.models import Sum
from decimal import Decimal
from datetime import datetime, timedelta

from directories.models import Counterparty
from documents.models import SalesDocument
from registers.models import SettlementMovement


@api_view(['GET'])
def get_counterparty_context(request, counterparty_id):
    """
    Get customer/supplier context for display in document forms
    
    Returns:
    - Total debt/credit
    - Credit limit and usage
    - Overdue information
    - Recent documents
    """
    counterparty = get_object_or_404(Counterparty, id=counterparty_id)
    
    # Calculate debt from settlement movements
    movements = SettlementMovement.objects.filter(
        tenant=counterparty.tenant,
        counterparty=counterparty
    )
    
    debt = movements.aggregate(
        total=Sum('amount')
    )['total'] or Decimal('0')
    
    # Get credit limit
    credit_limit = counterparty.credit_limit if hasattr(counterparty, 'credit_limit') else Decimal('0')
    used_credit = max(debt, Decimal('0'))
    
    # Calculate overdue
    overdue_movements = movements.filter(
        date__lt=datetime.now() - timedelta(days=30),
        amount__gt=0
    )
    overdue_amount = overdue_movements.aggregate(
        total=Sum('amount')
    )['total'] or Decimal('0')
    
    overdue_days = 0
    if overdue_amount > 0:
        oldest_overdue = overdue_movements.order_by('date').first()
        if oldest_overdue:
            overdue_days = (datetime.now().date() - oldest_overdue.date).days
    
    # Recent documents
    recent_docs = SalesDocument.objects.filter(
        tenant=counterparty.tenant,
        counterparty=counterparty,
        status__in=['posted', 'draft']
    ).order_by('-date')[:10]
    
    recent_docs_data = [{
        'id': doc.id,
        'type': 'salesdocument',
        'number': doc.number,
        'date': doc.date.isoformat() if doc.date else None,
        'amount': float(doc.total_amount) if hasattr(doc, 'total_amount') else 0,
        'status': doc.status
    } for doc in recent_docs]
    
    return Response({
        'debt': float(debt),
        'credit_limit': float(credit_limit),
        'used_credit': float(used_credit),
        'available_credit': float(credit_limit - used_credit),
        'overdue_amount': float(overdue_amount),
        'overdue_days': overdue_days,
        'recent_docs': recent_docs_data
    })
