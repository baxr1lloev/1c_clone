"""
API ViewSets for directories app.
"""
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Sum

from directories.models import (
    Currency, ExchangeRate, Counterparty, Contract, Warehouse, Item, BankAccount, Employee,
    Department, Project, BankOperationType, BankExchangeSettings,
)
from .serializers import (
    CurrencySerializer,
    ExchangeRateSerializer,
    CounterpartyListSerializer,
    CounterpartyDetailSerializer,
    CounterpartyCreateUpdateSerializer,
    ContractSerializer,
    ContractCreateUpdateSerializer,
    WarehouseSerializer,
    WarehouseCreateUpdateSerializer,
    ItemSerializer,
    ItemCreateUpdateSerializer,
    BankAccountSerializer,
    BankAccountCreateUpdateSerializer,
    BankExchangeSettingsSerializer,
    BankOperationTypeSerializer,
    EmployeeSerializer,
    ItemCategorySerializer,
    DepartmentSerializer,
    ProjectSerializer,
)
from directories.models import ItemCategory

class ItemCategoryViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = ItemCategorySerializer

    def get_queryset(self):
        qs = ItemCategory.objects.filter(tenant=self.request.user.tenant)
        if self.request.query_params.get('root_only'):
            return qs.filter(parent__isnull=True)
        return qs

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.tenant)


class TenantFilterMixin:
    """Mixin to filter queryset by tenant."""
    def get_queryset(self):
        qs = super().get_queryset()
        if hasattr(qs.model, 'tenant'):
            return qs.filter(tenant=self.request.user.tenant)
        return qs


class CurrencyViewSet(viewsets.ModelViewSet):
    """
    API endpoint for currencies.
    Currencies are global, but we allow admins/users to manage them.
    """
    queryset = Currency.objects.all()
    serializer_class = CurrencySerializer
    permission_classes = [IsAuthenticated]

    def create(self, request, *args, **kwargs):
        print(f"DEBUG: Creating currency with data: {request.data}")
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            print(f"DEBUG: Validation errors: {serializer.errors}")
        return super().create(request, *args, **kwargs)

    @action(detail=False, methods=['get'])
    def load_from_classifier(self, request):
        """Return a list of common currencies to add (Mock Classifier)."""
        from .serializers import CurrencyClassifierSerializer
        classifier_data = [
            {'code': 'USD', 'name': 'US Dollar', 'symbol': '$'},
            {'code': 'EUR', 'name': 'Euro', 'symbol': '€'},
            {'code': 'CNY', 'name': 'Chinese Yuan', 'symbol': '¥'},
            {'code': 'RUB', 'name': 'Russian Ruble', 'symbol': '₽'},
            {'code': 'UZS', 'name': 'Uzbek Sum', 'symbol': 'лв'},
            {'code': 'GBP', 'name': 'British Pound', 'symbol': '£'},
            {'code': 'KZT', 'name': 'Kazakhstani Tenge', 'symbol': '₸'},
        ]
        serializer = CurrencyClassifierSerializer(classifier_data, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def add_from_classifier(self, request):
        """Add a currency from the classifier codes."""
        codes = request.data.get('codes', [])
        added = []
        
        # Mock classifier dictionary
        classifier_map = {
            'USD': {'name': 'US Dollar', 'symbol': '$'},
            'EUR': {'name': 'Euro', 'symbol': '€'},
            'CNY': {'name': 'Chinese Yuan', 'symbol': '¥'},
            'RUB': {'name': 'Russian Ruble', 'symbol': '₽'},
            'UZS': {'name': 'Uzbek Sum', 'symbol': 'лв'},
            'GBP': {'name': 'British Pound', 'symbol': '£'},
            'KZT': {'name': 'Kazakhstani Tenge', 'symbol': '₸'},
        }

        for code in codes:
            if code in classifier_map:
                data = classifier_map[code]
                currency, created = Currency.objects.get_or_create(
                    code=code,
                    defaults={
                        'name': data['name'],
                        'symbol': data['symbol'],
                        'rate_source': 'CBR'  # Default to internet for major currencies
                    }
                )
                if created:
                    added.append(code)
        
        return Response({'added': added, 'count': len(added)})

    @action(detail=False, methods=['post'])
    def update_rates(self, request):
        """
        Download rates from 'Internet' (Mock).
        Updates all currencies with rate_source='CBR'.
        """
        import random
        from datetime import date
        from decimal import Decimal
        
        updated_count = 0
        currencies = Currency.objects.filter(rate_source='CBR')
        today = date.today()
        
        # Mock rates relative to base currency (assuming base is not CBR)
        # In a real app, we'd fetch from CBR.ru or CBU.uz
        mock_rates = {
            'USD': Decimal('12500.00'),
            'EUR': Decimal('13500.00'),
            'RUB': Decimal('135.00'),
            'CNY': Decimal('1700.00'),
            'GBP': Decimal('15800.00'),
            'KZT': Decimal('27.00'),
        }

        for currency in currencies:
            # Random fluctuation for demo
            base_rate = mock_rates.get(currency.code, Decimal('1.0'))
            fluctuation = Decimal(random.uniform(0.99, 1.01))
            new_rate = base_rate * fluctuation
            
            # Create or update rate for today
            ExchangeRate.objects.update_or_create(
                tenant=request.user.tenant,
                currency=currency,
                date=today,
                defaults={'rate': new_rate}
            )
            updated_count += 1
            
        return Response({'updated': updated_count})

    @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        """Get rate history for a specific currency."""
        currency = self.get_object()
        rates = ExchangeRate.objects.filter(
            tenant=request.user.tenant,
            currency=currency
        ).order_by('-date')
        
        page = self.paginate_queryset(rates)
        if page is not None:
            serializer = ExchangeRateSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = ExchangeRateSerializer(rates, many=True)
        return Response(serializer.data)


class ExchangeRateViewSet(TenantFilterMixin, viewsets.ModelViewSet):
    """API endpoint for exchange rates."""
    queryset = ExchangeRate.objects.select_related('currency').all()
    serializer_class = ExchangeRateSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['currency', 'date']
    ordering_fields = ['date']
    ordering = ['-date']
    
    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.tenant)


