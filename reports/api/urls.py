"""
URL configuration for reports drill-down API.
"""
from django.urls import path
from .drilldown import ReportDrillDownView
from .account_card import AccountCardView
from .analysis import AccountAnalysisView
from ..api_views import TrialBalanceAPIView, ProfitLossAPIView, AccountCardAPIView
from .advanced_reports import (
    ReconciliationView, # This ReconciliationView is used for 'audit/reconciliation/'
    StockBalanceAsOfDateView,
    SettlementBalanceAsOfDateView,
    StockItemHistoryView,
    SettlementCounterpartyHistoryView,
)
from .cash_flow import CashFlowView
from .cash_book import CashBookView
from .reconciliation_view import ReconciliationView as ReconciliationCheckView # Renamed to avoid conflict
# from .api import reconciliation_view, sequence_view # Removed incorrect import
from .sequence_view import SequenceRestorationView

urlpatterns = [
    # Reports # Added comment
    path('trial-balance/', TrialBalanceAPIView.as_view(), name='trial-balance'), # Modified: name changed
    path('profit-loss/', ProfitLossAPIView.as_view(), name='profit-loss'), # Added: Profit-loss path
    path('account-card-report/', AccountCardAPIView.as_view(), name='account-card-report'),
    path('account-card/', AccountCardView.as_view(), name='api-account-card'),
    path('account-analysis/<int:account_id>/', AccountAnalysisView.as_view(), name='api-account-analysis'),
    path('<str:report_type>/drilldown/', ReportDrillDownView.as_view(), name='report-drilldown'),
    # Level 6: Reconciliation
    path('audit/reconciliation/', ReconciliationView.as_view(), {'report_type': 'reconciliation'}, name='reconciliation_drilldown'),
    
    # Cash Flow
    path('cash-flow/', CashFlowView.as_view(), name='cash_flow'),
    path('cash-book/', CashBookView.as_view(), name='cash_book'),
    # Level 7: Balance as of date
    path('stock-as-of-date/', StockBalanceAsOfDateView.as_view(), name='api-stock-as-of-date'),
    path('settlements-as-of-date/', SettlementBalanceAsOfDateView.as_view(), name='api-settlements-as-of-date'),
    # Level 7: History drill-down
    path('stock-history/', StockItemHistoryView.as_view(), name='api-stock-history'),
    path('settlement-history/', SettlementCounterpartyHistoryView.as_view(), name='api-settlement-history'),
    path('reconciliation/check/', ReconciliationCheckView.as_view(), name='reconciliation-check'),
    path('sequence/restore/', SequenceRestorationView.as_view(), name='sequence-restore'),
]
