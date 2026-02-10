from django.views.generic import ListView, CreateView, UpdateView, FormView, TemplateView
from django.contrib.auth.mixins import LoginRequiredMixin
from django.shortcuts import redirect
from django.urls import reverse_lazy
from django.contrib import messages
from django.utils import timezone
from .models import ChartOfAccounts, AccountingEntry, PeriodClosing, AccountingPolicy
from .forms import (
    ChartOfAccountsForm, AccountingEntryForm, PeriodClosingForm, AccountingPolicyForm,
    ProfitLossReportForm, TrialBalanceReportForm
)
from .accounting_service import AccountingService

class TenantAwareMixin:
    def get_queryset(self):
        return super().get_queryset().filter(tenant=self.request.user.tenant)
    def form_valid(self, form):
        form.instance.tenant = self.request.user.tenant
        return super().form_valid(form)

# --- Chart of Accounts ---
class AccountListView(LoginRequiredMixin, TenantAwareMixin, ListView):
    model = ChartOfAccounts
    template_name = 'accounting/account_list.html'
    context_object_name = 'accounts'
    ordering = ['code']

class AccountCreateView(LoginRequiredMixin, TenantAwareMixin, CreateView):
    model = ChartOfAccounts
    form_class = ChartOfAccountsForm
    template_name = 'directories/form.html'
    extra_context = {'title': 'New Account'}
    success_url = reverse_lazy('accounting:account_list')

class AccountingPolicyView(LoginRequiredMixin, UpdateView):
    model = AccountingPolicy
    form_class = AccountingPolicyForm
    template_name = 'directories/form.html'
    success_url = reverse_lazy('accounting:policy')
    extra_context = {'title': 'Accounting Policy'}
    
    def get_object(self, queryset=None):
        if not self.request.user.tenant:
            from django.http import Http404
            raise Http404("User is not assigned to a tenant.")
            
        # Get or create policy for tenant
        obj, created = AccountingPolicy.objects.get_or_create(
            tenant=self.request.user.tenant,
            defaults={
                'effective_from': timezone.now().date(),
                'stock_valuation_method': 'FIFO'
            }
        )
        return obj

    def form_valid(self, form):
        form.instance.tenant = self.request.user.tenant
        messages.success(self.request, "Accounting Policy saved.")
        return super().form_valid(form)


# --- Journal Entries ---
class EntryListView(LoginRequiredMixin, TenantAwareMixin, ListView):
    model = AccountingEntry
    template_name = 'accounting/entry_list.html'
    context_object_name = 'entries'
    ordering = ['-date', '-id']
    paginate_by = 50

class ManualEntryCreateView(LoginRequiredMixin, TenantAwareMixin, CreateView):
    model = AccountingEntry
    form_class = AccountingEntryForm
    template_name = 'directories/form.html'
    extra_context = {'title': 'Manual Journal Entry'}
    success_url = reverse_lazy('accounting:entry_list')
    
    def form_valid(self, form):
        # ManualEntryForm logic might need specific handling if it's creating double entries directly
        # But typically manual entry is one row? Or a balanced set?
        # The form ManualEntryForm is a ModelForm for AccountingEntry (single row).
        # In real 1C/accounting, manual interface usually creates a "Operation" with multiple rows.
        # But for now, adhering to the form I created (ModelForm).
        return super().form_valid(form)

# --- Period Closing ---
class PeriodClosingView(LoginRequiredMixin, FormView):
    template_name = 'accounting/period_closing.html'
    form_class = PeriodClosingForm
    success_url = reverse_lazy('accounting:period_closing')
    
    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs['tenant'] = self.request.user.tenant
        return kwargs
    
    def form_valid(self, form):
        try:
            form.save()
            messages.success(self.request, "Period status updated.")
        except Exception as e:
            messages.error(self.request, str(e))
        return super().form_valid(form)

# --- Reports ---
class ReportListView(LoginRequiredMixin, TemplateView):
    template_name = 'accounting/reports.html'

class ProfitLossView(LoginRequiredMixin, FormView):
    template_name = 'accounting/report_pl.html'
    form_class = ProfitLossReportForm
    
    def form_valid(self, form):
        # Generate report data
        data = form.get_report_data() # Assuming form has helper
        return self.render_to_response(self.get_context_data(form=form, report_data=data))

class TrialBalanceView(LoginRequiredMixin, FormView):
    template_name = 'accounting/report_tb.html'
    form_class = TrialBalanceReportForm
    
    def form_valid(self, form):
        data = form.get_report_data()
        return self.render_to_response(self.get_context_data(form=form, report_data=data))
