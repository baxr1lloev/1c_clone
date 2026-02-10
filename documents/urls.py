from django.urls import path
from . import views

app_name = 'documents'

urlpatterns = [
    # Sales Documents
    path('sales/', views.SalesDocumentListView.as_view(), name='sales_list'),
    path('sales/add/', views.SalesDocumentCreateView.as_view(), name='sales_add'),
    path('sales/<int:pk>/', views.SalesDocumentDetailView.as_view(), name='sales_detail'),
    path('sales/<int:pk>/edit/', views.SalesDocumentUpdateView.as_view(), name='sales_edit'),
    path('sales/<int:pk>/post/', views.SalesDocumentPostView.as_view(), name='sales_post'),
    path('sales/<int:pk>/unpost/', views.SalesDocumentUnpostView.as_view(), name='sales_unpost'),
    path('sales/line/<int:pk>/delete/', views.SalesDocumentLineDeleteView.as_view(), name='sales_line_delete'),
    
    # Purchases
    path('purchases/', views.PurchaseDocumentListView.as_view(), name='purchase_list'),
    path('purchases/add/', views.PurchaseDocumentCreateView.as_view(), name='purchase_add'),
    path('purchases/<int:pk>/', views.PurchaseDocumentDetailView.as_view(), name='purchase_detail'),
    path('purchases/<int:pk>/edit/', views.PurchaseDocumentUpdateView.as_view(), name='purchase_edit'),
    path('purchases/<int:pk>/post/', views.PurchaseDocumentPostView.as_view(), name='purchase_post'),
    path('purchases/<int:pk>/unpost/', views.PurchaseDocumentUnpostView.as_view(), name='purchase_unpost'),
    path('purchases/line/<int:pk>/delete/', views.PurchaseDocumentLineDeleteView.as_view(), name='purchase_line_delete'),
    
    # Payments
    path('payments/', views.PaymentDocumentListView.as_view(), name='payment_list'),
    path('payments/add/', views.PaymentDocumentCreateView.as_view(), name='payment_add'),
    
    # Transfers (Goods in Transit)
    path('transfers/', views.TransferDocumentListView.as_view(), name='transfer_list'),
    path('transfers/add/', views.TransferDocumentCreateView.as_view(), name='transfer_add'),
    path('transfers/<int:pk>/', views.TransferDocumentDetailView.as_view(), name='transfer_detail'),
    path('transfers/<int:pk>/post/', views.TransferDocumentPostView.as_view(), name='transfer_post'),
    
    # Sales Orders
    path('orders/', views.SalesOrderListView.as_view(), name='sales_order_list'),
    path('orders/add/', views.SalesOrderCreateView.as_view(), name='sales_order_add'),
    path('orders/<int:pk>/', views.SalesOrderDetailView.as_view(), name='sales_order_detail'),
    path('orders/<int:pk>/post/', views.SalesOrderPostView.as_view(), name='sales_order_post'),
    path('orders/<int:pk>/unpost/', views.SalesOrderUnpostView.as_view(), name='sales_order_unpost'),
    path('orders/line/<int:pk>/delete/', views.SalesOrderLineDeleteView.as_view(), name='sales_order_line_delete'),
    
    # Inventory Documents
    path('inventory/', views.InventoryDocumentListView.as_view(), name='inventory_list'),
    path('inventory/add/', views.InventoryDocumentCreateView.as_view(), name='inventory_add'),
    path('inventory/<int:pk>/', views.InventoryDocumentDetailView.as_view(), name='inventory_detail'),
    path('inventory/<int:pk>/post/', views.InventoryDocumentPostView.as_view(), name='inventory_post'),
    
    # API endpoints for frontend
    path('api/availability/', views.get_availability, name='api_availability'),
]
