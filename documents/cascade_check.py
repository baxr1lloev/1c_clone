"""
Backend method to check cascade dependencies before unpost/delete.

Returns information about child documents and blocking conditions.
"""

from django.contrib.contenttypes.models import ContentType

def check_cascade_dependencies(self):
    """
    Check if document can be safely unposted/deleted.
    
    ENTERPRISE: Prevents breaking document chains.
    Shows user BEFORE they try to unpost/delete.
    
    Returns:
        {
            'can_unpost': bool,
            'can_delete': bool,
            'warnings': [str],
            'blockers': [str],  # Hard blocks
            'children': [{type, documents: [{number, status}]}]
        }
    """
    children = self.get_child_documents()
    
    warnings = []
    blockers = []
    children_list = []
    
    # Check for posted children
    for child_type_name, child_docs in children.items():
        if not child_docs:
            continue
            
        posted_children = [d for d in child_docs if hasattr(d, 'status') and d.status == 'posted']
        draft_children = [d for d in child_docs if hasattr(d, 'status') and d.status == 'draft']
        
        if posted_children:
            blockers.append(
                f"Has {len(posted_children)} posted {child_type_name}: "
                f"{', '.join([d.number for d in posted_children[:3]])}"
                + (f" and {len(posted_children) - 3} more" if len(posted_children) > 3 else "")
            )
        elif draft_children:
            warnings.append(f"Has {len(draft_children)} draft {child_type_name}")
        
        # Add to children list for display
        children_list.append({
            'type': child_type_name,
            'documents': [
                {'number': d.number, 'status': d.status if hasattr(d, 'status') else 'unknown'}
                for d in child_docs[:10]  # Limit to first 10
            ]
        })
    
    # Check for payments (special case)
    from documents.models import PaymentDocument
    content_type = ContentType.objects.get_for_model(self)
    payments = PaymentDocument.objects.filter(
        base_document_type=content_type,
        base_document_id=self.id
    )
    
    if payments.exists():
        posted_payments = payments.filter(status='posted')
        if posted_payments.exists():
            blockers.append(f"Has {posted_payments.count()} posted payments")
        else:
            warnings.append(f"Has {payments.count()} draft payments")
        
        children_list.append({
            'type': 'Payments',
            'documents': [
                {'number': p.number, 'status': p.status}
                for p in payments[:10]
            ]
        })
    
    return {
        'can_unpost': len(blockers) == 0,
        'can_delete': len(blockers) == 0 and len(warnings) == 0,
        'warnings': warnings,
        'blockers': blockers,
        'children': children_list
    }

# Add this method to BaseDocument class
BaseDocument.check_cascade_dependencies = check_cascade_dependencies
