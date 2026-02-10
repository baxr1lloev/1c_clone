from django.db import models
from django.utils.translation import gettext_lazy as _
from tenants.models import Tenant
from plans.models import SubscriptionPlan

class Subscription(models.Model):
    tenant = models.OneToOneField(Tenant, on_delete=models.CASCADE, related_name='subscription')
    plan = models.ForeignKey(SubscriptionPlan, on_delete=models.PROTECT, related_name='subscriptions')
    start_date = models.DateField(_('Start Date'))
    end_date = models.DateField(_('End Date'))
    is_active = models.BooleanField(_('Is Active'), default=True)
    auto_renew = models.BooleanField(_('Auto Renew'), default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.tenant} - {self.plan}"

    class Meta:
        verbose_name = _('Subscription')
        verbose_name_plural = _('Subscriptions')
