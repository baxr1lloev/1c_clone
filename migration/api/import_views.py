# migration/api/import_views.py
"""
API endpoints for 1C data import.

POST /migration/api/import/ - Import from 1C XML file
POST /migration/api/validate-import/ - Validate import without saving
GET /migration/api/import-status/ - Get import progress status
"""

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.core.files.uploadedfile import UploadedFile
import logging

from migration.import_service import ImportService
from migration.parsers.c1_xml_parser import C1XmlParser

logger = logging.getLogger(__name__)


@api_view(['POST'])
@permission_classes([IsAuthenticated])  # TODO: Add IsOwnerOrAccountant when users app exists
def import_from_1c(request):
    """
    Import data from 1C XML export file.
    
    Request:
        - file: XML file from 1C export
        - validate_only: (optional) If true, only validate without saving
    
    Response:
        {
            "success": true,
            "progress": {
                "total": 150,
                "processed": 150,
                "created": 120,
                "updated": 25,
                "skipped": 5,
                "errors": []
            },
            "message": "Import completed successfully"
        }
    """
    try:
        # Get uploaded file
        if 'file' not in request.FILES:
            return Response(
                {'error': 'No file provided'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        xml_file = request.FILES['file']
        validate_only = request.data.get('validate_only', 'false').lower() == 'true'
        
        # Limit file size (100MB max)
        if xml_file.size > 100 * 1024 * 1024:
            return Response(
                {' error': 'File too large (max 100MB)'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Parse XML
        logger.info(f"Parsing 1C XML file: {xml_file.name} ({xml_file.size} bytes)")
        parser = C1XmlParser()
        
        # Read file content
        xml_content = xml_file.read()
        parsed_data = parser.parse_xml(xml_content.decode('utf-8'))
        
        # Import data
        logger.info(f"Starting import (validate_only={validate_only})")
        import_service = ImportService(tenant=request.user.tenant)
        result = import_service.import_all(parsed_data, validate_only=validate_only)
        
        if result['success']:
            return Response(result, status=status.HTTP_200_OK)
        else:
            return Response(result, status=status.HTTP_400_BAD_REQUEST)
        
    except Exception as e:
        logger.error(f"Import failed: {str(e)}", exc_info=True)
        return Response(
            {
                'success': False,
                'error': str(e)
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])  # TODO: Add IsOwnerOrAccountant when users app exists
def validate_import(request):
    """
    Validate 1C import without actually saving data.
    
    Same as import_from_1c but automatically sets validate_only=True
    """
    # Add  validate_only parameter
    data = request.data.copy()
    data['validate_only'] = 'true'
    request._full_data = data
    
    return import_from_1c(request)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def import_status(request):
    """
    Get current import status (for progress reporting).
    
    TODO: Implement using celery task ID or session storage
    """
    return Response({
        'status': 'not_implemented',
        'message': 'Real-time progress tracking coming soon'
    })
