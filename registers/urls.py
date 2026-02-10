from django.urls import path
from . import views

app_name = 'registers'

urlpatterns = [
    path('reports/', views.ReportsDashboardView.as_view(), name='dashboard'),
    path('reports/stock/', views.StockReportView.as_view(), name='report_stock'),
    path('reports/batches/', views.BatchTurnoverReportView.as_view(), name='report_batches'),
    path('reports/availability/', views.StockAvailabilityReportView.as_view(), name='report_availability'),
    path('reports/valuation/', views.InventoryValuationReportView.as_view(), name='report_valuation'),
    path('reports/movements/', views.StockMovementReportView.as_view(), name='report_movements'),
    path('reports/settlements/', views.SettlementsReportView.as_view(), name='report_settlements'),
]
