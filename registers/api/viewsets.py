"""
API ViewSets for registers app.
All registers are READ-ONLY as they are derived from document postings.
"""
from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Sum, Avg, Count, F

from registers.models import (
    StockBalance, StockMovement, StockBatch, StockReservation,
    SettlementsBalance, CounterpartyStockBalance, GoodsInTransit,
    ItemPrice
)

from .serializers import (
    StockBalanceSerializer,
    StockMovementSerializer,
    StockBatchSerializer,
    StockReservationSerializer,
    SettlementsBalanceSerializer,
    CounterpartyStockBalanceSerializer,
    GoodsInTransitSerializer,
    ItemPriceSerializer,
)


class TenantFilterMixin:
    """Mixin to filter queryset by tenant."""
    def get_queryset(self):
        qs = super().get_queryset()
        if hasattr(qs.model, 'tenant'):
            return qs.filter(tenant=self.request.user.tenant)
        return qs


class StockBalanceViewSet(TenantFilterMixin, viewsets.ReadOnlyModelViewSet):
    """
    API endpoint for stock balances (current inventory levels).
    READ-ONLY: Balances are calculated from StockMovement.
    """
    queryset = StockBalance.objects.select_related('warehouse', 'item').all()
    serializer_class = StockBalanceSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['warehouse', 'item']
    search_fields = ['item__name', 'item__sku']
    ordering_fields = ['quantity', 'last_updated']
    ordering = ['-last_updated']


class StockMovementViewSet(TenantFilterMixin, viewsets.ReadOnlyModelViewSet):
    """
    API endpoint for stock movements (transaction history).
    READ-ONLY: Movements are created by document posting.
    """
    queryset = StockMovement.objects.select_related('warehouse', 'item', 'content_type').all()
    serializer_class = StockMovementSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['warehouse', 'item', 'type', 'is_reversal']
    ordering_fields = ['date', 'created_at']
    ordering = ['-date']


class StockBatchViewSet(TenantFilterMixin, viewsets.ReadOnlyModelViewSet):
    """
    API endpoint for stock batches (lot tracking for FIFO).
    READ-ONLY: Batches are created by purchase posting.
    
    Custom actions:
    - /batches/valuation/ - Get inventory valuation summary
    - /batches/expiring_soon/ - Get batches expiring within 7 days
    """
    queryset = StockBatch.objects.select_related('warehouse', 'item').all()
    serializer_class = StockBatchSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
    filterset_fields = ['warehouse', 'item']
    search_fields = ['item__name', 'item__sku']
    ordering = ['incoming_date']  # FIFO order
    
    def get_queryset(self):
        qs = super().get_queryset()
        
        # Only show batches with remaining quantity by default
        show_all = self.request.query_params.get('show_all', 'false')
        if show_all.lower() != 'true':
            qs = qs.filter(qty_remaining__gt=0)
        
        return qs
    
    @action(detail=False, methods=['get'])
    def valuation(self, request):
        """
        Get inventory valuation summary
        
        Query params:
        - warehouse: Filter by warehouse ID
        - item: Filter by item ID
        
        Returns:
        {
            "total_quantity": 1500,
            "total_value": 15000000,
            "average_cost": 10000,
            "batches_count": 25
        }
        """
        from rest_framework.decorators import action
        from rest_framework.response import Response
        from django.db.models import Sum, Avg, Count
        from decimal import Decimal
        
        qs = self.get_queryset().filter(qty_remaining__gt=0)
        
        # Apply filters
        warehouse_id = request.query_params.get('warehouse')
        if warehouse_id:
            qs = qs.filter(warehouse_id=warehouse_id)
        
        item_id = request.query_params.get('item')
        if item_id:
            qs = qs.filter(item_id=item_id)
        
        # Calculate aggregates
        aggregates = qs.aggregate(
            total_quantity=Sum('qty_remaining'),
            total_value=Sum(F('qty_remaining') * F('unit_cost')),
            average_cost=Avg('unit_cost'),
            batches_count=Count('id')
        )
        
        return Response({
            'total_quantity': aggregates['total_quantity'] or Decimal('0'),
            'total_value': aggregates['total_value'] or Decimal('0'),
            'average_cost': aggregates['average_cost'] or Decimal('0'),
            'batches_count': aggregates['batches_count'] or 0
        })
    
    @action(detail=False, methods=['get'])
    def expiring_soon(self, request):
        """
        Get batches expiring within the next 7 days
        
        Note: Requires expiry_date field to be added to StockBatch model
        Currently returns empty list as placeholder
        """
        from datetime import date, timedelta
        
        warning_date = date.today() + timedelta(days=7)
        
        # Placeholder - will work when expiry_date field is added
        batches = self.get_queryset().filter(
            qty_remaining__gt=0
        ).order_by('incoming_date')[:50]
        
        serializer = self.get_serializer(batches, many=True)
        return Response(serializer.data)


class StockReservationViewSet(TenantFilterMixin, viewsets.ReadOnlyModelViewSet):
    """
    API endpoint for stock reservations.
    READ-ONLY: Reservations are created by order posting.
    """
    queryset = StockReservation.objects.select_related('warehouse', 'item', 'document_type').all()
    serializer_class = StockReservationSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['warehouse', 'item']
    ordering = ['-created_at']


class SettlementsBalanceViewSet(TenantFilterMixin, viewsets.ReadOnlyModelViewSet):
    """
    API endpoint for settlements balances (receivables/payables).
    READ-ONLY: Balances are updated by document posting.
    """
    queryset = SettlementsBalance.objects.select_related('counterparty', 'contract', 'currency').all()
    serializer_class = SettlementsBalanceSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['counterparty', 'contract', 'currency']
    search_fields = ['counterparty__name']
    ordering = ['-last_updated']


class CounterpartyStockBalanceViewSet(TenantFilterMixin, viewsets.ReadOnlyModelViewSet):
    """
    API endpoint for counterparty stock balances (goods at agents).
    READ-ONLY.
    """
    queryset = CounterpartyStockBalance.objects.select_related('counterparty', 'item').all()
    serializer_class = CounterpartyStockBalanceSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['counterparty', 'item']
    ordering = ['-last_updated']


class GoodsInTransitViewSet(TenantFilterMixin, viewsets.ReadOnlyModelViewSet):
    """
    API endpoint for goods in transit.
    READ-ONLY.
    """
    queryset = GoodsInTransit.objects.select_related('supplier', 'destination_warehouse', 'item').all()
    serializer_class = GoodsInTransitSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['status', 'risk_status', 'supplier', 'destination_warehouse']
    ordering_fields = ['expected_date', 'shipped_date']
    ordering = ['expected_date']

class ItemPriceViewSet(TenantFilterMixin, viewsets.ModelViewSet):
    """
    API endpoint for item prices (Srez Poslednix register).
    Unlike other registers, this one can be edited directly to set new prices.
    """
    queryset = ItemPrice.objects.select_related('item', 'currency').all()
    serializer_class = ItemPriceSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['item', 'price_type', 'currency']
    ordering_fields = ['date', 'created_at']
    ordering = ['-date']

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.tenant)
