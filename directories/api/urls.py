"""
API URL configuration for directories app.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .viewsets import (
    CurrencyViewSet,
    ExchangeRateViewSet,
    CounterpartyViewSet,
    ContractViewSet,
    WarehouseViewSet,
    ItemViewSet,
    ItemCategoryViewSet,
    BankAccountViewSet,
    BankExchangeSettingsViewSet,
    BankOperationTypeViewSet,
    EmployeeViewSet,
    DepartmentViewSet,
    ProjectViewSet,
)
from documents.api.item_context import get_item_context
from .counterparty_context import get_counterparty_context

router = DefaultRouter()
router.register(r'currencies', CurrencyViewSet, basename='currency')
router.register(r'exchange-rates', ExchangeRateViewSet, basename='exchange-rate')
router.register(r'counterparties', CounterpartyViewSet, basename='counterparty')
router.register(r'contracts', ContractViewSet, basename='contract')
router.register(r'warehouses', WarehouseViewSet, basename='warehouse')
router.register(r'items', ItemViewSet, basename='item')
router.register(r'categories', ItemCategoryViewSet, basename='category')
router.register(r'bank-accounts', BankAccountViewSet, basename='bank-account')
router.register(r'bank-exchange-settings', BankExchangeSettingsViewSet, basename='bank-exchange-settings')
router.register(r'bank-operation-types', BankOperationTypeViewSet, basename='bank-operation-type')
router.register(r'employees', EmployeeViewSet, basename='employee')
router.register(r'departments', DepartmentViewSet, basename='department')
router.register(r'projects', ProjectViewSet, basename='project')

urlpatterns = [
    path('', include(router.urls)),
    # Item intelligence - auto-fill context
    path('items/<int:item_id>/context', get_item_context, name='item-context'),
    # Counterparty context - debt, credit, recent docs
    path('counterparties/<int:counterparty_id>/context', get_counterparty_context, name='counterparty-context'),
]
