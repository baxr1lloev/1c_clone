"""
Fixed Assets (Основные Средства) Module

This module implements 1C-style Fixed Assets management including:
- Asset registration and tracking
- Depreciation calculation (linear and declining balance)
- Asset movements (transfers, disposals)
- Integration with accounting
"""

from django.db import models
from django.utils.translation import gettext_lazy as _
from django.core.exceptions import ValidationError
from decimal import Decimal
from datetime import date


class FixedAssetCategory(models.Model):
    """
    Hierarchical categories for Fixed Assets (like 1C).
    Examples: Buildings, Vehicles, Computers, Furniture
    """
    tenant = models.ForeignKey('tenants.Tenant', on_delete=models.CASCADE, related_name='fa_categories')
    code = models.CharField(_('Code'), max_length=20)
    name = models.CharField(_('Name'), max_length=200)
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='children')
    
    # Default depreciation settings for this category
    default_useful_life_months = models.IntegerField(_('Default Useful Life (Months)'), default=60, help_text="5 years default")
    default_depreciation_method = models.CharField(
        _('Default Depreciation Method'),
        max_length=20,
        choices=[
            ('LINEAR', _('Linear (Straight-line)')),
            ('DECLINING', _('Declining Balance')),
        ],
        default='LINEAR'
    )
    
    # Accounting integration
    asset_account = models.ForeignKey(
        'accounting.ChartOfAccounts',
        on_delete=models.PROTECT,
        related_name='fa_categories_asset',
        null=True,
        blank=True,
        help_text="Default account 01 (Fixed Assets)"
    )
    depreciation_account = models.ForeignKey(
        'accounting.ChartOfAccounts',
        on_delete=models.PROTECT,
        related_name='fa_categories_depreciation',
        null=True,
        blank=True,
        help_text="Default account 02 (Accumulated Depreciation)"
    )
    
    class Meta:
        verbose_name = _('Fixed Asset Category')
        verbose_name_plural = _('Fixed Asset Categories')
        unique_together = [['tenant', 'code']]
        ordering = ['code']
    
    def __str__(self):
        return f"{self.code} - {self.name}"


