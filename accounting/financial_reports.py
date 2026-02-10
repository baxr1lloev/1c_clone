from django.views.generic import TemplateView, ListView
from django.contrib.auth.mixins import LoginRequiredMixin
from django.utils import timezone
from decimal import Decimal
from django.db.models import Sum

from accounting.models import ChartOfAccounts, AccountingEntry
from tenants.permissions import PermissionRequiredMixin


class FinancialReportService:
    """Service for generating formatted financial reports."""
    
    @staticmethod
    def get_balance_sheet(tenant, as_of_date=None):
        """Generate Balance Sheet as of a specific date."""
        if not as_of_date:
            as_of_date = timezone.now().date()
        
        # Assets
        asset_accounts = ChartOfAccounts.objects.filter(
            tenant=tenant,
            account_type__in=['asset', 'cash', 'bank']
        ).order_by('code')
        
        assets = {}
        total_assets = Decimal('0')
        
        for account in asset_accounts:
            balance_data = AccountingEntry.objects.filter(
                tenant=tenant,
                account=account,
                date__lte=as_of_date
            ).aggregate(
                debit=Sum('debit'),
                credit=Sum('credit')
            )
            
            debit = balance_data['debit'] or Decimal('0')
            credit = balance_data['credit'] or Decimal('0')
            balance = debit - credit
            
            if balance != 0:
                assets[account] = balance
                total_assets += balance
        
        # Liabilities
        liability_accounts = ChartOfAccounts.objects.filter(
            tenant=tenant,
            account_type='liability'
        ).order_by('code')
        
        liabilities = {}
        total_liabilities = Decimal('0')
        
        for account in liability_accounts:
            balance_data = AccountingEntry.objects.filter(
                tenant=tenant,
                account=account,
                date__lte=as_of_date
            ).aggregate(
                debit=Sum('debit'),
                credit=Sum('credit')
            )
            
            debit = balance_data['debit'] or Decimal('0')
            credit = balance_data['credit'] or Decimal('0')
            balance = credit - debit  # Liabilities have credit balance
            
            if balance != 0:
                liabilities[account] = balance
                total_liabilities += balance
        
        # Equity
        equity_accounts = ChartOfAccounts.objects.filter(
            tenant=tenant,
            account_type='equity'
        ).order_by('code')
        
        equity = {}
        total_equity = Decimal('0')
        
        for account in equity_accounts:
            balance_data = AccountingEntry.objects.filter(
                tenant=tenant,
                account=account,
                date__lte=as_of_date
            ).aggregate(
                debit=Sum('debit'),
                credit=Sum('credit')
            )
            
            debit = balance_data['debit'] or Decimal('0')
            credit = balance_data['credit'] or Decimal('0')
            balance = credit - debit  # Equity has credit balance
            
            if balance != 0:
                equity[account] = balance
                total_equity += balance
        
        return {
            'as_of_date': as_of_date,
            'assets': assets,
            'total_assets': total_assets,
            'liabilities': liabilities,
            'total_liabilities': total_liabilities,
            'equity': equity,
            'total_equity': total_equity,
            'balanced': abs(total_assets - (total_liabilities + total_equity)) < Decimal('0.01'),
        }
    
    @staticmethod
    def get_profit_loss(tenant, start_date, end_date):
        """Generate P&L Statement for a period."""
        # Revenue
        revenue_accounts = ChartOfAccounts.objects.filter(
            tenant=tenant,
            account_type='revenue'
        ).order_by('code')
        
        revenue = {}
        total_revenue = Decimal('0')
        
        for account in revenue_accounts:
            balance_data = AccountingEntry.objects.filter(
                tenant=tenant,
                account=account,
                date__gte=start_date,
                date__lte=end_date
            ).aggregate(
                debit=Sum('debit'),
                credit=Sum('credit')
            )
            
            debit = balance_data['debit'] or Decimal('0')
            credit = balance_data['credit'] or Decimal('0')
            balance = credit - debit  # Revenue has credit balance
            
            if balance != 0:
                revenue[account] = balance
                total_revenue += balance
        
        # Expenses
        expense_accounts = ChartOfAccounts.objects.filter(
            tenant=tenant,
            account_type='expense'
        ).order_by('code')
        
        expenses = {}
        total_expenses = Decimal('0')
        
        for account in expense_accounts:
            balance_data = AccountingEntry.objects.filter(
                tenant=tenant,
                account=account,
                date__gte=start_date,
                date__lte=end_date
            ).aggregate(
                debit=Sum('debit'),
                credit=Sum('credit')
            )
            
            debit = balance_data['debit'] or Decimal('0')
            credit = balance_data['credit'] or Decimal('0')
            balance = debit - credit  # Expenses have debit balance
            
            if balance != 0:
                expenses[account] = balance
                total_expenses += balance
        
        net_profit = total_revenue - total_expenses
        
        return {
            'start_date': start_date,
            'end_date': end_date,
            'revenue': revenue,
            'total_revenue': total_revenue,
            'expenses': expenses,
            'total_expenses': total_expenses,
            'net_profit': net_profit,
        }


