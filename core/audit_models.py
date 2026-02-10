from django.db import models
from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.utils.translation import gettext_lazy as _
from tenants.models import Tenant


class AuditLog(models.Model):
    """
    System-wide audit log to track all changes.
    WHO did WHAT, WHEN, and WHERE.
    """
    ACTION_CREATE = 'CREATE'
    ACTION_UPDATE = 'UPDATE'
    ACTION_DELETE = 'DELETE'
    ACTION_POST = 'POST'
    ACTION_UNPOST = 'UNPOST'
    ACTION_SUBMIT = 'SUBMIT'
    ACTION_CLOSE = 'CLOSE'
    ACTION_REOPEN = 'REOPEN'
    
    ACTION_CHOICES = [
        (ACTION_CREATE, _('Created')),
        (ACTION_UPDATE, _('Updated')),
        (ACTION_DELETE, _('Deleted')),
        (ACTION_POST, _('Posted')),
        (ACTION_UNPOST, _('Unposted')),
        (ACTION_SUBMIT, _('Submitted')),
        (ACTION_CLOSE, _('Closed')),
        (ACTION_REOPEN, _('Reopened')),
    ]
    
    # Who
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='audit_logs')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='audit_logs'
    )
    
    # What
    action = models.CharField(_('Action'), max_length=20, choices=ACTION_CHOICES)
    model_name = models.CharField(_('Model'), max_length=100)
    object_id = models.CharField(_('Object ID'), max_length=100)
    object_repr = models.CharField(_('Object'), max_length=200, blank=True)
    
    # Generic relation to any object
    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='core_audit_logs'
    )
    content_object = GenericForeignKey('content_type', 'object_id')
    
    # Details
    changes = models.JSONField(_('Changes'), default=dict, blank=True)
    # Format: {'field_name': {'old': value, 'new': value}, ...}
    
    # When
    timestamp = models.DateTimeField(_('Timestamp'), auto_now_add=True)
    
    # Where (optional)
    ip_address = models.GenericIPAddressField(_('IP Address'), null=True, blank=True)
    user_agent = models.TextField(_('User Agent'), blank=True)
    
    class Meta:
        verbose_name = _('Audit Log')
        verbose_name_plural = _('Audit Logs')
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['tenant', 'timestamp']),
            models.Index(fields=['model_name', 'object_id']),
            models.Index(fields=['user', 'timestamp']),
        ]
    
    def __str__(self):
        return f"{self.user} {self.action} {self.model_name}#{self.object_id} at {self.timestamp}"