class FixedAsset(models.Model):
    """
    Fixed Asset (Основное Средство) - 1C Style
    
    Tracks individual assets with depreciation, location, and accounting.
    """
    STATUS_CHOICES = [
        ('IN_USE', _('In Use')),
        ('MOTHBALLED', _('Mothballed')),
        ('DISPOSED', _('Disposed')),
    ]
    
    tenant = models.ForeignKey('tenants.Tenant', on_delete=models.CASCADE, related_name='fixed_assets')
    
    # Identification
    inventory_number = models.CharField(_('Inventory Number'), max_length=50, help_text="Unique asset ID")
    name = models.CharField(_('Name'), max_length=200)
    category = models.ForeignKey(FixedAssetCategory, on_delete=models.PROTECT, related_name='assets')
    
    # Financial
    initial_cost = models.DecimalField(_('Initial Cost'), max_digits=15, decimal_places=2, help_text="Original purchase price")
    residual_value = models.DecimalField(_('Residual Value'), max_digits=15, decimal_places=2, default=0, help_text="Salvage value")
    accumulated_depreciation = models.DecimalField(_('Accumulated Depreciation'), max_digits=15, decimal_places=2, default=0, editable=False)
    
    # Depreciation settings
    depreciation_method = models.CharField(_('Depreciation Method'), max_length=20, choices=[
        ('LINEAR', _('Linear')),
        ('DECLINING', _('Declining Balance')),
    ], default='LINEAR')
    useful_life_months = models.IntegerField(_('Useful Life (Months)'), default=60)
    depreciation_rate = models.DecimalField(_('Depreciation Rate (%)'), max_digits=5, decimal_places=2, null=True, blank=True, help_text="For declining balance method")
    
    # Dates
    acquisition_date = models.DateField(_('Acquisition Date'))
    commissioning_date = models.DateField(_('Commissioning Date'), help_text="Date when depreciation starts")
    disposal_date = models.DateField(_('Disposal Date'), null=True, blank=True)
    
    # Location and responsibility
    location = models.CharField(_('Location'), max_length=200, blank=True, help_text="Department or physical location")
    responsible_person = models.ForeignKey('accounts.User', on_delete=models.PROTECT, null=True, blank=True, related_name='responsible_for_assets')
    
    # Status
    status = models.CharField(_('Status'), max_length=20, choices=STATUS_CHOICES, default='IN_USE')
    
    # Additional info
    description = models.TextField(_('Description'), blank=True)
    serial_number = models.CharField(_('Serial Number'), max_length=100, blank=True)
    manufacturer = models.CharField(_('Manufacturer'), max_length=200, blank=True)
    
    class Meta:
        verbose_name = _('Fixed Asset')
        verbose_name_plural = _('Fixed Assets')
        unique_together = [['tenant', 'inventory_number']]
        ordering = ['inventory_number']
    
    def __str__(self):
        return f"{self.inventory_number} - {self.name}"
    
    @property
    def current_value(self):
        """Book value = Initial cost - Accumulated depreciation"""
        return self.initial_cost - self.accumulated_depreciation
    
    @property
    def depreciation_base(self):
        """Amount subject to depreciation"""
        return self.initial_cost - self.residual_value
    
    def calculate_monthly_depreciation(self):
        """
        Calculate monthly depreciation amount based on method.
        Returns Decimal amount.
        """
        if self.status != 'IN_USE':
            return Decimal('0.00')
        
        if self.accumulated_depreciation >= self.depreciation_base:
            return Decimal('0.00')  # Fully depreciated
        
        if self.depreciation_method == 'LINEAR':
            # Linear: (Cost - Residual) / Useful Life
            monthly_amount = self.depreciation_base / self.useful_life_months
            
            # Don't exceed remaining depreciable amount
            remaining = self.depreciation_base - self.accumulated_depreciation
            return min(monthly_amount, remaining).quantize(Decimal('0.01'))
        
        elif self.depreciation_method == 'DECLINING':
            # Declining Balance: Current Value × Rate
            if not self.depreciation_rate:
                raise ValidationError("Depreciation rate required for declining balance method")
            
            rate_decimal = self.depreciation_rate / Decimal('100')
            monthly_rate = rate_decimal / Decimal('12')
            monthly_amount = self.current_value * monthly_rate
            
            # Don't exceed remaining depreciable amount
            remaining = self.depreciation_base - self.accumulated_depreciation
            return min(monthly_amount, remaining).quantize(Decimal('0.01'))
        
        return Decimal('0.00')
    
    def post_depreciation(self, period_date):
        """
        Post depreciation for a given month.
        Creates accounting entry and updates accumulated depreciation.
        """
        from accounting.models import AccountingEntry, ChartOfAccounts
        from django.db import transaction
        
        if self.status != 'IN_USE':
            return None
        
        if period_date < self.commissioning_date:
            return None  # Not yet commissioned
        
        monthly_depreciation = self.calculate_monthly_depreciation()
        
        if monthly_depreciation <= 0:
            return None
        
        with transaction.atomic():
            # Update accumulated depreciation
            self.accumulated_depreciation += monthly_depreciation
            self.save(update_fields=['accumulated_depreciation'])
            
            # Create accounting entry
            # Debit: Depreciation Expense (account 26 or 44)
            # Credit: Accumulated Depreciation (account 02)
            
            try:
                acc_depreciation = self.category.depreciation_account or ChartOfAccounts.objects.get(
                    tenant=self.tenant, code='02'
                )
                acc_expense = ChartOfAccounts.objects.get(tenant=self.tenant, code='26')  # General expenses
            except ChartOfAccounts.DoesNotExist:
                raise ValidationError("Required accounts (02, 26) not found")
            
            entry = AccountingEntry.objects.create(
                tenant=self.tenant,
                date=period_date,
                debit_account=acc_expense,
                credit_account=acc_depreciation,
                amount=monthly_depreciation,
                description=f"Depreciation for {self.inventory_number} - {self.name}",
                document_type_name='FixedAsset',
                document_id=self.id
            )
            
            return entry


