from django import forms
from django.contrib.auth import get_user_model
from tenants.models import Role

User = get_user_model()

class EmployeeCreationForm(forms.ModelForm):
    role = forms.ModelChoiceField(queryset=Role.objects.none(), widget=forms.Select(attrs={'class': 'form-select'}))
    password = forms.CharField(widget=forms.PasswordInput(attrs={'class': 'form-input'}))
    
    class Meta:
        model = User
        fields = ['email', 'first_name', 'last_name', 'role', 'password']
        widgets = {
            'email': forms.EmailInput(attrs={'class': 'form-input'}),
            'first_name': forms.TextInput(attrs={'class': 'form-input'}),
            'last_name': forms.TextInput(attrs={'class': 'form-input'}),
        }
    
    def __init__(self, *args, **kwargs):
        tenant = kwargs.pop('tenant', None)
        super().__init__(*args, **kwargs)
        if tenant:
            self.fields['role'].queryset = Role.objects.filter(tenant=tenant)
            
    def save(self, commit=True):
        user = super().save(commit=False)
        user.set_password(self.cleaned_data['password'])
        if commit:
            user.save()
        return user


class UserRoleForm(forms.ModelForm):
    """Form for changing a user's role."""
    
    class Meta:
        model = User
        fields = ['role']
        widgets = {
            'role': forms.Select(attrs={'class': 'form-select'}),
        }
    
    def __init__(self, *args, **kwargs):
        tenant = kwargs.pop('tenant', None)
        super().__init__(*args, **kwargs)
        if tenant:
            self.fields['role'].queryset = Role.objects.filter(tenant=tenant)
            self.fields['role'].label = 'Role'

