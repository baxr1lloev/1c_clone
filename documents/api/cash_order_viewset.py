"""
Cash Order ViewSet for API.
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters

from documents.models import CashOrder
from .cash_order_serializers import (
    CashOrderListSerializer,
    CashOrderDetailSerializer,
    CashOrderCreateUpdateSerializer,
)


class TenantFilterMixin:
    """Mixin to filter queryset by tenant."""
    def get_queryset(self):
        qs = super().get_queryset()
        if hasattr(qs.model, 'tenant'):
            return qs.filter(tenant=self.request.user.tenant)
        return qs


class CashOrderViewSet(TenantFilterMixin, viewsets.ModelViewSet):
    """
    ViewSet for Cash Orders (PKO/RKO).
    Provides CRUD operations and post/unpost actions.
    """
    queryset = CashOrder.objects.all().select_related(
        'currency', 'counterparty', 'cash_flow_item', 'debit_account', 'credit_account'
    )
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'order_type', 'date']
    search_fields = ['number', 'counterparty_name', 'purpose']
    ordering_fields = ['date', 'number', 'amount']
    ordering = ['-date', '-id']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return CashOrderListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return CashOrderCreateUpdateSerializer
        return CashOrderDetailSerializer
    
    @action(detail=True, methods=['post'])
    def post_document(self, request, pk=None):
        """Post the cash order (проведение)."""
        cash_order = self.get_object()
        
        try:
            cash_order.post(user=request.user)
            serializer = self.get_serializer(cash_order)
            return Response(serializer.data)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['post'])
    def unpost_document(self, request, pk=None):
        """Unpost the cash order (отмена проведения)."""
        cash_order = self.get_object()
        
        try:
            cash_order.unpost()
            serializer = self.get_serializer(cash_order)
            return Response(serializer.data)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'], url_path='post')
    def post(self, request, pk=None):
        """Alias for post_document (standardized API naming)."""
        return self.post_document(request, pk=pk)

    @action(detail=True, methods=['post'], url_path='unpost')
    def unpost(self, request, pk=None):
        """Alias for unpost_document (standardized API naming)."""
        return self.unpost_document(request, pk=pk)