class BalanceSheetView(LoginRequiredMixin, PermissionRequiredMixin, TemplateView):
    template_name = 'accounting/balance_sheet.html'
    permission_required = 'accounting.view_reports'
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        
        as_of_date_str = self.request.GET.get('as_of_date')
        if as_of_date_str:
            as_of_date = timezone.datetime.strptime(as_of_date_str, '%Y-%m-%d').date()
        else:
            as_of_date = timezone.now().date()
        
        balance_sheet = FinancialReportService.get_balance_sheet(
            self.request.user.tenant,
            as_of_date
        )
        
        context.update(balance_sheet)
        return context


class ProfitLossView(LoginRequiredMixin, PermissionRequiredMixin, TemplateView):
    template_name = 'accounting/profit_loss.html'
    permission_required = 'accounting.view_reports'
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        
        end_date_str = self.request.GET.get('end_date')
        start_date_str = self.request.GET.get('start_date')
        
        if end_date_str:
            end_date = timezone.datetime.strptime(end_date_str, '%Y-%m-% d').date()
        else:
            end_date = timezone.now().date()
        
        if start_date_str:
            start_date = timezone.datetime.strptime(start_date_str, '%Y-%m-%d').date()
        else:
            start_date = end_date.replace(day=1)
        
        profit_loss = FinancialReportService.get_profit_loss(
            self.request.user.tenant,
            start_date,
            end_date
        )
        
        context.update(profit_loss)
        return context


class AccountLedgerView(LoginRequiredMixin, PermissionRequiredMixin, ListView):
    """Account Ledger with running balance."""
    model = AccountingEntry
    template_name = 'accounting/account_ledger.html'
    permission_required = 'accounting.view_ledger'
    context_object_name = 'entries'
    paginate_by = 100
    
    def get_queryset(self):
        account_id = self.kwargs['account_id']
        self.account = ChartOfAccounts.objects.get(
            pk=account_id,
            tenant=self.request.user.tenant
        )
        
        return AccountingEntry.objects.filter(
            tenant=self.request.user.tenant,
            account=self.account
        ).order_by('date', 'id')
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['account'] = self.account
        
        # Calculate running balance
        entries = list(context['entries'])
        running_balance = Decimal('0')
        for entry in entries:
            running_balance += (entry.debit - entry.credit)
            entry.running_balance = running_balance
        
        context['entries'] = entries
        context['final_balance'] = running_balance
        
        return context


# PDF/Excel Export Views
from django.views import View
from reports.export_utils import ReportExporter


class BalanceSheetPDFView(LoginRequiredMixin, PermissionRequiredMixin, View):
    """Export Balance Sheet as PDF."""
    permission_required = 'accounting.view_reports'
    
    def get(self, request):
        as_of_date_str = request.GET.get('as_of_date')
        if as_of_date_str:
            as_of_date = timezone.datetime.strptime(as_of_date_str, '%Y-%m-%d').date()
        else:
            as_of_date = timezone.now().date()
        
        balance_sheet = FinancialReportService.get_balance_sheet(
            request.user.tenant,
            as_of_date
        )
        
        return ReportExporter.export_to_pdf(
            'accounting/balance_sheet_pdf.html',
            balance_sheet,
            f'balance_sheet_{as_of_date}.pdf'
        )


