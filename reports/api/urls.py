"""
URL configuration for reports drill-down API.
"""
from django.urls import path
from .drilldown import ReportDrillDownView

urlpatterns = [
    path('<str:report_type>/drilldown/', ReportDrillDownView.as_view(), name='report-drilldown'),
]
