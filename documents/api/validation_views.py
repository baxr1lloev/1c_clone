from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.shortcuts import get_object_or_404

from documents.models import SalesDocument, PurchaseDocument
from documents.validation import DocumentValidator


@api_view(['POST'])
def validate_sales_document(request):
    """Real-time validation endpoint for sales documents"""
    document_id = request.data.get('document_id')
    
    if document_id:
        document = get_object_or_404(SalesDocument, id=document_id)
        lines = document.lines.all()
    else:
        # Validation for unsaved document
        # Create temporary document object
        from django.contrib.contenttypes.models import ContentType
        document = SalesDocument()
        # Set fields from request data
        for field in ['counterparty_id', 'warehouse_id', 'date']:
            if field in request.data:
                setattr(document, field, request.data[field])
        
        lines = request.data.get('lines', [])
    
    validation = DocumentValidator.validate_sales_document(document, lines)
    
    return Response(validation.to_dict())


@api_view(['POST'])
def validate_purchase_document(request):
    """Real-time validation endpoint for purchase documents"""
    document_id = request.data.get('document_id')
    
    if document_id:
        document = get_object_or_404(PurchaseDocument, id=document_id)
        lines = document.lines.all()
    else:
        document = PurchaseDocument()
        for field in ['counterparty_id', 'warehouse_id', 'date']:
            if field in request.data:
                setattr(document, field, request.data[field])
        
        lines = request.data.get('lines', [])
    
    validation = DocumentValidator.validate_purchase_document(document, lines)
    
    return Response(validation.to_dict())