class DepreciationSchedule(models.Model):
    """
    Tracks depreciation postings by period.
    Ensures depreciation is posted only once per month.
    """
    tenant = models.ForeignKey('tenants.Tenant', on_delete=models.CASCADE, related_name='depreciation_schedules')
    asset = models.ForeignKey(FixedAsset, on_delete=models.CASCADE, related_name='depreciation_schedule')
    period = models.DateField(_('Period'), help_text="First day of month")
    amount = models.DecimalField(_('Depreciation Amount'), max_digits=15, decimal_places=2)
    accounting_entry = models.ForeignKey('accounting.AccountingEntry', on_delete=models.SET_NULL, null=True, blank=True)
    posted_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = _('Depreciation Schedule')
        verbose_name_plural = _('Depreciation Schedules')
        unique_together = [['tenant', 'asset', 'period']]
        ordering = ['-period']
    
    def __str__(self):
        return f"{self.asset.inventory_number} - {self.period.strftime('%Y-%m')}: {self.amount}"


# ============================================================================
# FIXED ASSET DOCUMENTS (1C-Style)
# ============================================================================

class FAReceiptDocument(models.Model):
    """
    Receipt of Fixed Asset (Поступление ОС)
    Records acquisition of new assets.
    """
    STATUS_CHOICES = [
        ('DRAFT', _('Draft')),
        ('POSTED', _('Posted')),
    ]
    
    tenant = models.ForeignKey('tenants.Tenant', on_delete=models.CASCADE, related_name='fa_receipts')
    number = models.CharField(_('Number'), max_length=50)
    date = models.DateField(_('Date'))
    status = models.CharField(_('Status'), max_length=20, choices=STATUS_CHOICES, default='DRAFT')
    
    supplier = models.ForeignKey('directories.Counterparty', on_delete=models.PROTECT, related_name='fa_receipts')
    
    # Asset details
    asset = models.ForeignKey(FixedAsset, on_delete=models.PROTECT, related_name='receipt_documents', null=True, blank=True)
    
    # Posting info
    posted_at = models.DateTimeField(null=True, blank=True)
    posted_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='posted_fa_receipts')
    
    class Meta:
        verbose_name = _('FA Receipt Document')
        verbose_name_plural = _('FA Receipt Documents')
        unique_together = [['tenant', 'number']]
        ordering = ['-date', '-number']
    
    def __str__(self):
        return f"FA Receipt {self.number} from {self.date}"
    
    def post(self):
        """
        Post FA receipt:
        1. Create accounting entry (Debit 08, Credit 60)
        2. Update status
        """
        from accounting.models import AccountingEntry, ChartOfAccounts
        from django.db import transaction
        from django.utils import timezone
        
        if self.status == 'POSTED':
            raise ValidationError("Document already posted")
        
        if not self.asset:
            raise ValidationError("Asset must be specified")
        
        with transaction.atomic():
            # Accounting: Debit 08 (Assets in Progress), Credit 60 (Payables)
            try:
                acc_08 = ChartOfAccounts.objects.get(tenant=self.tenant, code='08')
                acc_60 = ChartOfAccounts.objects.get(tenant=self.tenant, code='60')
            except ChartOfAccounts.DoesNotExist:
                raise ValidationError("Required accounts (08, 60) not found")
            
            AccountingEntry.objects.create(
                tenant=self.tenant,
                date=self.date,
                debit_account=acc_08,
                credit_account=acc_60,
                amount=self.asset.initial_cost,
                description=f"FA Receipt: {self.asset.name}",
                document_type_name='FAReceiptDocument',
                document_id=self.id
            )
            
            self.status = 'POSTED'
            self.posted_at = timezone.now()
            self.save(update_fields=['status', 'posted_at'])


