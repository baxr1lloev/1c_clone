from django.db import models
from django.utils.translation import gettext_lazy as _
from tenants.models import Tenant
from subscriptions.models import Subscription
from documents.models import PaymentDocument

class Invoice(models.Model):
    STATUS_UNPAID = 'unpaid'
    STATUS_PAID = 'paid'
    STATUS_OVERDUE = 'overdue'
    
    STATUS_CHOICES = [
        (STATUS_UNPAID, _('Unpaid')),
        (STATUS_PAID, _('Paid')),
        (STATUS_OVERDUE, _('Overdue')),
    ]
    
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='invoices')
    subscription = models.ForeignKey(Subscription, on_delete=models.PROTECT, related_name='invoices')
    number = models.CharField(_('Invoice Number'), max_length=50, unique=True)
    amount = models.DecimalField(_('Amount'), max_digits=10, decimal_places=2)
    date_issued = models.DateField(_('Date Issued'), auto_now_add=True)
    due_date = models.DateField(_('Due Date'))
    status = models.CharField(_('Status'), max_length=20, choices=STATUS_CHOICES, default=STATUS_UNPAID)
    
    # Integration with 1C Accounting
    # When an invoice is paid, we can optionally link it to a PaymentDocument (Income)
    payment_document = models.OneToOneField(
        PaymentDocument, 
        on_delete=models.SET_NULL, 
        null=True, blank=True,
        related_name='subscription_invoice',
        help_text=_('Linked payment receipt in accounting system')
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"INV-{self.number} ({self.tenant})"

    class Meta:
        verbose_name = _('Invoice')
        verbose_name_plural = _('Invoices')
