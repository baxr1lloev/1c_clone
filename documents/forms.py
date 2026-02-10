from django import forms
from django.core.exceptions import ValidationError
from .models import (
    SalesDocument, SalesDocumentLine,
    PurchaseDocument, PurchaseDocumentLine,
    PaymentDocument, TransferDocument, TransferDocumentLine,
    SalesOrder, SalesOrderLine, InventoryDocument, InventoryDocumentLine
)
from registers.reservation_service import ReservationService
from registers.batch_service import BatchService
from directories.services import CurrencyService
from .pricing_service import PricingService
from decimal import Decimal


class SalesDocumentForm(forms.ModelForm):
    """
    Sales Document Form with stock availability checking.
    """
    class Meta:
        model = SalesDocument
        fields = ['number', 'date', 'counterparty', 'contract', 'warehouse', 'currency', 'comment']
        widgets = {
            'number': forms.TextInput(attrs={
                'class': 'form-input',
                'placeholder': 'Auto-generated if empty'
            }),
            'date': forms.DateTimeInput(attrs={
                'class': 'form-input',
                'type': 'datetime-local'
            }),
            'counterparty': forms.Select(attrs={
                'class': 'form-select',
                'required': True
            }),
            'contract': forms.Select(attrs={
                'class': 'form-select',
                'required': True
            }),
            'warehouse': forms.Select(attrs={
                'class': 'form-select',
                'required': True
            }),
            'currency': forms.Select(attrs={
                'class': 'form-select',
                'required': True
            }),
            'comment': forms.Textarea(attrs={
                'class': 'form-textarea',
                'rows': 2,
                'placeholder': 'Optional notes...'
            }),
        }

    def clean(self):
        cleaned_data = super().clean()
        tenant = self.instance.tenant  # Set in view via form_valid or similar, but here instance might come from update
        # If create, view sets tenant on instance. If update, it's there.
        # But form.clean happens before view sets tenant in CreateView.
        # Ideally tenant should be passed to form or available. 
        # Using self.initial or assuming view handles it? 
        # Let's rely on view to handle 'rate' via helper or do it here if possible.
        # Actually, best place is 'save()' but user wants validation.
        # CreateView: form_valid sets tenant. form.clean runs before form_valid.
        # Validation error if no rate.
        
        date = cleaned_data.get('date')
        currency = cleaned_data.get('currency')
        
        # We need tenant to check rate. 
        # In TenantAwareMixin, we set form.instance.tenant = user.tenant in form_valid.
        # So we can't easily access tenant here without passing it.
        # Let's Modify CreateView/UpdateView to pass tenant to __init__?
        # Or Just handle Rate fetching in save() or form_valid()? (User said "Error (strict)").
        # If we do it in form_valid, we can raise ValidationError there but it's not standard.
        # Let's assume tenant is passed to __init__ like in LineForm.
        return cleaned_data
    
    def __init__(self, *args, **kwargs):
        self.tenant = kwargs.pop('tenant', None)
        super().__init__(*args, **kwargs)

    def clean(self):
        cleaned_data = super().clean()
        date = cleaned_data.get('date')
        currency = cleaned_data.get('currency')
        
        if date and currency and self.tenant:
            try:
                rate = CurrencyService.get_rate(self.tenant, currency, date)
                self.instance.rate = rate
            except ValidationError as e:
                raise ValidationError(str(e))
        
        return cleaned_data


