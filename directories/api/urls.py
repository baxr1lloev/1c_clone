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
    ItemViewSet,
    ItemCategoryViewSet,
    BankAccountViewSet,
    EmployeeViewSet,
)

router = DefaultRouter()
router.register(r'currencies', CurrencyViewSet, basename='currency')
router.register(r'exchange-rates', ExchangeRateViewSet, basename='exchange-rate')
router.register(r'counterparties', CounterpartyViewSet, basename='counterparty')
router.register(r'contracts', ContractViewSet, basename='contract')
router.register(r'warehouses', WarehouseViewSet, basename='warehouse')
router.register(r'items', ItemViewSet, basename='item')
router.register(r'categories', ItemCategoryViewSet, basename='category')
router.register(r'bank-accounts', BankAccountViewSet, basename='bank-account')
router.register(r'employees', EmployeeViewSet, basename='employee')

urlpatterns = [
    path('', include(router.urls)),
]
