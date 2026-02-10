from django.views.generic import ListView
from django.contrib.auth.mixins import LoginRequiredMixin
from core.audit_models import AuditLog
from tenants.permissions import PermissionRequiredMixin


class AuditLogListView(LoginRequiredMixin, PermissionRequiredMixin, ListView):
    """View all audit logs for the tenant."""
    model = AuditLog
    template_name = 'core/audit_log_list.html'
    context_object_name = 'logs'
    paginate_by = 50
    permission_required = 'admin.manage_tenant'  # Only owners can view full audit
    
    def get_queryset(self):
        return AuditLog.objects.filter(
            tenant=self.request.user.tenant
        ).select_related('user', 'content_type')
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        
        # Filter options
        action_filter = self.request.GET.get('action')
        user_filter = self.request.GET.get('user')
        model_filter = self.request.GET.get('model')
        
        queryset = self.get_queryset()
        
        if action_filter:
            queryset = queryset.filter(action=action_filter)
        if user_filter:
            queryset = queryset.filter(user_id=user_filter)
        if model_filter:
            queryset = queryset.filter(model_name=model_filter)
        
        context['filtered_logs'] = queryset[:self.paginate_by]
        context['action_choices'] = AuditLog.ACTION_CHOICES
        
        return context


class ObjectAuditHistoryView(LoginRequiredMixin, ListView):
    """View audit history for a specific object (embedded in detail views)."""
    model = AuditLog
    template_name = 'core/object_audit_history.html'
    context_object_name = 'history'
    
    def get_queryset(self):
        from django.contrib.contenttypes.models import ContentType
        
        # Get object details from kwargs
        model_name = self.kwargs.get('model_name')
        object_id = self.kwargs.get('object_id')
        
        # Get content type
        try:
            content_type = ContentType.objects.get(model=model_name.lower())
        except ContentType.DoesNotExist:
            return AuditLog.objects.none()
        
        return AuditLog.objects.filter(
            tenant=self.request.user.tenant,
            content_type=content_type,
            object_id=str(object_id)
        ).select_related('user')[:20]
