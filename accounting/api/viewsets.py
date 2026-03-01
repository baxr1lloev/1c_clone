"""
API ViewSets for VAT system.
Handles HTTP requests and returns JSON responses.
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404

from accounting.vat import ElectronicInvoice, VATDeclaration
from accounting.services.vat_query_service import VATQueryService
from accounting.api.serializers import (
    ElectronicInvoiceListSerializer,
    ElectronicInvoiceDetailSerializer,
    ElectronicInvoiceCreateSerializer,
    VATDeclarationSerializer,
    AccountSerializer,
    AccountingEntrySerializer,
    TrialBalanceSerializer,
    PeriodClosingSerializer,
    OperationSerializer,
)
from accounting.models import (
    ChartOfAccounts, AccountingEntry, TrialBalance, PeriodClosing, Operation
)
from accounting.api.permissions import IsTenantMember


class VATDashboardViewSet(viewsets.ViewSet):
    """
    API endpoint for VAT dashboard.
    
    GET /api/vat/dashboard/ - Get dashboard summary
    """
    permission_classes = [IsAuthenticated, IsTenantMember]
    
    def list(self, request):
        """Get dashboard summary using QueryService"""
        tenant = request.user.tenant
        period = request.query_params.get('period')  # Optional: YYYY-MM-DD
        
        if period:
            from datetime import datetime
            period = datetime.strptime(period, '%Y-%m-%d').date()
        
        summary = VATQueryService.get_dashboard_summary(tenant, period)
        
        return Response(summary)


class ElectronicInvoiceViewSet(viewsets.ModelViewSet):
    """
    API endpoint for Electronic Invoices.
    
    GET    /api/vat/invoices/          - List invoices
    POST   /api/vat/invoices/          - Create invoice
    GET    /api/vat/invoices/{id}/     - Get invoice detail
    POST   /api/vat/invoices/{id}/send/   - Send to E-Soliq
    POST   /api/vat/invoices/{id}/accept/ - Accept invoice
    """
    permission_classes = [IsAuthenticated, IsTenantMember]
    
    def get_queryset(self):
        """Filter by tenant using QueryService"""
        tenant = self.request.user.tenant
        filters = {
            'status': self.request.query_params.get('status'),
            'invoice_type': self.request.query_params.get('invoice_type'),
            'search': self.request.query_params.get('search'),
        }
        return VATQueryService.get_invoices_queryset(
            tenant, **{k: v for k, v in filters.items() if v}
        )
    
    def get_serializer_class(self):
        """Choose serializer based on action"""
        if self.action == 'list':
            return ElectronicInvoiceListSerializer
        elif self.action == 'create':
            return ElectronicInvoiceCreateSerializer
        else:
            return ElectronicInvoiceDetailSerializer
    
    @action(detail=True, methods=['post'])
    def send(self, request, pk=None):
        """Send invoice to E-Soliq"""
        invoice = self.get_object()
        
        try:
            invoice.send_to_esoliq()
            
            # Invalidate cache
            VATQueryService.invalidate_cache(
                'dashboard_summary', request.user.tenant.id
            )
            
            return Response({
                'status': 'success',
                'message': 'Invoice sent to E-Soliq',
                'data': ElectronicInvoiceDetailSerializer(invoice).data
            })
        except Exception as e:
            return Response({
                'status': 'error',
                'code': 'SEND_FAILED',
                'message': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        """Accept invoice (mark as ACCEPTED)"""
        invoice = self.get_object()
        esoliq_uuid = request.data.get('esoliq_uuid')
        
        try:
            invoice.mark_as_accepted(esoliq_uuid=esoliq_uuid)
            
            # Invalidate cache
            VATQueryService.invalidate_cache(
                'dashboard_summary', request.user.tenant.id
            )
            
            return Response({
                'status': 'success',
                'message': 'Invoice accepted',
                'data': ElectronicInvoiceDetailSerializer(invoice).data
            })
        except Exception as e:
            return Response({
                'status': 'error',
                'code': 'ACCEPT_FAILED',
                'message': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)


class VATDeclarationViewSet(viewsets.ModelViewSet):
    """
    API endpoint for VAT Declarations.
    
    GET  /api/vat/declarations/              - List declarations
    GET  /api/vat/declarations/{id}/         - Get declaration detail
    POST /api/vat/declarations/              - Create declaration
    POST /api/vat/declarations/{id}/submit/  - Submit to E-Soliq
    GET  /api/vat/declarations/{id}/breakdown/ - Get detailed breakdown
    """
    permission_classes = [IsAuthenticated, IsTenantMember]
    serializer_class = VATDeclarationSerializer
    
    def get_queryset(self):
        """Filter by tenant using QueryService"""
        return VATQueryService.get_declarations_queryset(self.request.user.tenant)
    
    def create(self, request, *args, **kwargs):
        """Create new declaration for period"""
        period = request.data.get('period')
        
        if not period:
            return Response({
                'status': 'error',
                'code': 'PERIOD_REQUIRED',
                'message': 'Period is required (YYYY-MM-DD)'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        from datetime import datetime
        period_date = datetime.strptime(period, '%Y-%m-%d').date()
        
        # Create using model method
        from accounting.vat import VATDeclaration
        declaration = VATDeclaration.create_for_period(
            tenant=request.user.tenant,
            period=period_date
        )
        
        serializer = self.get_serializer(declaration)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Submit declaration to E-Soliq"""
        declaration = self.get_object()
        
        try:
            declaration.submit_to_esoliq(request.user)
            
            return Response({
                'status': 'success',
                'message': 'Declaration submitted',
                'data': VATDeclarationSerializer(declaration).data
            })
        except Exception as e:
            return Response({
                'status': 'error',
                'code': 'SUBMIT_FAILED',
                'message': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['get'])
    def breakdown(self, request, pk=None):
        """Get detailed breakdown for declaration"""
        declaration = self.get_object()
        breakdown = VATQueryService.get_declaration_breakdown(
            tenant=request.user.tenant,
            period=declaration.period
        )
        
        return Response(breakdown)


class AccountViewSet(viewsets.ModelViewSet):
    """
    API endpoint for Chart of Accounts.
    """
    permission_classes = [IsAuthenticated, IsTenantMember]
    serializer_class = AccountSerializer
    
    def get_queryset(self):
        return ChartOfAccounts.objects.filter(tenant=self.request.user.tenant)
    
    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.tenant)


