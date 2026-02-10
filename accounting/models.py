from django.db import models
from django.utils.translation import gettext_lazy as _
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey
from django.conf import settings
from tenants.models import Tenant
from directories.models import Currency


class ChartOfAccounts(models.Model):
    """
    План счетов (Chart of Accounts).
    
    Examples:
    - 41.01 "Товары на складах"
    - 60 "Расчёты с поставщиками и подрядчиками"
    - 62 "Расчёты с покупателями и заказчиками"
    - 90.1 "Выручка"
    - 90.2 "Себестоимость продаж"
    """
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='chart_of_accounts')
    code = models.CharField(_('Account Code'), max_length=20, help_text="e.g., 41.01, 60, 62")
    name = models.CharField(_('Account Name'), max_length=255, help_text="e.g., Товары на складах")
    
    ACCOUNT_TYPES = [
        ('ASSET', _('Asset (Актив)')),
        ('LIABILITY', _('Liability (Пассив)')),
        ('EQUITY', _('Equity (Капитал)')),
        ('REVENUE', _('Revenue (Доход)')),
        ('EXPENSE', _('Expense (Расход)')),
    ]
    account_type = models.CharField(_('Account Type'), max_length=20, choices=ACCOUNT_TYPES)
    
    # Hierarchical structure (optional)
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.CASCADE, related_name='children')
    
    # Active/Inactive  
    is_active = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ('tenant', 'code')
        verbose_name = _('Chart of Accounts')
        verbose_name_plural = _('Chart of Accounts')
        ordering = ['code']
    
    def __str__(self):
        return f"{self.code} - {self.name}"


