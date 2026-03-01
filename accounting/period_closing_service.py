"""
Period Closing Service

Orchestrates all month-end closing operations:
- Depreciation calculation
- Exchange differences
- P&L closing
- VAT calculation
- Period lock
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional, Dict, Any, List
from dataclasses import dataclass

from django.db import transaction
from django.db.models import Sum, F
from django.utils import timezone

from tenants.models import Tenant
from accounting.models import ChartOfAccounts, AccountingEntry, PeriodClosing
from directories.models import Currency, ExchangeRate


@dataclass
class ClosingTask:
    """Represents a closing task with status"""
    code: str
    name: str
    name_ru: str
    description: str
    status: str  # 'pending', 'completed', 'skipped', 'error'
    result: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    order: int = 0


@dataclass
class TaskResult:
    """Result of executing a closing task"""
    success: bool
    task_code: str
    message: str
    data: Optional[Dict[str, Any]] = None
    entries_created: int = 0
    total_amount: Decimal = Decimal('0')


class PeriodClosingService:
    """
    1C-Style Period Closing Wizard Service
    
    Provides step-by-step month-end closing with:
    - Task status tracking
    - Individual task execution
    - Full period close
    """
    
    TASKS = [
        ('DEPRECIATION', 'Calculate Depreciation', 'Расчёт амортизации', 'Post monthly depreciation for fixed assets'),
        ('EXCHANGE_DIFF', 'Exchange Differences', 'Курсовые разницы', 'Revalue foreign currency balances'),
        ('CLOSE_PL', 'Close P&L Accounts', 'Закрытие счетов', 'Transfer P&L to retained earnings'),
        ('VAT', 'Calculate VAT', 'Расчёт НДС', 'Calculate VAT payable for the period'),
        ('LOCK', 'Lock Period', 'Закрыть период', 'Lock period to prevent modifications'),
    ]
    
    @classmethod
    def get_period_status(cls, tenant: Tenant, period: date) -> Dict[str, Any]:
        """
        Get current status of period closing including all tasks.
        """
        # Ensure period is first day of month
        period = period.replace(day=1)
        
        # Get or create period closing record
        closing, created = PeriodClosing.objects.get_or_create(
            tenant=tenant,
            period=period,
            defaults={'status': 'OPEN'}
        )
        
        tasks = cls._get_tasks_status(tenant, period, closing)
        
        return {
            'period': period.strftime('%Y-%m'),
            'period_date': period.isoformat(),
            'status': closing.status,
            'is_closed': closing.status == 'CLOSED',
            'closed_by': closing.closed_by.get_full_name() if closing.closed_by else None,
            'closed_at': closing.closed_at.isoformat() if closing.closed_at else None,
            'profit_loss': float(closing.profit_loss),
            'tasks': [t.__dict__ for t in tasks],
            'can_close': all(t.status in ['completed', 'skipped'] for t in tasks[:-1]),  # All except LOCK
        }
    
    @classmethod
    def _get_tasks_status(cls, tenant: Tenant, period: date, closing: PeriodClosing) -> List[ClosingTask]:
        """
        Determine status of each closing task.
        """
        tasks = []
        
        for i, (code, name, name_ru, desc) in enumerate(cls.TASKS):
            status = 'pending'
            result = None
            
            if closing.status == 'CLOSED':
                status = 'completed'
            elif code == 'DEPRECIATION':
                try:
                    from fixed_assets.models import DepreciationSchedule
                    count = DepreciationSchedule.objects.filter(
                        asset__tenant=tenant,
                        period=period
                    ).count()
                    if count > 0:
                        status = 'completed'
                        result = {'entries': count}
                except Exception:
                    status = 'pending'
            elif code == 'EXCHANGE_DIFF':
                try:
                    count = AccountingEntry.objects.filter(
                        tenant=tenant,
                        period=period,
                        description__icontains='exchange difference'
                    ).count()
                    if count > 0:
                        status = 'completed'
                        result = {'entries': count}
                except Exception:
                    status = 'pending'
            elif code == 'CLOSE_PL':
                try:
                    count = AccountingEntry.objects.filter(
                        tenant=tenant,
                        period=period,
                        description__icontains='P&L closing'
                    ).count()
                    if count > 0:
                        status = 'completed'
                        result = {'entries': count}
                except Exception:
                    status = 'pending'
            elif code == 'VAT':
                try:
                    from accounting.vat import VATTransaction
                    vat_count = VATTransaction.objects.filter(
                        tenant=tenant,
                        period=period
                    ).count()
                    if vat_count > 0:
                        status = 'completed'
                        result = {'entries': vat_count}
                except Exception:
                    status = 'pending'
            elif code == 'LOCK':
                if closing.status == 'CLOSED':
                    status = 'completed'
            
            tasks.append(ClosingTask(
                code=code,
                name=name,
                name_ru=name_ru,
                description=desc,
                status=status,
                result=result,
                order=i
            ))
        
        return tasks
    
    @classmethod
    @transaction.atomic
    def execute_task(cls, tenant: Tenant, period: date, task_code: str, user) -> TaskResult:
        """
        Execute a specific closing task.
        """
        period = period.replace(day=1)
        
        # Get closing record
        closing, _ = PeriodClosing.objects.get_or_create(
            tenant=tenant,
            period=period,
            defaults={'status': 'OPEN'}
        )
        
        if closing.status == 'CLOSED':
            return TaskResult(
                success=False,
                task_code=task_code,
                message='Period is already closed'
            )
        
        try:
            if task_code == 'DEPRECIATION':
                return cls._execute_depreciation(tenant, period, user)
            elif task_code == 'EXCHANGE_DIFF':
                return cls._execute_exchange_differences(tenant, period, user)
            elif task_code == 'CLOSE_PL':
                return cls._execute_close_pl(tenant, period, closing, user)
            elif task_code == 'VAT':
                return cls._execute_vat(tenant, period, user)
            elif task_code == 'LOCK':
                return cls._execute_lock(tenant, period, closing, user)
            else:
                return TaskResult(
                    success=False,
                    task_code=task_code,
                    message=f'Unknown task: {task_code}'
                )
        except Exception as e:
            return TaskResult(
                success=False,
                task_code=task_code,
                message=str(e)
            )
    
    @classmethod
    def _execute_depreciation(cls, tenant: Tenant, period: date, user) -> TaskResult:
        """Calculate and post depreciation for all fixed assets."""
        from fixed_assets.services import DepreciationService
        
        result = DepreciationService.post_monthly_depreciation(tenant, period)
        
        return TaskResult(
            success=True,
            task_code='DEPRECIATION',
            message=f"Posted depreciation for {result['assets_processed']} assets",
            data=result,
            entries_created=result['assets_processed'],
            total_amount=result['total_depreciation']
        )
    
    @classmethod
    def _execute_exchange_differences(cls, tenant: Tenant, period: date, user) -> TaskResult:
        """
        Calculate exchange rate differences for foreign currency balances.
        
        Revalues:
        - Foreign currency bank accounts
        - Foreign currency receivables/payables
        """
        # Get period end date
        import calendar
        _, last_day = calendar.monthrange(period.year, period.month)
        period_end = period.replace(day=last_day)
        
        entries_created = 0
        total_gain = Decimal('0')
        total_loss = Decimal('0')
        
        # Get base currency (usually first currency or USD)
        base_currency = Currency.objects.filter(tenant=tenant).first()
        if not base_currency:
            return TaskResult(
                success=True,
                task_code='EXCHANGE_DIFF',
                message='No currencies configured',
                entries_created=0
            )
        
        # Get all foreign currencies
        foreign_currencies = Currency.objects.filter(tenant=tenant).exclude(id=base_currency.id)
        
        # Get exchange difference accounts
        exchange_gain_account = ChartOfAccounts.objects.filter(
            tenant=tenant,
            code__in=['91.01', '9101', '91']  # Common codes for exchange gains
        ).first()
        
        exchange_loss_account = ChartOfAccounts.objects.filter(
            tenant=tenant,
            code__in=['91.02', '9102', '91']  # Common codes for exchange losses
        ).first()
        
        if not exchange_gain_account or not exchange_loss_account:
            # Use default account 91 if specific ones don't exist
            account_91 = ChartOfAccounts.objects.filter(
                tenant=tenant,
                code__startswith='91'
            ).first()
            exchange_gain_account = exchange_gain_account or account_91
            exchange_loss_account = exchange_loss_account or account_91
        
        if not exchange_gain_account:
            return TaskResult(
                success=True,
                task_code='EXCHANGE_DIFF',
                message='Exchange difference accounts not configured (91.0x)',
                entries_created=0
            )
        
        # Process receivables/payables (accounts 60, 62, 76)
        currency_accounts = ChartOfAccounts.objects.filter(
            tenant=tenant,
            code__regex=r'^(60|62|76)'  # Counterparty accounts
        )
        
        for currency in foreign_currencies:
            # Get rate at period end
            try:
                rate_record = ExchangeRate.objects.filter(
                    tenant=tenant,
                    from_currency=currency,
                    date__lte=period_end
                ).order_by('-date').first()
                
                if not rate_record:
                    continue
                    
                current_rate = rate_record.rate
            except:
                continue
            
            # Calculate differences for each account
            for account in currency_accounts:
                # Get balance in foreign currency at historical rates
                historical_entries = AccountingEntry.objects.filter(
                    tenant=tenant,
                    period__lte=period,
                    currency=currency
                ).filter(
                    models.Q(debit_account=account) | models.Q(credit_account=account)
                )
                
                if not historical_entries.exists():
                    continue
                
                # Calculate balance
                debit_sum = historical_entries.filter(debit_account=account).aggregate(
                    total=Sum('amount')
                )['total'] or Decimal('0')
                
                credit_sum = historical_entries.filter(credit_account=account).aggregate(
                    total=Sum('amount')
                )['total'] or Decimal('0')
                
                balance = debit_sum - credit_sum
                
                if abs(balance) < Decimal('0.01'):
                    continue
                
                # Get historical amount in base currency
                historical_base = historical_entries.filter(debit_account=account).aggregate(
                    total=Sum('amount_base')
                )['total'] or Decimal('0')
                historical_base -= historical_entries.filter(credit_account=account).aggregate(
                    total=Sum('amount_base')
                )['total'] or Decimal('0')
                
                # Calculate current value at new rate
                current_base = balance * current_rate
                
                # Calculate difference
                difference = current_base - historical_base
                
                if abs(difference) < Decimal('0.01'):
                    continue
                
                # Create adjustment entry
                if difference > 0:
                    # Exchange gain
                    AccountingEntry.objects.create(
                        tenant=tenant,
                        date=period_end,
                        period=period,
                        debit_account=account,
                        credit_account=exchange_gain_account,
                        amount=abs(difference),
                        amount_base=abs(difference),
                        currency=base_currency,
                        exchange_rate=Decimal('1'),
                        description=f'Exchange difference revaluation - {currency.code}',
                        created_by=user
                    )
                    total_gain += abs(difference)
                else:
                    # Exchange loss
                    AccountingEntry.objects.create(
                        tenant=tenant,
                        date=period_end,
                        period=period,
                        debit_account=exchange_loss_account,
                        credit_account=account,
                        amount=abs(difference),
                        amount_base=abs(difference),
                        currency=base_currency,
                        exchange_rate=Decimal('1'),
                        description=f'Exchange difference revaluation - {currency.code}',
                        created_by=user
                    )
                    total_loss += abs(difference)
                
                entries_created += 1
        
        return TaskResult(
            success=True,
            task_code='EXCHANGE_DIFF',
            message=f'Created {entries_created} exchange difference entries',
            data={
                'entries_created': entries_created,
                'total_gain': float(total_gain),
                'total_loss': float(total_loss),
                'net_difference': float(total_gain - total_loss)
            },
            entries_created=entries_created,
            total_amount=total_gain - total_loss
        )
    
    @classmethod
    def _execute_close_pl(cls, tenant: Tenant, period: date, closing: PeriodClosing, user) -> TaskResult:
        """Close P&L accounts to retained earnings."""
        import calendar
        _, last_day = calendar.monthrange(period.year, period.month)
        period_end = period.replace(day=last_day)
        
        # Get P&L accounts (typically 90xx for revenue, 20-29 for expenses, etc.)
        revenue_accounts = ChartOfAccounts.objects.filter(
            tenant=tenant,
            code__regex=r'^(90|91)'  # Revenue accounts
        )
        
        expense_accounts = ChartOfAccounts.objects.filter(
            tenant=tenant,
            code__regex=r'^(20|21|25|26|44)'  # Cost/expense accounts
        )
        
        # Get account 99 (Profit/Loss)
        pl_account = ChartOfAccounts.objects.filter(
            tenant=tenant,
            code__in=['99', '99.01']
        ).first()
        
        # Get account 84 (Retained Earnings) 
        retained_account = ChartOfAccounts.objects.filter(
            tenant=tenant,
            code__in=['84', '84.01']
        ).first()
        
        if not pl_account:
            return TaskResult(
                success=False,
                task_code='CLOSE_PL',
                message='Account 99 (Profit/Loss) not found in chart of accounts'
            )
        
        entries_created = 0
        total_revenue = Decimal('0')
        total_expenses = Decimal('0')
        base_currency = Currency.objects.filter(tenant=tenant).first()
        
        # Close revenue accounts to 99
        for account in revenue_accounts:
            balance = cls._get_account_balance(tenant, account, period)
            if abs(balance) > Decimal('0.01'):
                if balance > 0:  # Credit balance (normal for revenue)
                    AccountingEntry.objects.create(
                        tenant=tenant,
                        date=period_end,
                        period=period,
                        debit_account=account,
                        credit_account=pl_account,
                        amount=abs(balance),
                        amount_base=abs(balance),
                        currency=base_currency,
                        exchange_rate=Decimal('1'),
                        description=f'P&L closing - {account.code} {account.name}',
                        created_by=user
                    )
                else:  # Debit balance (abnormal)
                    AccountingEntry.objects.create(
                        tenant=tenant,
                        date=period_end,
                        period=period,
                        debit_account=pl_account,
                        credit_account=account,
                        amount=abs(balance),
                        amount_base=abs(balance),
                        currency=base_currency,
                        exchange_rate=Decimal('1'),
                        description=f'P&L closing - {account.code} {account.name}',
                        created_by=user
                    )
                total_revenue += abs(balance)
                entries_created += 1
        
        # Close expense accounts to 99
        for account in expense_accounts:
            balance = cls._get_account_balance(tenant, account, period)
            if abs(balance) > Decimal('0.01'):
                if balance < 0:  # Debit balance (normal for expenses)
                    AccountingEntry.objects.create(
                        tenant=tenant,
                        date=period_end,
                        period=period,
                        debit_account=pl_account,
                        credit_account=account,
                        amount=abs(balance),
                        amount_base=abs(balance),
                        currency=base_currency,
                        exchange_rate=Decimal('1'),
                        description=f'P&L closing - {account.code} {account.name}',
                        created_by=user
                    )
                else:  # Credit balance (abnormal)
                    AccountingEntry.objects.create(
                        tenant=tenant,
                        date=period_end,
                        period=period,
                        debit_account=account,
                        credit_account=pl_account,
                        amount=abs(balance),
                        amount_base=abs(balance),
                        currency=base_currency,
                        exchange_rate=Decimal('1'),
                        description=f'P&L closing - {account.code} {account.name}',
                        created_by=user
                    )
                total_expenses += abs(balance)
                entries_created += 1
        
        profit_loss = total_revenue - total_expenses
        closing.profit_loss = profit_loss
        closing.save()
        
        return TaskResult(
            success=True,
            task_code='CLOSE_PL',
            message=f'Closed {entries_created} P&L accounts. Profit/Loss: {profit_loss:,.2f}',
            data={
                'entries_created': entries_created,
                'total_revenue': float(total_revenue),
                'total_expenses': float(total_expenses),
                'profit_loss': float(profit_loss)
            },
            entries_created=entries_created,
            total_amount=profit_loss
        )
    
    @classmethod
    def _get_account_balance(cls, tenant: Tenant, account: ChartOfAccounts, period: date) -> Decimal:
        """Get net balance for account in period (Credit - Debit)."""
        entries = AccountingEntry.objects.filter(
            tenant=tenant,
            period=period
        )
        
        debit = entries.filter(debit_account=account).aggregate(
            total=Sum('amount_base')
        )['total'] or Decimal('0')
        
        credit = entries.filter(credit_account=account).aggregate(
            total=Sum('amount_base')
        )['total'] or Decimal('0')
        
        return credit - debit  # Positive = credit balance
    
    @classmethod
    def _execute_vat(cls, tenant: Tenant, period: date, user) -> TaskResult:
        """Calculate VAT for the period."""
        try:
            from accounting.vat import VATTransaction
            
            # Calculate VAT from transactions
            from django.db.models import Sum
            import calendar
            _, last_day = calendar.monthrange(period.year, period.month)
            period_end = period.replace(day=last_day)
            
            output_vat = VATTransaction.objects.filter(
                tenant=tenant,
                date__gte=period,
                date__lte=period_end,
                transaction_type='OUTPUT'
            ).aggregate(total=Sum('vat_amount'))['total'] or Decimal('0')
            
            input_vat = VATTransaction.objects.filter(
                tenant=tenant,
                date__gte=period,
                date__lte=period_end,
                transaction_type='INPUT'
            ).aggregate(total=Sum('vat_amount'))['total'] or Decimal('0')
            
            vat_payable = output_vat - input_vat
            
            vat_data = {
                'output_vat': float(output_vat),
                'input_vat': float(input_vat),
                'vat_payable': float(vat_payable)
            }
            
            return TaskResult(
                success=True,
                task_code='VAT',
                message=f"VAT calculated: Output {output_vat:,.2f}, Input {input_vat:,.2f}",
                data=vat_data,
                total_amount=vat_payable
            )
        except Exception as e:
            return TaskResult(
                success=True,
                task_code='VAT',
                message=f'VAT calculation skipped: {str(e)}',
                data={'output_vat': 0, 'input_vat': 0, 'vat_payable': 0},
                total_amount=Decimal('0')
            )
    
    @classmethod
    def _execute_lock(cls, tenant: Tenant, period: date, closing: PeriodClosing, user) -> TaskResult:
        """Lock the period to prevent further modifications."""
        closing.status = 'CLOSED'
        closing.accounting_closed = True
        closing.operational_closed = True
        closing.closed_by = user
        closing.closed_at = timezone.now()
        closing.save()
        
        # Create audit log
        from accounting.models import PeriodClosingLog
        PeriodClosingLog.objects.create(
            period_closing=closing,
            action='CLOSE',
            user=user,
            reason='Period closed via wizard',
            user_role='accountant'
        )
        
        return TaskResult(
            success=True,
            task_code='LOCK',
            message=f'Period {period.strftime("%Y-%m")} locked successfully',
            data={
                'period': period.strftime('%Y-%m'),
                'closed_at': closing.closed_at.isoformat(),
                'closed_by': user.get_full_name() or user.username
            }
        )
    
    @classmethod
    @transaction.atomic
    def close_period_full(cls, tenant: Tenant, period: date, user) -> Dict[str, Any]:
        """
        Execute full period closing (all tasks).
        """
        results = []
        
        for task_code, _, _, _ in cls.TASKS:
            result = cls.execute_task(tenant, period, task_code, user)
            results.append(result.__dict__)
            
            if not result.success and task_code != 'EXCHANGE_DIFF':
                # Don't fail on exchange diff as it's optional
                break
        
        return {
            'success': all(r['success'] for r in results),
            'results': results
        }