class FAAcceptanceDocument(models.Model):
    """
    Acceptance/Commissioning of Fixed Asset (Принятие к учету ОС)
    Moves asset from 08 to 01 and starts depreciation.
    """
    STATUS_CHOICES = [
        ('DRAFT', _('Draft')),
        ('POSTED', _('Posted')),
    ]
    
    tenant = models.ForeignKey('tenants.Tenant', on_delete=models.CASCADE, related_name='fa_acceptances')
    number = models.CharField(_('Number'), max_length=50)
    date = models.DateField(_('Date'))
    status = models.CharField(_('Status'), max_length=20, choices=STATUS_CHOICES, default='DRAFT')
    
    asset = models.ForeignKey(FixedAsset, on_delete=models.PROTECT, related_name='acceptance_documents')
    
    posted_at = models.DateTimeField(null=True, blank=True)
    posted_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='posted_fa_acceptances')
    
    class Meta:
        verbose_name = _('FA Acceptance Document')
        verbose_name_plural = _('FA Acceptance Documents')
        unique_together = [['tenant', 'number']]
        ordering = ['-date', '-number']
    
    def __str__(self):
        return f"FA Acceptance {self.number} from {self.date}"
    
    def post(self):
        """
        Post FA acceptance:
        1. Create accounting entry (Debit 01, Credit 08)
        2. Set asset status to IN_USE
        3. Set commissioning date
        """
        from accounting.models import AccountingEntry, ChartOfAccounts
        from django.db import transaction
        from django.utils import timezone
        
        if self.status == 'POSTED':
            raise ValidationError("Document already posted")
        
        with transaction.atomic():
            # Accounting: Debit 01 (Fixed Assets), Credit 08 (Assets in Progress)
            try:
                acc_01 = self.asset.category.asset_account or ChartOfAccounts.objects.get(tenant=self.tenant, code='01')
                acc_08 = ChartOfAccounts.objects.get(tenant=self.tenant, code='08')
            except ChartOfAccounts.DoesNotExist:
                raise ValidationError("Required accounts (01, 08) not found")
            
            AccountingEntry.objects.create(
                tenant=self.tenant,
                date=self.date,
                debit_account=acc_01,
                credit_account=acc_08,
                amount=self.asset.initial_cost,
                description=f"FA Acceptance: {self.asset.name}",
                document_type_name='FAAcceptanceDocument',
                document_id=self.id
            )
            
            # Update asset
            self.asset.status = 'IN_USE'
            self.asset.commissioning_date = self.date
            self.asset.save(update_fields=['status', 'commissioning_date'])
            
            self.status = 'POSTED'
            self.posted_at = timezone.now()
            self.save(update_fields=['status', 'posted_at'])


class FADisposalDocument(models.Model):
    """
    Disposal of Fixed Asset (Списание ОС)
    Removes asset from books.
    """
    STATUS_CHOICES = [
        ('DRAFT', _('Draft')),
        ('POSTED', _('Posted')),
    ]
    
    DISPOSAL_REASONS = [
        ('SALE', _('Sale')),
        ('SCRAP', _('Scrapped')),
        ('DONATION', _('Donated')),
        ('LOSS', _('Lost/Stolen')),
    ]
    
    tenant = models.ForeignKey('tenants.Tenant', on_delete=models.CASCADE, related_name='fa_disposals')
    number = models.CharField(_('Number'), max_length=50)
    date = models.DateField(_('Date'))
    status = models.CharField(_('Status'), max_length=20, choices=STATUS_CHOICES, default='DRAFT')
    
    asset = models.ForeignKey(FixedAsset, on_delete=models.PROTECT, related_name='disposal_documents')
    reason = models.CharField(_('Disposal Reason'), max_length=20, choices=DISPOSAL_REASONS)
    sale_amount = models.DecimalField(_('Sale Amount'), max_digits=15, decimal_places=2, null=True, blank=True, help_text="If sold")
    
    posted_at = models.DateTimeField(null=True, blank=True)
    posted_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='posted_fa_disposals')
    
    class Meta:
        verbose_name = _('FA Disposal Document')
        verbose_name_plural = _('FA Disposal Documents')
        unique_together = [['tenant', 'number']]
        ordering = ['-date', '-number']
    
    def __str__(self):
        return f"FA Disposal {self.number} from {self.date}"
    
    def post(self):
        """
        Post FA disposal:
        1. Write off accumulated depreciation (Debit 02, Credit 01)
        2. Write off remaining value to expenses (Debit 91, Credit 01)
        3. If sold, record revenue (Debit 62, Credit 91)
        4. Update asset status
        """
        from accounting.models import AccountingEntry, ChartOfAccounts
        from django.db import transaction
        from django.utils import timezone
        
        if self.status == 'POSTED':
            raise ValidationError("Document already posted")
        
        with transaction.atomic():
            try:
                acc_01 = ChartOfAccounts.objects.get(tenant=self.tenant, code='01')
                acc_02 = ChartOfAccounts.objects.get(tenant=self.tenant, code='02')
                acc_91 = ChartOfAccounts.objects.get(tenant=self.tenant, code='91')  # Other income/expenses
            except ChartOfAccounts.DoesNotExist:
                raise ValidationError("Required accounts (01, 02, 91) not found")
            
            # 1. Write off accumulated depreciation
            if self.asset.accumulated_depreciation > 0:
                AccountingEntry.objects.create(
                    tenant=self.tenant,
                    date=self.date,
                    debit_account=acc_02,
                    credit_account=acc_01,
                    amount=self.asset.accumulated_depreciation,
                    description=f"Write-off accumulated depreciation: {self.asset.name}",
                    document_type_name='FADisposalDocument',
                    document_id=self.id
                )
            
            # 2. Write off remaining book value
            remaining_value = self.asset.current_value
            if remaining_value > 0:
                AccountingEntry.objects.create(
                    tenant=self.tenant,
                    date=self.date,
                    debit_account=acc_91,
                    credit_account=acc_01,
                    amount=remaining_value,
                    description=f"Write-off remaining value: {self.asset.name}",
                    document_type_name='FADisposalDocument',
                    document_id=self.id
                )
            
            # 3. If sold, record revenue
            if self.reason == 'SALE' and self.sale_amount:
                acc_62 = ChartOfAccounts.objects.get(tenant=self.tenant, code='62')  # Receivables
                AccountingEntry.objects.create(
                    tenant=self.tenant,
                    date=self.date,
                    debit_account=acc_62,
                    credit_account=acc_91,
                    amount=self.sale_amount,
                    description=f"Sale of FA: {self.asset.name}",
                    document_type_name='FADisposalDocument',
                    document_id=self.id
                )
            
            # Update asset
            self.asset.status = 'DISPOSED'
            self.asset.disposal_date = self.date
            self.asset.save(update_fields=['status', 'disposal_date'])
            
            self.status = 'POSTED'
            self.posted_at = timezone.now()
            self.save(update_fields=['status', 'posted_at'])


