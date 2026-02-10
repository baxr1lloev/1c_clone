"""
Tax Engine Service - Evaluates Tax Fields and Generates Reports
"""
from decimal import Decimal
from django.db import transaction, models
from django.db.models import Sum
from .models import TaxReport, TaxReportLine, TaxField
from accounting.models import AccountingEntry



class TaxEngineService:
    """
    Service for calculating and generating tax reports.
    """
    
    @staticmethod
    @transaction.atomic
    def generate_report(tenant, tax_form, period_start, period_end):
        """
        Generate a new tax report for the given period.
        
        IMPORTANT: This creates a SNAPSHOT of ledger data at current moment.
        Future ledger changes will NOT affect this report.
        
        Args:
            tenant: Tenant instance
            tax_form: TaxForm instance
            period_start: date
            period_end: date
            
        Returns:
            TaxReport instance with calculated lines (SNAPSHOT)
        """
        from django.utils import timezone
        
        # Freeze ledger at this moment
        ledger_frozen_at = timezone.now()
        
        # Get the next version number for this period/form
        last_version = TaxReport.objects.filter(
            tenant=tenant,
            form=tax_form,
            period_start=period_start,
            period_end=period_end
        ).aggregate(models.Max('version'))['version__max'] or 0
        
        # Create report instance
        report = TaxReport.objects.create(
            tenant=tenant,
            form=tax_form,
            period_start=period_start,
            period_end=period_end,
            status='draft',
            ledger_frozen_at=ledger_frozen_at,
            version=last_version + 1
        )
        
        # Calculate all fields (ONE TIME ONLY)
        for field in tax_form.fields.all():
            value = TaxEngineService._calculate_field(
                tenant=tenant,
                field=field,
                period_start=period_start,
                period_end=period_end,
                report=report,
                ledger_frozen_at=ledger_frozen_at
            )
            
            TaxReportLine.objects.create(
                report=report,
                field=field,
                value_numeric=value if isinstance(value, Decimal) else Decimal('0'),
                value_text=str(value) if not isinstance(value, Decimal) else '',
                is_manual_override=False
            )
        
        return report
    
    @staticmethod
    def _calculate_field(tenant, field, period_start, period_end, report, ledger_frozen_at=None):
        """
        Calculate value for a single field.
        
        NOTE: ledger_frozen_at is for documentation purposes.
        In a production system, you might query ledger as of that timestamp.
        
        Returns:
            Decimal or str
        """
        if field.source_type == 'MANUAL':
            # Manual fields require user input, default to 0
            return Decimal('0')
        
        elif field.source_type == 'LEDGER':
            # Query ledger based on formula JSON
            # For now, simple implementation
            # Formula format example: {"account": "90.1", "side": "credit"}
            import json
            try:
                config = json.loads(field.formula) if field.formula else {}
                account_code = config.get('account')
                side = config.get('side', 'credit')
                
                if account_code:
                    entries = AccountingEntry.objects.filter(
                        tenant=tenant,
                        date__gte=period_start,
                        date__lte=period_end
                    )
                    
                    # NOTE: In production, you might add:
                    # if ledger_frozen_at:
                    #     entries = entries.filter(created_at__lte=ledger_frozen_at)
                    
                    if side == 'credit':
                        entries = entries.filter(credit_account__code=account_code)
                        total = entries.aggregate(total=Sum('amount'))['total'] or Decimal('0')
                    else:
                        entries = entries.filter(debit_account__code=account_code)
                        total = entries.aggregate(total=Sum('amount'))['total'] or Decimal('0')
                    
                    return total
            except (json.JSONDecodeError, KeyError):
                pass
            
            return Decimal('0')
        
        elif field.source_type == 'FORMULA':
            # Evaluate formula (e.g., "010 + 020 - 030")
            # Get values from other lines in this report
            formula = field.formula
            
            # Simple replacement: find other line codes and replace with values
            for line in report.lines.all():
                if line.field.code in formula:
                    formula = formula.replace(line.field.code, str(line.value_numeric))
            
            try:
                # Evaluate simple arithmetic
                result = eval(formula)
                return Decimal(str(result))
            except:
                return Decimal('0')
        
        return Decimal('0')
    
    @staticmethod
    def recalculate_formulas(report):
        """
        Recalculate all formula-based fields in a report.
        Useful after manual overrides.
        
        IMPORTANT: Only works for DRAFT reports.
        Submitted reports are READ-ONLY snapshots.
        """
        if not report.is_editable():
            raise ValueError("Cannot recalculate a submitted or superseded report. Create a new version instead.")
        
        for line in report.lines.filter(field__source_type='FORMULA'):
            if not line.is_manual_override:
                value = TaxEngineService._calculate_field(
                    tenant=report.tenant,
                    field=line.field,
                    period_start=report.period_start,
                    period_end=report.period_end,
                    report=report,
                    ledger_frozen_at=report.ledger_frozen_at
                )
                line.value_numeric = value
                line.save()

