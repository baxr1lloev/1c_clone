from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.utils.dateparse import parse_date
from documents.services import SequenceRestorationService

class SequenceRestorationView(APIView):
    """
    API Endpoint for Level 7: Sequence Restoration.
    
    POST /reports/sequence/restore/
    Body:
        { "start_date": "2024-01-01" }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        tenant = request.user.tenant
        start_date_str = request.data.get('start_date')
        
        if not start_date_str:
            return Response(
                {'error': 'start_date is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        start_date = parse_date(start_date_str)
        if not start_date:
            return Response(
                {'error': 'Invalid date format'},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        try:
            # Note: This checks periods during execution.
            # If period is closed, it will fail (Expected behavior).
            results = SequenceRestorationService.restore_sequence(
                tenant, start_date, request.user
            )
            return Response(results)
        except Exception as e:
            return Response(
                {'error': str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
