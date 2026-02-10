"""
Forms for Registers Module - Регистры
"""
from django import forms
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _
from .models import StockBatch, StockReservation
from accounting.models import AccountingPolicy
from decimal import Decimal


class StockReportForm(forms.Form):
    """
    Stock Report Parameters
    """
    warehouse = forms.ModelChoiceField(
        required=False,
        queryset=None,  # Set in __init__
        widget=forms.Select(attrs={
            'class': 'form-select'
        }),
        label=_('Warehouse'),
        empty_label=_('All Warehouses')
    )
    
    item = forms.ModelChoiceField(
        required=False,
        queryset=None,  # Set in __init__
        widget=forms.Select(attrs={
            'class': 'form-select'
        }),
        label=_('Item'),
        empty_label=_('All Items')
    )
    
    show_zero_stock = forms.BooleanField(
        required=False,
        initial=False,
        widget=forms.CheckboxInput(attrs={
            'class': 'form-checkbox'
        }),
        label=_('Show items with zero stock')
    )
    
    def __init__(self, *args, **kwargs):
        tenant = kwargs.pop('tenant', None)
        super().__init__(*args, **kwargs)
        
        if tenant:
            from directories.models import Warehouse, Item
            self.fields['warehouse'].queryset = Warehouse.objects.filter(tenant=tenant, is_active=True)
            self.fields['item'].queryset = Item.objects.filter(tenant=tenant)


class BatchTurnoverReportForm(forms.Form):
    """
    Batch Turnover Report Parameters - Партионный учёт
    """
    date_from = forms.DateField(
        required=True,
        widget=forms.DateInput(attrs={
            'class': 'form-input',
            'type': 'date'
        }),
        label=_('From Date')
    )
    
    date_to = forms.DateField(
        required=True,
        widget=forms.DateInput(attrs={
            'class': 'form-input',
            'type': 'date'
        }),
        label=_('To Date')
    )
    
    warehouse = forms.ModelChoiceField(
        required=False,
        queryset=None,
        widget=forms.Select(attrs={
            'class': 'form-select'
        }),
        label=_('Warehouse'),
        empty_label=_('All Warehouses')
    )
    
    item = forms.ModelChoiceField(
        required=False,
        queryset=None,
        widget=forms.Select(attrs={
            'class': 'form-select'
        }),
        label=_('Item'),
        empty_label=_('All Items')
    )
    
    show_consumed_batches = forms.BooleanField(
        required=False,
        initial=False,
        widget=forms.CheckboxInput(attrs={
            'class': 'form-checkbox'
        }),
        label=_('Show fully consumed batches')
    )
    
    def __init__(self, *args, **kwargs):
        tenant = kwargs.pop('tenant', None)
        super().__init__(*args, **kwargs)
        
        if tenant:
            from directories.models import Warehouse, Item
            self.fields['warehouse'].queryset = Warehouse.objects.filter(tenant=tenant, is_active=True)
            self.fields['item'].queryset = Item.objects.filter(tenant=tenant)
    
    def clean(self):
        cleaned_data = super().clean()
        date_from = cleaned_data.get('date_from')
        date_to = cleaned_data.get('date_to')
        
        if date_from and date_to and date_from > date_to:
            raise ValidationError(_('From date must be before To date!'))
        
        return cleaned_data


class StockAvailabilityReportForm(forms.Form):
    """
    Stock Availability Report - Available = Stock - Reserved
    """
    warehouse = forms.ModelChoiceField(
        required=False,
        queryset=None,
        widget=forms.Select(attrs={
            'class': 'form-select'
        }),
        label=_('Warehouse'),
        empty_label=_('All Warehouses')
    )
    
    item = forms.ModelChoiceField(
        required=False,
        queryset=None,
        widget=forms.Select(attrs={
            'class': 'form-select'
        }),
        label=_('Item'),
        empty_label=_('All Items')
    )
    
    show_only_low_stock = forms.BooleanField(
        required=False,
        initial=False,
        widget=forms.CheckboxInput(attrs={
            'class': 'form-checkbox'
        }),
        label=_('Show only low stock items (available < 10)')
    )
    
    show_only_reserved = forms.BooleanField(
        required=False,
        initial=False,
        widget=forms.CheckboxInput(attrs={
            'class': 'form-checkbox'
        }),
        label=_('Show only items with reservations')
    )
    
    def __init__(self, *args, **kwargs):
        tenant = kwargs.pop('tenant', None)
        super().__init__(*args, **kwargs)
        
        if tenant:
            from directories.models import Warehouse, Item
            self.fields['warehouse'].queryset = Warehouse.objects.filter(tenant=tenant, is_active=True)
            self.fields['item'].queryset = Item.objects.filter(tenant=tenant)


