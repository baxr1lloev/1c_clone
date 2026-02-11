"""
URL configuration for reports drill-down API.
"""
from django.urls import path
from .drilldown import ReportDrillDownView
from .account_card import AccountCardView
from ..api_views import TrialBalanceAPIView

urlpatterns = [
    path('trial-balance/', TrialBalanceAPIView.as_view(), name='api-trial-balance'),
    path('account-card/', AccountCardView.as_view(), name='api-account-card'),
    path('<str:report_type>/drilldown/', ReportDrillDownView.as_view(), name='report-drilldown'),
]
