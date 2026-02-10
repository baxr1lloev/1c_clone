from django.views.generic import TemplateView
from django.contrib.auth.mixins import LoginRequiredMixin
from django.utils import timezone
from datetime import timedelta

from tenants.permissions import PermissionRequiredMixin
from .cash_flow_service import CashFlowService


class CashFlowStatementView(LoginRequiredMixin, PermissionRequiredMixin, TemplateView):
    """Cash Flow Statement - where money came from and where it went."""
    template_name = 'reports/cash_flow_statement.html'
    permission_required = 'accounting.view_reports'
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        
        # Get date range from request or default to current month
        end_date_str = self.request.GET.get('end_date')
        start_date_str = self.request.GET.get('start_date')
        
        if end_date_str:
            end_date = timezone.datetime.strptime(end_date_str, '%Y-%m-%d').date()
        else:
            end_date = timezone.now().date()
        
        if start_date_str:
            start_date = timezone.datetime.strptime(start_date_str, '%Y-%m-%d').date()
        else:
            # Default to beginning of current month
            start_date = end_date.replace(day=1)
        
        # Get cash flow data
        cash_flow = CashFlowService.get_cash_flow_statement(
            self.request.user.tenant,
            start_date,
            end_date
        )
        
        context['cash_flow'] = cash_flow
        context['start_date'] = start_date
        context['end_date'] = end_date
        
        return context


class CashPositionView(LoginRequiredMixin, PermissionRequiredMixin, TemplateView):
    """Cash Position - current balance by cash/bank account."""
    template_name = 'reports/cash_position.html'
    permission_required = 'accounting.view_reports'
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        
        # Get as_of_date from request or default to today
        as_of_date_str = self.request.GET.get('as_of_date')
        if as_of_date_str:
            as_of_date = timezone.datetime.strptime(as_of_date_str, '%Y-%m-%d').date()
        else:
            as_of_date = timezone.now().date()
        
        # Get cash position
        cash_position = CashFlowService.get_cash_position(
            self.request.user.tenant,
            as_of_date
        )
        
        context['cash_position'] = cash_position
        context['as_of_date'] = as_of_date
        
        return context


class ReceivablesAgingView(LoginRequiredMixin, PermissionRequiredMixin, TemplateView):
    """Receivables Aging - who owes us money."""
    template_name = 'reports/receivables_aging.html'
    permission_required = 'accounting.view_reports'
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        
        # Get as_of_date from request or default to today
        as_of_date_str = self.request.GET.get('as_of_date')
        if as_of_date_str:
            as_of_date = timezone.datetime.strptime(as_of_date_str, '%Y-%m-%d').date()
        else:
            as_of_date = timezone.now().date()
        
        # Get receivables aging
        receivables = CashFlowService.get_receivables_aging(
            self.request.user.tenant,
            as_of_date
        )
        
        context['receivables'] = receivables
        context['as_of_date'] = as_of_date
        
        return context


class PayablesAgingView(LoginRequiredMixin, PermissionRequiredMixin, TemplateView):
    """Payables Aging - who we owe money."""
    template_name = 'reports/payables_aging.html'
    permission_required = 'accounting.view_reports'
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        
        # Get as_of_date from request or default to today
        as_of_date_str = self.request.GET.get('as_of_date')
        if as_of_date_str:
            as_of_date = timezone.datetime.strptime(as_of_date_str, '%Y-%m-%d').date()
        else:
            as_of_date = timezone.now().date()
        
        # Get payables aging
        payables = CashFlowService.get_payables_aging(
            self.request.user.tenant,
            as_of_date
        )
        
        context['payables'] = payables
        context['as_of_date'] = as_of_date
        
        return context
