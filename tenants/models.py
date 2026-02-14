from django.db import models
from django.utils.translation import gettext_lazy as _

class Tenant(models.Model):
    """
    Represents a company/organization.
    Everything in the system belongs to a tenant.
    """
    company_name = models.CharField(_('Company Name'), max_length=255)
    inn = models.CharField(_('INN'), max_length=20, blank=True, default='')
    
    # Configuration
    base_currency = models.ForeignKey('directories.Currency', on_delete=models.SET_NULL, null=True, blank=True, related_name='tenants')
    default_language = models.CharField(_('Default Language'), max_length=10, default='ru', choices=[
        ('ru', 'Russian'),
        ('en', 'English'),
        ('uz', 'Uzbek'),
    ])
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return self.company_name

    class Meta:
        verbose_name = _('Tenant')
        verbose_name_plural = _('Tenants')


class Role(models.Model):
    """
    User roles for RBAC.
    """
    ROLE_CHOICES = [
        ('OWNER', _('Owner')),
        ('ACCOUNTANT', _('Accountant')),
        ('MANAGER', _('Manager')),
        ('WAREHOUSE', _('Warehouse Keeper')),
        ('VIEWER', _('Viewer')),
    ]
    
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='roles', null=True, blank=True)
    name = models.CharField(_('Role Name'), max_length=50)
    code = models.CharField(_('Role Code'), max_length=20, choices=ROLE_CHOICES)
    
    def __str__(self):
        return f"{self.name} ({self.tenant})"

    class Meta:
        verbose_name = _('Role')
        verbose_name_plural = _('Roles')
        unique_together = ('tenant', 'code')


class Permission(models.Model):
    """
    Granular permission for RBAC.
    Examples: 'documents.post', 'accounting.view_reports'
    """
    code = models.CharField(_('Permission Code'), max_length=100, unique=True)
    name = models.CharField(_('Permission Name'), max_length=200)
    description = models.TextField(_('Description'), blank=True)
    
    def __str__(self):
        return f"{self.code} - {self.name}"
    
    class Meta:
        verbose_name = _('Permission')
        verbose_name_plural = _('Permissions')
        ordering = ['code']


class RolePermission(models.Model):
    """
    Many-to-Many relationship: Role -> Permissions
    """
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name='role_permissions')
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE, related_name='role_assignments')
    
    def __str__(self):
        return f"{self.role.name} -> {self.permission.code}"
    
    class Meta:
        verbose_name = _('Role Permission')
        verbose_name_plural = _('Role Permissions')
        unique_together = ('role', 'permission')

