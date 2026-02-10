from django.urls import path
from . import views

app_name = 'directories'

urlpatterns = [
    # Counterparties
    path('counterparties/', views.CounterpartyListView.as_view(), name='counterparty_list'),
    path('counterparties/add/', views.CounterpartyCreateView.as_view(), name='counterparty_add'),
    path('counterparties/<int:pk>/edit/', views.CounterpartyUpdateView.as_view(), name='counterparty_edit'),
    
    # Items
    path('items/', views.ItemListView.as_view(), name='item_list'),
    path('items/add/', views.ItemCreateView.as_view(), name='item_add'),
    path('items/<int:pk>/edit/', views.ItemUpdateView.as_view(), name='item_edit'),
    
    # Warehouses
    path('warehouses/', views.WarehouseListView.as_view(), name='warehouse_list'),
    path('warehouses/add/', views.WarehouseCreateView.as_view(), name='warehouse_add'),
    
    # Contracts
    path('contracts/', views.ContractListView.as_view(), name='contract_list'),
    path('contracts/add/', views.ContractCreateView.as_view(), name='contract_add'),
    path('contracts/<int:pk>/edit/', views.ContractUpdateView.as_view(), name='contract_edit'),

    # Rates
    path('exchange_rates/', views.ExchangeRateListView.as_view(), name='exchange_rate_list'),
    path('exchange_rates/add/', views.ExchangeRateCreateView.as_view(), name='exchange_rate_add'),
]
