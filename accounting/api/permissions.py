"""
Custom permissions for API access control.
"""
from rest_framework import permissions


class IsTenantMember(permissions.BasePermission):
    """
    Permission to check user belongs to tenant.
    Ensures tenant isolation in API.
    """
    
    def has_permission(self, request, view):
        """Check user has tenant"""
        return hasattr(request.user, 'tenant') and request.user.tenant is not None
    
    def has_object_permission(self, request, view, obj):
        """Check object belongs to user's tenant"""
        if hasattr(obj, 'tenant'):
            return obj.tenant == request.user.tenant
        return True
