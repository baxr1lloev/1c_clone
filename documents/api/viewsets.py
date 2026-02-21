"""
API ViewSets for documents app.
Includes custom actions for post/unpost operations.
"""
from rest_framework import viewsets, filters, status, serializers as drf_serializers
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
    OpeningBalanceDocument,
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
    OpeningBalanceDocumentSerializer,
    OpeningBalanceDocumentCreateSerializer,
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
        except Exception as e:
            from documents.validators import DocumentValidationError
            if isinstance(e, DocumentValidationError):
                return Response({
                    'error': 'Validation failed',
                    'validation_errors': e.validation_errors
                }, status=status.HTTP_400_BAD_REQUEST)
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='post')
    def post(self, request, pk=None):
        """Alias for post_document (standardized API naming)."""
        return self.post_document(request, pk=pk)

    @action(detail=True, methods=['post'], url_path='unpost')
    def unpost(self, request, pk=None):
        """Alias for unpost_document (standardized API naming)."""
        return self.unpost_document(request, pk=pk)
    
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
        except Exception as e:
            from documents.validators import DocumentValidationError
            if isinstance(e, DocumentValidationError):
                return Response({
                    'error': 'Validation failed',
                    'validation_errors': e.validation_errors
                }, status=status.HTTP_400_BAD_REQUEST)
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='post')
    def post(self, request, pk=None):
        """Alias for post_document (standardized API naming)."""
        return self.post_document(request, pk=pk)

    @action(detail=True, methods=['post'], url_path='unpost')
    def unpost(self, request, pk=None):
        """Alias for unpost_document (standardized API naming)."""
        return self.unpost_document(request, pk=pk)


