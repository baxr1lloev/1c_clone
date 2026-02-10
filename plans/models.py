from django.db import models
from django.utils.translation import gettext_lazy as _

class SubscriptionPlan(models.Model):
    name = models.CharField(_('Plan Name'), max_length=50)
    price_monthly = models.DecimalField(_('Monthly Price'), max_digits=10, decimal_places=2)
    max_users = models.IntegerField(_('Max Users'), default=1)
    max_storage_gb = models.IntegerField(_('Max Storage (GB)'), default=1)
    features = models.TextField(_('Features'), blank=True, help_text="JSON or comma-separated list")
    
    def __str__(self):
        return self.name

    class Meta:
        verbose_name = _('Subscription Plan')
        verbose_name_plural = _('Subscription Plans')
