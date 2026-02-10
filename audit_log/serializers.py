from rest_framework import serializers
from .models import AuditLog

class AuditLogSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.username', read_only=True)
    model_name = serializers.CharField(source='content_type.model', read_only=True)
    
    class Meta:
        model = AuditLog
        fields = ['id', 'action', 'user', 'user_name', 'timestamp', 'model_name', 'object_id', 'changes', 'ip_address']
