from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.db import transaction

from documents.models import SalesDocument, PurchaseDocument
from documents.services import DocumentPostingService


@api_view(['POST'])
def bulk_post_documents(request):
    """
    Bulk post multiple documents at once (1C-style mass operations)
    
    Request body:
    {
        "document_type": "sales",  # or "purchase"
        "document_ids": [1, 2, 3, 4, 5]
    }
    
    Returns:
    {
        "success": [1, 2, 3],
        "failed": [
            {"id": 4, "error": "Insufficient stock"},
            {"id": 5, "error": "Period closed"}
        ]
    }
    """
    document_type = request.data.get('document_type')
    document_ids = request.data.get('document_ids', [])
    
    if not document_type or not document_ids:
        return Response(
            {'error': 'document_type and document_ids are required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Get model class
    if document_type == 'sales':
        Model = SalesDocument
        post_func = DocumentPostingService.post_sales_document
    elif document_type == 'purchase':
        Model = PurchaseDocument
        post_func = DocumentPostingService.post_purchase_document
    else:
        return Response(
            {'error': f'Unsupported document type: {document_type}'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    results = {'success': [], 'failed': []}
    
    for doc_id in document_ids:
        try:
            with transaction.atomic():
                doc = Model.objects.get(id=doc_id, tenant=request.user.tenant)
                
                if doc.status != 'draft':
                    results['failed'].append({
                        'id': doc_id,
                        'error': f'Document {doc.number} is not in draft status'
                    })
                    continue
                
                post_func(doc)
                doc.posted_by = request.user
                doc.save()
                results['success'].append(doc_id)
                
        except Model.DoesNotExist:
            results['failed'].append({
                'id': doc_id,
                'error': 'Document not found'
            })
        except Exception as e:
            results['failed'].append({
                'id': doc_id,
                'error': str(e)
            })
    
    return Response(results)


@api_view(['POST'])
def bulk_unpost_documents(request):
    """Bulk unpost multiple documents"""
    document_type = request.data.get('document_type')
    document_ids = request.data.get('document_ids', [])
    
    if document_type == 'sales':
        Model = SalesDocument
        unpost_func = DocumentPostingService.unpost_sales_document
    elif document_type == 'purchase':
        Model = PurchaseDocument
        unpost_func = DocumentPostingService.unpost_purchase_document
    else:
        return Response(
            {'error': f'Unsupported document type: {document_type}'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    results = {'success': [], 'failed': []}
    
    for doc_id in document_ids:
        try:
            with transaction.atomic():
                doc = Model.objects.get(id=doc_id, tenant=request.user.tenant)
                
                if doc.status != 'posted':
                    results['failed'].append({
                        'id': doc_id,
                        'error': f'Document {doc.number} is not posted'
                    })
                    continue
                
                unpost_func(doc)
                results['success'].append(doc_id)
                
        except Model.DoesNotExist:
            results['failed'].append({'id': doc_id, 'error': 'Document not found'})
        except Exception as e:
            results['failed'].append({'id': doc_id, 'error': str(e)})
    
    return Response(results)


@api_view(['POST'])
def bulk_delete_documents(request):
    """Bulk delete (mark for deletion) multiple documents"""
    document_type = request.data.get('document_type')
    document_ids = request.data.get('document_ids', [])
    
    if document_type == 'sales':
        Model = SalesDocument
    elif document_type == 'purchase':
        Model = PurchaseDocument
    else:
        return Response(
            {'error': f'Unsupported document type: {document_type}'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    results = {'success': [], 'failed': []}
    
    for doc_id in document_ids:
        try:
            doc = Model.objects.get(id=doc_id, tenant=request.user.tenant)
            
            if doc.status == 'posted':
                results['failed'].append({
                    'id': doc_id,
                    'error': f'Cannot delete posted document {doc.number}'
                })
                continue
            
            doc.status = 'cancelled'
            doc.save()
            results['success'].append(doc_id)
            
        except Model.DoesNotExist:
            results['failed'].append({'id': doc_id, 'error': 'Document not found'})
        except Exception as e:
            results['failed'].append({'id': doc_id, 'error': str(e)})
    
    return Response(results)
