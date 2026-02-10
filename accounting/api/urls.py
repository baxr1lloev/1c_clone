"""
API URL routing for accounting VAT endpoints.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from accounting.api.viewsets import (
    VATDashboardViewSet,
    ElectronicInvoiceViewSet,
    VATDeclarationViewSet,
    AccountViewSet,
    EntryViewSet,
    GeneralLedgerViewSet,
    PeriodClosingViewSet,
    OperationViewSet,
)

router = DefaultRouter()
router.register(r'dashboard', VATDashboardViewSet, basename='vat-dashboard')
router.register(r'invoices', ElectronicInvoiceViewSet, basename='einvoice')
router.register(r'declarations', VATDeclarationViewSet, basename='vat-declaration')
router.register(r'accounts', AccountViewSet, basename='account')
router.register(r'entries', EntryViewSet, basename='entry')
router.register(r'general-ledger', GeneralLedgerViewSet, basename='general-ledger')
router.register(r'period-closing', PeriodClosingViewSet, basename='period-closing')
router.register(r'operations', OperationViewSet, basename='operation')

urlpatterns = [
    path('', include(router.urls)),
]