class PaymentDocumentViewSet(TenantFilterMixin, DocumentChainMixin, PostedDocumentProtectionMixin, PeriodEnforcementMixin, DocumentPostingsMixin, viewsets.ModelViewSet):
    """API endpoint for payment documents."""
    queryset = PaymentDocument.objects.select_related(
        'counterparty', 'contract', 'currency',
        'bank_account', 'bank_operation_type',
        'debit_account', 'credit_account', 'cash_flow_item',
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

    @action(detail=False, methods=['post'], url_path='posting-preview')
    def posting_preview(self, request):
        """
        Return resolved debit/credit template for guided UX preview.
        """
        from accounting.models import ChartOfAccounts
        from directories.models import BankOperationType, Counterparty

        tenant = request.user.tenant
        bank_operation_type_id = request.data.get('bank_operation_type')
        debit_id = request.data.get('debit_account')
        credit_id = request.data.get('credit_account')
        payment_type = request.data.get('payment_type', 'INCOMING')
        counterparty_id = request.data.get('counterparty')
        amount = request.data.get('amount')

        debit = None
        credit = None

        if bank_operation_type_id:
            op = BankOperationType.objects.filter(tenant=tenant, id=bank_operation_type_id, is_active=True).first()
            if not op:
                return Response({'error': 'Bank operation type not found'}, status=status.HTTP_400_BAD_REQUEST)
            debit = op.debit_account
            credit = op.credit_account
        elif debit_id and credit_id:
            debit = ChartOfAccounts.objects.filter(tenant=tenant, id=debit_id).first()
            credit = ChartOfAccounts.objects.filter(tenant=tenant, id=credit_id).first()
        else:
            try:
                acc_bank = ChartOfAccounts.objects.get(tenant=tenant, code='1030')
                if payment_type == 'INCOMING':
                    partner_code = '1210'
                else:
                    partner_code = '3310'

                if counterparty_id:
                    cp = Counterparty.objects.filter(tenant=tenant, id=counterparty_id).first()
                    if cp and payment_type == 'INCOMING':
                        partner_code = '1210'
                    elif cp and payment_type == 'OUTGOING':
                        partner_code = '3310'

                acc_partner = ChartOfAccounts.objects.get(tenant=tenant, code=partner_code)
                if payment_type == 'INCOMING':
                    debit, credit = acc_bank, acc_partner
                else:
                    debit, credit = acc_partner, acc_bank
            except ChartOfAccounts.DoesNotExist:
                return Response({'error': 'Default accounts not configured (1030/1210/3310).'}, status=status.HTTP_400_BAD_REQUEST)

        if not debit or not credit:
            return Response({'error': 'Unable to resolve posting accounts.'}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'debit_account': {'id': debit.id, 'code': debit.code, 'name': debit.name},
            'credit_account': {'id': credit.id, 'code': credit.code, 'name': credit.name},
            'amount': amount,
            'payment_type': payment_type,
        })
    
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
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='post')
    def post(self, request, pk=None):
        """Alias for post_document (standardized API naming)."""
        return self.post_document(request, pk=pk)

    @action(detail=True, methods=['post'], url_path='unpost')
    def unpost(self, request, pk=None):
        """Alias for unpost_document (standardized API naming)."""
        return self.unpost_document(request, pk=pk)


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

    @action(detail=True, methods=['post'])
    def unpost_document(self, request, pk=None):
        """Unpost the transfer document."""
        doc = self.get_object()
        if doc.status != 'posted':
            return Response({'error': 'Only posted documents can be unposted'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            self.validate_period_open(doc.date)
            DocumentPostingService.unpost_transfer_document(doc)
            return Response({'status': 'draft', 'message': f'Transfer #{doc.number} unposted'})
        except Exception as e:
            from documents.validators import DocumentValidationError
            if isinstance(e, DocumentValidationError):
                return Response({
                    'error': 'Validation failed',
                    'validation_errors': e.validation_errors
                }, status=status.HTTP_400_BAD_REQUEST)
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='post')
    def post(self, request, pk=None):
        """Alias for post_document (standardized API naming)."""
        return self.post_document(request, pk=pk)

    @action(detail=True, methods=['post'], url_path='unpost')
    def unpost(self, request, pk=None):
        """Alias for unpost_document (standardized API naming)."""
        return self.unpost_document(request, pk=pk)


class SalesOrderViewSet(TenantFilterMixin, DocumentChainMixin, PostedDocumentProtectionMixin, PeriodEnforcementMixin, viewsets.ModelViewSet):
    """API endpoint for sales orders."""
    queryset = SalesOrder.objects.select_related(
        'counterparty', 'contract', 'warehouse', 'currency'
    ).prefetch_related('lines__item').all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['status', 'counterparty']
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

            doc.post(user=request.user)
            return Response({'status': doc.status, 'message': f'Order #{doc.number} posted (Stock Reserved)'})
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
        """Unpost the sales order (release reservations)."""
        doc = self.get_object()
        if doc.status not in ['posted', getattr(doc, 'STATUS_CONFIRMED', 'confirmed')]:
            return Response({'error': 'Only posted orders can be unposted'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # 1C Rule: Check period before unposting
            self.validate_period_open(doc.date)

            doc.unpost()
            return Response({'status': doc.status, 'message': f'Order #{doc.number} unposted'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='post')
    def post(self, request, pk=None):
        """Alias for post_document (standardized API naming)."""
        return self.post_document(request, pk=pk)

    @action(detail=True, methods=['post'], url_path='unpost')
    def unpost(self, request, pk=None):
        """Alias for unpost_document (standardized API naming)."""
        return self.unpost_document(request, pk=pk)

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

    @action(detail=True, methods=['post'], url_path='post')
    def post(self, request, pk=None):
        """Alias for post_document (standardized API naming)."""
        return self.post_document(request, pk=pk)

    @action(detail=True, methods=['post'], url_path='unpost')
    def unpost(self, request, pk=None):
        """Alias for unpost_document (standardized API naming)."""
        return self.unpost_document(request, pk=pk)


class BankStatementViewSet(TenantFilterMixin, viewsets.ModelViewSet):
    """API endpoint for bank statements."""
    queryset = BankStatement.objects.select_related(
        'bank_account', 'currency'
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

    @action(detail=False, methods=['get'], url_path='suggest-opening-balance')
    def suggest_opening_balance(self, request):
        """Suggest opening balance and reconciliation hints for a new statement."""
        from decimal import Decimal
        from datetime import datetime
        from accounting.models import AccountingEntry
        from django.db.models import Sum

        bank_account_id = request.query_params.get('bank_account')
        statement_date_raw = request.query_params.get('statement_date')

        if not bank_account_id or not statement_date_raw:
            return Response({'error': 'bank_account and statement_date are required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            statement_date = datetime.strptime(statement_date_raw, '%Y-%m-%d').date()
            bank_account_id_int = int(bank_account_id)
        except (ValueError, TypeError):
            return Response({'error': 'Invalid bank_account or statement_date'}, status=status.HTTP_400_BAD_REQUEST)

        previous = BankStatement.get_previous_statement(request.user.tenant, bank_account_id_int, statement_date)
        latest = BankStatement.get_latest_statement(request.user.tenant, bank_account_id_int)

        opening_balance = previous.closing_balance if previous else Decimal('0')
        opening_locked = previous is not None

        continuity_warning = None
        if previous and (statement_date - previous.statement_date).days > 1:
            continuity_warning = f"Gap detected: previous statement date is {previous.statement_date}"

        can_create_for_date = True
        if latest and statement_date < latest.statement_date:
            can_create_for_date = False

        debit_total = AccountingEntry.objects.filter(
            tenant=request.user.tenant,
            date__date__lte=statement_date,
            debit_account__code__startswith='1030'
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
        credit_total = AccountingEntry.objects.filter(
            tenant=request.user.tenant,
            date__date__lte=statement_date,
            credit_account__code__startswith='1030'
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
        accounting_balance = debit_total - credit_total

        return Response({
            'opening_balance': opening_balance,
            'opening_balance_locked': opening_locked,
            'previous_statement_date': previous.statement_date if previous else None,
            'previous_statement_closing_balance': previous.closing_balance if previous else None,
            'latest_statement_date': latest.statement_date if latest else None,
            'continuity_warning': continuity_warning,
            'can_create_for_date': can_create_for_date,
            'accounting_balance': accounting_balance,
        })
    
    @action(detail=False, methods=['post'], url_path='upload')
    def upload(self, request):
        """
        Upload and parse a bank statement file.
        Expects: file, bank_account, statement_date, opening_balance
        """
        from decimal import Decimal
        from datetime import datetime
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
            
            statement_date_obj = datetime.strptime(statement_date, '%Y-%m-%d').date()
            previous = BankStatement.get_previous_statement(request.user.tenant, bank_account.id, statement_date_obj)
            latest = BankStatement.get_latest_statement(request.user.tenant, bank_account.id)
            if latest and statement_date_obj < latest.statement_date:
                return Response(
                    {'error': f'Cannot create statement older than latest existing statement date ({latest.statement_date})'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            if previous:
                opening_balance = previous.closing_balance

            statement = BankStatement.objects.create(
                tenant=request.user.tenant,
                created_by=request.user,
                number=number,
                date=timezone.now(),
                statement_date=statement_date,
                source='imported',
                bank_account=bank_account,
                currency=bank_account.currency,
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
                    bank_document_number=row.get('document_number', ''),
                    description=row.get('description', ''),
                    payment_purpose=row.get('purpose', row.get('description', '')),
                    operation_type=BankStatementLine.detect_operation_type(
                        row.get('description', ''),
                        'INCOMING' if debit > 0 else 'OUTGOING'
                    ),
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
            statement.recalculate_totals()
            if not statement.is_balanced:
                return Response(
                    {
                        'error': (
                            f"Cannot post unbalanced statement. "
                            f"Accounting difference: {statement.accounting_balance_difference}"
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
            from django.utils import timezone
            statement.status = 'posted'
            statement.posted_at = timezone.now()
            statement.posted_by = request.user
            statement.save(update_fields=['status', 'posted_at', 'posted_by'])
            
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
    
    # Line management actions
    @action(detail=True, methods=['post'], url_path='lines')
    def create_line(self, request, pk=None):
        """Create a new line for a bank statement."""
        from decimal import Decimal
        from django.utils import timezone
        
        statement = self.get_object()
        
        # Only allow editing draft statements
        if statement.status != 'draft':
            return Response(
                {'error': 'Can only add lines to draft statements'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            transaction_date = request.data.get('transaction_date', statement.statement_date)
            description = request.data.get('description', '')
            payment_purpose = request.data.get('payment_purpose', '')
            bank_document_number = request.data.get('bank_document_number', '')
            counterparty_name = request.data.get('counterparty_name', '')
            operation_type = request.data.get('operation_type', '')
            contract_id = request.data.get('contract')
            if contract_id in ['', None]:
                contract_id = None
            debit_amount = Decimal(request.data.get('debit_amount', '0') or '0')
            credit_amount = Decimal(request.data.get('credit_amount', '0') or '0')
            
            # Calculate balance
            last_line = statement.lines.order_by('-id').first()
            previous_balance = last_line.balance if last_line else statement.opening_balance
            new_balance = previous_balance + debit_amount - credit_amount
            
            line = BankStatementLine.objects.create(
                statement=statement,
                transaction_date=transaction_date,
                bank_document_number=bank_document_number,
                description=description,
                payment_purpose=payment_purpose,
                operation_type=operation_type,
                counterparty_name=counterparty_name,
                contract_id=contract_id,
                debit_amount=debit_amount,
                credit_amount=credit_amount,
                balance=new_balance
            )
            
            # Recalculate totals
            statement.recalculate_totals()
            
            serializer = BankStatementLineSerializer(line)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['patch', 'put'], url_path='lines/(?P<line_id>\\d+)')
    def update_line(self, request, pk=None, line_id=None):
        """Update a bank statement line."""
        from decimal import Decimal
        
        statement = self.get_object()
        
        # Only allow editing draft statements
        if statement.status != 'draft':
            return Response(
                {'error': 'Can only edit lines in draft statements'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            line = BankStatementLine.objects.get(id=line_id, statement=statement)
            
            # Update fields
            if 'transaction_date' in request.data:
                line.transaction_date = request.data['transaction_date']
            if 'description' in request.data:
                line.description = request.data['description']
            if 'payment_purpose' in request.data:
                line.payment_purpose = request.data['payment_purpose']
            if 'bank_document_number' in request.data:
                line.bank_document_number = request.data['bank_document_number']
            if 'counterparty_name' in request.data:
                line.counterparty_name = request.data['counterparty_name']
            if 'operation_type' in request.data:
                line.operation_type = request.data['operation_type']
            if 'contract' in request.data:
                line.contract_id = request.data['contract']
            if 'debit_amount' in request.data:
                line.debit_amount = Decimal(request.data['debit_amount'] or '0')
            if 'credit_amount' in request.data:
                line.credit_amount = Decimal(request.data['credit_amount'] or '0')
            
            # Recalculate balance for this line and all subsequent lines
            previous_line = statement.lines.filter(id__lt=line.id).order_by('-id').first()
            previous_balance = previous_line.balance if previous_line else statement.opening_balance
            line.balance = previous_balance + line.debit_amount - line.credit_amount
            line.save()
            
            # Recalculate all subsequent lines
            subsequent_lines = statement.lines.filter(id__gt=line.id).order_by('id')
            running_balance = line.balance
            for subsequent_line in subsequent_lines:
                running_balance = running_balance + subsequent_line.debit_amount - subsequent_line.credit_amount
                subsequent_line.balance = running_balance
                subsequent_line.save(update_fields=['balance'])
            
            # Recalculate totals
            statement.recalculate_totals()
            
            serializer = BankStatementLineSerializer(line)
            return Response(serializer.data)
            
        except BankStatementLine.DoesNotExist:
            return Response(
                {'error': 'Line not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['delete'], url_path='lines/(?P<line_id>\\d+)')
    def delete_line(self, request, pk=None, line_id=None):
        """Delete a bank statement line."""
        statement = self.get_object()
        
        # Only allow editing draft statements
        if statement.status != 'draft':
            return Response(
                {'error': 'Can only delete lines from draft statements'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            line = BankStatementLine.objects.get(id=line_id, statement=statement)
            line_id_to_delete = line.id
            
            # Get previous balance
            previous_line = statement.lines.filter(id__lt=line_id_to_delete).order_by('-id').first()
            previous_balance = previous_line.balance if previous_line else statement.opening_balance
            
            # Delete the line
            line.delete()
            
            # Recalculate all subsequent lines
            subsequent_lines = statement.lines.filter(id__gt=line_id_to_delete).order_by('id')
            running_balance = previous_balance
            for subsequent_line in subsequent_lines:
                running_balance = running_balance + subsequent_line.debit_amount - subsequent_line.credit_amount
                subsequent_line.balance = running_balance
                subsequent_line.save(update_fields=['balance'])
            
            # Recalculate totals
            statement.recalculate_totals()
            
            return Response(status=status.HTTP_204_NO_CONTENT)
            
        except BankStatementLine.DoesNotExist:
            return Response(
                {'error': 'Line not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'], url_path='lines/(?P<line_id>\\d+)/create-payment')
    def create_payment_from_line(self, request, pk=None, line_id=None):
        """Create PaymentDocument from a bank statement line."""
        statement = self.get_object()
        
        try:
            line = BankStatementLine.objects.get(id=line_id, statement=statement)
            
            # Check if payment already created
            if line.created_payment_document:
                return Response(
                    {'error': 'Payment document already created for this line'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Get optional parameters
            counterparty_id = request.data.get('counterparty_id')
            contract_id = request.data.get('contract_id')
            auto_post = request.data.get('auto_post', False)
            
            counterparty = None
            contract = None
            
            if counterparty_id:
                from directories.models import Counterparty
                counterparty = Counterparty.objects.get(id=counterparty_id, tenant=request.user.tenant)
            
            if contract_id:
                from directories.models import Contract
                contract = Contract.objects.get(id=contract_id, tenant=request.user.tenant)
            
            # Create payment document
            payment_doc = line.create_payment_document(
                user=request.user,
                counterparty=counterparty,
                contract=contract,
                auto_post=auto_post
            )
            
            # Serialize and return
            from .serializers import PaymentDocumentSerializer
            serializer = PaymentDocumentSerializer(payment_doc)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
            
        except BankStatementLine.DoesNotExist:
            return Response(
                {'error': 'Line not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'], url_path='create-payments-for-unmatched')
    def create_payments_for_unmatched(self, request, pk=None):
        """Create PaymentDocuments for all unmatched lines."""
        statement = self.get_object()
        auto_post = request.data.get('auto_post', False)
        created_count = 0
        errors = []
        
        unmatched_lines = statement.lines.filter(status='unmatched', created_payment_document__isnull=True)
        
        for line in unmatched_lines:
            try:
                line.create_payment_document(
                    user=request.user,
                    auto_post=auto_post
                )
                created_count += 1
            except Exception as e:
                errors.append(f"Line {line.id}: {str(e)}")
        
        return Response({
            'created_count': created_count,
            'errors': errors
        }, status=status.HTTP_200_OK)

class OpeningBalanceDocumentViewSet(TenantFilterMixin, viewsets.ModelViewSet):
    """
    API endpoint for stock opening balances.

    Uses OpeningBalanceDocument for stock/settlement/bank opening balances.
    """
    queryset = OpeningBalanceDocument.objects.select_related('warehouse').prefetch_related(
        'stock_lines__item',
        'stock_lines__warehouse',
        'settlement_lines__counterparty',
        'settlement_lines__contract',
        'account_lines__bank_account',
    ).all()
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'post', 'head', 'options']
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['status', 'warehouse', 'operation_type']
    search_fields = ['number', 'comment']
    ordering = ['-date']

    def get_queryset(self):
        qs = super().get_queryset()
        operation_type = self.request.query_params.get('operation_type')
        if operation_type in {
            OpeningBalanceDocument.OPERATION_STOCK,
            OpeningBalanceDocument.OPERATION_SETTLEMENT,
            OpeningBalanceDocument.OPERATION_ACCOUNT,
        }:
            return qs.filter(operation_type=operation_type)
        # Backward compatibility for existing stock balance page
        return qs.filter(operation_type=OpeningBalanceDocument.OPERATION_STOCK)

    def get_serializer_class(self):
        if self.action in ['create']:
            return OpeningBalanceDocumentCreateSerializer
        return OpeningBalanceDocumentSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
            doc = serializer.save()
        except drf_serializers.ValidationError as exc:
            return Response(exc.detail, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        out = OpeningBalanceDocumentSerializer(doc, context=self.get_serializer_context())
        headers = self.get_success_headers(out.data)
        return Response(out.data, status=status.HTTP_201_CREATED, headers=headers)


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
