from django.db.models.signals import post_save, pre_delete
from django.dispatch import receiver
from django.contrib.contenttypes.models import ContentType
import json
from .models import AuditLog

# Global exclusion list
EXCLUDE_MODELS = ['auditlog', 'session', 'contenttype', 'logentry']

def register_audit_log(model_class):
    """
    Manually register a model for audit logging if not using middleware/global approach.
    """
    post_save.connect(log_save, sender=model_class)
    pre_delete.connect(log_delete, sender=model_class)

@receiver(post_save)
def log_save(sender, instance, created, **kwargs):
    if sender._meta.app_label in ['admin', 'sessions', 'audit_log']:
        return

    from .middleware import get_current_user
    user = get_current_user()
    
    action = AuditLog.ACTION_create if created else AuditLog.ACTION_UPDATE
    
    # Simple change tracking (naive)
    # Real implementation needs to cache pre-save state to compare.
    # For now we log the full state.
    
    try:
        data = {}
        # Serialize fields... simplified
        for field in instance._meta.fields:
             if field.name not in ['password']:
                val = getattr(instance, field.name)
                data[field.name] = str(val)

        AuditLog.objects.create(
            action=action,
            user=user, # Add user here
            content_type=ContentType.objects.get_for_model(sender),
            object_id=str(instance.pk),
            changes=data # storing full snapshot for now
        )
    except Exception:
        pass # Fail silently to not break logic

@receiver(pre_delete)
def log_delete(sender, instance, **kwargs):
    if sender._meta.app_label in ['admin', 'sessions', 'audit_log']:
        return
        
    AuditLog.objects.create(
        action=AuditLog.ACTION_DELETE,
        content_type=ContentType.objects.get_for_model(sender),
        object_id=str(instance.pk),
        changes={'deleted_state': str(instance)}
    )