class CounterpartyViewSet(TenantFilterMixin, viewsets.ModelViewSet):
    """API endpoint for counterparties."""
    queryset = Counterparty.objects.prefetch_related('contacts').all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['type']
    search_fields = ['name', 'inn', 'email']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return CounterpartyListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return CounterpartyCreateUpdateSerializer
        return CounterpartyDetailSerializer
    
    @action(detail=True, methods=['get'])
    def balance(self, request, pk=None):
        """Get settlement balance for this counterparty (1C-style drill-down)."""
        from registers.models import SettlementsBalance
        
        counterparty = self.get_object()
        balances = SettlementsBalance.objects.filter(
            tenant=counterparty.tenant,
            counterparty_id=pk
        ).select_related('currency', 'contract')
        
        balance_data = [{
            'contract_id': b.contract_id,
            'contract_number': b.contract.number if b.contract else None,
            'currency': b.currency.code,
            'amount': float(b.amount)
        } for b in balances]
        
        total = sum(b['amount'] for b in balance_data)
        
        return Response({
            'total_balance': total,
            'balances': balance_data
        })
    
    @action(detail=True, methods=['get'])
    def documents(self, request, pk=None):
        """Get related documents for this counterparty (1C-style drill-down)."""
        from documents.models import SalesDocument, PurchaseDocument, PaymentDocument
        
        counterparty = self.get_object()
        doc_type = request.query_params.get('type', 'all')
        
        documents = []
        
        if doc_type in ['all', 'sales']:
            sales = SalesDocument.objects.filter(
                tenant=counterparty.tenant,
                counterparty_id=pk
            ).order_by('-date')[:20]
            documents.extend([{
                'id': d.id, 'type': 'sales', 'number': d.number,
                'date': d.date.isoformat() if d.date else None,
                'total': float(d.total) if hasattr(d, 'total') else None
            } for d in sales])
        
        if doc_type in ['all', 'purchase']:
            purchases = PurchaseDocument.objects.filter(
                tenant=counterparty.tenant,
                counterparty_id=pk
            ).order_by('-date')[:20]
            documents.extend([{
                'id': d.id, 'type': 'purchase', 'number': d.number,
                'date': d.date.isoformat() if d.date else None,
                'total': float(d.total) if hasattr(d, 'total') else None
            } for d in purchases])
        
        if doc_type in ['all', 'payment']:
            payments = PaymentDocument.objects.filter(
                tenant=counterparty.tenant,
                counterparty_id=pk
            ).order_by('-date')[:20]
            documents.extend([{
                'id': d.id, 'type': 'payment', 'number': d.number,
                'date': d.date.isoformat() if d.date else None,
                'amount': float(d.amount) if hasattr(d, 'amount') else None
            } for d in payments])
        
        documents.sort(key=lambda x: x['date'] or '', reverse=True)
        
        return Response({'documents': documents})
    
    @action(detail=True, methods=['get'])
    def preview(self, request, pk=None):
        """Get quick preview for hover (1C-style)."""
        from registers.models import SettlementsBalance
        from documents.models import SalesDocument
        
        counterparty = self.get_object()
        
        # Get total balance
        balance = SettlementsBalance.objects.filter(
            tenant=counterparty.tenant,
            counterparty_id=pk
        ).aggregate(total=Sum('amount'))['total'] or 0
        
        # Get last document
        last_doc = SalesDocument.objects.filter(
            tenant=counterparty.tenant,
            counterparty_id=pk
        ).order_by('-date').first()
        
        return Response({
            'id': counterparty.id,
            'type': 'counterparty',
            'name': counterparty.name,
            'summary': {
                'balance': float(balance),
                'last_document': last_doc.number if last_doc else None,
                'last_document_date': last_doc.date.isoformat() if last_doc and last_doc.date else None
            }
        })


