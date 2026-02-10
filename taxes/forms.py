from django import forms
from .models import TaxScheme, TaxForm, TaxReport, TaxReportLine

class TaxReportWizardForm(forms.Form):
    """
    Wizard Step 1-2: Select Scheme and Form
    """
    scheme = forms.ModelChoiceField(
        queryset=TaxScheme.objects.filter(is_active=True),
        widget=forms.Select(attrs={'class': 'form-select'}),
        label='Tax Scheme (Country/Version)'
    )
    
    form = forms.ModelChoiceField(
        queryset=TaxForm.objects.none(),
        widget=forms.Select(attrs={'class': 'form-select'}),
        label='Report Type'
    )
    
    period_start = forms.DateField(
        widget=forms.DateInput(attrs={'class': 'form-input', 'type': 'date'}),
        label='Period Start'
    )
    
    period_end = forms.DateField(
        widget=forms.DateInput(attrs={'class': 'form-input', 'type': 'date'}),
        label='Period End'
    )
    
    def __init__(self, *args, **kwargs):
        scheme_id = kwargs.pop('scheme_id', None)
        super().__init__(*args, **kwargs)
        
        if scheme_id:
            self.fields['form'].queryset = TaxForm.objects.filter(scheme_id=scheme_id)

class TaxReportLineForm(forms.ModelForm):
    """
    Form to manually edit a tax report line value.
    """
    class Meta:
        model = TaxReportLine
        fields = ['value_numeric', 'value_text']
        widgets = {
            'value_numeric': forms.NumberInput(attrs={'class': 'form-input', 'step': '0.01'}),
            'value_text': forms.TextInput(attrs={'class': 'form-input'}),
        }