class AccountingEntry(models.Model):
    """
    Бухгалтерская проводка (Journal Entry).
    
    Double-entry bookkeeping: Debit = Credit
    
    Example - Purchase:
        Дт 41 "Товары" Кт 60 "Поставщики" - 10,000
    
    Example - Sale:
        Дт 62 "Покупатели" Кт 90.1 "Выручка" - 15,000
        Дт 90.2 "Себестоимость" Кт 41 "Товары" - 10,000
    """
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    date = models.DateTimeField(_('Date'))
    period = models.DateField(_('Accounting Period'), help_text="YYYY-MM-01 for monthly closing")
    
    # КРИТИЧНО: Явная связь с PeriodClosing для 100% детерминированности
    accounting_period = models.ForeignKey(
        'PeriodClosing',
        on_delete=models.PROTECT,
        related_name='entries',
        null=True,  # Temporary for migration
        blank=True,
        help_text="Явная связь с периодом - для детерминированных отчётов"
    )
    
    # Source Document (GenericFK)
    content_type = models.ForeignKey(ContentType, on_delete=models.PROTECT)
    object_id = models.PositiveIntegerField()
    document = GenericForeignKey('content_type', 'object_id')
    
    # Double-Entry
    debit_account = models.ForeignKey(
        ChartOfAccounts, 
        on_delete=models.PROTECT, 
        related_name='debit_entries',
        verbose_name=_('Debit Account')
    )
    credit_account = models.ForeignKey(
        ChartOfAccounts, 
        on_delete=models.PROTECT, 
        related_name='credit_entries',
        verbose_name=_('Credit Account')
    )
    
    amount = models.DecimalField(_('Amount'), max_digits=15, decimal_places=2)
    currency = models.ForeignKey(Currency, on_delete=models.PROTECT)
    
    # --- ANALYTICS (Subconto) ---
    # Optional fields for drill-down reporting (1C-style)
    
    # 60, 62, 76: Settlements
    counterparty = models.ForeignKey('directories.Counterparty', on_delete=models.PROTECT, null=True, blank=True, related_name='entries')
    contract = models.ForeignKey('directories.Contract', on_delete=models.PROTECT, null=True, blank=True, related_name='entries')
    
    # 41, 10, 43: Inventory
    warehouse = models.ForeignKey('directories.Warehouse', on_delete=models.PROTECT, null=True, blank=True, related_name='entries')
    item = models.ForeignKey('directories.Item', on_delete=models.PROTECT, null=True, blank=True, related_name='entries')
    quantity = models.DecimalField(_('Quantity'), max_digits=15, decimal_places=3, default=0, help_text="For quantitative accounting (41, 10, 43)")
    
    # 20, 26, 44, 90: P&L centers
    project = models.ForeignKey('directories.Project', on_delete=models.PROTECT, null=True, blank=True, related_name='entries')
    department = models.ForeignKey('directories.Department', on_delete=models.PROTECT, null=True, blank=True, related_name='entries')
    
    # 70, 71: Employees
    employee = models.ForeignKey('directories.Employee', on_delete=models.PROTECT, null=True, blank=True, related_name='entries')
    
    description = models.CharField(_('Description'), max_length=255, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = _('Accounting Entry')
        verbose_name_plural = _('Accounting Entries')
        indexes = [
            models.Index(fields=['tenant', 'period']),
            models.Index(fields=['debit_account', 'period']),
            models.Index(fields=['credit_account', 'period']),
            models.Index(fields=['date']),
        ]
        ordering = ['-date']
    
    def __str__(self):
        return f"Entry {self.date} - {self.debit_account} → {self.credit_account}: {self.amount}"
    
    def get_document_url(self):
        """Get URL to source document for drill-down navigation."""
        if not self.content_type or not self.object_id:
            return None
        
        from django.urls import reverse, NoReverseMatch
        
        model_name = self.content_type.model
        obj_id = self.object_id
        
        # Map models to URL patterns
        url_mapping = {
            'salesdocument': ('documents:sales_detail', [obj_id]),
            'purchasedocument': ('documents:purchase_detail', [obj_id]),
            'paymentdocument': ('documents:payment_list', []),  # No detail view yet
            'transferdocument': ('documents:transfer_detail', [obj_id]),
        }
        
        if model_name in url_mapping:
            try:
                url_name, args = url_mapping[model_name]
                return reverse(url_name, args=args)
            except NoReverseMatch:
                return None
        
        return None
    
    def clean(self):
        """Validation: debit and credit must be different"""
        if self.debit_account == self.credit_account:
            from django.core.exceptions import ValidationError
            raise ValidationError(_("Debit and Credit accounts must be different"))
    
    def save(self, *args, **kwargs):
        # Validate period is open
        from .models import PeriodClosing
        PeriodClosing.validate_period_is_open(self.date, self.tenant, check_type='ACCOUNTING')
        
        # Auto-link to period closing if not set
        if not self.accounting_period:
            period_date = self.period
            self.accounting_period, _ = PeriodClosing.objects.get_or_create(
                tenant=self.tenant,
                period=period_date,
                defaults={'status': 'OPEN'}
            )
        
        self.full_clean()
        super().save(*args, **kwargs)


class TrialBalance(models.Model):
    """
    Оборотно-сальдовая ведомость (Trial Balance).
    
    Calculated monthly. Can be materialized view or cached table.
    """
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    account = models.ForeignKey(ChartOfAccounts, on_delete=models.CASCADE)
    period = models.DateField(_('Period'))  # First day of month
    
    # Opening balance
    opening_debit = models.DecimalField(_('Opening Debit'), max_digits=15, decimal_places=2, default=0)
    opening_credit = models.DecimalField(_('Opening Credit'), max_digits=15, decimal_places=2, default=0)
    
    # Turnover for period
    turnover_debit = models.DecimalField(_('Turnover Debit'), max_digits=15, decimal_places=2, default=0)
    turnover_credit = models.DecimalField(_('Turnover Credit'), max_digits=15, decimal_places=2, default=0)
    
    # Closing balance
    closing_debit = models.DecimalField(_('Closing Debit'), max_digits=15, decimal_places=2, default=0)
    closing_credit = models.DecimalField(_('Closing Credit'), max_digits=15, decimal_places=2, default=0)
    
    class Meta:
        unique_together = ('tenant', 'account', 'period')
        verbose_name = _('Trial Balance')
        verbose_name_plural = _('Trial Balances')
        ordering = ['period', 'account__code']
    
    def __str__(self):
        return f"{self.account.code} - {self.period.strftime('%Y-%m')}"
    
    @classmethod
    def calculate_for_period(cls, tenant, period):
        """
        Calculate trial balance for a specific period.
        period should be the first day of the month (YYYY-MM-01)
        """
        from django.db.models import Sum, Q
        from datetime import datetime
        import calendar
        
        # Get last day of period
        last_day = calendar.monthrange(period.year, period.month)[1]
        period_end = datetime(period.year, period.month, last_day, 23, 59, 59)
        
        accounts = ChartOfAccounts.objects.filter(tenant=tenant, is_active=True)
        
        for account in accounts:
            # Calculate turnover
            entries_debit = AccountingEntry.objects.filter(
                tenant=tenant,
                debit_account=account,
                period=period
            ).aggregate(Sum('amount'))['amount__sum'] or 0
            
            entries_credit = AccountingEntry.objects.filter(
                tenant=tenant,
                credit_account=account,
                period=period
            ).aggregate(Sum('amount'))['amount__sum'] or 0
            
            # For now, skip opening balance calculation (would need previous period)
            # In production: get previous month's closing balance
            
            # Calculate closing
            closing_debit = max(entries_debit - entries_credit, 0)
            closing_credit = max(entries_credit - entries_debit, 0)
            
            cls.objects.update_or_create(
                tenant=tenant,
                account=account,
                period=period,
                defaults={
                    'turnover_debit': entries_debit,
                    'turnover_credit': entries_credit,
                    'closing_debit': closing_debit,
                    'closing_credit': closing_credit,
                }
            )


class PeriodClosing(models.Model):
    """
    Закрытие периода (Period Closing).
    
    КРИТИЧНО: После закрытия периода:
    ❌ нельзя post/unpost документы
    ❌ нельзя создавать AccountingEntry
    ❌ нельзя редактировать движения
    
    Это обязательное требование для бухгалтерского учёта!
    """
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='period_closings')
    
    # Period
    period = models.DateField(_('Period'), help_text="YYYY-MM-01 - первое число месяца")
    
    # Status
    STATUS_CHOICES = [
        ('OPEN', _('Open')),
        ('CLOSING', _('Closing in Progress')),
        ('CLOSED', _('Closed')),
        ('REOPENED', _('Reopened for adjustments')),
    ]
    status = models.CharField(_('Status'), max_length=20, choices=STATUS_CHOICES, default='OPEN')
    
    # Separation: Operational vs Accounting
    operational_closed = models.BooleanField(
        _('Operational Closed'), 
        default=False,
        help_text="Закрыт оперативный учёт (склад, продажи)"
    )
    accounting_closed = models.BooleanField(
        _('Accounting Closed'), 
        default=False,
        help_text="Закрыт бухгалтерский учёт (проводки, НДС)"
    )
    
    # Allow operational posting after accounting close?
    allow_operational_after_close = models.BooleanField(
        _('Allow Operational After Close'),
        default=True,
        help_text="Разрешить оперативные движения после закрытия бухучёта"
    )
    
    # Who and when
    closed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.PROTECT, 
        null=True, 
        blank=True,
        related_name='closed_periods'
    )
    closed_at = models.DateTimeField(_('Closed At'), null=True, blank=True)
    
    # Closing results
    profit_loss = models.DecimalField(
        _('П/У (Profit/Loss)'), 
        max_digits=15, 
        decimal_places=2, 
        default=0,
        help_text="Прибыль/убыток за период"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ('tenant', 'period')
        verbose_name = _('Period Closing')
        verbose_name_plural = _('Period Closings')
        ordering = ['-period']
        indexes = [
            models.Index(fields=['tenant', 'status']),
            models.Index(fields=['period', 'status']),
        ]
    
    def __str__(self):
        return f"{self.tenant} - {self.period.strftime('%Y-%m')} ({self.get_status_display()})"
    
    @classmethod
    def is_period_closed(cls, date, tenant, check_type='ACCOUNTING'):
        """
        Check if period is closed for a specific date.
        
        Args:
            date: datetime or date object
            tenant: Tenant instance
            check_type: 'OPERATIONAL' or 'ACCOUNTING'
        
        Returns:
            True if period is closed, False otherwise
        """
        from datetime import date as date_type
        
        if isinstance(date, date_type):
            period_date = date.replace(day=1)
        else:
            period_date = date.date().replace(day=1)
        
        try:
            closing = cls.objects.get(tenant=tenant, period=period_date)
            
            if check_type == 'OPERATIONAL':
                # Check if operational is explicitly closed
                return closing.operational_closed
            elif check_type == 'ACCOUNTING':
                # Accounting closed = both flags OR accounting_closed
                return closing.accounting_closed
            
            return closing.status == 'CLOSED'
        except cls.DoesNotExist:
            # Period not closed if no record exists
            return False
    
    @classmethod
    def validate_period_is_open(cls, date, tenant, check_type='ACCOUNTING', raise_exception=True):
        """
        Validate that period is open before posting.
        
        MUST be called in every document.post() and AccountingEntry.save()
        
        Args:
            date: datetime or date object
            tenant: Tenant instance
            check_type: 'OPERATIONAL' or 'ACCOUNTING'
            raise_exception: if True, raise ValidationError; if False, return bool
        
        Returns:
            True if period is open, raises ValidationError if closed
        """
        from django.core.exceptions import ValidationError
        
        is_closed = cls.is_period_closed(date, tenant, check_type)
        
        if is_closed:
            if raise_exception:
                period_str = date.strftime('%Y-%m') if hasattr(date, 'strftime') else date.date().strftime('%Y-%m')
                raise ValidationError(
                    f"❌ Period {period_str} is closed for {check_type}! "
                    f"Cannot post/edit documents or movements."
                )
            return False
        
        return True
    
    def close_period(self, user, reason=None):
        """
        Close period procedure with AUDIT LOGGING.
        
        Steps:
        1. Calculate depreciation
        2. Close P&L accounts to account 99
        3. Calculate VAT payable
        4. Lock period
        5. LOG ACTION
        """
        from django.db import transaction
        from django.utils import timezone
        
        if self.status == 'CLOSED':
            raise ValueError("Period is already closed")
        
        with transaction.atomic():
            self.status = 'CLOSING'
            self.save()
            
            # 1. Calculate profit/loss
            self.profit_loss = self._calculate_profit_loss()
            
            # 2. Close P&L accounts
            self._close_profit_loss_accounts()
            
            # 3. Calculate VAT
            self._calculate_vat()
            
            # 4. Lock
            self.status = 'CLOSED'
            self.accounting_closed = True
            self.operational_closed = True
            self.closed_by = user
            self.closed_at = timezone.now()
            self.save()
            
            # 5. AUDIT LOG
            PeriodClosingLog.objects.create(
                period_closing=self,
                action='CLOSE',
                user=user,
                reason=reason or 'Period closed',
                user_role=self._get_user_role(user)
            )
    
    def _calculate_profit_loss(self):
        """Calculate P&L for the period"""
        from django.db.models import Sum, Q
        
        # Revenue (credit balance on account 90.1)
        revenue = AccountingEntry.objects.filter(
            tenant=self.tenant,
            period=self.period,
            credit_account__code='90.1'
        ).aggregate(Sum('amount'))['amount__sum'] or 0
        
        # COGS (debit balance on account 90.2)
        cogs = AccountingEntry.objects.filter(
            tenant=self.tenant,
            period=self.period,
            debit_account__code='90.2'
        ).aggregate(Sum('amount'))['amount__sum'] or 0
        
        return revenue - cogs
    
    def _close_profit_loss_accounts(self):
        """Close revenue and expense accounts to P&L (account 99)"""
        # TODO: Implement closing entries
        pass
    
    def _calculate_vat(self):
        """Calculate VAT payable for the period"""
        vat_payable = VATTransaction.calculate_vat_payable(self.tenant, self.period)
        # TODO: Create VAT payable entry
        return vat_payable
    
    def _get_user_role(self, user):
        """Get user role from permissions"""
        if user.is_superuser:
            return 'SuperAdmin'
        elif user.groups.filter(name='Chief Accountant').exists():
            return 'Chief Accountant'
        elif user.groups.filter(name='Accountant').exists():
            return 'Accountant'
        return 'User'
    
    def reopen(self, user, reason, force=False):
        """
        Reopen closed period (for adjustments).
        
        КРИТИЧНО:
        - Требует роль: Chief Accountant или SuperAdmin
        - ОБЯЗАТЕЛЬНА причина!
        - Логируется в PeriodClosingLog
        
        Args:
            user: User performing the action
            reason: REQUIRED reason for reopening
            force: SuperAdmin can force reopen
        """
        from django.core.exceptions import PermissionDenied
        from django.db import transaction
        
        if self.status != 'CLOSED':
            raise ValueError("Can only reopen CLOSED periods")
        
        if not reason or len(reason.strip()) < 10:
            raise ValueError("❌ Reason is REQUIRED and must be at least 10 characters!")
        
        # Permission check
        user_role = self._get_user_role(user)
        if not force:
            if user_role not in ['Chief Accountant', 'SuperAdmin']:
                raise PermissionDenied(
                    f"❌ User role '{user_role}' cannot reopen periods! "
                    f"Required: Chief Accountant or SuperAdmin"
                )
        else:
            if user_role != 'SuperAdmin':
                raise PermissionDenied("❌ Only SuperAdmin can FORCE reopen!")
        
        with transaction.atomic():
            self.status = 'REOPENED'
            self.accounting_closed = False
            self.operational_closed = False
            self.save()
            
            # AUDIT LOG - КРИТИЧНО!
            action = 'FORCE_REOPEN' if force else 'REOPEN'
            PeriodClosingLog.objects.create(
                period_closing=self,
                action=action,
                user=user,
                reason=reason,
                user_role=user_role
            )


class PeriodClosingLog(models.Model):
    """
    Журнал закрытия/открытия периодов (Period Closing Audit Log).
    
    КРИТИЧНО ДЛЯ АУДИТА:
    - Кто закрыл/открыл период?
    - Когда?
    - Почему?
    
    Без этого аудиторы скажут: ❌ «История изменений отсутствует»
    """
    period_closing = models.ForeignKey(PeriodClosing, on_delete=models.CASCADE, related_name='logs')
    
    ACTION_CHOICES = [
        ('CLOSE', _('Close Period')),
        ('REOPEN', _('Reopen Period')),
        ('FORCE_REOPEN', _('Force Reopen (SuperAdmin)')),
    ]
    action = models.CharField(_('Action'), max_length=20, choices=ACTION_CHOICES)
    
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    timestamp = models.DateTimeField(_('Timestamp'), auto_now_add=True)
    
    reason = models.TextField(_('Reason'), help_text="Обязательная причина для REOPEN")
    
    # User role at time of action
    user_role = models.CharField(_('User Role'), max_length=100, blank=True,
                                 help_text="e.g., Chief Accountant, SuperAdmin")
    
    # IP address for security audit
    ip_address = models.GenericIPAddressField(_('IP Address'), null=True, blank=True)
    
    class Meta:
        verbose_name = _('Period Closing Log')
        verbose_name_plural = _('Period Closing Logs')
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['period_closing', 'action']),
            models.Index(fields=['user', 'timestamp']),
        ]
    
    def __str__(self):
        return f"{self.get_action_display()} - {self.period_closing.period} by {self.user} at {self.timestamp}"


