from django.contrib.contenttypes.models import ContentType
from django.utils import timezone
from core.audit_models import AuditLog


class AuditService:
    """Service for creating audit log entries."""
    
    @staticmethod
    def log_action(user, action, obj, changes=None, request=None):
        """
        Create an audit log entry.
        
        Args:
            user: User who performed the action
            action: Action type (CREATE, UPDATE, DELETE, etc.)
            obj: The object that was changed
            changes: Dict of changes {'field': {'old': val, 'new': val}}
            request: HTTP request object (for IP, user agent)
        """
        if not hasattr(obj, 'tenant'):
            # Skip objects without tenant
            return None
        
        ip_address = None
        user_agent = ""
        
        if request:
            ip_address = AuditService._get_client_ip(request)
            user_agent = request.META.get('HTTP_USER_AGENT', '')[:500]
        
        content_type = ContentType.objects.get_for_model(obj)
        
        return AuditLog.objects.create(
            tenant=obj.tenant,
            user=user,
            action=action,
            model_name=obj.__class__.__name__,
            object_id=str(obj.pk),
            object_repr=str(obj)[:200],
            content_type=content_type,
            changes=changes or {},
            ip_address=ip_address,
            user_agent=user_agent,
        )
    
    @staticmethod
    def log_create(user, obj, request=None):
        """Log object creation."""
        return AuditService.log_action(
            user, AuditLog.ACTION_CREATE, obj, request=request
        )
    
    @staticmethod
    def log_update(user, obj, changes, request=None):
        """Log object update with changes."""
        return AuditService.log_action(
            user, AuditLog.ACTION_UPDATE, obj, changes=changes, request=request
        )
    
    @staticmethod
    def log_delete(user, obj, request=None):
        """Log object deletion."""
        return AuditService.log_action(
            user, AuditLog.ACTION_DELETE, obj, request=request
        )
    
    @staticmethod
    def log_post(user, obj, request=None):
        """Log document posting."""
        return AuditService.log_action(
            user, AuditLog.ACTION_POST, obj, request=request
        )
    
    @staticmethod
    def log_unpost(user, obj, request=None):
        """Log document unposting."""
        return AuditService.log_action(
            user, AuditLog.ACTION_UNPOST, obj, request=request
        )
    
    @staticmethod
    def log_submit(user, obj, request=None):
        """Log submission (e.g., tax report)."""
        return AuditService.log_action(
            user, AuditLog.ACTION_SUBMIT, obj, request=request
        )
    
    @staticmethod
    def log_close(user, obj, request=None):
        """Log period closing."""
        return AuditService.log_action(
            user, AuditLog.ACTION_CLOSE, obj, request=request
        )
    
    @staticmethod
    def log_reopen(user, obj, request=None):
        """Log period reopening."""
        return AuditService.log_action(
            user, AuditLog.ACTION_REOPEN, obj, request=request
        )
    
    @staticmethod
    def get_object_history(obj, limit=50):
        """Get audit history for a specific object."""
        content_type = ContentType.objects.get_for_model(obj)
        return AuditLog.objects.filter(
            content_type=content_type,
            object_id=str(obj.pk)
        ).select_related('user')[:limit]
    
    @staticmethod
    def get_user_activity(user, tenant, limit=100):
        """Get recent activity for a user."""
        return AuditLog.objects.filter(
            user=user,
            tenant=tenant
        ).select_related('content_type')[:limit]
    
    @staticmethod
    def _get_client_ip(request):
        """Extract client IP from request."""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip
