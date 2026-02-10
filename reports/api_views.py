from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from datetime import datetime, date
from .trial_balance_service import TrialBalanceService

class TrialBalanceAPIView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        tenant = request.user.tenant
        
        # Parse dates
        start_date_str = request.GET.get('start_date')
        end_date_str = request.GET.get('end_date')
        
        if start_date_str:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
        else:
            start_date = date(date.today().year, date.today().month, 1)
            
        if end_date_str:
             end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
        else:
             end_date = date.today()

        data = TrialBalanceService.get_trial_balance(tenant, start_date, end_date)
        
        return Response(data)
