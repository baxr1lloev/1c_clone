# documents/services/price_source_tracker.py
"""
Price Source Tracking Service

Tracks where prices come from in document lines, following 1C philosophy:
every price must be traceable to its source.

NOTE: This is a simplified implementation. Full price source tracking requires:
1. Database migration to add price_source_* fields to line models
2. Integration with document save logic
"""

from decimal import Decimal
from typing import List, Dict, Any
import logging

logger = logging.getLogger(__name__)


class PriceSourceTracker:
    """
    Service to track and retrieve price sources.
    
    Usage:
        tracker = PriceSourceTracker()
        history = tracker.get_price_history(item)
    """
    
    @staticmethod
    def get_price_history(item, limit=10) -> List[Dict[str, Any]]:
        """
        Get price history for an item across all documents.
        
        Returns list of price entries with document details.
        
        NOTE: Simplified implementation - returns document-level prices.
        Full implementation would query actual line items.
        """
        from documents.models import SalesDocument, PurchaseDocument
        
        history = []
        
        # Get  sales documents (simplified - using total_amount as proxy for price)
        sales = SalesDocument.objects.filter(
            tenant=item.tenant,
            status='posted'
        ).select_related('counterparty').order_by('-date')[:limit]
        
        for doc in sales:
            if doc.total_amount > 0:
                history.append({
                    'date': doc.date,
                    'price': doc.total_amount,  # Placeholder until we have line-level data
                    'document_type': 'sale',
                    'document_number': doc.number,
                    'document_id': doc.id,
                    'counterparty_name': doc.counterparty.name
                })
        
        # Get purchase documents
        purchases = PurchaseDocument.objects.filter(
            tenant=item.tenant,
            status='posted'
        ).select_related('counterparty').order_by('-date')[:limit]
        
        for doc in purchases:
            if doc.total_amount > 0:
                history.append({
                    'date': doc.date,
                    'price': doc.total_amount,  # Placeholder
                    'document_type': 'purchase',
                    'document_number': doc.number,
                    'document_id': doc.id,
                    'counterparty_name': doc.counterparty.name
                })
        
        # Sort by date descending
        history.sort(key=lambda x: x['date'], reverse=True)
        
        return history[:limit]
