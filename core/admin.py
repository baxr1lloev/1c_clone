from django.contrib import admin
from .audit_models import AuditLog

@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ('timestamp', 'action', 'user', 'model_name', 'object_repr', 'tenant')
    list_filter = ('action', 'model_name', 'tenant')
    search_fields = ('object_id', 'object_repr', 'changes', 'user__email')
    readonly_fields = ('timestamp', 'changes')
    date_hierarchy = 'timestamp'

    def has_add_permission(self, request):
        return False
        
    def has_change_permission(self, request, obj=None):
        return False
        
    def has_delete_permission(self, request, obj=None):
        return False
