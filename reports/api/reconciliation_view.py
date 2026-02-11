from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from reports.reconciliation_service import ReconciliationService

class ReconciliationView(APIView):
    """
    API Endpoint for Level 6: Reconciliation.
    
    GET /reports/reconciliation/check/
    Runs full reconciliation analysis.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        tenant = request.user.tenant
        
        try:
            results = ReconciliationService.full_reconciliation(tenant)
            return Response(results)
        except Exception as e:
            return Response(
                {'error': str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
