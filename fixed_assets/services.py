"""
Depreciation Calculation Service

Handles monthly depreciation calculation and posting for all assets.
"""

from django.db import transaction
from django.utils import timezone
from datetime import date
from decimal import Decimal
from .models import FixedAsset, DepreciationSchedule


class DepreciationService:
    """Service for calculating and posting depreciation"""
    
    @staticmethod
    def calculate_monthly_depreciation_for_all(tenant, period_date=None):
        """
        Calculate monthly depreciation for all active assets.
        
        Args:
            tenant: Tenant object
            period_date: Date for the period (defaults to first day of current month)
        
        Returns:
            dict with summary of calculations
        """
        if period_date is None:
            today = date.today()
            period_date = date(today.year, today.month, 1)
        
        assets = FixedAsset.objects.filter(
            tenant=tenant,
            status='IN_USE',
            commissioning_date__lte=period_date
        )
        
        total_depreciation = Decimal('0.00')
        assets_processed = 0
        assets_skipped = 0
        
        results = []
        
        for asset in assets:
            # Check if already posted for this period
            existing = DepreciationSchedule.objects.filter(
                tenant=tenant,
                asset=asset,
                period=period_date
            ).exists()
            
            if existing:
                assets_skipped += 1
                continue
            
            try:
                monthly_amount = asset.calculate_monthly_depreciation()
                
                if monthly_amount > 0:
                    results.append({
                        'asset_id': asset.id,
                        'asset_name': asset.name,
                        'inventory_number': asset.inventory_number,
                        'amount': monthly_amount
                    })
                    total_depreciation += monthly_amount
                    assets_processed += 1
                else:
                    assets_skipped += 1
            except Exception as e:
                results.append({
                    'asset_id': asset.id,
                    'asset_name': asset.name,
                    'inventory_number': asset.inventory_number,
                    'error': str(e)
                })
                assets_skipped += 1
        
        return {
            'period': period_date,
            'total_depreciation': total_depreciation,
            'assets_processed': assets_processed,
            'assets_skipped': assets_skipped,
            'details': results
        }
    
    @staticmethod
    def post_monthly_depreciation(tenant, period_date=None):
        """
        Post monthly depreciation for all active assets.
        Creates accounting entries and depreciation schedule records.
        
        Args:
            tenant: Tenant object
            period_date: Date for the period (defaults to first day of current month)
        
        Returns:
            dict with summary of postings
        """
        if period_date is None:
            today = date.today()
            period_date = date(today.year, today.month, 1)
        
        assets = FixedAsset.objects.filter(
            tenant=tenant,
            status='IN_USE',
            commissioning_date__lte=period_date
        )
        
        total_depreciation = Decimal('0.00')
        assets_posted = 0
        assets_skipped = 0
        errors = []
        
        with transaction.atomic():
            for asset in assets:
                # Check if already posted for this period
                existing = DepreciationSchedule.objects.filter(
                    tenant=tenant,
                    asset=asset,
                    period=period_date
                ).exists()
                
                if existing:
                    assets_skipped += 1
                    continue
                
                try:
                    entry = asset.post_depreciation(period_date)
                    
                    if entry:
                        monthly_amount = asset.calculate_monthly_depreciation()
                        
                        # Create depreciation schedule record
                        DepreciationSchedule.objects.create(
                            tenant=tenant,
                            asset=asset,
                            period=period_date,
                            amount=monthly_amount,
                            accounting_entry=entry
                        )
                        
                        total_depreciation += monthly_amount
                        assets_posted += 1
                    else:
                        assets_skipped += 1
                except Exception as e:
                    errors.append({
                        'asset_id': asset.id,
                        'asset_name': asset.name,
                        'inventory_number': asset.inventory_number,
                        'error': str(e)
                    })
                    assets_skipped += 1
        
        return {
            'period': period_date,
            'total_depreciation': total_depreciation,
            'assets_posted': assets_posted,
            'assets_skipped': assets_skipped,
            'errors': errors,
            'success': len(errors) == 0
        }
    
    @staticmethod
    def get_depreciation_summary(tenant, start_date, end_date):
        """
        Get depreciation summary for a date range.
        
        Args:
            tenant: Tenant object
            start_date: Start date
            end_date: End date
        
        Returns:
            dict with depreciation summary
        """
        schedules = DepreciationSchedule.objects.filter(
            tenant=tenant,
            period__gte=start_date,
            period__lte=end_date
        ).select_related('asset')
        
        total_depreciation = sum(s.amount for s in schedules)
        
        by_category = {}
        for schedule in schedules:
            category = schedule.asset.category.name
            if category not in by_category:
                by_category[category] = Decimal('0.00')
            by_category[category] += schedule.amount
        
        return {
            'start_date': start_date,
            'end_date': end_date,
            'total_depreciation': total_depreciation,
            'periods_count': schedules.values('period').distinct().count(),
            'assets_count': schedules.values('asset').distinct().count(),
            'by_category': by_category
        }