class ContractViewSet(TenantFilterMixin, viewsets.ModelViewSet):
    """API endpoint for contracts."""
    queryset = Contract.objects.select_related('counterparty', 'currency').all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['counterparty', 'contract_type', 'is_active']
    search_fields = ['number']
    ordering_fields = ['date', 'number']
    ordering = ['-date']
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return ContractCreateUpdateSerializer
        return ContractSerializer


class WarehouseViewSet(TenantFilterMixin, viewsets.ModelViewSet):
    """API endpoint for warehouses."""
    queryset = Warehouse.objects.all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['warehouse_type', 'is_active']
    search_fields = ['name']
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return WarehouseCreateUpdateSerializer
        return WarehouseSerializer
    
    @action(detail=True, methods=['get'])
    def balances(self, request, pk=None):
        """Get stock balances in this warehouse (1C-style drill-down)."""
        from registers.models import StockBalance
        
        warehouse = self.get_object()
        balances = StockBalance.objects.filter(
            tenant=warehouse.tenant,
            warehouse_id=pk,
            quantity__gt=0
        ).select_related('item')
        
        balances_data = [{
            'item_id': b.item_id,
            'item_name': b.item.name,
            'item_sku': b.item.sku,
            'quantity': float(b.quantity),
            'amount': float(b.amount)
        } for b in balances]
        
        return Response({'balances': balances_data})
    
    @action(detail=True, methods=['get'])
    def preview(self, request, pk=None):
        """Get quick preview for hover (1C-style)."""
        from registers.models import StockBalance
        
        warehouse = self.get_object()
        total_value = StockBalance.objects.filter(
            tenant=warehouse.tenant,
            warehouse_id=pk
        ).aggregate(total=Sum('amount'))['total'] or 0
        
        return Response({
            'id': warehouse.id,
            'type': 'warehouse',
            'name': warehouse.name,
            'summary': {
                'total_value': float(total_value)
            }
        })


