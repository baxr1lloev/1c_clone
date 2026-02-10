from django import template
from core.audit_service import AuditService

register = template.Library()


@register.inclusion_tag('core/audit_history_widget.html', takes_context=True)
def show_audit_history(context, obj, limit=10):
    """
    Display audit history for an object.
    
    Usage in templates:
        {% load audit_tags %}
        {% show_audit_history document %}
    """
    history = AuditService.get_object_history(obj, limit=limit)
    
    return {
        'history': history,
        'object': obj,
        'request': context.get('request'),
    }


@register.simple_tag
def get_action_icon(action):
    """Get icon for action type."""
    icons = {
        'CREATE': '➕',
        'UPDATE': '✏️',
        'DELETE': '🗑️',
        'POST': '📝',
        'UNPOST': '↩️',
        'SUBMIT': '📤',
        'CLOSE': '🔒',
        'REOPEN': '🔓',
    }
    return icons.get(action, '📋')


@register.simple_tag
def get_action_color(action):
    """Get color class for action type."""
    colors = {
        'CREATE': 'success',
        'UPDATE': 'info',
        'DELETE': 'danger',
        'POST': 'primary',
        'UNPOST': 'warning',
        'SUBMIT': 'success',
        'CLOSE': 'danger',
        'REOPEN': 'warning',
    }
    return colors.get(action, 'secondary')
