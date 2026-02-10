from functools import wraps
from django.core.exceptions import PermissionDenied
from django.shortcuts import redirect
from django.contrib import messages


class PermissionService:
    """Service to check user permissions."""
    
    @staticmethod
    def user_has_permission(user, permission_code):
        """
        Check if user has a specific permission.
        
        Args:
            user: User instance
            permission_code: String like 'documents.post'
            
        Returns:
            Boolean
        """
        if not user.is_authenticated:
            return False
        
        # Superusers always have permission
        if user.is_superuser:
            return True
        
        # Check if user has role
        if not hasattr(user, 'role') or not user.role:
            return False
        
        # Check if role has permission
        return user.role.role_permissions.filter(
            permission__code=permission_code
        ).exists()
    
    @staticmethod
    def check_permission(user, permission_code):
        """
        Raise PermissionDenied if user doesn't have permission.
        
        Args:
            user: User instance
            permission_code: String like 'documents.post'
            
        Raises:
            PermissionDenied: If user lacks permission
        """
        if not PermissionService.user_has_permission(user, permission_code):
            raise PermissionDenied(
                f"Access denied. Required permission: {permission_code}"
            )
    
    @staticmethod
    def get_user_permissions(user):
        """
        Get all permissions for a user.
        
        Returns:
            QuerySet of Permission objects
        """
        if not user.is_authenticated:
            return []
        
        if user.is_superuser:
            from tenants.models import Permission
            return Permission.objects.all()
        
        if not hasattr(user, 'role') or not user.role:
            return []
        
        from tenants.models import Permission
        return Permission.objects.filter(
            role_assignments__role=user.role
        ).distinct()


def require_permission(permission_code):
    """
    Decorator for function-based views to require permission.
    
    Usage:
        @require_permission('documents.post')
        def my_view(request):
            ...
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            PermissionService.check_permission(request.user, permission_code)
            return view_func(request, *args, **kwargs)
        return wrapper
    return decorator


class PermissionRequiredMixin:
    """
    Mixin to require permission for a class-based view.
    
    Usage:
        class MyView(PermissionRequiredMixin, View):
            permission_required = 'documents.post'
    """
    permission_required = None  # Set this in subclass
    
    def dispatch(self, request, *args, **kwargs):
        if self.permission_required:
            if not PermissionService.user_has_permission(request.user, self.permission_required):
                messages.error(
                    request,
                    f"Access denied. Required permission: {self.permission_required}"
                )
                return redirect('core:dashboard')
        return super().dispatch(request, *args, **kwargs)
