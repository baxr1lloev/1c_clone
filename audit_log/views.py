from rest_framework import viewsets, permissions
from .models import AuditLog
from .serializers import AuditLogSerializer

class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only viewset for viewing system audit logs.
    Only strictly authorized users should view this.
    """
    queryset = AuditLog.objects.all().select_related('user', 'content_type')
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAuthenticated] # Should be IsAdminUser in prod
    filterset_fields = ['action', 'user']
    search_fields = ['object_id', 'user__username']