# ============================================================================
# INTANGIBLE ASSETS (NMA) - 1C Style Mirror
# ============================================================================

class IntangibleAssetCategory(models.Model):
    """
    Hierarchical categories for Intangible Assets.
    Examples: Software Licenses, Patents, Trademarks
    """
    tenant = models.ForeignKey('tenants.Tenant', on_delete=models.CASCADE, related_name='ia_categories')
    code = models.CharField(_('Code'), max_length=20)
    name = models.CharField(_('Name'), max_length=200)
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='children')
    
    default_useful_life_months = models.IntegerField(_('Default Useful Life (Months)'), default=60)
    
    # Accounting integration
    asset_account = models.ForeignKey(
        'accounting.ChartOfAccounts',
        on_delete=models.PROTECT,
        related_name='ia_categories_asset',
        null=True,
        blank=True,
        help_text="Default account 04 (Intangible Assets)"
    )
    amortization_account = models.ForeignKey(
        'accounting.ChartOfAccounts',
        on_delete=models.PROTECT,
        related_name='ia_categories_amortization',
        null=True,
        blank=True,
        help_text="Default account 05 (Amortization of Intangible Assets)"
    )
    
    class Meta:
        verbose_name = _('Intangible Asset Category')
        verbose_name_plural = _('Intangible Asset Categories')
        unique_together = [['tenant', 'code']]
        ordering = ['code']
    
    def __str__(self):
        return f"{self.code} - {self.name}"


