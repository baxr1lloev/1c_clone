from django.views.generic import TemplateView
from django.contrib.auth.mixins import LoginRequiredMixin
from django.utils import timezone
from django.db.models import Sum, Count, Q
from reports.services import FinancialReportService
from tenants.models import Tenant
from accounting.models import ChartOfAccounts, AccountingEntry, PeriodClosing
from documents.models import SalesDocument, PurchaseDocument
from registers.models import SettlementsBalance  # Fixed: was SettlementsRegister
from taxes.models import TaxReport

class DashboardView(LoginRequiredMixin, TemplateView):
    template_name = 'dashboard.html'
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        
        if not hasattr(self.request.user, 'tenant') or not self.request.user.tenant:
            return context
        
        tenant = self.request.user.tenant
        today = timezone.now().date()
        
        # 1. Cash/Bank Balance
        cash_balance = self._get_cash_bank_balance(tenant, today)
        
        # 2. Receivables (Customer owes us)
        receivables_balance = SettlementsBalance.objects.filter(
            tenant=tenant,
            counterparty__type__in=['CUSTOMER', 'AGENT'],
            amount__gt=0  # Positive = they owe us
        ).aggregate(total=Sum('amount'))['total'] or 0
        
        # 3. Payables (We owe supplier)
        payables_balance = SettlementsBalance.objects.filter(
            tenant=tenant,
            counterparty__type__in=['SUPPLIER', 'AGENT'],
            amount__lt=0  # Negative = we owe them
        ).aggregate(total=Sum('amount'))['total'] or 0
        
        # 4. Sales Today
        sales_today = SalesDocument.objects.filter(
            tenant=tenant,
            date__date=today,
            status='posted'
        ).aggregate(total=Sum('total_amount_base'))['total'] or 0
        
        # 5. Sales MTD (Month-to-Date)
        month_start = today.replace(day=1)
        sales_mtd = SalesDocument.objects.filter(
            tenant=tenant,
            date__gte=month_start,
            date__lte=today,
            status='posted'
        ).aggregate(total=Sum('total_amount_base'))['total'] or 0
        
        # 6. Profit MTD
        profit_mtd = self._calculate_profit(tenant, month_start, today)
        
        # 7. Period Status
        current_period = PeriodClosing.objects.filter(
            tenant=tenant,
            period=month_start
        ).first()
        
        # 8. Tax Reports Status
        tax_reports_summary = TaxReport.objects.filter(
            tenant=tenant
        ).values('status').annotate(count=Count('id'))
        
        # 9. Recent Activity (last 5 documents)
        recent_sales = SalesDocument.objects.filter(
            tenant=tenant
        ).order_by('-date')[:5]
        
        recent_purchases = PurchaseDocument.objects.filter(
            tenant=tenant
        ).order_by('-date')[:5]
        
        context.update({
            'cash_balance': cash_balance,
            'receivables': max(receivables_balance, 0),  # Only positive = they owe us
            'payables': abs(min(payables_balance, 0)),   # Only negative = we owe them
            'sales_today': sales_today,
            'sales_mtd': sales_mtd,
            'profit_mtd': profit_mtd,
            'current_period': current_period,
            'tax_reports_summary': tax_reports_summary,
            'recent_sales': recent_sales,
            'recent_purchases': recent_purchases,
        })
        
        return context
    
    def _get_cash_bank_balance(self, tenant, as_of_date):
        """Calculate balance for cash/bank accounts (10.x)."""
        cash_accounts = ChartOfAccounts.objects.filter(
            tenant=tenant,
            code__startswith='10'
        )
        
        account_ids = list(cash_accounts.values_list('id', flat=True))
        
        if not account_ids:
            return 0
        
        debits = AccountingEntry.objects.filter(
            tenant=tenant,
            debit_account_id__in=account_ids,
            date__lte=as_of_date
        ).aggregate(Sum('amount'))['amount__sum'] or 0
        
        credits = AccountingEntry.objects.filter(
            tenant=tenant,
            credit_account_id__in=account_ids,
            date__lte=as_of_date
        ).aggregate(Sum('amount'))['amount__sum'] or 0
        
        return debits - credits
    
    def _calculate_profit(self, tenant, date_from, date_to):
        """Calculate profit for period (Revenue - Expenses)."""
        revenue = AccountingEntry.objects.filter(
            tenant=tenant,
            credit_account__account_type='REVENUE',
            date__gte=date_from,
            date__lte=date_to
        ).aggregate(Sum('amount'))['amount__sum'] or 0
        
        expenses = AccountingEntry.objects.filter(
            tenant=tenant,
            debit_account__account_type='EXPENSE',
            date__gte=date_from,
            date__lte=date_to
        ).aggregate(Sum('amount'))['amount__sum'] or 0
        
        return revenue - expenses


from django.db.models import Sum
from django.db.models.functions import TruncMonth
from documents.models import SalesDocument, PurchaseDocument
from django.contrib.auth import logout
from django.shortcuts import redirect

def custom_logout(request):
    """Logout view that handles both GET and POST."""
    logout(request)
    return redirect('login')

class MonthlyReportView(LoginRequiredMixin, TemplateView):
    template_name = 'reports/monthly_report.html'
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        if not hasattr(self.request.user, 'tenant') or not self.request.user.tenant:
            return context
            
        tenant = self.request.user.tenant
        
        # Aggregate Sales by Month
        sales = SalesDocument.objects.filter(
            tenant=tenant,
            status='posted'
        ).annotate(
            month=TruncMonth('date')
        ).values('month', 'currency__code').annotate(
            total=Sum('total_amount'),
            total_base=Sum('total_amount_base')
        ).order_by('-month')
        
        # Aggregate Purchases by Month
        purchases = PurchaseDocument.objects.filter(
            tenant=tenant,
            status='posted'
        ).annotate(
            month=TruncMonth('date')
        ).values('month', 'currency__code').annotate(
            total=Sum('total_amount')
        ).order_by('-month')
        
        context['sales_data'] = sales
        context['purchases_data'] = purchases
        return context
