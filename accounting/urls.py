from django.urls import path
from . import views
from .financial_reports import (
    BalanceSheetView, ProfitLossView, AccountLedgerView,
    BalanceSheetPDFView, BalanceSheetExcelView, 
    ProfitLossPDFView, ProfitLossExcelView
)

app_name = 'accounting'

urlpatterns = [
    # Accounts
    path('accounts/', views.AccountListView.as_view(), name='account_list'),
    path('accounts/add/', views.AccountCreateView.as_view(), name='account_add'),
    
    # Entries
    path('entries/', views.EntryListView.as_view(), name='entry_list'),
    path('entries/add/', views.ManualEntryCreateView.as_view(), name='entry_add'),
    
    # Period closing
    path('period-closing/', views.PeriodClosingView.as_view(), name='period_closing'),
    
    # Financial Reports
    path('reports/balance-sheet/', BalanceSheetView.as_view(), name='balance_sheet'),
    path('reports/profit-loss/', ProfitLossView.as_view(), name='profit_loss'),
    path('account/<int:account_id>/ledger/', AccountLedgerView.as_view(), name='account_ledger'),
    
    # Export URLs
    path('reports/balance-sheet/pdf/', BalanceSheetPDFView.as_view(), name='balance_sheet_pdf'),
    path('reports/balance-sheet/excel/', BalanceSheetExcelView.as_view(), name='balance_sheet_excel'),
    path('reports/profit-loss/pdf/', ProfitLossPDFView.as_view(), name='profit_loss_pdf'),
    path('reports/profit-loss/excel/', ProfitLossExcelView.as_view(), name='profit_loss_excel'),

    # Other
    path('policy/', views.AccountingPolicyView.as_view(), name='policy'),
    path('reports/', views.ReportListView.as_view(), name='reports'),
    path('reports/tb/', views.TrialBalanceView.as_view(), name='report_tb'),
]
