from django.urls import path
from . import views

app_name = 'billing'

urlpatterns = [
    path('invoices/', views.InvoiceListView.as_view(), name='invoice_list'),
    path('invoices/<int:pk>/pay/', views.PayInvoiceView.as_view(), name='pay_invoice'),
]
