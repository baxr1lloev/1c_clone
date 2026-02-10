"""
Forms for Accounting Module - Бухгалтерия
"""
from django import forms
from django.core.exceptions import ValidationError
from .models import ChartOfAccounts, AccountingEntry, PeriodClosing, AccountingPolicy
from decimal import Decimal


class ChartOfAccountsForm(forms.ModelForm):
    """
    Chart of Accounts Form - План счетов
    """
    class Meta:
        model = ChartOfAccounts
        fields = ['code', 'name', 'account_type', 'parent', 'is_active']
        widgets = {
            'code': forms.TextInput(attrs={
                'class': 'form-input',
                'placeholder': 'e.g., 41, 60, 90.1'
            }),
            'name': forms.TextInput(attrs={
                'class': 'form-input',
                'placeholder': 'e.g., Товары на складах'
            }),
            'account_type': forms.Select(attrs={
                'class': 'form-select',
                'required': True
            }),
            'parent': forms.Select(attrs={
                'class': 'form-select',
                'required': False
            }),
            'is_active': forms.CheckboxInput(attrs={
                'class': 'form-checkbox'
            }),
        }


class AccountingEntryForm(forms.ModelForm):
    """
    Manual Accounting Entry Form - Ручная проводка
    
    Note: Most entries are auto-generated from documents.
    This form is for manual adjustments only.
    """
    class Meta:
        model = AccountingEntry
        fields = ['date', 'period', 'debit_account', 'credit_account', 'amount', 'currency', 'description']
        widgets = {
            'date': forms.DateTimeInput(attrs={
                'class': 'form-input',
                'type': 'datetime-local'
            }),
            'period': forms.DateInput(attrs={
                'class': 'form-input',
                'type': 'date',
                'help_text': 'First day of month (YYYY-MM-01)'
            }),
            'debit_account': forms.Select(attrs={
                'class': 'form-select',
                'required': True
            }),
            'credit_account': forms.Select(attrs={
                'class': 'form-select',
                'required': True
            }),
            'amount': forms.NumberInput(attrs={
                'class': 'form-input',
                'step': '0.01',
                'min': '0.01'
            }),
            'currency': forms.Select(attrs={
                'class': 'form-select',
                'required': True
            }),
            'description': forms.TextInput(attrs={
                'class': 'form-input',
                'placeholder': 'Entry description...'
            }),
        }
    
    def clean(self):
        cleaned_data = super().clean()
        debit = cleaned_data.get('debit_account')
        credit = cleaned_data.get('credit_account')
        
        if debit and credit and debit == credit:
            raise ValidationError('Debit and Credit accounts must be different!')
        
        return cleaned_data


class PeriodClosingForm(forms.ModelForm):
    """
    Period Closing Form - Закрытие периода
    """
    class Meta:
        model = PeriodClosing
        fields = ['period', 'operational_closed', 'accounting_closed', 'allow_operational_after_close']
        widgets = {
            'period': forms.DateInput(attrs={
                'class': 'form-input',
                'type': 'date',
                'help_text': 'First day of month (YYYY-MM-01)'
            }),
            'operational_closed': forms.CheckboxInput(attrs={
                'class': 'form-checkbox'
            }),
            'accounting_closed': forms.CheckboxInput(attrs={
                'class': 'form-checkbox'
            }),
            'allow_operational_after_close': forms.CheckboxInput(attrs={
                'class': 'form-checkbox'
            }),
        }

    def __init__(self, *args, **kwargs):
        self.tenant = kwargs.pop('tenant', None)
        super().__init__(*args, **kwargs)
        if self.instance and self.tenant:
            self.instance.tenant = self.tenant

    def save(self, commit=True):
        instance = super().save(commit=False)
        if self.tenant:
            instance.tenant = self.tenant
        if commit:
            instance.save()
        return instance


class PeriodReopenForm(forms.Form):
    """
    Form for reopening a closed period.
    Requires reason and user authorization.
    """
    reason = forms.CharField(
        required=True,
        min_length=10,
        widget=forms.Textarea(attrs={
            'class': 'form-textarea',
            'rows': 3,
            'placeholder': 'Reason for reopening (minimum 10 characters)...',
            'required': True
        }),
        help_text='REQUIRED: Explain why this period needs to be reopened'
    )
    
    force = forms.BooleanField(
        required=False,
        widget=forms.CheckboxInput(attrs={
            'class': 'form-checkbox'
        }),
        help_text='Force reopen (SuperAdmin only)'
    )
    
    def clean_reason(self):
        reason = self.cleaned_data.get('reason')
        if not reason or len(reason.strip()) < 10:
            raise ValidationError('Reason must be at least 10 characters!')
        return reason


class AccountingPolicyForm(forms.ModelForm):
    """
    Accounting Policy Form - Учётная политика
    """
    class Meta:
        model = AccountingPolicy
        fields = ['stock_valuation_method', 'effective_from']
        widgets = {
            'stock_valuation_method': forms.Select(attrs={
                'class': 'form-select',
                'required': True
            }),
            'effective_from': forms.DateInput(attrs={
                'class': 'form-input',
                'type': 'date',
                'required': True
            }),
        }
        help_texts = {
            'stock_valuation_method': 'Method for calculating cost of goods sold',
            'effective_from': 'Date when this policy becomes effective'
        }


class ProfitLossReportForm(forms.Form):
    """
    Profit & Loss Report Parameters
    """
    period_start = forms.DateField(
        required=True,
        widget=forms.DateInput(attrs={
            'class': 'form-input',
            'type': 'date'
        }),
        label='From Date'
    )
    
    period_end = forms.DateField(
        required=True,
        widget=forms.DateInput(attrs={
            'class': 'form-input',
            'type': 'date'
        }),
        label='To Date'
    )
    
    def clean(self):
        cleaned_data = super().clean()
        start = cleaned_data.get('period_start')
        end = cleaned_data.get('period_end')
        
        if start and end and start > end:
            raise ValidationError('Start date must be before end date!')
        
        return cleaned_data


class TrialBalanceReportForm(forms.Form):
    """
    Trial Balance Report Parameters
    """
    period = forms.DateField(
        required=True,
        widget=forms.DateInput(attrs={
            'class': 'form-input',
            'type': 'date'
        }),
        label='Period (YYYY-MM-01)',
        help_text='First day of the month'
    )
    
    account_type = forms.ChoiceField(
        required=False,
        choices=[('', 'All Accounts')] + ChartOfAccounts.ACCOUNT_TYPES,
        widget=forms.Select(attrs={
            'class': 'form-select'
        }),
        label='Filter by Account Type'
    )
