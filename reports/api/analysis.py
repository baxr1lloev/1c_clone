from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from datetime import datetime, date
from ..services.account_analysis import AccountAnalysisService

class AccountAnalysisView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request, account_id):
        tenant = request.user.tenant
        
        # Parse params
        start_date_str = request.GET.get('start_date')
        end_date_str = request.GET.get('end_date')
        group_by = request.GET.get('group_by', 'counterparty')
        
        if start_date_str:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
        else:
            start_date = date(date.today().year, date.today().month, 1)
            
        if end_date_str:
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
        else:
            end_date = date.today()
            
        try:
            data = AccountAnalysisService.get_analysis(
                tenant, 
                account_id, 
                start_date, 
                end_date, 
                group_by
            )
            return Response(data)
        except ValueError as e:
            return Response({'error': str(e)}, status=400)
        except Exception as e:
            return Response({'error': str(e)}, status=500)
