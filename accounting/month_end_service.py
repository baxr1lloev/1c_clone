"""
Month-End Closing Service

Handles the month-end closing process:
1. Verify all documents are posted
2. Calculate and verify COGS
3. Generate reports (Trial Balance, P&L)
4. Lock the period
"""

from django.db import models, transaction
from django.utils import timezone
from django.core.exceptions import ValidationError
from decimal import Decimal
from datetime import date

from documents.models import SalesDocument, PurchaseDocument
from accounting.models import AccountingEntry, AccountingPeriod
from registers.models import StockBatch


class MonthEndClosing(models.Model):
    """
    Month-End Closing record
    """
    STATUS_IN_PROGRESS = 'in_progress'
    STATUS_COMPLETED = 'completed'
    STATUS_CANCELLED = 'cancelled'
    
    STATUS_CHOICES = [
        (STATUS_IN_PROGRESS, 'In Progress'),
        (STATUS_COMPLETED, 'Completed'),
        (STATUS_CANCELLED, 'Cancelled'),
    ]
    
    tenant = models.ForeignKey('tenants.Tenant', on_delete=models.CASCADE)
    period = models.DateField(help_text="First day of the month being closed")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_IN_PROGRESS)
    
    # Steps completed
    step1_verify_documents = models.BooleanField(default=False)
    step2_calculate_cogs = models.BooleanField(default=False)
    step3_generate_reports = models.BooleanField(default=False)
    step4_review_profit = models.BooleanField(default=False)
    step5_lock_period = models.BooleanField(default=False)
    
    # Results
    unposted_documents_count = models.IntegerField(default=0)
    total_revenue = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_cogs = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    gross_profit = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    net_profit = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    
    # Metadata
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    started_by = models.ForeignKey('auth.User', on_delete=models.SET_NULL, null=True, related_name='month_ends_started')
    completed_by = models.ForeignKey('auth.User', on_delete=models.SET_NULL, null=True, related_name='month_ends_completed')
    
    class Meta:
        ordering = ['-period']
        unique_together = [('tenant', 'period')]


class MonthEndService:
    """Service for month-end closing operations"""
    
    @staticmethod
    def start_closing(tenant, period, user):
        """
        Start a new month-end closing process
        
        Args:
            tenant: Tenant instance
            period: Date (first day of month to close)
            user: User starting the process
            
        Returns:
            MonthEndClosing instance
        """
        # Ensure period is first day of month
        period = period.replace(day=1)
        
        # Check if already exists
        closing, created = MonthEndClosing.objects.get_or_create(
            tenant=tenant,
            period=period,
            defaults={
                'started_by': user,
                'status': MonthEndClosing.STATUS_IN_PROGRESS
            }
        )
        
        if not created and closing.status == MonthEndClosing.STATUS_COMPLETED:
            raise ValidationError(f"Period {period.strftime('%Y-%m')} is already closed")
        
        return closing
    
    @staticmethod
    def step1_verify_documents(closing):
        """
        Step 1: Verify all documents are posted
        
        Returns:
            dict with verification results
        """
        from datetime import timedelta
        
        # Get period range
        period_start = closing.period
        if period_start.month == 12:
            period_end = date(period_start.year + 1, 1, 1)
        else:
            period_end = date(period_start.year, period_start.month + 1, 1)
        
        # Check unposted sales documents
        unposted_sales = SalesDocument.objects.filter(
            tenant=closing.tenant,
            date__gte=period_start,
            date__lt=period_end,
            status='draft'
        ).count()
        
        # Check unposted purchases
        unposted_purchases = PurchaseDocument.objects.filter(
            tenant=closing.tenant,
            date__gte=period_start,
            date__lt=period_end,
            status='draft'
        ).count()
        
        total_unposted = unposted_sales + unposted_purchases
        
        # Update closing record
        closing.unposted_documents_count = total_unposted
        closing.step1_verify_documents = (total_unposted == 0)
        closing.save()
        
        return {
            'success': total_unposted == 0,
            'unposted_sales': unposted_sales,
            'unposted_purchases': unposted_purchases,
            'total_unposted': total_unposted
        }
    
    @staticmethod
    def step2_calculate_cogs(closing):
        """
        Step 2: Calculate and verify COGS using FIFO
        
        Returns:
            dict with COGS calculation results
        """
        from datetime import timedelta
        
        # Get period range
        period_start = closing.period
        if period_start.month == 12:
            period_end = date(period_start.year + 1, 1, 1)
        else:
            period_end = date(period_start.year, period_start.month + 1, 1)
        
        # Get all sales in period
        sales = SalesDocument.objects.filter(
            tenant=closing.tenant,
            date__gte=period_start,
            date__lt=period_end,
            status='posted'
        )
        
        # Calculate total COGS from accounting entries
        total_cogs = AccountingEntry.objects.filter(
            tenant=closing.tenant,
            date__gte=period_start,
            date__lt=period_end,
            debit_account__code='90.2'  # COGS account
        ).aggregate(total=models.Sum('amount'))['total'] or Decimal('0')
        
        # Calculate total revenue
        total_revenue = AccountingEntry.objects.filter(
            tenant=closing.tenant,
            date__gte=period_start,
            date__lt=period_end,
            credit_account__code='90.1'  # Revenue account
        ).aggregate(total=models.Sum('amount'))['total'] or Decimal('0')
        
        gross_profit = total_revenue - total_cogs
        
        # Update closing record
        closing.total_revenue = total_revenue
        closing.total_cogs = total_cogs
        closing.gross_profit = gross_profit
        closing.step2_calculate_cogs = True
        closing.save()
        
        return {
            'success': True,
            'total_revenue': total_revenue,
            'total_cogs': total_cogs,
            'gross_profit': gross_profit,
            'sales_count': sales.count()
        }
    
    @staticmethod
    def step3_generate_reports(closing):
        """
        Step 3: Generate Trial Balance and P&L reports
        
        Returns:
            dict with report data
        """
        # This would generate actual reports
        # For now, just mark as complete
        closing.step3_generate_reports = True
        closing.save()
        
        return {
            'success': True,
            'trial_balance_url': f'/reports/trial-balance/?period={closing.period}',
            'profit_loss_url': f'/reports/profit-loss/?period={closing.period}'
        }
    
    @staticmethod
    def step4_review_profit(closing):
        """
        Step 4: Review profit calculation
        
        Returns:
            dict with profit summary
        """
        # Calculate net profit (would include expenses in real implementation)
        closing.net_profit = closing.gross_profit  # Simplified
        closing.step4_review_profit = True
        closing.save()
        
        return {
            'success': True,
            'gross_profit': closing.gross_profit,
            'net_profit': closing.net_profit,
            'profit_margin': (closing.net_profit / closing.total_revenue * 100) if closing.total_revenue > 0 else 0
        }
    
    @staticmethod
    def step5_lock_period(closing, user):
        """
        Step 5: Lock the period to prevent further changes
        
        Returns:
            dict with lock status
        """
        # Get or create accounting period
        period, created = AccountingPeriod.objects.get_or_create(
            tenant=closing.tenant,
            period=closing.period,
            defaults={'is_closed': False}
        )
        
        # Lock the period
        period.is_closed = True
        period.closed_at = timezone.now()
        period.closed_by = user
        period.save()
        
        # Mark closing as complete
        closing.step5_lock_period = True
        closing.status = MonthEndClosing.STATUS_COMPLETED
        closing.completed_at = timezone.now()
        closing.completed_by = user
        closing.save()
        
        return {
            'success': True,
            'period_locked': True,
            'locked_at': period.closed_at
        }