# Utility function for easy access
def validate_period_is_open(date, tenant, check_type='ACCOUNTING'):
    """
    Shortcut function to validate period is open.
    
    Usage in documents:
        from accounting.models import validate_period_is_open
        
        def post(self):
            validate_period_is_open(self.date, self.tenant)
            # ... rest of posting logic
    """
    return PeriodClosing.validate_period_is_open(date, tenant, check_type)


class AccountingPolicy(models.Model):
    """
    Учётная политика организации.
    Defines how to calculate costs, depreciation, etc.
    """
    tenant = models.OneToOneField(Tenant, on_delete=models.CASCADE, related_name='accounting_policy')
    
    # Stock Valuation Method
    VALUATION_METHODS = [
        ('FIFO', _('First In First Out (FIFO)')),
        ('AVG', _('Weighted Average')),
        ('LIFO', _('Last In First Out (LIFO)')),
    ]
    stock_valuation_method = models.CharField(
        _('Stock Valuation Method'), 
        max_length=10, 
        choices=VALUATION_METHODS, 
        default='FIFO',
        help_text="Метод оценки товаров при списании"
    )
    
    # Effective date (for policy changes)
    effective_from = models.DateField(_('Effective From'))
    
    # Future: Cost center allocation, depreciation methods, currency precision, etc.
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = _('Accounting Policy')
        verbose_name_plural = _('Accounting Policies')
    
    def __str__(self):
        return f"{self.tenant} - {self.get_stock_valuation_method_display()}"
    
    def save(self, *args, **kwargs):
        """
        When policy changes, create history record.
        """
        if self.pk:  # Update existing policy
            old_policy = AccountingPolicy.objects.get(pk=self.pk)
            if old_policy.stock_valuation_method != self.stock_valuation_method:
                # Create history record
                AccountingPolicyHistory.objects.create(
                    tenant=self.tenant,
                    valuation_method=old_policy.stock_valuation_method,
                    effective_from=old_policy.effective_from,
                    effective_to=self.effective_from
                )
        super().save(*args, **kwargs)


