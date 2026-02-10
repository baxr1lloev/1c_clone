from django import forms
from .models import Counterparty, Item, Warehouse, Contract

class ContractForm(forms.ModelForm):
    class Meta:
        model = Contract
        fields = ['number', 'date', 'counterparty', 'currency', 'contract_type', 'is_active']
        widgets = {
            'number': forms.TextInput(attrs={'class': 'form-input'}),
            'date': forms.DateInput(attrs={'class': 'form-input', 'type': 'date'}),
            'counterparty': forms.Select(attrs={'class': 'form-select'}),
            'currency': forms.Select(attrs={'class': 'form-select'}),
            'contract_type': forms.Select(attrs={'class': 'form-select'}),
            'is_active': forms.CheckboxInput(attrs={'class': 'form-checkbox'}),
        }
    
    def __init__(self, *args, **kwargs):
        tenant = kwargs.pop('tenant', None)
        super().__init__(*args, **kwargs)
        if tenant:
            self.fields['counterparty'].queryset = Counterparty.objects.filter(tenant=tenant)


class CounterpartyForm(forms.ModelForm):
    class Meta:
        model = Counterparty
        fields = ['name', 'inn', 'type', 'phone', 'email', 'address']
        widgets = {
            'name': forms.TextInput(attrs={'class': 'form-input'}),
            'inn': forms.TextInput(attrs={'class': 'form-input'}),
            'type': forms.Select(attrs={'class': 'form-select'}),
            'phone': forms.TextInput(attrs={'class': 'form-input'}),
            'email': forms.EmailInput(attrs={'class': 'form-input'}),
            'address': forms.Textarea(attrs={'class': 'form-textarea', 'rows': 3}),
        }

    def __init__(self, *args, **kwargs):
        kwargs.pop('tenant', None)
        super().__init__(*args, **kwargs)

class ItemForm(forms.ModelForm):
    class Meta:
        model = Item
        fields = ['name', 'sku', 'item_type', 'unit', 'purchase_price', 'selling_price']
        widgets = {
            'name': forms.TextInput(attrs={'class': 'form-input'}),
            'sku': forms.TextInput(attrs={'class': 'form-input'}),
            'item_type': forms.Select(attrs={'class': 'form-select'}),
            'unit': forms.TextInput(attrs={'class': 'form-input', 'style': 'width: 100px;'}),
            'purchase_price': forms.NumberInput(attrs={'class': 'form-input'}),
            'selling_price': forms.NumberInput(attrs={'class': 'form-input'}),
        }

    def __init__(self, *args, **kwargs):
        kwargs.pop('tenant', None)
        super().__init__(*args, **kwargs)

class WarehouseForm(forms.ModelForm):
    class Meta:
        model = Warehouse
        fields = ['name', 'address', 'warehouse_type', 'is_active']
        widgets = {
            'name': forms.TextInput(attrs={'class': 'form-input'}),
            'address': forms.TextInput(attrs={'class': 'form-input'}),
            'warehouse_type': forms.Select(attrs={'class': 'form-select'}),
            'is_active': forms.CheckboxInput(attrs={'class': 'form-checkbox'}),
        }

    def __init__(self, *args, **kwargs):
        kwargs.pop('tenant', None)
        super().__init__(*args, **kwargs)

from .models import ExchangeRate

class ExchangeRateForm(forms.ModelForm):
    class Meta:
        model = ExchangeRate
        fields = ['currency', 'date', 'rate']
        widgets = {
            'currency': forms.Select(attrs={'class': 'form-select'}),
            'date': forms.DateInput(attrs={'class': 'form-input', 'type': 'date'}),
            'rate': forms.NumberInput(attrs={'class': 'form-input', 'step': '0.0001'}),
        }

    def __init__(self, *args, **kwargs):
        tenant = kwargs.pop('tenant', None)
        super().__init__(*args, **kwargs)
        if tenant and tenant.base_currency:
            self.fields['currency'].queryset = self.fields['currency'].queryset.exclude(id=tenant.base_currency.id)