class InventoryValuationReportForm(forms.Form):
    """
    Inventory Valuation Report - for financial statements
    """
    as_of_date = forms.DateField(
        required=True,
        widget=forms.DateInput(attrs={
            'class': 'form-input',
            'type': 'date'
        }),
        label=_('As of Date')
    )
    
    warehouse = forms.ModelChoiceField(
        required=False,
        queryset=None,
        widget=forms.Select(attrs={
            'class': 'form-select'
        }),
        label=_('Warehouse'),
        empty_label=_('All Warehouses')
    )
    
    valuation_method = forms.ChoiceField(
        required=False,
        choices=[
            ('', _('Use Accounting Policy')),
            ('FIFO', _('FIFO')),
            ('AVG', _('Weighted Average')),
            ('LIFO', _('LIFO')),
        ],
        widget=forms.Select(attrs={
            'class': 'form-select'
        }),
        label=_('Valuation Method Override')
    )
    
    def __init__(self, *args, **kwargs):
        tenant = kwargs.pop('tenant', None)
        super().__init__(*args, **kwargs)
        
        if tenant:
            from directories.models import Warehouse
            self.fields['warehouse'].queryset = Warehouse.objects.filter(tenant=tenant, is_active=True)


class StockMovementReportForm(forms.Form):
    """
    Stock Movement Report - detailed movement history
    """
    date_from = forms.DateField(
        required=True,
        widget=forms.DateInput(attrs={
            'class': 'form-input',
            'type': 'date'
        }),
        label=_('From Date')
    )
    
    date_to = forms.DateField(
        required=True,
        widget=forms.DateInput(attrs={
            'class': 'form-input',
            'type': 'date'
        }),
        label=_('To Date')
    )
    
    warehouse = forms.ModelChoiceField(
        required=False,
        queryset=None,
        widget=forms.Select(attrs={
            'class': 'form-select'
        }),
        label=_('Warehouse'),
        empty_label=_('All Warehouses')
    )
    
    item = forms.ModelChoiceField(
        required=False,
        queryset=None,
        widget=forms.Select(attrs={
            'class': 'form-select'
        }),
        label=_('Item'),
        empty_label=_('All Items')
    )
    
    movement_type = forms.ChoiceField(
        required=False,
        choices=[
            ('', _('All Types')),
            ('IN', _('Incoming')),
            ('OUT', _('Outgoing')),
        ],
        widget=forms.Select(attrs={
            'class': 'form-select'
        }),
        label=_('Movement Type')
    )
    
    show_reversals = forms.BooleanField(
        required=False,
        initial=True,
        widget=forms.CheckboxInput(attrs={
            'class': 'form-checkbox'
        }),
        label=_('Show reversal movements (storno)')
    )
    
    def __init__(self, *args, **kwargs):
        tenant = kwargs.pop('tenant', None)
        super().__init__(*args, **kwargs)
        
        if tenant:
            from directories.models import Warehouse, Item
            self.fields['warehouse'].queryset = Warehouse.objects.filter(tenant=tenant, is_active=True)
            self.fields['item'].queryset = Item.objects.filter(tenant=tenant)
    
    def clean(self):
        cleaned_data = super().clean()
        date_from = cleaned_data.get('date_from')
        date_to = cleaned_data.get('date_to')
        
        if date_from and date_to and date_from > date_to:
            raise ValidationError(_('From date must be before To date!'))
        
        return cleaned_data


class SettlementsReportForm(forms.Form):
    """
    Settlements Report - Debts and Receivables
    """
    as_of_date = forms.DateField(
        required=True,
        widget=forms.DateInput(attrs={
            'class': 'form-input',
            'type': 'date'
        }),
        label=_('As of Date')
    )
    
    counterparty = forms.ModelChoiceField(
        required=False,
        queryset=None,
        widget=forms.Select(attrs={
            'class': 'form-select'
        }),
        label=_('Counterparty'),
        empty_label=_('All Counterparties')
    )
    
    counterparty_type = forms.ChoiceField(
        required=False,
        choices=[
            ('', _('All Types')),
            ('CUSTOMER', _('Customers Only')),
            ('SUPPLIER', _('Suppliers Only')),
        ],
        widget=forms.Select(attrs={
            'class': 'form-select'
        }),
        label=_('Counterparty Type')
    )
    
    show_zero_balance = forms.BooleanField(
        required=False,
        initial=False,
        widget=forms.CheckboxInput(attrs={
            'class': 'form-checkbox'
        }),
        label=_('Show counterparties with zero balance')
    )
    
    def __init__(self, *args, **kwargs):
        tenant = kwargs.pop('tenant', None)
        super().__init__(*args, **kwargs)
        
        if tenant:
            from directories.models import Counterparty
            self.fields['counterparty'].queryset = Counterparty.objects.filter(tenant=tenant)
