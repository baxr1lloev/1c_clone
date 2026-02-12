"""
API ViewSets for documents app.
Includes custom actions for post/unpost operations.
"""
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied
from django_filters.rest_framework import DjangoFilterBackend


from documents.models import (
    SalesDocument, SalesDocumentLine,
    PurchaseDocument, PurchaseDocumentLine,
    PaymentDocument,
    TransferDocument,
    SalesOrder,
    SalesOrder,
    InventoryDocument,
    BankStatement, BankStatementLine,
    CashOrder,
)
from documents.services import DocumentPostingService
from tenants.permissions import PermissionService
from django.contrib.contenttypes.models import ContentType
from registers.models import StockMovement, SettlementMovement
from accounting.models import AccountingEntry

from .serializers import (
    SalesDocumentListSerializer,
    SalesDocumentDetailSerializer,
    SalesDocumentCreateUpdateSerializer,
    SalesDocumentLineSerializer,
    PurchaseDocumentListSerializer,
    PurchaseDocumentDetailSerializer,
    PurchaseDocumentCreateUpdateSerializer,
    PurchaseDocumentLineSerializer,
    PaymentDocumentSerializer,
    PaymentDocumentCreateUpdateSerializer,
    TransferDocumentListSerializer,
    TransferDocumentDetailSerializer,
    TransferDocumentCreateUpdateSerializer,
    SalesOrderListSerializer,
    SalesOrderDetailSerializer,
    SalesOrderCreateUpdateSerializer,
    SalesOrderLineSerializer,
    InventoryDocumentSerializer,
    InventoryDocumentCreateUpdateSerializer,
    BankStatementListSerializer,
    BankStatementDetailSerializer,
    BankStatementCreateUpdateSerializer,
    BankStatementLineSerializer,
    PayrollDocumentSerializer,
    PayrollDocumentCreateUpdateSerializer,
    ProductionDocumentSerializer,
    ProductionDocumentCreateUpdateSerializer,
)
from documents.models import PayrollDocument, ProductionDocument
from documents.models import PayrollDocument, ProductionDocument
from .protection_mixins import PostedDocumentProtectionMixin
from documents.mixins import PeriodEnforcementMixin


class TenantFilterMixin:
    """Mixin to filter queryset by tenant."""
    def get_queryset(self):
        qs = super().get_queryset()
        if hasattr(qs.model, 'tenant'):
            if not getattr(self.request.user, 'tenant_id', None):
                raise PermissionDenied('Current user is not assigned to a tenant.')
            return qs.filter(tenant=self.request.user.tenant)
        return qs