class ItemViewSet(TenantFilterMixin, viewsets.ModelViewSet):
    """API endpoint for items (products/services)."""
    queryset = Item.objects.all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['item_type']
    search_fields = ['name', 'sku']
    ordering_fields = ['name', 'sku']
    ordering = ['name']
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return ItemCreateUpdateSerializer
        return ItemSerializer
    
    def create(self, request, *args, **kwargs):
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Item create request data: {request.data}")
        try:
            return super().create(request, *args, **kwargs)
        except Exception as e:
            logger.error(f"Item create error: {e}, type: {type(e)}")
            if hasattr(e, 'detail'):
                logger.error(f"Error detail: {e.detail}")
            raise
    
    @action(detail=True, methods=['get'])
    def balances(self, request, pk=None):
        """Get current stock balances by warehouse (1C-style drill-down)."""
        from registers.models import StockBalance
        
        item = self.get_object()
        balances = StockBalance.objects.filter(
            tenant=item.tenant,
            item_id=pk,
            quantity__gt=0
        ).select_related('warehouse')
        
        balances_data = [{
            'warehouse_id': b.warehouse_id,
            'warehouse_name': b.warehouse.name,
            'quantity': float(b.quantity),
            'amount': float(b.amount)
        } for b in balances]
        
        return Response({'balances': balances_data})

    @action(detail=False, methods=['post'])
    def create_sample(self, request):
        """Create sample items for current tenant so you can see them in Sales/Purchases."""
        tenant = getattr(request.user, 'tenant', None)
        if not tenant:
            return Response(
                {'error': 'User has no tenant.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        from directories.models import ItemCategory
        created = []
        cat, _ = ItemCategory.objects.get_or_create(
            tenant=tenant, name='Goods', defaults={'code': 'GOODS', 'parent': None}
        )
        cat_svc, _ = ItemCategory.objects.get_or_create(
            tenant=tenant, name='Services', defaults={'code': 'SRV', 'parent': None}
        )
        samples = [
            ('ITEM-001', 'Sample Product A', 'GOODS', cat, 10, 15),
            ('ITEM-002', 'Sample Product B', 'GOODS', cat, 25, 35),
            ('ITEM-003', 'Office Supplies', 'GOODS', cat, 5, 8),
            ('SVC-001', 'Delivery Service', 'SERVICE', cat_svc, 0, 20),
        ]
        for sku, name, item_type, category, purchase, selling in samples:
            obj, is_new = Item.objects.get_or_create(
                tenant=tenant, sku=sku,
                defaults={
                    'name': name, 'item_type': item_type, 'category': category,
                    'unit': 'pcs', 'purchase_price': purchase, 'selling_price': selling,
                }
            )
            if is_new:
                created.append({'id': obj.id, 'name': obj.name, 'sku': obj.sku})
        return Response({
            'created': created,
            'message': f'Created {len(created)} sample items. You can now select them in Sales and Purchases.',
        })
    
    @action(detail=True, methods=['get'])
    def documents(self, request, pk=None):
        """Get related documents (1C-style drill-down)."""
        from documents.models import SalesDocument, PurchaseDocument
        
        item = self.get_object()
        
        # Get sales with this item
        sales = SalesDocument.objects.filter(
            tenant=item.tenant,
            lines__item_id=pk
        ).distinct().order_by('-date')[:20]
        
        # Get purchases with this item
        purchases = PurchaseDocument.objects.filter(
            tenant=item.tenant,
            lines__item_id=pk
        ).distinct().order_by('-date')[:20]
        
        documents = []
        for doc in sales:
            documents.append({
                'id': doc.id,
                'type': 'sales',
                'number': doc.number,
                'date': doc.date.isoformat() if doc.date else None,
                'total': float(doc.total_amount) if hasattr(doc, 'total_amount') else None
            })
        for doc in purchases:
            documents.append({
                'id': doc.id,
                'type': 'purchase',
                'number': doc.number,
                'date': doc.date.isoformat() if doc.date else None,
                'total': float(doc.total_amount) if hasattr(doc, 'total_amount') else None
            })
        
        # Sort by date
        documents.sort(key=lambda x: x['date'] or '', reverse=True)
        
        return Response({'documents': documents})
    
    @action(detail=True, methods=['get'])
    def preview(self, request, pk=None):
        """Get quick preview for hover (1C-style)."""
        from registers.models import StockBalance
        
        item = self.get_object()
        total_stock = StockBalance.objects.filter(
            tenant=item.tenant,
            item_id=pk
        ).aggregate(total=Sum('quantity'))['total'] or 0
        
        return Response({
            'id': item.id,
            'type': 'item',
            'name': item.name,
            'summary': {
                'sku': item.sku,
                'stock': float(total_stock),
                'sale_price': float(item.sale_price) if item.sale_price else None
            }
        })
    
    @action(detail=True, methods=['get'])
    def batches(self, request, pk=None):
        """Get FIFO batch list for this item (1C-style drill-down)."""
        from registers.models import StockBatch
        
        item = self.get_object()
        batches = StockBatch.objects.filter(
            tenant=item.tenant,
            item_id=pk,
            qty_remaining__gt=0
        ).select_related('warehouse').order_by('incoming_date')
        
        batches_data = [{
            'id': b.id,
            'batch_number': f'BATCH-{b.id}',
            'warehouse_id': b.warehouse_id,
            'warehouse_name': b.warehouse.name,
            'date': b.incoming_date.isoformat() if b.incoming_date else None,
            'quantity': float(b.qty_remaining),
            'cost_per_unit': float(b.unit_cost)
        } for b in batches]
        
        return Response({'batches': batches_data})


class BankAccountViewSet(TenantFilterMixin, viewsets.ModelViewSet):
    """API endpoint for bank accounts."""
    queryset = BankAccount.objects.select_related('currency', 'accounting_account').all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['currency', 'is_active']
    search_fields = ['name', 'bank_name', 'account_number']
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return BankAccountCreateUpdateSerializer
        return BankAccountSerializer


class BankOperationTypeViewSet(TenantFilterMixin, viewsets.ModelViewSet):
    """API endpoint for bank operation semantics."""
    queryset = BankOperationType.objects.select_related('debit_account', 'credit_account').all()
    permission_classes = [IsAuthenticated]
    serializer_class = BankOperationTypeSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['is_active', 'requires_counterparty', 'requires_contract', 'requires_tax']
    search_fields = ['code', 'name']


class BankExchangeSettingsViewSet(TenantFilterMixin, viewsets.ModelViewSet):
    """API endpoint for bank exchange settings."""
    queryset = BankExchangeSettings.objects.select_related('bank_account').all()
    permission_classes = [IsAuthenticated]
    serializer_class = BankExchangeSettingsSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['exchange_format', 'encoding', 'auto_create_counterparties']
    search_fields = ['bank_program_name', 'bank_account__name', 'bank_account__account_number']


class EmployeeViewSet(TenantFilterMixin, viewsets.ModelViewSet):
    """API endpoint for employees."""
    queryset = Employee.objects.all()
    permission_classes = [IsAuthenticated]
    serializer_class = EmployeeSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['first_name', 'last_name', 'inn', 'email']
    ordering_fields = ['last_name', 'hiring_date']
    ordering = ['last_name', 'first_name']

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.tenant)


class DepartmentViewSet(TenantFilterMixin, viewsets.ModelViewSet):
    """API endpoint for departments (cost centers)."""
    queryset = Department.objects.all()
    permission_classes = [IsAuthenticated]
    serializer_class = DepartmentSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    search_fields = ['name', 'code']
    ordering = ['name']

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.tenant)


class ProjectViewSet(TenantFilterMixin, viewsets.ModelViewSet):
    """API endpoint for projects (P&L centers)."""
    queryset = Project.objects.all()
    permission_classes = [IsAuthenticated]
    serializer_class = ProjectSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    search_fields = ['name', 'code']
    ordering = ['-created_at']

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.tenant)
