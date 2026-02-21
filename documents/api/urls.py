"""
API URL configuration for documents app.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .viewsets import (
    SalesDocumentViewSet,
    PurchaseDocumentViewSet,
    PaymentDocumentViewSet,
    TransferDocumentViewSet,
    SalesOrderViewSet,
    InventoryDocumentViewSet,
    BankStatementViewSet,
    PayrollDocumentViewSet,
    ProductionDocumentViewSet,
    OpeningBalanceDocumentViewSet,
)
from .cash_order_viewset import CashOrderViewSet
from .item_context import get_item_context
from .validation_views import validate_sales_document, validate_purchase_document
from .bulk_operations import bulk_post_documents, bulk_unpost_documents, bulk_delete_documents
from . import reposting_views  # NEW: Reposting APIs
from . import price_history  # NEW: Price history/drill-down APIs

router = DefaultRouter()
router.register(r'sales', SalesDocumentViewSet, basename='sales')
router.register(r'purchases', PurchaseDocumentViewSet, basename='purchase')
router.register(r'payments', PaymentDocumentViewSet, basename='payment')
router.register(r'transfers', TransferDocumentViewSet, basename='transfer')
router.register(r'sales-orders', SalesOrderViewSet, basename='sales-order')
router.register(r'inventory', InventoryDocumentViewSet, basename='inventory')
router.register(r'bank-statements', BankStatementViewSet, basename='bank-statement')
router.register(r'cash-orders', CashOrderViewSet, basename='cash-order')
router.register(r'payroll', PayrollDocumentViewSet, basename='payroll')
router.register(r'production', ProductionDocumentViewSet, basename='production')
router.register(r'opening-balances', OpeningBalanceDocumentViewSet, basename='opening-balance')

urlpatterns = [
    path('', include(router.urls)),
    # Intelligence features
    path('sales/validate', validate_sales_document, name='validate-sales'),
    path('purchases/validate', validate_purchase_document, name='validate-purchase'),
    # Bulk operations
    path('bulk-post/', bulk_post_documents, name='bulk-post'),
    path('bulk-unpost/', bulk_unpost_documents, name='bulk-unpost'),
    path('bulk-delete/', bulk_delete_documents, name='bulk-delete'),
    
    # Item context API
    path('item-context/<int:item_id>/', get_item_context, name='item-context'),
    
    # ═══════════════════════════════════════════════════════════════════════════
    # ENTERPRISE FEATURES: Reposting, FIFO Rebuild, Determinism Testing
    # ═══════════════════════════════════════════════════════════════════════════
    path('repost-period/', reposting_views.repost_period, name='repost-period'),
    path('rebuild-fifo/', reposting_views.rebuild_fifo, name='rebuild-fifo'),
    path('verify-determinism/', reposting_views.verify_determinism, name='verify-determinism'),
    
    # ═══════════════════════════════════════════════════════════════════════════
    # DRILL-DOWN: Price History & Source Tracking
    # ═══════════════════════════════════════════════════════════════════════════
    path('items/<int:item_id>/price-history/', price_history.item_price_history, name='item-price-history'),
    path('lines/<int:line_id>/price-source/', price_history.line_price_source, name='line-price-source'),
]
