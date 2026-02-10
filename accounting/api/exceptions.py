"""
Custom exception handler for consistent error responses.
"""
from rest_framework.views import exception_handler
from rest_framework.response import Response
from django.core.exceptions import ValidationError as DjangoValidationError


def custom_exception_handler(exc, context):
    """
    Custom exception handler for API.
    
    Returns consistent error format:
    {
        "status": "error",
        "code": "ERROR_CODE",
        "message": "Human readable message",
        "details": {...}  # Optional
    }
    """
    # Call DRF's default handler first
    response = exception_handler(exc, context)
    
    if response is not None:
        # DRF exception
        error_data = {
            'status': 'error',
            'code': exc.__class__.__name__,
            'message': str(exc),
        }
        
        # Add details if available
        if hasattr(exc, 'detail'):
            error_data['details'] = exc.detail
        
        response.data = error_data
    else:
        # Django ValidationError
        if isinstance(exc, DjangoValidationError):
            response = Response({
                'status': 'error',
                'code': 'VALIDATION_ERROR',
                'message': str(exc),
            }, status=400)
    
    return response
