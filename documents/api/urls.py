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
)
from .cash_order_viewset import CashOrderViewSet

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

urlpatterns = [
    path('', include(router.urls)),
]
