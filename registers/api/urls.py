"""
API URL configuration for registers app.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .viewsets import (
    StockBalanceViewSet,
    StockMovementViewSet,
    StockBatchViewSet,
    StockReservationViewSet,
    SettlementsBalanceViewSet,
    CounterpartyStockBalanceViewSet,
    GoodsInTransitViewSet,
    ItemPriceViewSet,
)
from .operational_views import (
    StockInfoView,
    SettlementInfoView,
    StockPredictionView,
    SettlementPredictionView,
)

router = DefaultRouter()
router.register(r'stock-balances', StockBalanceViewSet, basename='stock-balance')
router.register(r'stock-movements', StockMovementViewSet, basename='stock-movement')
router.register(r'stock-batches', StockBatchViewSet, basename='stock-batch')
router.register(r'stock-reservations', StockReservationViewSet, basename='stock-reservation')
router.register(r'settlements', SettlementsBalanceViewSet, basename='settlement')
router.register(r'counterparty-stock', CounterpartyStockBalanceViewSet, basename='counterparty-stock')
router.register(r'goods-in-transit', GoodsInTransitViewSet, basename='goods-in-transit')
router.register(r'item-prices', ItemPriceViewSet, basename='item-price')

urlpatterns = [
    path('', include(router.urls)),
    # Operational Accounting (Real-time 1C-style panels)
    path('operational/stock-info/', StockInfoView.as_view(), name='operational-stock-info'),
    path('operational/settlement-info/', SettlementInfoView.as_view(), name='operational-settlement-info'),
    path('operational/stock-predict/', StockPredictionView.as_view(), name='operational-stock-predict'),
    path('operational/settlement-predict/', SettlementPredictionView.as_view(), name='operational-settlement-predict'),
]