class BalanceSheetExcelView(LoginRequiredMixin, PermissionRequiredMixin, View):
    """Export Balance Sheet as Excel."""
    permission_required = 'accounting.view_reports'
    
    def get(self, request):
        as_of_date_str = request.GET.get('as_of_date')
        if as_of_date_str:
            as_of_date = timezone.datetime.strptime(as_of_date_str, '%Y-%m-%d').date()
        else:
            as_of_date = timezone.now().date()
        
        balance_sheet = FinancialReportService.get_balance_sheet(
            request.user.tenant,
            as_of_date
        )
        
        # Build Excel data structure
        rows = []
        
        # Assets
        rows.append(['ASSETS', ''])
        for account, balance in balance_sheet['assets'].items():
            rows.append([f"  {account.code} {account.name}", float(balance)])
        rows.append(['Total Assets', float(balance_sheet['total_assets'])])
        rows.append(['', ''])
        
        # Liabilities
        rows.append(['LIABILITIES', ''])
        for account, balance in balance_sheet['liabilities'].items():
            rows.append([f"  {account.code} {account.name}", float(balance)])
        rows.append(['Total Liabilities', float(balance_sheet['total_liabilities'])])
        rows.append(['', ''])
        
        # Equity
        rows.append(['EQUITY', ''])
        for account, balance in balance_sheet['equity'].items():
            rows.append([f"  {account.code} {account.name}", float(balance)])
        rows.append(['Total Equity', float(balance_sheet['total_equity'])])
        
        workbook_data = {
            'sheets': [{
                'name': 'Balance Sheet',
                'title': f"Balance Sheet - {as_of_date}",
                'headers': ['Account', 'Balance'],
                'rows': rows
            }]
        }
        
        return ReportExporter.export_to_excel(
            workbook_data,
            f'balance_sheet_{as_of_date}.xlsx'
        )


class ProfitLossPDFView(LoginRequiredMixin, PermissionRequiredMixin, View):
    """Export P&L as PDF."""
    permission_required = 'accounting.view_reports'
    
    def get(self, request):
        end_date_str = request.GET.get('end_date')
        start_date_str = request.GET.get('start_date')
        
        if end_date_str:
            end_date = timezone.datetime.strptime(end_date_str, '%Y-%m-%d').date()
        else:
            end_date = timezone.now().date()
        
        if start_date_str:
            start_date = timezone.datetime.strptime(start_date_str, '%Y-%m-%d').date()
        else:
            start_date = end_date.replace(day=1)
        
        profit_loss = FinancialReportService.get_profit_loss(
            request.user.tenant,
            start_date,
            end_date
        )
        
        return ReportExporter.export_to_pdf(
            'accounting/profit_loss_pdf.html',
            profit_loss,
            f'profit_loss_{start_date}_to_{end_date}.pdf'
        )


class ProfitLossExcelView(LoginRequiredMixin, PermissionRequiredMixin, View):
    """Export P&L as Excel."""
    permission_required = 'accounting.view_reports'
    
    def get(self, request):
        end_date_str = request.GET.get('end_date')
        start_date_str = request.GET.get('start_date')
        
        if end_date_str:
            end_date = timezone.datetime.strptime(end_date_str, '%Y-%m-%d').date()
        else:
            end_date = timezone.now().date()
        
        if start_date_str:
            start_date = timezone.datetime.strptime(start_date_str, '%Y-%m-%d').date()
        else:
            start_date = end_date.replace(day=1)
        
        profit_loss = FinancialReportService.get_profit_loss(
            request.user.tenant,
            start_date,
            end_date
        )
        
        # Build Excel data structure
        rows = []
        
        # Revenue
        rows.append(['REVENUE', ''])
        for account, amount in profit_loss['revenue'].items():
            rows.append([f"  {account.code} {account.name}", float(amount)])
        rows.append(['Total Revenue', float(profit_loss['total_revenue'])])
        rows.append(['', ''])
        
        # Expenses
        rows.append(['EXPENSES', ''])
        for account, amount in profit_loss['expenses'].items():
            rows.append([f"  {account.code} {account.name}", float(amount)])
        rows.append(['Total Expenses', float(profit_loss['total_expenses'])])
        rows.append(['', ''])
        
        # Net Profit
        rows.append(['NET PROFIT/LOSS', float(profit_loss['net_profit'])])
        
        workbook_data = {
            'sheets': [{
                'name': 'P&L',
                'title': f"Profit & Loss - {start_date} to {end_date}",
                'headers': ['Account', 'Amount'],
                'rows': rows
            }]
        }
        
        return ReportExporter.export_to_excel(
            workbook_data,
            f'profit_loss_{start_date}_to_{end_date}.xlsx'
        )
