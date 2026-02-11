"""
Django REST API views for document operations.

ENTERPRISE: Cascade dependency check endpoint.
"""

from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from documents.models import SalesDocument, PurchaseDocument, TransferDocument


@api_view(['GET'])
def check_dependencies(request, document_type, document_id):
    """
    ENTERPRISE: Check cascade dependencies before unpost/delete.
    
    GET /documents/{type}/{id}/dependencies/
    
    Returns:
        {
            'can_unpost': bool,
            'can_delete': bool,
            'warnings': [str],
            'blockers': [str],
            'children': [{type, documents: [{number, status}]}]
        }
    """
    # Map document type to model
    doc_models = {
        'sales': SalesDocument,
        'purchase': PurchaseDocument,
        'transfer': TransferDocument,
    }
    
    model = doc_models.get(document_type)
    if not model:
        return Response(
            {'error': f'Invalid document type: {document_type}'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Get document
    doc = get_object_or_404(
        model,
        pk=document_id,
        tenant=request.user.tenant
    )
    
    # Check dependencies
    try:
        dependencies = doc.check_cascade_dependencies()
        return Response(dependencies)
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
