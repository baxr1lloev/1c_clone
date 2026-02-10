from django import template
from tenants.permissions import PermissionService

register = template.Library()


@register.simple_tag(takes_context=True)
def has_perm(context, permission_code):
    """
    Check if current user has a specific permission.
    
    Usage in templates:
        {% load permission_tags %}
        {% has_perm 'documents.post' as can_post %}
        {% if can_post %}
            <button>Post</button>
        {% endif %}
    """
    request = context.get('request')
    if not request or not hasattr(request, 'user'):
        return False
    
    return PermissionService.user_has_permission(request.user, permission_code)


@register.filter
def user_has_permission(user, permission_code):
    """
    Filter version of permission check.
    
    Usage:
        {% if request.user|user_has_permission:'documents.post' %}
            <button>Post</button>
        {% endif %}
    """
    return PermissionService.user_has_permission(user, permission_code)
