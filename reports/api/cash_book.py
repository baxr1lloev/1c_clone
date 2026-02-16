from datetime import date, datetime

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from reports.cash_book_service import CashBookService


class CashBookView(APIView):
    """Daily cash book report API."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        tenant = request.user.tenant

        start_date_str = request.GET.get("start_date")
        end_date_str = request.GET.get("end_date")

        if start_date_str:
            start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
        else:
            today = date.today()
            start_date = date(today.year, today.month, 1)

        if end_date_str:
            end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
        else:
            end_date = date.today()

        if end_date < start_date:
            return Response({"error": "end_date must be greater than or equal to start_date"}, status=400)

        data = CashBookService.get_report(tenant, start_date, end_date)
        return Response(data)
