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

class ProfitLossAPIView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        tenant = request.user.tenant
        
        # Parse dates
        start_date_str = request.GET.get('start_date')
        end_date_str = request.GET.get('end_date')
        
        # Comparison period (optional)
        compare_start_str = request.GET.get('compare_start_date')
        compare_end_str = request.GET.get('compare_end_date')
        
        if start_date_str:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
        else:
            start_date = date(date.today().year, date.today().month, 1)
            
        if end_date_str:
             end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
        else:
             end_date = date.today()

        compare_start = None
        compare_end = None
        if compare_start_str and compare_end_str:
            compare_start = datetime.strptime(compare_start_str, '%Y-%m-%d').date()
            compare_end = datetime.strptime(compare_end_str, '%Y-%m-%d').date()
            
        from .services.profit_loss_service import ProfitLossService
        data = ProfitLossService.get_report(tenant, start_date, end_date, compare_start, compare_end)
        
        return Response(data)

class AccountCardAPIView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        tenant = request.user.tenant
        account_id = request.GET.get('account_id')
        
        if not account_id:
             return Response({'error': 'account_id is required'}, status=400)
        
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
             
        from .services.account_card_service import AccountCardService
        data = AccountCardService.get_report(tenant, account_id, start_date, end_date)
        
        return Response(data)
