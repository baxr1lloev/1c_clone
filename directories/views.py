from django.views.generic import ListView, CreateView, UpdateView, DeleteView
from django.contrib.auth.mixins import LoginRequiredMixin
from django.urls import reverse_lazy
from .models import Counterparty, Item, Warehouse, ExchangeRate, Contract
from .forms import CounterpartyForm, ItemForm, WarehouseForm, ExchangeRateForm, ContractForm

class TenantAwareMixin:
    """Ensure user only sees their own tenant's data."""
    def get_queryset(self):
        return super().get_queryset().filter(tenant=self.request.user.tenant)
    
    def form_valid(self, form):
        form.instance.tenant = self.request.user.tenant
        return super().form_valid(form)
    
    def get_form_kwargs(self):
        """Pass tenant to form for filtering querysets"""
        kwargs = super().get_form_kwargs()
        kwargs['tenant'] = self.request.user.tenant
        return kwargs

# --- Contract Views ---
class ContractListView(LoginRequiredMixin, TenantAwareMixin, ListView):
    model = Contract
    template_name = 'directories/contract_list.html'
    context_object_name = 'contracts'
    ordering = ['-date']

class ContractCreateView(LoginRequiredMixin, TenantAwareMixin, CreateView):
    model = Contract
    form_class = ContractForm
    template_name = 'directories/form.html'
    success_url = reverse_lazy('directories:contract_list')
    extra_context = {'title': 'Create Contract'}

class ContractUpdateView(LoginRequiredMixin, TenantAwareMixin, UpdateView):
    model = Contract
    form_class = ContractForm
    template_name = 'directories/form.html'
    success_url = reverse_lazy('directories:contract_list')
    extra_context = {'title': 'Edit Contract'}

# --- Counterparty Views ---
class CounterpartyListView(LoginRequiredMixin, TenantAwareMixin, ListView):
    model = Counterparty
    template_name = 'directories/counterparty_list.html'
    context_object_name = 'counterparties'

class CounterpartyCreateView(LoginRequiredMixin, TenantAwareMixin, CreateView):
    model = Counterparty
    form_class = CounterpartyForm
    template_name = 'directories/form.html'
    success_url = reverse_lazy('directories:counterparty_list')
    extra_context = {'title': 'Create Counterparty'}

class CounterpartyUpdateView(LoginRequiredMixin, TenantAwareMixin, UpdateView):
    model = Counterparty
    form_class = CounterpartyForm
    template_name = 'directories/form.html'
    success_url = reverse_lazy('directories:counterparty_list')
    extra_context = {'title': 'Edit Counterparty'}

# --- Item Views ---
class ItemListView(LoginRequiredMixin, TenantAwareMixin, ListView):
    model = Item
    template_name = 'directories/item_list.html'
    context_object_name = 'items'

class ItemCreateView(LoginRequiredMixin, TenantAwareMixin, CreateView):
    model = Item
    form_class = ItemForm
    template_name = 'directories/form.html'
    success_url = reverse_lazy('directories:item_list')
    extra_context = {'title': 'Create Item'}

class ItemUpdateView(LoginRequiredMixin, TenantAwareMixin, UpdateView):
    model = Item
    form_class = ItemForm
    template_name = 'directories/form.html'
    success_url = reverse_lazy('directories:item_list')
    extra_context = {'title': 'Edit Item'}

# --- Warehouse Views ---
class WarehouseListView(LoginRequiredMixin, TenantAwareMixin, ListView):
    model = Warehouse
    template_name = 'directories/warehouse_list.html'
    context_object_name = 'warehouses'

class WarehouseCreateView(LoginRequiredMixin, TenantAwareMixin, CreateView):
    model = Warehouse
    form_class = WarehouseForm
    template_name = 'directories/form.html'
    success_url = reverse_lazy('directories:warehouse_list')
    extra_context = {'title': 'Add Warehouse'}

class ExchangeRateListView(LoginRequiredMixin, TenantAwareMixin, ListView):
    model = ExchangeRate
    template_name = 'directories/exchange_rate_list.html'
    context_object_name = 'rates'
    ordering = ['-date', 'currency']

class ExchangeRateCreateView(LoginRequiredMixin, TenantAwareMixin, CreateView):
    model = ExchangeRate
    form_class = ExchangeRateForm
    template_name = 'directories/form.html'
    success_url = reverse_lazy('directories:exchange_rate_list')
    extra_context = {'title': 'Add Exchange Rate'}
