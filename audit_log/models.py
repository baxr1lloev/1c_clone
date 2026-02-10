from django.db import models
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey

User = get_user_model()

class AuditLog(models.Model):
    ACTION_create = 'create'
    ACTION_UPDATE = 'update'
    ACTION_DELETE = 'delete'
    ACTION_POST = 'post'
    ACTION_UNPOST = 'unpost'
    
    ACTIONS = [
        (ACTION_create, 'Create'),
        (ACTION_UPDATE, 'Update'),
        (ACTION_DELETE, 'Delete'),
        (ACTION_POST, 'Post'),
        (ACTION_UNPOST, 'Unpost'),
    ]

    action = models.CharField(max_length=20, choices=ACTIONS)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    
    # Target Object
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE, related_name='audit_log_entries')
    object_id = models.CharField(max_length=50) # Use CharField to support UUIDs/BigInts
    content_object = GenericForeignKey('content_type', 'object_id')
    
    # Data
    changes = models.JSONField(null=True, blank=True) # { "field": [old, new] }
    
    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['content_type', 'object_id']),
            models.Index(fields=['user']),
        ]

    def __str__(self):
        return f"{self.user} {self.action} {self.content_type} ({self.timestamp})"
