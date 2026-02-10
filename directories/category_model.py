from django.db import models
from django.utils.translation import gettext_lazy as _
from tenants.models import Tenant

class ItemCategory(models.Model):
    """
    Hierarchical category for items (e.g. Goods -> Electronics -> Laptops)
    """
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='item_categories')
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.CASCADE, related_name='children')
    name = models.CharField(_('Name'), max_length=100)
    code = models.CharField(_('Code'), max_length=50, blank=True)
    
    class Meta:
        verbose_name = _('Item Category')
        verbose_name_plural = _('Item Categories')
        unique_together = ('tenant', 'name') # Simple constraint, ideally should be unique under parent

    def __str__(self):
        return self.name
