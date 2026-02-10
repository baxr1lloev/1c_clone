from django.urls import path
from . import views

app_name = 'taxes'

urlpatterns = [
    path('reports/', views.TaxReportListView.as_view(), name='report_list'),
    path('reports/new/', views.TaxReportWizardView.as_view(), name='report_wizard'),
    path('reports/<int:pk>/', views.TaxReportDetailView.as_view(), name='report_detail'),
    path('reports/<int:pk>/submit/', views.TaxReportSubmitView.as_view(), name='report_submit'),
    path('reports/line/<int:pk>/update/', views.TaxReportLineUpdateView.as_view(), name='line_update'),
]
