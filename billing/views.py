from django.views.generic import ListView, DetailView, View
from django.contrib.auth.mixins import LoginRequiredMixin
from django.shortcuts import get_object_or_404, redirect
from django.contrib import messages
from .models import Invoice

class InvoiceListView(LoginRequiredMixin, ListView):
    model = Invoice
    template_name = 'billing/invoice_list.html'
    context_object_name = 'invoices'

    def get_queryset(self):
        return Invoice.objects.filter(tenant=self.request.user.tenant).order_by('-date_issued')

class PayInvoiceView(LoginRequiredMixin, View):
    def post(self, request, pk):
        invoice = get_object_or_404(Invoice, pk=pk, tenant=request.user.tenant)
        if invoice.status != 'paid':
            # Simulate payment processing
            invoice.status = 'paid'
            invoice.save()
            messages.success(request, f'Invoice #{invoice.number} paid successfully!')
        return redirect('subscriptions:my_plan')