class IntangibleAsset(models.Model):
    """
    Intangible Asset (Нематериальный Актив)
    """
    STATUS_CHOICES = [
        ('IN_USE', _('In Use')),
        ('WRITTEN_OFF', _('Written Off')),
    ]
    
    tenant = models.ForeignKey('tenants.Tenant', on_delete=models.CASCADE, related_name='intangible_assets')
    
    inventory_number = models.CharField(_('Inventory Number'), max_length=50, help_text="Unique NMA ID")
    name = models.CharField(_('Name'), max_length=200)
    category = models.ForeignKey(IntangibleAssetCategory, on_delete=models.PROTECT, related_name='assets')
    
    initial_cost = models.DecimalField(_('Initial Cost'), max_digits=15, decimal_places=2)
    accumulated_amortization = models.DecimalField(_('Accumulated Amortization'), max_digits=15, decimal_places=2, default=0, editable=False)
    
    useful_life_months = models.IntegerField(_('Useful Life (Months)'), default=60)
    
    acquisition_date = models.DateField(_('Acquisition Date'))
    commissioning_date = models.DateField(_('Commissioning Date'))
    write_off_date = models.DateField(_('Write-off Date'), null=True, blank=True)
    
    status = models.CharField(_('Status'), max_length=20, choices=STATUS_CHOICES, default='IN_USE')
    
    description = models.TextField(_('Description'), blank=True)
    
    class Meta:
        verbose_name = _('Intangible Asset')
        verbose_name_plural = _('Intangible Assets')
        unique_together = [['tenant', 'inventory_number']]
        ordering = ['inventory_number']
    
    def __str__(self):
        return f"{self.inventory_number} - {self.name}"
    
    @property
    def current_value(self):
        return self.initial_cost - self.accumulated_amortization
    
    def calculate_monthly_amortization(self):
        if self.status != 'IN_USE':
            return Decimal('0.00')
        
        if self.accumulated_amortization >= self.initial_cost:
            return Decimal('0.00')
        
        # Linear only for NMA usually
        monthly_amount = self.initial_cost / self.useful_life_months
        remaining = self.initial_cost - self.accumulated_amortization
        return min(monthly_amount, remaining).quantize(Decimal('0.01'))


class AmortizationSchedule(models.Model):
    """
    Tracks amortization postings by period for NMA.
    """
    tenant = models.ForeignKey('tenants.Tenant', on_delete=models.CASCADE, related_name='amortization_schedules')
    asset = models.ForeignKey(IntangibleAsset, on_delete=models.CASCADE, related_name='amortization_schedule')
    period = models.DateField(_('Period'))
    amount = models.DecimalField(_('Amortization Amount'), max_digits=15, decimal_places=2)
    accounting_entry = models.ForeignKey('accounting.AccountingEntry', on_delete=models.SET_NULL, null=True, blank=True)
    posted_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = _('Amortization Schedule')
        verbose_name_plural = _('Amortization Schedules')
        unique_together = [['tenant', 'asset', 'period']]
        ordering = ['-period']


# --- NMA DOCUMENTS ---

class IAReceiptDocument(models.Model):
    """Receipt of Intangible Asset"""
    STATUS_CHOICES = [('DRAFT', _('Draft')), ('POSTED', _('Posted'))]
    
    tenant = models.ForeignKey('tenants.Tenant', on_delete=models.CASCADE, related_name='ia_receipts')
    number = models.CharField(_('Number'), max_length=50)
    date = models.DateField(_('Date'))
    status = models.CharField(_('Status'), max_length=20, choices=STATUS_CHOICES, default='DRAFT')
    
    supplier = models.ForeignKey('directories.Counterparty', on_delete=models.PROTECT, related_name='ia_receipts')
    asset = models.ForeignKey(IntangibleAsset, on_delete=models.PROTECT, related_name='receipt_documents', null=True, blank=True)
    
    posted_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-date', '-number']
        unique_together = [['tenant', 'number']]

    def post(self):
        from accounting.models import AccountingEntry, ChartOfAccounts
        from django.db import transaction
        from django.utils import timezone
        
        if self.status == 'POSTED': raise ValidationError("Already posted")
        if not self.asset: raise ValidationError("Asset required")

        with transaction.atomic():
            # DB 08 (Investments/Intangible), CR 60 (Suppliers)
            # Assuming 08 covers NMA progress too, or 08.05 specifically. Using generic '08' for now.
            try:
                acc_08 = ChartOfAccounts.objects.get(tenant=self.tenant, code='08')
                acc_60 = ChartOfAccounts.objects.get(tenant=self.tenant, code='60')
            except ChartOfAccounts.DoesNotExist:
                raise ValidationError("Accounts 08/60 not found")
            
            AccountingEntry.objects.create(
                tenant=self.tenant, date=self.date,
                debit_account=acc_08, credit_account=acc_60,
                amount=self.asset.initial_cost,
                description=f"IA Receipt: {self.asset.name}",
                document_type_name='IAReceiptDocument', document_id=self.id
            )
            self.status = 'POSTED'
            self.posted_at = timezone.now()
            self.save()


