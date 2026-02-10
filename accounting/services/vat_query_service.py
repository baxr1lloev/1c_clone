"""
VATQueryService - Optimized read operations for VAT system.

Implements CQRS-lite pattern: all READ operations go through this service.
WRITE operations still use models directly.

Performance improvements:
- Caching for expensive aggregations
- Optimized querysets (select_related, prefetch_related)
- Single source of truth for complex queries
"""
from django.db.models import Sum, Count, Q, F, Avg, Max, Min
from django.utils import timezone
from datetime import date, timedelta
from decimal import Decimal
from typing import Dict, List, Optional, Any
import logging

from accounting.vat import (
    ElectronicInvoice, VATTransaction, VATDeclaration, 
    ESoliqIntegrationLog, VATRate
)
from directories.models import Counterparty
from tenants.models import Tenant
from .base import BaseQueryService, cached_query

logger = logging.getLogger(__name__)


class VATQueryService(BaseQueryService):
    """
    Read-only queries for VAT system.
    
    All dashboard, list, report, and search queries use this service.
    Never use this for WRITE operations!
    
    Methods:
        Dashboard: get_dashboard_summary()
        Lists: get_invoices_queryset(), get_declarations_queryset()
        Reports: get_declaration_breakdown(), get_vat_analysis()
        Search: search_invoices()
    """
    
    cache_timeout = 180  # 3 minutes (VAT data changes frequently)
    
    # ────────────────────────────────────────────────────────
    # Dashboard Queries (HEAVY - must be cached!)
    # ────────────────────────────────────────────────────────
    
    @classmethod
    @cached_query(timeout=120)  # 2 minutes for dashboard
    def get_dashboard_summary(cls, tenant: Tenant, period: Optional[date] = None) -> Dict[str, Any]:
        """
        Get VAT dashboard summary (OPTIMIZED with cache).
        
        Returns:
            {
                'current_period': '2024-01',
                'output_vat': Decimal('12000.00'),
                'input_vat': Decimal('3600.00'),
                'vat_payable': Decimal('8400.00'),
                'pending_invoices_count': 5,
                'recent_invoices': [...],
                'recent_activity': [...],
            }
        """
        if period is None:
            period = timezone.now().date().replace(day=1)
        
        logger.info(f"Querying VAT dashboard for tenant={tenant.id}, period={period}")
        
        # Single optimized aggregation query
        vat_summary = VATTransaction.objects.filter(
            tenant=tenant,
            period=period
        ).aggregate(
            output_vat=Sum('vat_amount', filter=Q(vat_type='OUTPUT')),
            input_vat=Sum('vat_amount', filter=Q(vat_type='INPUT')),
            total_transactions=Count('id'),
            avg_transaction=Avg('vat_amount')
        )
        
        output_vat = vat_summary['output_vat'] or Decimal('0')
        input_vat = vat_summary['input_vat'] or Decimal('0')
        
        # Count pending invoices (single query)
        pending_counts = ElectronicInvoice.objects.filter(
            tenant=tenant
        ).aggregate(
            draft=Count('id', filter=Q(status='DRAFT')),
            sent=Count('id', filter=Q(status='SENT')),
        )
        
        # Recent invoices (optimized)
        recent_invoices = cls._get_recent_invoices(tenant, limit=10)
        
        # Recent E-Soliq activity
        recent_activity = cls._get_recent_esoliq_activity(tenant, limit=10)
        
        return {
            'current_period': period.strftime('%Y-%m'),
            'output_vat': float(output_vat),
            'input_vat': float(input_vat),
            'vat_payable': float(output_vat - input_vat),
            'total_transactions': vat_summary['total_transactions'] or 0,
            'avg_transaction': float(vat_summary['avg_transaction'] or 0),
            'pending_draft_count': pending_counts['draft'],
            'pending_sent_count': pending_counts['sent'],
            'recent_invoices': recent_invoices,
            'recent_activity': recent_activity,
        }
    
    @classmethod
    def _get_recent_invoices(cls, tenant: Tenant, limit: int = 10) -> List[Dict]:
        """Get recent invoices (optimized with select_related)"""
        invoices = ElectronicInvoice.objects.filter(
            tenant=tenant
        ).select_related(
            'counterparty', 'vat_rate', 'created_by'
        ).order_by('-created_at')[:limit]
        
        return [{
            'id': inv.id,
            'number': inv.number,
            'date': inv.date.isoformat(),
            'type': inv.get_invoice_type_display(),
            'counterparty': inv.counterparty.name,
            'total_amount': float(inv.total_amount),
            'status': inv.get_status_display(),
            'status_code': inv.status,
        } for inv in invoices]
    
    @classmethod
    def _get_recent_esoliq_activity(cls, tenant: Tenant, limit: int = 10) -> List[Dict]:
        """Get recent E-Soliq activity (optimized)"""
        logs = ESoliqIntegrationLog.objects.filter(
            tenant=tenant
        ).select_related(
            'invoice', 'invoice__counterparty'
        ).order_by('-created_at')[:limit]
        
        return [{
            'timestamp': log.created_at.isoformat(),
            'action': log.get_action_display(),
            'status': log.get_status_display(),
            'invoice_number': log.invoice.number if log.invoice else None,
        } for log in logs]
    
    # ────────────────────────────────────────────────────────
    # Invoice Queries (LIST views)
    # ────────────────────────────────────────────────────────
    
    @classmethod
    def get_invoices_queryset(cls, tenant: Tenant, **filters):
        """
        Get optimized queryset for invoice list.
        
        Filters:
            status: str  # 'DRAFT', 'SENT', 'ACCEPTED', etc.
            invoice_type: str  # 'IN', 'OUT', etc.
            date_from: date
            date_to: date
            counterparty_id: int
            search: str  # Search by number, TIN, etc.
        
        Returns:
            Optimized QuerySet with select_related applied
        """
        qs = ElectronicInvoice.objects.filter(tenant=tenant)
        
        # Apply filters
        if filters.get('status'):
            qs = qs.filter(status=filters['status'])
        
        if filters.get('invoice_type'):
            qs = qs.filter(invoice_type=filters['invoice_type'])
        
        if filters.get('date_from'):
            qs = qs.filter(date__gte=filters['date_from'])
        
        if filters.get('date_to'):
            qs = qs.filter(date__lte=filters['date_to'])
        
        if filters.get('counterparty_id'):
            qs = qs.filter(counterparty_id=filters['counterparty_id'])
        
        if filters.get('search'):
            search = filters['search']
            qs = qs.filter(
                Q(number__icontains=search) |
                Q(counterparty__name__icontains=search) |
                Q(counterparty_tin__icontains=search) |
                Q(esoliq_uuid__icontains=search)
            )
        
        # Optimize: select_related for ForeignKeys
        qs = qs.select_related(
            'counterparty',
            'vat_rate',
            'created_by',
            'vat_transaction'
        )
        
        # Order by recent first
        qs = qs.order_by('-date', '-created_at')
        
        return qs
    
    @classmethod
    def get_pending_invoices(cls, tenant: Tenant):
        """Get all pending invoices (DRAFT + SENT)"""
        return cls.get_invoices_queryset(
            tenant,
            status__in=['DRAFT', 'SENT']
        )
    
    # ────────────────────────────────────────────────────────
    # Declaration Queries
    # ────────────────────────────────────────────────────────
    
    @classmethod
    @cached_query(timeout=300)  # 5 minutes for breakdown
    def get_declaration_breakdown(cls, tenant: Tenant, period: date) -> Dict[str, Any]:
        """
        Get detailed VAT breakdown for declaration.
        
        Args:
            tenant: Tenant instance
            period: Period as date (YYYY-MM-01)
        
        Returns:
            {
                'period': '2024-01',
                'output_by_counterparty': [
                    {'counterparty': 'Customer A', 'vat': 5000, 'count': 3},
                    ...
                ],
                'input_by_counterparty': [...],
                'total_output': 12000,
                'total_input': 3600,
                'net_payable': 8400,
                'invoice_count': 15,
            }
        """
        logger.info(f"Building declaration breakdown for tenant={tenant.id}, period={period}")
        
        # Output VAT by counterparty (single query with annotation)
        output_invoices = ElectronicInvoice.objects.filter(
            tenant=tenant,
            date__year=period.year,
            date__month=period.month,
            status='ACCEPTED',
            invoice_type__in=['OUT', 'RETURN_IN', 'EXPORT', 'AGENT']
        ).values(
            'counterparty__name'
        ).annotate(
            total_vat=Sum('vat_amount'),
            invoice_count=Count('id')
        ).order_by('-total_vat')
        
        # Input VAT by counterparty
        input_invoices = ElectronicInvoice.objects.filter(
            tenant=tenant,
            date__year=period.year,
            date__month=period.month,
            status='ACCEPTED',
            invoice_type__in=['IN', 'RETURN_OUT']
        ).values(
            'counterparty__name'
        ).annotate(
            total_vat=Sum('vat_amount'),
            invoice_count=Count('id')
        ).order_by('-total_vat')
        
        output_list = list(output_invoices)
        input_list = list(input_invoices)
        
        total_output = sum(float(item['total_vat']) for item in output_list)
        total_input = sum(float(item['total_vat']) for item in input_list)
        
        return {
            'period': period.strftime('%Y-%m'),
            'output_by_counterparty': [
                {
                    'counterparty': item['counterparty__name'],
                    'vat': float(item['total_vat']),
                    'count': item['invoice_count']
                }
                for item in output_list
            ],
            'input_by_counterparty': [
                {
                    'counterparty': item['counterparty__name'],
                    'vat': float(item['total_vat']),
                    'count': item['invoice_count']
                }
                for item in input_list
            ],
            'total_output': total_output,
            'total_input': total_input,
            'net_payable': total_output - total_input,
            'invoice_count': len(output_list) + len(input_list),
        }
    
    @classmethod
    def get_declarations_queryset(cls, tenant: Tenant):
        """Get optimized queryset for declarations list"""
        return VATDeclaration.objects.filter(
            tenant=tenant
        ).select_related(
            'submitted_by'
        ).order_by('-period')
    
    # ────────────────────────────────────────────────────────
    # Search / Autocomplete
    # ────────────────────────────────────────────────────────
    
    @classmethod
    def search_invoices(cls, tenant: Tenant, query: str, limit: int = 20):
        """
        Search invoices by number, counterparty name, TIN, or E-Soliq UUID.
        
        Args:
            tenant: Tenant instance
            query: Search string
            limit: Max results
        
        Returns:
            QuerySet of matching invoices
        """
        return ElectronicInvoice.objects.filter(
            tenant=tenant
        ).filter(
            Q(number__icontains=query) |
            Q(counterparty__name__icontains=query) |
            Q(counterparty_tin__icontains=query) |
            Q(esoliq_uuid__icontains=query)
        ).select_related(
            'counterparty', 'vat_rate'
        )[:limit]
    
    # ────────────────────────────────────────────────────────
    # Analytics / Reports
    # ────────────────────────────────────────────────────────
    
    @classmethod
    @cached_query(timeout=600)  # 10 minutes for analytics
    def get_vat_trend_analysis(cls, tenant: Tenant, months: int = 6) -> Dict[str, Any]:
        """
        Get VAT trend over N months.
        
        Returns:
            {
                'labels': ['2023-08', '2023-09', ...],
                'output_vat': [10000, 12000, ...],
                'input_vat': [3000, 3600, ...],
                'net_payable': [7000, 8400, ...],
            }
        """
        today = timezone.now().date()
        periods = []
        for i in range(months):
            period = (today.replace(day=1) - timedelta(days=30*i)).replace(day=1)
            periods.append(period)
        periods.reverse()
        
        labels = []
        output_data = []
        input_data = []
        net_data = []
        
        for period in periods:
            summary = VATTransaction.objects.filter(
                tenant=tenant,
                period=period
            ).aggregate(
                output=Sum('vat_amount', filter=Q(vat_type='OUTPUT')),
                input_vat=Sum('vat_amount', filter=Q(vat_type='INPUT'))
            )
            
            output_val = float(summary['output'] or 0)
            input_val = float(summary['input_vat'] or 0)
            
            labels.append(period.strftime('%Y-%m'))
            output_data.append(output_val)
            input_data.append(input_val)
            net_data.append(output_val - input_val)
        
        return {
            'labels': labels,
            'output_vat': output_data,
            'input_vat': input_data,
            'net_payable': net_data,
        }