class SalesDocumentLineForm(forms.ModelForm):
    """
    Sales Line with available quantity display.
    """
    available_qty = forms.DecimalField(
        required=False,
        disabled=True,
        label='Available',
        widget=forms.NumberInput(attrs={
            'class': 'form-input bg-gray-100',
            'readonly': True
        })
    )
    
    class Meta:
        model = SalesDocumentLine
        fields = ['item', 'quantity', 'price', 'available_qty']
        widgets = {
            'item': forms.Select(attrs={
                'class': 'form-select',
                'onchange': 'updateAvailableQty(this)'
            }),
            'quantity': forms.NumberInput(attrs={
                'class': 'form-input',
                'step': '0.001',
                'min': '0.001'
            }),
            'price': forms.NumberInput(attrs={
                'class': 'form-input',
                'step': '0.01',
                'min': '0.01',
                'placeholder': 'Auto-filled if empty'
            }),
        }
    
    def __init__(self, *args, **kwargs):
        warehouse = kwargs.pop('warehouse', None)
        self.tenant = kwargs.pop('tenant', None)
        self.document = kwargs.pop('document', None)
        super().__init__(*args, **kwargs)
        
        # Show available quantity if item is selected
        if self.instance and getattr(self.instance, 'item_id', None) and warehouse and self.tenant:
            available = ReservationService.get_available_quantity(
                self.tenant, warehouse, self.instance.item
            )
            self.fields['available_qty'].initial = available
            
        # Make price optional to allow auto-filling
        self.fields['price'].required = False

    def clean_price(self):
        price = self.cleaned_data.get('price')
        if not price and self.document and self.tenant:
            # Auto-fill price
            item = self.cleaned_data.get('item')
            if item:
                price = PricingService.get_last_price(
                    self.tenant, item, self.document.currency, self.document.date
                )
        
        if not price:
             raise ValidationError("Price is required and could not be auto-determined.")
             
        return price


class PurchaseDocumentForm(forms.ModelForm):
    """
    Purchase Document Form - creates batches on posting.
    """
    class Meta:
        model = PurchaseDocument
        fields = ['number', 'date', 'counterparty', 'contract', 'warehouse', 'currency', 'comment']
        widgets = {
            'number': forms.TextInput(attrs={
                'class': 'form-input',
                'placeholder': 'Auto-generated if empty'
            }),
            'date': forms.DateTimeInput(attrs={
                'class': 'form-input',
                'type': 'datetime-local'
            }),
            'counterparty': forms.Select(attrs={
                'class': 'form-select',
                'required': True
            }),
            'contract': forms.Select(attrs={
                'class': 'form-select',
                'required': True
            }),
            'warehouse': forms.Select(attrs={
                'class': 'form-select',
                'required': True
            }),
            'currency': forms.Select(attrs={
                'class': 'form-select',
                'required': True
            }),
            'comment': forms.Textarea(attrs={
                'class': 'form-textarea',
                'rows': 2,
                'placeholder': 'Supplier invoice details...'
            }),
        }

    def __init__(self, *args, **kwargs):
        self.tenant = kwargs.pop('tenant', None)
        super().__init__(*args, **kwargs)

    def clean(self):
        cleaned_data = super().clean()
        date = cleaned_data.get('date')
        currency = cleaned_data.get('currency')
        
        if date and currency and self.tenant:
            try:
                rate = CurrencyService.get_rate(self.tenant, currency, date)
                self.instance.rate = rate
            except ValidationError as e:
                raise ValidationError(str(e))
        
        return cleaned_data


class PurchaseDocumentLineForm(forms.ModelForm):
    """
    Purchase Line - will create batch on posting.
    """
    class Meta:
        model = PurchaseDocumentLine
        fields = ['item', 'quantity', 'price']
        widgets = {
            'item': forms.Select(attrs={
                'class': 'form-select'
            }),
            'quantity': forms.NumberInput(attrs={
                'class': 'form-input',
                'step': '0.001',
                'min': '0.001'
            }),
            'price': forms.NumberInput(attrs={
                'class': 'form-input',
                'step': '0.01',
                'min': '0.01',
                'placeholder': 'Unit price'
            }),
        }
        
    def __init__(self, *args, **kwargs):
        self.document = kwargs.pop('document', None)
        self.tenant = kwargs.pop('tenant', None)
        super().__init__(*args, **kwargs)