class IAAcceptanceDocument(models.Model):
    """Commissioning of Intangible Asset"""
    STATUS_CHOICES = [('DRAFT', _('Draft')), ('POSTED', _('Posted'))]
    
    tenant = models.ForeignKey('tenants.Tenant', on_delete=models.CASCADE, related_name='ia_acceptances')
    number = models.CharField(_('Number'), max_length=50)
    date = models.DateField(_('Date'))
    status = models.CharField(_('Status'), max_length=20, choices=STATUS_CHOICES, default='DRAFT')
    
    asset = models.ForeignKey(IntangibleAsset, on_delete=models.PROTECT, related_name='acceptance_documents')
    posted_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-date', '-number']
        unique_together = [['tenant', 'number']]

    def post(self):
        from accounting.models import AccountingEntry, ChartOfAccounts
        from django.db import transaction
        from django.utils import timezone
        
        if self.status == 'POSTED': raise ValidationError("Already posted")

        with transaction.atomic():
            # DB 04 (Intangible Assets), CR 08 (Investments)
            try:
                acc_04 = self.asset.category.asset_account or ChartOfAccounts.objects.get(tenant=self.tenant, code='04')
                acc_08 = ChartOfAccounts.objects.get(tenant=self.tenant, code='08')
            except ChartOfAccounts.DoesNotExist:
                raise ValidationError("Accounts 04/08 not found")
            
            AccountingEntry.objects.create(
                tenant=self.tenant, date=self.date,
                debit_account=acc_04, credit_account=acc_08,
                amount=self.asset.initial_cost,
                description=f"IA Acceptance: {self.asset.name}",
                document_type_name='IAAcceptanceDocument', document_id=self.id
            )
            
            self.asset.status = 'IN_USE'
            self.asset.commissioning_date = self.date
            self.asset.save()
            
            self.status = 'POSTED'
            self.posted_at = timezone.now()
            self.save()


class IADisposalDocument(models.Model):
    """Disposal of Intangible Asset"""
    STATUS_CHOICES = [('DRAFT', _('Draft')), ('POSTED', _('Posted'))]
    
    tenant = models.ForeignKey('tenants.Tenant', on_delete=models.CASCADE, related_name='ia_disposals')
    number = models.CharField(_('Number'), max_length=50)
    date = models.DateField(_('Date'))
    status = models.CharField(_('Status'), max_length=20, choices=STATUS_CHOICES, default='DRAFT')
    
    asset = models.ForeignKey(IntangibleAsset, on_delete=models.PROTECT, related_name='disposal_documents')
    posted_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-date', '-number']
        unique_together = [['tenant', 'number']]

    def post(self):
        from accounting.models import AccountingEntry, ChartOfAccounts
        from django.db import transaction
        from django.utils import timezone
        
        if self.status == 'POSTED': raise ValidationError("Already posted")
        
        with transaction.atomic():
            try:
                acc_04 = ChartOfAccounts.objects.get(tenant=self.tenant, code='04')
                acc_05 = ChartOfAccounts.objects.get(tenant=self.tenant, code='05') # Amortization
                acc_91 = ChartOfAccounts.objects.get(tenant=self.tenant, code='91')
            except ChartOfAccounts.DoesNotExist:
                raise ValidationError("Accounts 04/05/91 not found")
            
            # 1. Write off amortization (DB 05, CR 04)
            if self.asset.accumulated_amortization > 0:
                AccountingEntry.objects.create(
                    tenant=self.tenant, date=self.date,
                    debit_account=acc_05, credit_account=acc_04,
                    amount=self.asset.accumulated_amortization,
                    description=f"Write-off amortization: {self.asset.name}",
                    document_type_name='IADisposalDocument', document_id=self.id
                )
            
            # 2. Write off remaining (DB 91, CR 04)
            remaining = self.asset.current_value
            if remaining > 0:
                AccountingEntry.objects.create(
                    tenant=self.tenant, date=self.date,
                    debit_account=acc_91, credit_account=acc_04,
                    amount=remaining,
                    description=f"Write-off remaining IA: {self.asset.name}",
                    document_type_name='IADisposalDocument', document_id=self.id
                )
            
            self.asset.status = 'WRITTEN_OFF'
            self.asset.write_off_date = self.date
            self.asset.save()
            
            self.status = 'POSTED'
            self.posted_at = timezone.now()
            self.save()