class AccountingPolicyHistory(models.Model):
    """
    История изменений учётной политики (Policy Change History).
    
    ВАЖНО: Учётная политика может меняться!
    Например: FIFO → AVG (с определённой даты)
    
    Нужна история для:
    - Аудита
    - Пересчёта прошлых периодов
    - Регуляторных требований
    """
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='policy_history')
    valuation_method = models.CharField(
        _('Valuation Method'), 
        max_length=10, 
        choices=AccountingPolicy.VALUATION_METHODS
    )
    effective_from = models.DateField(_('Effective From'))
    effective_to = models.DateField(_('Effective To'), null=True, blank=True,
                                    help_text="NULL = still active")
    
    changed_by = models.CharField(_('Changed By'), max_length=255, blank=True)
    change_reason = models.TextField(_('Reason for Change'), blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = _('Accounting Policy History')
        verbose_name_plural = _('Accounting Policy History')
        ordering = ['-effective_from']
        indexes = [
            models.Index(fields=['tenant', 'effective_from']),
        ]
    
    def __str__(self):
        return f"{self.tenant} - {self.get_valuation_method_display()} ({self.effective_from} to {self.effective_to or 'current'})"


class Operation(models.Model):
    """
    Ручная операция (Manual Accounting Operation).
    
    Serving as a container (Document) for manual accounting entries.
    Users create an Operation, and add AccountingEntries linked to it.
    """
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='operations')
    number = models.CharField(_('Number'), max_length=50)
    date = models.DateTimeField(_('Date'))
    comment = models.TextField(_('Comment'), blank=True)
    
    amount = models.DecimalField(_('Amount'), max_digits=15, decimal_places=2, default=0, help_text="Sum of amounts (informational)")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='created_operations')
    
    class Meta:
        verbose_name = _('Operation')
        verbose_name_plural = _('Operations')
        ordering = ['-date', '-created_at']
        unique_together = ('tenant', 'number')

    def __str__(self):
        return f"Operation #{self.number} ({self.date.date()})"
    
    def update_totals(self):
        """Update total amount from entries"""
        from django.contrib.contenttypes.models import ContentType
        from django.db.models import Sum
        
        ct = ContentType.objects.get_for_model(self)
        total = AccountingEntry.objects.filter(
            content_type=ct, 
            object_id=self.id
        ).aggregate(Sum('amount'))['amount__sum'] or 0
        
        self.amount = total
        self.save(update_fields=['amount'])
