from django.urls import path
from . import views, api_views

app_name = 'reports'

urlpatterns = [
    path('api/trial-balance/', api_views.TrialBalanceAPIView.as_view(), name='api_trial_balance'),

    # Cash Flow Reports
    path('cash-flow/', views.CashFlowStatementView.as_view(), name='cash_flow'),
    path('cash-position/', views.CashPositionView.as_view(), name='cash_position'),
    path('receivables/', views.ReceivablesAgingView.as_view(), name='receivables'),
    path('payables/', views.PayablesAgingView.as_view(), name='payables'),
]
