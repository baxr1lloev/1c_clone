from django.views.generic import ListView, CreateView, DetailView, FormView, View
from django.contrib.auth.mixins import LoginRequiredMixin
from django.shortcuts import redirect, get_object_or_404
from django.urls import reverse_lazy, reverse
from django.contrib import messages
from .models import TaxScheme, TaxForm, TaxReport, TaxReportLine
from .forms import TaxReportWizardForm, TaxReportLineForm
from .tax_service import TaxEngineService

class TenantAwareMixin:
    def get_queryset(self):
        return super().get_queryset().filter(tenant=self.request.user.tenant)

class TaxReportListView(LoginRequiredMixin, TenantAwareMixin, ListView):
    model = TaxReport
    template_name = 'taxes/report_list.html'
    context_object_name = 'reports'
    ordering = ['-period_start']

class TaxReportWizardView(LoginRequiredMixin, FormView):
    """
    Wizard to generate a new tax report.
    """
    template_name = 'taxes/wizard.html'
    form_class = TaxReportWizardForm
    
    def form_valid(self, form):
        # Generate report using service
        report = TaxEngineService.generate_report(
            tenant=self.request.user.tenant,
            tax_form=form.cleaned_data['form'],
            period_start=form.cleaned_data['period_start'],
            period_end=form.cleaned_data['period_end']
        )
        
        messages.success(self.request, f"Tax report #{report.id} generated successfully!")
        return redirect('taxes:report_detail', pk=report.pk)

class TaxReportDetailView(LoginRequiredMixin, TenantAwareMixin, DetailView):
    model = TaxReport
    template_name = 'taxes/report_detail.html'
    context_object_name = 'report'
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['lines'] = self.object.lines.select_related('field').order_by('field__order', 'field__code')
        return context

class TaxReportSubmitView(LoginRequiredMixin, View):
    """
    Finalize/Submit a tax report.
    Once submitted, the report becomes READ-ONLY.
    """
    def post(self, request, pk):
        report = get_object_or_404(TaxReport, pk=pk, tenant=request.user.tenant)
        
        try:
            report.submit(user=request.user)
            messages.success(request, f"Report submitted successfully! Report is now READ-ONLY.")
        except ValueError as e:
            messages.error(request, str(e))
        
        return redirect('taxes:report_detail', pk=pk)


class TaxReportLineUpdateView(LoginRequiredMixin, View):
    """
    Update a single line in a tax report (manual override).
    Only allowed for DRAFT reports.
    """
    def post(self, request, pk):
        line = get_object_or_404(TaxReportLine, pk=pk, report__tenant=request.user.tenant)
        
        if not line.report.is_editable():
            messages.error(request, "Cannot edit submitted or superseded reports. They are READ-ONLY snapshots.")
            return redirect('taxes:report_detail', pk=line.report.pk)
        
        form = TaxReportLineForm(request.POST, instance=line)
        if form.is_valid():
            line = form.save(commit=False)
            line.is_manual_override = True
            line.save()
            
            # Recalculate formulas that depend on this field
            try:
                TaxEngineService.recalculate_formulas(line.report)
                messages.success(request, "Line updated and formulas recalculated.")
            except ValueError as e:
                messages.error(request, str(e))
        
        return redirect('taxes:report_detail', pk=line.report.pk)