class DocumentChainMixin:
    """
    Mixin to provide 1C-style document chain functionality.
    
    Endpoints:
    - GET /documents/{id}/chain/ - Get document chain info
    - POST /documents/{id}/create_on_basis/ - Create new document from this one
    """
    
    @action(detail=True, methods=['get'])
    def chain(self, request, pk=None):
        """
        Get document chain information (1C-style).
        
        Returns:
        - base_document: The source document this was created from
        - child_documents: Documents created from this document
        - available_creations: What document types can be created from this
        - settlement: Payment summary (total, paid, remaining)
        """
        from documents.chain_service import DocumentChainService
        
        document = self.get_object()
        
        # Get base document info
        base_doc_data = None
        if document.base_document_type and document.base_document_id:
            base_doc_data = {
                'type': document.base_document_type.model,
                'type_display': document.base_document_type.model_class()._meta.verbose_name if document.base_document_type.model_class() else document.base_document_type.model,
                'id': document.base_document_id,
                'display': document.get_base_document_display(),
                'url': document.get_base_document_url(),
            }
        
        # Get child documents
        child_docs = []
        children = document.get_child_documents()
        for doc_type, docs in children.items():
            for doc in docs:
                child_docs.append({
                    'type': doc._meta.model_name,
                    'type_display': doc._meta.verbose_name,
                    'id': doc.id,
                    'number': doc.number,
                    'date': doc.date.isoformat() if doc.date else None,
                    'status': doc.status,
                    'url': DocumentChainService.get_document_url(doc),
                })
        
        # Get available creation types
        available_creations = DocumentChainService.get_available_creation_types(document)
        
        # Get settlement summary (for sales/purchase documents)
        settlement = None
        if hasattr(document, 'total_amount_base') or hasattr(document, 'total_amount'):
            settlement_data = DocumentChainService.get_settlement_summary(document)
            settlement = {
                'total_amount': float(settlement_data['total_amount']),
                'paid_amount': float(settlement_data['paid_amount']),
                'remaining_amount': float(settlement_data['remaining_amount']),
                'is_fully_paid': settlement_data['is_fully_paid'],
                'payments_count': len(settlement_data['payments']),
            }
        
        return Response({
            'base_document': base_doc_data,
            'child_documents': child_docs,
            'available_creations': available_creations,
            'settlement': settlement,
        })
    
    @action(detail=True, methods=['post'])
    def create_on_basis(self, request, pk=None):
        """
        Create a new document based on this document (1C-style "Ввод на основании").
        
        Request body:
        - target_type: 'salesdocument', 'paymentdocument', etc.
        
        Returns:
        - id: New document ID
        - type: Document type
        - number: Document number
        - url: Frontend URL to the new document
        """
        from documents.chain_service import DocumentChainService
        
        document = self.get_object()
        target_type = request.data.get('target_type')
        
        if not target_type:
            return Response(
                {'error': 'target_type is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            new_doc = DocumentChainService.create_on_basis(
                document, target_type, user=request.user
            )
            
            return Response({
                'id': new_doc.id,
                'type': new_doc._meta.model_name,
                'number': new_doc.number,
                'status': new_doc.status,
                'url': DocumentChainService.get_document_url(new_doc),
            }, status=status.HTTP_201_CREATED)
            
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


from audit_log.models import AuditLog
from audit_log.serializers import AuditLogSerializer

class DocumentPostingsMixin:
    """Mixin to provide drill-down actions for documents."""
    
    @action(detail=True, methods=['get'])
    def audit(self, request, pk=None):
        """Get audit trail for this document."""
        doc = self.get_object()
        content_type = ContentType.objects.get_for_model(doc)
        
        logs = AuditLog.objects.filter(
            content_type=content_type,
            object_id=doc.id
        ).select_related('user').order_by('-timestamp')
        
        serializer = AuditLogSerializer(logs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def postings(self, request, pk=None):
        """Return all register movements for this document."""
        doc = self.get_object()
        content_type = ContentType.objects.get_for_model(doc)
        
        # 1. Stock Movements
        stock_qs = StockMovement.objects.filter(
            tenant=doc.tenant,
            source_content_type=content_type,
            source_object_id=doc.id
        ).select_related('item', 'warehouse').values(
            'id', 'date', 'movement_type', 
            'item', 'item__name', 
            'warehouse', 'warehouse__name', 
            'quantity', 'total_cost'
        )
        
        # 2. Settlement Movements
        settlement_qs = SettlementMovement.objects.filter(
            tenant=doc.tenant,
            content_type=content_type,
            object_id=doc.id
        ).select_related('counterparty', 'currency').values(
            'id', 'date', 'counterparty', 'counterparty__name', 'amount', 'currency__code'
        )
        
        # 3. Accounting Entries
        accounting_qs = AccountingEntry.objects.filter(
            tenant=doc.tenant,
            content_type=content_type,
            object_id=doc.id
        ).select_related('debit_account', 'credit_account').values(
            'id', 'period', 
            'debit_account', 'debit_account__code', 
            'credit_account', 'credit_account__code',
            'amount', 'description'
        )
        
        return Response({
            'stock': list(stock_qs),
            'settlement': list(settlement_qs),
            'accounting': list(accounting_qs)
        })
    
    @action(detail=True, methods=['post'])
    def post(self, request, pk=None):
        """Post the document (create movements and postings)."""
        doc = self.get_object()
        
        if doc.status == 'posted':
            return Response(
                {'error': 'Document is already posted'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Determine document type and call appropriate posting method
            model_name = doc.__class__.__name__
            
            if model_name == 'SalesDocument':
                result = DocumentPostingService.post_sales_document(doc)
            elif model_name == 'PurchaseDocument':
                result = DocumentPostingService.post_purchase_document(doc)
            elif model_name == 'TransferDocument':
                result = DocumentPostingService.post_transfer_document(doc)
            elif model_name == 'PaymentDocument':
                result = DocumentPostingService.post_payment_document(doc)
            elif model_name == 'SalesOrder':
                result = DocumentPostingService.post_sales_order(doc)
            else:
                return Response(
                    {'error': f'Posting not implemented for {model_name}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            return Response({
                'status': 'posted',
                'message': 'Document posted successfully'
            })
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['post'])
    def unpost(self, request, pk=None):
        """Unpost the document (reverse movements and postings)."""
        doc = self.get_object()
        
        if doc.status != 'posted':
            return Response(
                {'error': 'Document is not posted'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Determine document type and call appropriate unposting method
            model_name = doc.__class__.__name__
            
            if model_name == 'SalesDocument':
                result = DocumentPostingService.unpost_sales_document(doc)
            elif model_name == 'PurchaseDocument':
                result = DocumentPostingService.unpost_purchase_document(doc)
            elif model_name == 'TransferDocument':
                # Add unpost_transfer_document to services.py if needed
                return Response(
                    {'error': 'Unpost not yet implemented for transfers'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            elif model_name == 'PaymentDocument':
                result = DocumentPostingService.unpost_payment_document(doc)
            elif model_name == 'SalesOrder':
                result = DocumentPostingService.unpost_sales_order(doc)
            else:
                return Response(
                    {'error': f'Unposting not implemented for {model_name}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            return Response({
                'status': 'draft',
                'message': 'Document unposted successfully'
            })
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['get'])
    def movements(self, request, pk=None):
        """Get stock movements created by this document (1C-style drill-down)."""
        doc = self.get_object()
        content_type = ContentType.objects.get_for_model(doc)
        
        movements = StockMovement.objects.filter(
            tenant=doc.tenant,
            content_type=content_type,
            object_id=doc.id
        ).select_related('item', 'warehouse', 'batch').order_by('date', 'id')
        
        movements_data = [{
            'id': m.id,
            'date': m.date.isoformat() if m.date else None,
            'item_id': m.item_id,
            'item_name': m.item.name,
            'warehouse_id': m.warehouse_id,
            'warehouse_name': m.warehouse.name,
            'quantity': float(m.quantity),
            'batch_id': m.batch_id,
            'movement_type': m.type
        } for m in movements]
        
        return Response({'movements': movements_data})
    
    @action(detail=True, methods=['get'])
    def journal(self, request, pk=None):
        """Get journal entries (postings) created by this document (1C-style drill-down)."""
        doc = self.get_object()
        content_type = ContentType.objects.get_for_model(doc)
        
        entries = AccountingEntry.objects.filter(
            tenant=doc.tenant,
            content_type=content_type,
            object_id=doc.id
        ).select_related('debit_account', 'credit_account').order_by('id')
        
        entries_data = [{
            'id': e.id,
            'debit_account': e.debit_account.code,
            'debit_account_name': e.debit_account.name,
            'credit_account': e.credit_account.code,
            'credit_account_name': e.credit_account.name,
            'amount': float(e.amount),
            'description': e.description or ''
        } for e in entries]
        
        return Response({'entries': entries_data})
    
    @action(detail=True, methods=['get'])
    def preview(self, request, pk=None):
        """Get quick preview data for hover (1C-style)."""
        doc = self.get_object()
        
        # Get counterparty name if exists
        counterparty_name = None
        if hasattr(doc, 'counterparty') and doc.counterparty:
            counterparty_name = doc.counterparty.name
        elif hasattr(doc, 'supplier') and doc.supplier:
            counterparty_name = doc.supplier.name
        
        # Get total amount
        total = None
        if hasattr(doc, 'total'):
            total = float(doc.total)
        elif hasattr(doc, 'total_amount'):
            total = float(doc.total_amount)
        elif hasattr(doc, 'amount'):
            total = float(doc.amount)
        
        return Response({
            'id': doc.id,
            'type': doc.__class__.__name__.lower().replace('document', ''),
            'name': doc.number,
            'summary': {
                'date': doc.date.isoformat() if doc.date else None,
                'status': doc.status,
                'total': total,
                'counterparty': counterparty_name
            }
        })


class SalesDocumentViewSet(TenantFilterMixin, DocumentChainMixin, PostedDocumentProtectionMixin, PeriodEnforcementMixin, DocumentPostingsMixin, viewsets.ModelViewSet):
    """
    API endpoint for sales documents.
    
    Supports custom actions:
    - POST /sales/{id}/post/ - Post document
    - POST /sales/{id}/unpost/ - Unpost document
    - POST /sales/{id}/lines/ - Add a line
    """
    queryset = SalesDocument.objects.select_related(
        'counterparty', 'contract', 'warehouse', 'currency'
    ).prefetch_related('lines__item').all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'counterparty', 'warehouse']
    search_fields = ['number']
    ordering_fields = ['date', 'number', 'total_amount']
    ordering = ['-date']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return SalesDocumentListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return SalesDocumentCreateUpdateSerializer
        return SalesDocumentDetailSerializer
    
    @action(detail=True, methods=['post'])
    def post_document(self, request, pk=None):
        """Post (finalize) the sales document."""
        doc = self.get_object()
        
        if not PermissionService.user_has_permission(request.user, 'documents.post'):
            return Response(
                {'error': 'You do not have permission to post documents'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        if doc.status != 'draft':
            return Response(
                {'error': 'Only draft documents can be posted'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # 1C Rule: Check period before posting
            self.validate_period_open(doc.date)
            
            DocumentPostingService.post_sales_document(doc)
            doc.posted_by = request.user
            doc.save()
            return Response({'status': 'posted', 'message': f'Document #{doc.number} posted successfully'})
        except Exception as e:
            # Handle structured validation errors
            from documents.validators import DocumentValidationError
            if isinstance(e, DocumentValidationError):
                return Response({
                    'error': 'Validation failed',
                    'validation_errors': e.validation_errors
                }, status=status.HTTP_400_BAD_REQUEST)
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def unpost_document(self, request, pk=None):
        """Unpost (reverse) the sales document."""
        doc = self.get_object()
        
        if not PermissionService.user_has_permission(request.user, 'documents.unpost'):
            return Response(
                {'error': 'You do not have permission to unpost documents'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        if doc.status != 'posted':
            return Response(
                {'error': 'Only posted documents can be unposted'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # 1C Rule: Check period before unposting
            self.validate_period_open(doc.date)
            
            DocumentPostingService.unpost_sales_document(doc)
            return Response({'status': 'draft', 'message': f'Document #{doc.number} unposted successfully'})
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def add_line(self, request, pk=None):
        """Add a line to the document."""
        doc = self.get_object()
        
        if doc.status != 'draft':
            return Response(
                {'error': 'Cannot add lines to posted documents'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = SalesDocumentLineSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(document=doc)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PurchaseDocumentViewSet(TenantFilterMixin, DocumentChainMixin, PostedDocumentProtectionMixin, PeriodEnforcementMixin, DocumentPostingsMixin, viewsets.ModelViewSet):
    """API endpoint for purchase documents."""
    queryset = PurchaseDocument.objects.select_related(
        'counterparty', 'contract', 'warehouse', 'currency'
    ).prefetch_related('lines__item').all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'counterparty', 'warehouse']
    search_fields = ['number']
    ordering = ['-date']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return PurchaseDocumentListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return PurchaseDocumentCreateUpdateSerializer
        return PurchaseDocumentDetailSerializer
    
    @action(detail=True, methods=['post'])
    def post_document(self, request, pk=None):
        """Post the purchase document."""
        doc = self.get_object()
        
        if not PermissionService.user_has_permission(request.user, 'documents.post'):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        if doc.status != 'draft':
            return Response({'error': 'Only draft documents can be posted'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # 1C Rule: Check period before posting
            self.validate_period_open(doc.date)

            DocumentPostingService.post_purchase_document(doc)
            doc.posted_by = request.user
            doc.save()
            return Response({'status': 'posted', 'message': f'Purchase #{doc.number} posted'})
        except Exception as e:
            # Handle structured validation errors
            from documents.validators import DocumentValidationError
            if isinstance(e, DocumentValidationError):
                return Response({
                    'error': 'Validation failed',
                    'validation_errors': e.validation_errors
                }, status=status.HTTP_400_BAD_REQUEST)
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def unpost_document(self, request, pk=None):
        """Unpost the purchase document."""
        doc = self.get_object()
        
        if not PermissionService.user_has_permission(request.user, 'documents.unpost'):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        if doc.status != 'posted':
            return Response({'error': 'Only posted documents can be unposted'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # 1C Rule: Check period before unposting
            self.validate_period_open(doc.date)

            DocumentPostingService.unpost_purchase_document(doc)
            return Response({'status': 'draft', 'message': f'Purchase #{doc.number} unposted'})
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class PaymentDocumentViewSet(TenantFilterMixin, DocumentChainMixin, PostedDocumentProtectionMixin, PeriodEnforcementMixin, DocumentPostingsMixin, viewsets.ModelViewSet):
    """API endpoint for payment documents."""
    queryset = PaymentDocument.objects.select_related(
        'counterparty', 'contract', 'currency'
    ).all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['status', 'payment_type', 'counterparty']
    search_fields = ['number']
    ordering = ['-date']
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return PaymentDocumentCreateUpdateSerializer
        return PaymentDocumentSerializer
    
    @action(detail=True, methods=['post'])
    def post_document(self, request, pk=None):
        """Post the payment document."""
        doc = self.get_object()
        
        if not PermissionService.user_has_permission(request.user, 'documents.post'):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        if doc.status != 'draft':
            return Response({'error': 'Only draft documents can be posted'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # 1C Rule: Check period before posting
            self.validate_period_open(doc.date)

            DocumentPostingService.post_payment_document(doc)
            return Response({'status': 'posted', 'message': f'Payment #{doc.number} posted'})
        except Exception as e:
            # Handle structured validation errors
            from documents.validators import DocumentValidationError
            if isinstance(e, DocumentValidationError):
                return Response({
                    'error': 'Validation failed',
                    'validation_errors': e.validation_errors
                }, status=status.HTTP_400_BAD_REQUEST)
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def unpost_document(self, request, pk=None):
        """Unpost the payment document."""
        doc = self.get_object()
        
        if not PermissionService.user_has_permission(request.user, 'documents.unpost'):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        if doc.status != 'posted':
            return Response({'error': 'Only posted documents can be unposted'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # 1C Rule: Check period before unposting
            self.validate_period_open(doc.date)

            DocumentPostingService.unpost_payment_document(doc)
            return Response({'status': 'draft', 'message': f'Payment #{doc.number} unposted'})
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class TransferDocumentViewSet(TenantFilterMixin, PostedDocumentProtectionMixin, PeriodEnforcementMixin, viewsets.ModelViewSet):
    """API endpoint for transfer documents."""
    queryset = TransferDocument.objects.select_related(
        'from_warehouse', 'to_warehouse', 'counterparty'
    ).prefetch_related('lines__item').all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['status', 'from_warehouse', 'to_warehouse']
    search_fields = ['number']
    ordering = ['-date']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return TransferDocumentListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return TransferDocumentCreateUpdateSerializer
        return TransferDocumentDetailSerializer
    
    @action(detail=True, methods=['post'])
    def post_document(self, request, pk=None):
        """Post the transfer document."""
        doc = self.get_object()
        if doc.status != 'draft':
            return Response({'error': 'Only draft documents can be posted'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # 1C Rule: Check period before posting
            self.validate_period_open(doc.date)

            DocumentPostingService.post_transfer_document(doc)
            return Response({'status': 'posted', 'message': f'Transfer #{doc.number} posted'})
        except Exception as e:
            # Handle structured validation errors
            from documents.validators import DocumentValidationError
            if isinstance(e, DocumentValidationError):
                return Response({
                    'error': 'Validation failed',
                    'validation_errors': e.validation_errors
                }, status=status.HTTP_400_BAD_REQUEST)
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class SalesOrderViewSet(TenantFilterMixin, DocumentChainMixin, PostedDocumentProtectionMixin, PeriodEnforcementMixin, viewsets.ModelViewSet):
    """API endpoint for sales orders."""
    queryset = SalesOrder.objects.select_related(
        'counterparty', 'contract', 'warehouse', 'currency'
    ).prefetch_related('lines__item').all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['status', 'counterparty', 'is_fully_shipped']
    search_fields = ['number']
    ordering = ['-date']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return SalesOrderListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return SalesOrderCreateUpdateSerializer
        return SalesOrderDetailSerializer
    
    @action(detail=True, methods=['post'])
    def post_document(self, request, pk=None):
        """Post the sales order (create reservations)."""
        doc = self.get_object()
        if doc.status != 'draft':
            return Response({'error': 'Only draft orders can be posted'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # 1C Rule: Check period before posting
            self.validate_period_open(doc.date)

            DocumentPostingService.post_sales_order(doc)
            return Response({'status': 'posted', 'message': f'Order #{doc.number} posted (Stock Reserved)'})
        except ValueError as e:
            # Handle structured validation errors
            from documents.validators import DocumentValidationError
            if isinstance(e, DocumentValidationError):
                return Response({
                    'error': 'Validation failed',
                    'validation_errors': e.validation_errors
                }, status=status.HTTP_400_BAD_REQUEST)
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def unpost_document(self, request, pk=None):
        """Unpost the sales order (release reservations)."""
        doc = self.get_object()
        if doc.status != 'posted':
            return Response({'error': 'Only posted orders can be unposted'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # 1C Rule: Check period before unposting
            self.validate_period_open(doc.date)

            DocumentPostingService.unpost_sales_order(doc)
            return Response({'status': 'draft', 'message': f'Order #{doc.number} unposted'})
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def create_sales_document(self, request, pk=None):
        """Create a Sales Document from this order."""
        order = self.get_object()
        try:
            doc = order.create_sales_document(user=request.user)
            return Response({
                'status': 'created',
                'id': doc.id,
                'number': doc.number,
                'message': f'Sales Document #{doc.number} created'
            })
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class InventoryDocumentViewSet(TenantFilterMixin, PostedDocumentProtectionMixin, PeriodEnforcementMixin, DocumentPostingsMixin, viewsets.ModelViewSet):
    """API endpoint for inventory documents."""
    queryset = InventoryDocument.objects.select_related(
        'warehouse'
    ).prefetch_related('lines__item').all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['status', 'warehouse']
    search_fields = ['number']
    ordering = ['-date']
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return InventoryDocumentCreateUpdateSerializer
        return InventoryDocumentSerializer

    @action(detail=True, methods=['post'])
    def post_document(self, request, pk=None):
        doc = self.get_object()
        if doc.status != 'draft':
            return Response({'error': 'Only draft documents can be posted'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # 1C Rule: Check period before posting
            self.validate_period_open(doc.date)

            DocumentPostingService.post_inventory_document(doc)
            return Response({'status': 'posted', 'message': f'Inventory #{doc.number} posted'})
        except Exception as e:
            # Handle structured validation errors
            from documents.validators import DocumentValidationError
            if isinstance(e, DocumentValidationError):
                return Response({
                    'error': 'Validation failed',
                    'validation_errors': e.validation_errors
                }, status=status.HTTP_400_BAD_REQUEST)
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def unpost_document(self, request, pk=None):
        doc = self.get_object()
        if doc.status != 'posted':
            return Response({'error': 'Only posted documents can be unposted'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # 1C Rule: Check period before unposting
            self.validate_period_open(doc.date)

            DocumentPostingService.unpost_inventory_document(doc)
            return Response({'status': 'draft', 'message': f'Inventory #{doc.number} unposted'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class BankStatementViewSet(TenantFilterMixin, viewsets.ModelViewSet):
    """API endpoint for bank statements."""
    queryset = BankStatement.objects.select_related(
        'bank_account'
    ).prefetch_related('lines').all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['status', 'bank_account', 'statement_date']
    search_fields = ['number']
    ordering = ['-statement_date', '-date']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return BankStatementListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return BankStatementCreateUpdateSerializer
        return BankStatementDetailSerializer
    
    def get_queryset(self):
        qs = super().get_queryset()
        # Annotate with permission flags
        for statement in qs:
            statement.can_post = statement.status == 'draft'
            statement.can_unpost = statement.status == 'posted'
            statement.period_is_closed = False  # TODO: Implement period closing logic
        return qs
    
    @action(detail=False, methods=['post'], url_path='upload')
    def upload(self, request):
        """
        Upload and parse a bank statement file.
        Expects: file, bank_account, statement_date, opening_balance
        """
        from decimal import Decimal
        import csv
        import io
        
        file = request.FILES.get('file')
        bank_account_id = request.data.get('bank_account')
        statement_date = request.data.get('statement_date')
        opening_balance = Decimal(request.data.get('opening_balance', '0'))
        
        if not all([file, bank_account_id, statement_date]):
            return Response(
                {'error': 'Missing required fields: file, bank_account, statement_date'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Create the bank statement
            from directories.models import BankAccount
            bank_account = BankAccount.objects.get(id=bank_account_id, tenant=request.user.tenant)
            
            # Generate number
            from django.utils import timezone
            number = f"BS-{timezone.now().strftime('%Y%m%d-%H%M%S')}"
            
            statement = BankStatement.objects.create(
                tenant=request.user.tenant,
                created_by=request.user,
                number=number,
                date=timezone.now(),
                statement_date=statement_date,
                bank_account=bank_account,
                opening_balance=opening_balance,
                file=file
            )
            
            # Parse CSV file (simple implementation)
            file_content = file.read().decode('utf-8')
            csv_reader = csv.DictReader(io.StringIO(file_content))
            
            running_balance = opening_balance
            for row in csv_reader:
                # Expecting columns: date, description, debit, credit, balance
                # This is a simplified parser - you'll need to adapt to actual bank formats
                debit = Decimal(row.get('debit', '0') or '0')
                credit = Decimal(row.get('credit', '0') or '0')
                
                running_balance += debit - credit
                
                BankStatementLine.objects.create(
                    statement=statement,
                    transaction_date=row.get('date', statement_date),
                    description=row.get('description', ''),
                    counterparty_name=row.get('counterparty', ''),
                    debit_amount=debit,
                    credit_amount=credit,
                    balance=running_balance
                )
            
            # Recalculate totals
            statement.recalculate_totals()
            
            serializer = BankStatementDetailSerializer(statement)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def post(self, request, pk=None):
        """Post a bank statement."""
        statement = self.get_object()
        
        if statement.status != 'draft':
            return Response(
                {'error': 'Only draft statements can be posted'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            from django.utils import timezone
            statement.status = 'posted'
            statement.posted_at = timezone.now()
            statement.posted_by = request.user
            statement.save()
            
            serializer = self.get_serializer(statement)
            return Response(serializer.data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def unpost(self, request, pk=None):
        """Unpost a bank statement."""
        statement = self.get_object()
        
        if statement.status != 'posted':
            return Response(
                {'error': 'Only posted statements can be unposted'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            statement.status = 'draft'
            statement.posted_at = None
            statement.posted_by = None
            statement.save()
            
            serializer = self.get_serializer(statement)
            return Response(serializer.data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

class PayrollDocumentViewSet(TenantFilterMixin, DocumentPostingsMixin, viewsets.ModelViewSet):
    """API endpoint for payroll documents."""
    queryset = PayrollDocument.objects.select_related().prefetch_related('lines__employee').all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['status']
    search_fields = ['number', 'comment']
    ordering = ['-date']
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return PayrollDocumentCreateUpdateSerializer
        return PayrollDocumentSerializer
        
    @action(detail=True, methods=['post'])
    def post_document(self, request, pk=None):
        doc = self.get_object()
        if doc.status != 'draft':
            return Response({'error': 'Only draft documents can be posted'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            doc.post() # using model method directly for now as service might not be updated
            return Response({'status': 'posted', 'message': f'Payroll #{doc.number} posted'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def unpost_document(self, request, pk=None):
        doc = self.get_object()
        if doc.status != 'posted':
            return Response({'error': 'Only posted documents can be unposted'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            doc.unpost()
            return Response({'status': 'draft', 'message': f'Payroll #{doc.number} unposted'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class ProductionDocumentViewSet(TenantFilterMixin, DocumentPostingsMixin, viewsets.ModelViewSet):
    """API endpoint for production documents."""
    queryset = ProductionDocument.objects.select_related(
        'warehouse', 'materials_warehouse'
    ).prefetch_related(
        'products__item__unit', 
        'materials__item__unit'
    ).all()
    
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['status', 'warehouse']
    search_fields = ['number', 'comment']
    ordering = ['-date']
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return ProductionDocumentCreateUpdateSerializer
        return ProductionDocumentSerializer
        
    @action(detail=True, methods=['post'])
    def post_document(self, request, pk=None):
        doc = self.get_object()
        if doc.status != 'draft':
            return Response({'error': 'Only draft documents can be posted'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            doc.post(user=request.user)
            return Response({'status': 'posted', 'message': f'Production #{doc.number} posted'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def unpost_document(self, request, pk=None):
        doc = self.get_object()
        if doc.status != 'posted':
            return Response({'error': 'Only posted documents can be unposted'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            doc.unpost()
            return Response({'status': 'draft', 'message': f'Production #{doc.number} unposted'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