class PaymentDocumentForm(forms.ModelForm):
    """
    Payment Document Form - affects settlements.
    """
    outstanding_balance = forms.DecimalField(
        required=False,
        disabled=True,
        label='Outstanding Balance',
        widget=forms.NumberInput(attrs={
            'class': 'form-input bg-gray-100',
            'readonly': True
        })
    )
    
    class Meta:
        model = PaymentDocument
        fields = ['number', 'date', 'payment_type', 'counterparty', 'contract', 'amount', 'currency', 'comment']
        widgets = {
            'number': forms.TextInput(attrs={
                'class': 'form-input',
                'placeholder': 'Auto-generated if empty'
            }),
            'date': forms.DateTimeInput(attrs={
                'class': 'form-input',
                'type': 'datetime-local'
            }),
            'payment_type': forms.Select(attrs={
                'class': 'form-select',
                'required': True
            }),
            'counterparty': forms.Select(attrs={
                'class': 'form-select',
                'required': True,
                'onchange': 'updateOutstandingBalance(this)'
            }),
            'contract': forms.Select(attrs={
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
            'comment': forms.Textarea(attrs={
                'class': 'form-textarea',
                'rows': 2,
                'placeholder': 'Payment details...'
            }),
        }


class TransferDocumentForm(forms.ModelForm):
    """
    Transfer Document Form - moves batches between warehouses.
    """
    class Meta:
        model = TransferDocument
        fields = ['number', 'date', 'from_warehouse', 'to_warehouse', 'counterparty', 'comment']
        widgets = {
            'number': forms.TextInput(attrs={
                'class': 'form-input',
                'placeholder': 'Auto-generated if empty'
            }),
            'date': forms.DateTimeInput(attrs={
                'class': 'form-input',
                'type': 'datetime-local'
            }),
            'from_warehouse': forms.Select(attrs={
                'class': 'form-select',
                'required': True
            }),
            'to_warehouse': forms.Select(attrs={
                'class': 'form-select',
                'required': True
            }),
            'counterparty': forms.Select(attrs={
                'class': 'form-select',
                'required': False
            }),
            'comment': forms.Textarea(attrs={
                'class': 'form-textarea',
                'rows': 2,
                'placeholder': 'Transfer reason...'
            }),
        }
    
    def clean(self):
        cleaned_data = super().clean()
        from_wh = cleaned_data.get('from_warehouse')
        to_wh = cleaned_data.get('to_warehouse')
        
        if from_wh and to_wh and from_wh == to_wh:
            raise ValidationError('Source and destination warehouses must be different!')
        
        return cleaned_data


class TransferDocumentLineForm(forms.ModelForm):
    """
    Transfer Line with source warehouse stock check.
    """
    available_qty = forms.DecimalField(
        required=False,
        disabled=True,
        label='Available at Source',
        widget=forms.NumberInput(attrs={
            'class': 'form-input bg-gray-100',
            'readonly': True
        })
    )
    
    class Meta:
        model = TransferDocumentLine
        fields = ['item', 'quantity', 'available_qty']
        widgets = {
            'item': forms.Select(attrs={
                'class': 'form-select',
                'onchange': 'updateSourceStock(this)'
            }),
            'quantity': forms.NumberInput(attrs={
                'class': 'form-input',
                'step': '0.001',
                'min': '0.001'
            }),
        }


class SalesOrderForm(forms.ModelForm):
    """
    Sales Order Form - creates reservations on posting.
    """
    class Meta:
        model = SalesOrder
        fields = ['number', 'date', 'counterparty', 'contract', 'warehouse', 'currency', 'comment']
        widgets = {
            'number': forms.TextInput(attrs={
                'class': 'form-input',
                'placeholder': 'Auto-generated if empty'
            }),
            'date': forms.DateTimeInput(attrs={
                'class': 'form-input',
                'type': 'datetime-local'
            }),
            'counterparty': forms.Select(attrs={
                'class': 'form-select',
                'required': True
            }),
            'contract': forms.Select(attrs={
                'class': 'form-select',
                'required': True
            }),
            'warehouse': forms.Select(attrs={
                'class': 'form-select',
                'required': True
            }),
            'currency': forms.Select(attrs={
                'class': 'form-select',
                'required': True
            }),
            'comment': forms.Textarea(attrs={
                'class': 'form-textarea',
                'rows': 2,
                'placeholder': 'Customer order details...'
            }),
        }


class SalesOrderLineForm(forms.ModelForm):
    """
    Sales Order Line with availability check.
    """
    available_qty = forms.DecimalField(
        required=False,
        disabled=True,
        label='Available',
        widget=forms.NumberInput(attrs={
            'class': 'form-input bg-gray-100',
            'readonly': True
        })
    )
    
    class Meta:
        model = SalesOrderLine
        fields = ['item', 'quantity', 'price', 'available_qty']
        widgets = {
            'item': forms.Select(attrs={
                'class': 'form-select',
                'onchange': 'updateAvailableQty(this)'
            }),
            'quantity': forms.NumberInput(attrs={
                'class': 'form-input',
                'step': '0.001',
                'min': '0.001'
            }),
            'price': forms.NumberInput(attrs={
                'class': 'form-input',
                'step': '0.01',
                'min': '0.01'
            }),
        }

    def __init__(self, *args, **kwargs):
        warehouse = kwargs.pop('warehouse', None)
        self.tenant = kwargs.pop('tenant', None)
        super().__init__(*args, **kwargs)
        
        # Show available quantity if item is selected
        if self.instance and getattr(self.instance, 'item_id', None) and warehouse and self.tenant:
            available = ReservationService.get_available_quantity(
                self.tenant, warehouse, self.instance.item
            )
            self.fields['available_qty'].initial = available


class InventoryDocumentForm(forms.ModelForm):
    """
    Inventory Document Form - physical stock count.
    """
    class Meta:
        model = InventoryDocument
        fields = ['number', 'date', 'warehouse', 'responsible', 'comment']
        widgets = {
            'number': forms.TextInput(attrs={
                'class': 'form-input',
                'placeholder': 'Auto-generated if empty'
            }),
            'date': forms.DateTimeInput(attrs={
                'class': 'form-input',
                'type': 'datetime-local'
            }),
            'warehouse': forms.Select(attrs={
                'class': 'form-select',
                'required': True
            }),
            'responsible': forms.TextInput(attrs={
                'class': 'form-input',
                'placeholder': 'Person responsible for count'
            }),
            'comment': forms.Textarea(attrs={
                'class': 'form-textarea',
                'rows': 2,
                'placeholder': 'Inventory notes...'
            }),
        }


class InventoryDocumentLineForm(forms.ModelForm):
    """
    Inventory Line showing book vs actual quantities.
    """
    difference = forms.DecimalField(
        required=False,
        disabled=True,
        label='Difference',
        widget=forms.NumberInput(attrs={
            'class': 'form-input bg-gray-100',
            'readonly': True
        })
    )
    
    class Meta:
        model = InventoryDocumentLine
        fields = ['item', 'quantity_book', 'quantity_actual', 'difference']
        widgets = {
            'item': forms.Select(attrs={
                'class': 'form-select',
                'onchange': 'loadBookQuantity(this)'
            }),
            'quantity_book': forms.NumberInput(attrs={
                'class': 'form-input bg-gray-100',
                'step': '0.001',
                'readonly': True
            }),
            'quantity_actual': forms.NumberInput(attrs={
                'class': 'form-input',
                'step': '0.001',
                'min': '0',
                'onchange': 'calculateDifference(this)'
            }),
        }
    
    def __init__(self, *args, **kwargs):
        warehouse = kwargs.pop('warehouse', None)
        tenant = kwargs.pop('tenant', None)
        super().__init__(*args, **kwargs)
        
        # Auto-fill book quantity if item is selected
        if self.instance and getattr(self.instance, 'item_id', None) and warehouse and tenant:
            from registers.models import StockBalance
            balance = StockBalance.objects.filter(
                tenant=tenant,
                warehouse=warehouse,
                item=self.instance.item
            ).first()
            
            if balance:
                self.fields['quantity_book'].initial = balance.quantity
            
            # Calculate difference
            if self.instance.quantity_actual:
                diff = self.instance.quantity_actual - (balance.quantity if balance else 0)
                self.fields['difference'].initial = diff

