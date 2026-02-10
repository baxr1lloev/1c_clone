from django.views.generic import TemplateView, FormView
from django.contrib.auth.mixins import LoginRequiredMixin
from .forms import (
    StockReportForm, BatchTurnoverReportForm, StockAvailabilityReportForm,
    InventoryValuationReportForm, StockMovementReportForm, SettlementsReportForm
)

class ReportViewMixin:
    """Mixin to pass tenant to report forms."""
    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs['tenant'] = self.request.user.tenant
        return kwargs

class ReportsDashboardView(LoginRequiredMixin, TemplateView):
    template_name = 'registers/reports_dashboard.html'

class StockReportView(LoginRequiredMixin, ReportViewMixin, FormView):
    template_name = 'registers/report_stock.html'
    form_class = StockReportForm
    
    def form_valid(self, form):
        # Placeholder for data logic
        # data = form.get_data()
        return self.render_to_response(self.get_context_data(form=form, report_data=[]))

class BatchTurnoverReportView(LoginRequiredMixin, ReportViewMixin, FormView):
    template_name = 'registers/report_batch.html'
    form_class = BatchTurnoverReportForm
    
    def form_valid(self, form):
        return self.render_to_response(self.get_context_data(form=form, report_data=[]))

class StockAvailabilityReportView(LoginRequiredMixin, ReportViewMixin, FormView):
    template_name = 'registers/report_availability.html'
    form_class = StockAvailabilityReportForm
    
    def form_valid(self, form):
        return self.render_to_response(self.get_context_data(form=form, report_data=[]))

class InventoryValuationReportView(LoginRequiredMixin, ReportViewMixin, FormView):
    template_name = 'registers/report_valuation.html'
    form_class = InventoryValuationReportForm
    
    def form_valid(self, form):
        return self.render_to_response(self.get_context_data(form=form, report_data=[]))

class StockMovementReportView(LoginRequiredMixin, ReportViewMixin, FormView):
    template_name = 'registers/report_movement.html'
    form_class = StockMovementReportForm
    
    def form_valid(self, form):
        return self.render_to_response(self.get_context_data(form=form, report_data=[]))

class SettlementsReportView(LoginRequiredMixin, ReportViewMixin, FormView):
    template_name = 'registers/report_settlements.html'
    form_class = SettlementsReportForm
    
    def form_valid(self, form):
        return self.render_to_response(self.get_context_data(form=form, report_data=[]))