class EntryViewSet(viewsets.ModelViewSet):
    """
    API endpoint for Journal Entries.
    """
    permission_classes = [IsAuthenticated, IsTenantMember]
    serializer_class = AccountingEntrySerializer
    
    def get_queryset(self):
        return AccountingEntry.objects.filter(tenant=self.request.user.tenant).order_by('-date')
    
    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.tenant)


class GeneralLedgerViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint for General Ledger (Trial Balance).
    """
    permission_classes = [IsAuthenticated, IsTenantMember]
    serializer_class = TrialBalanceSerializer
    
    def get_queryset(self):
        return TrialBalance.objects.filter(tenant=self.request.user.tenant).order_by('-period')


class PeriodClosingViewSet(viewsets.ModelViewSet):
    """
    API endpoint for Period Closings with Wizard support.
    
    GET  /api/accounting/periods/                      - List periods
    GET  /api/accounting/periods/{id}/                 - Get period
    GET  /api/accounting/periods/{id}/wizard-status/   - Get wizard status
    POST /api/accounting/periods/{id}/execute-task/    - Execute single task
    POST /api/accounting/periods/{id}/close-full/      - Execute all tasks
    """
    permission_classes = [IsAuthenticated, IsTenantMember]
    serializer_class = PeriodClosingSerializer
    
    def get_queryset(self):
        return PeriodClosing.objects.filter(tenant=self.request.user.tenant).order_by('-period')
    
    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.tenant)
    
    @action(detail=False, methods=['get'])
    def wizard_status(self, request):
        """
        Get wizard status for a specific period.
        Query param: period=YYYY-MM-DD
        """
        from datetime import datetime
        from accounting.period_closing_service import PeriodClosingService
        
        period_str = request.query_params.get('period')
        if not period_str:
            # Default to current month
            period = datetime.now().date().replace(day=1)
        else:
            period = datetime.strptime(period_str, '%Y-%m-%d').date()
        
        status_data = PeriodClosingService.get_period_status(
            tenant=request.user.tenant,
            period=period
        )
        
        return Response(status_data)
    
    @action(detail=False, methods=['post'])
    def execute_task(self, request):
        """
        Execute a single closing task.
        Body: { period: "YYYY-MM-DD", task_code: "DEPRECIATION" }
        """
        from datetime import datetime
        from accounting.period_closing_service import PeriodClosingService
        
        period_str = request.data.get('period')
        task_code = request.data.get('task_code')
        
        if not period_str or not task_code:
            return Response({
                'error': 'period and task_code are required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        period = datetime.strptime(period_str, '%Y-%m-%d').date()
        
        result = PeriodClosingService.execute_task(
            tenant=request.user.tenant,
            period=period,
            task_code=task_code,
            user=request.user
        )
        
        if result.success:
            return Response({
                'success': True,
                'task_code': result.task_code,
                'message': result.message,
                'data': result.data,
                'entries_created': result.entries_created,
                'total_amount': float(result.total_amount)
            })
        else:
            return Response({
                'success': False,
                'task_code': result.task_code,
                'message': result.message
            }, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['post'])
    def close_full(self, request):
        """
        Execute full period closing (all tasks).
        Body: { period: "YYYY-MM-DD" }
        """
        from datetime import datetime
        from accounting.period_closing_service import PeriodClosingService
        
        period_str = request.data.get('period')
        
        if not period_str:
            return Response({
                'error': 'period is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        period = datetime.strptime(period_str, '%Y-%m-%d').date()
        
        is_async = request.data.get('async', False)
        
        if is_async:
            from accounting.tasks import close_period_task
            task = close_period_task.delay(request.user.tenant.id, period_str, request.user.id, "Auto closed via UI")
            return Response({'task_id': task.id, 'status': 'PENDING'})

        result = PeriodClosingService.close_period_full(
            tenant=request.user.tenant,
            period=period,
            user=request.user
        )
        
        return Response(result)


class OperationViewSet(viewsets.ModelViewSet):
    """
    API endpoint for Manual Operations.
    """
    permission_classes = [IsAuthenticated, IsTenantMember]
    serializer_class = OperationSerializer
    
    def get_queryset(self):
        return Operation.objects.filter(tenant=self.request.user.tenant).order_by('-date')
    
    # perform_create is generic enough, serializer handles tenant
