"""
Dashboard API views for the Next.js frontend.
Provides aggregated statistics and chart data.
"""
from datetime import datetime, timedelta
from decimal import Decimal

from django.db.models import Sum, Count, Q
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from documents.models import SalesDocument, PurchaseDocument, SalesOrder
from registers.models import StockBalance, SettlementsBalance, StockMovement
from directories.models import Item


class DashboardStatsView(APIView):
    """
    Get aggregated dashboard statistics for the current tenant.
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        tenant = request.user.tenant
        today = timezone.now().date()
        month_start = today.replace(day=1)
        
        # Revenue (posted sales this month)
        total_revenue = SalesDocument.objects.filter(
            tenant=tenant,
            is_posted=True,
            date__gte=month_start,
            date__lte=today
        ).aggregate(total=Sum('total_amount'))['total'] or Decimal('0')
        
        # Expenses (posted purchases this month)
        total_expenses = PurchaseDocument.objects.filter(
            tenant=tenant,
            is_posted=True,
            date__gte=month_start,
            date__lte=today
        ).aggregate(total=Sum('total_amount'))['total'] or Decimal('0')
        
        # Net profit
        net_profit = total_revenue - total_expenses
        
        # Receivables (positive settlements = customers owe us)
        total_receivables = SettlementsBalance.objects.filter(
            tenant=tenant,
            balance__gt=0
        ).aggregate(total=Sum('balance'))['total'] or Decimal('0')
        
        # Payables (negative settlements = we owe suppliers)
        total_payables = abs(SettlementsBalance.objects.filter(
            tenant=tenant,
            balance__lt=0
        ).aggregate(total=Sum('balance'))['total'] or Decimal('0'))
        
        # Low stock items (items with balance < 10)
        low_stock_items = StockBalance.objects.filter(
            tenant=tenant,
            balance__lt=10,
            balance__gt=0
        ).count()
        
        # Pending orders (unposted sales orders)
        pending_orders = SalesOrder.objects.filter(
            tenant=tenant,
            is_posted=False
        ).count()
        
        # Documents created today
        documents_today = (
            SalesDocument.objects.filter(tenant=tenant, date=today).count() +
            PurchaseDocument.objects.filter(tenant=tenant, date=today).count()
        )
        
        return Response({
            'total_revenue': float(total_revenue),
            'total_expenses': float(total_expenses),
            'net_profit': float(net_profit),
            'total_receivables': float(total_receivables),
            'total_payables': float(total_payables),
            'low_stock_items': low_stock_items,
            'pending_orders': pending_orders,
            'documents_today': documents_today,
        })


class DashboardRevenueChartView(APIView):
    """
    Get revenue vs expenses chart data for the last 6 months.
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        tenant = request.user.tenant
        today = timezone.now().date()
        chart_data = []
        
        for i in range(5, -1, -1):
            # Calculate month boundaries
            month_date = today - timedelta(days=i * 30)
            month_start = month_date.replace(day=1)
            
            # Get last day of month
            if month_start.month == 12:
                next_month = month_start.replace(year=month_start.year + 1, month=1)
            else:
                next_month = month_start.replace(month=month_start.month + 1)
            month_end = next_month - timedelta(days=1)
            
            # Revenue for this month
            revenue = SalesDocument.objects.filter(
                tenant=tenant,
                is_posted=True,
                date__gte=month_start,
                date__lte=month_end
            ).aggregate(total=Sum('total_amount'))['total'] or Decimal('0')
            
            # Expenses for this month
            expenses = PurchaseDocument.objects.filter(
                tenant=tenant,
                is_posted=True,
                date__gte=month_start,
                date__lte=month_end
            ).aggregate(total=Sum('total_amount'))['total'] or Decimal('0')
            
            chart_data.append({
                'date': month_start.strftime('%Y-%m'),
                'revenue': float(revenue),
                'expenses': float(expenses),
            })
        
        return Response(chart_data)
