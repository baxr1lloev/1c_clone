from django.db import models
from django.utils.translation import gettext_lazy as _
from django.conf import settings
from tenants.models import Tenant
from .category_model import ItemCategory

class Currency(models.Model):
    """
    Global currencies (USD, EUR, RUB, UZS).
    """
    RATE_SOURCE_CHOICES = [
        ('MANUAL', _('Manual Input')),
        ('CBR', _('Download from Internet (CBR/CBU)')),
        ('MARKUP', _('Markup on Base Currency')),
    ]

    code = models.CharField(_('Code'), max_length=3, unique=True)
    name = models.CharField(_('Name'), max_length=50)
    symbol = models.CharField(_('Symbol'), max_length=5, blank=True)
    
    rate_source = models.CharField(_('Rate Source'), max_length=20, choices=RATE_SOURCE_CHOICES, default='MANUAL')
    markup_percent = models.DecimalField(_('Markup %'), max_digits=5, decimal_places=2, default=0, help_text="Percentage added to base rate")
    markup_base_currency = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='dependent_currencies')
    
    def __str__(self):
        return self.code

    class Meta:
        verbose_name = _('Currency')
        verbose_name_plural = _('Currencies')


class ExchangeRate(models.Model):
    """
    Daily exchange rates per tenant.
    One rate per currency per day.
    """
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='exchange_rates')
    currency = models.ForeignKey(Currency, on_delete=models.CASCADE)
    date = models.DateField(_('Date'))
    from django.utils import timezone
    rate = models.DecimalField(_('Rate'), max_digits=12, decimal_places=6, default=1, help_text="Rate relative to Base Currency")
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        unique_together = ('tenant', 'currency', 'date')
        verbose_name = _('Exchange Rate')
        verbose_name_plural = _('Exchange Rates')
        ordering = ['-date']
        
    def __str__(self):
        return f"{self.currency} @ {self.date}: {self.rate}"


class Counterparty(models.Model):
    """
    Clients, Suppliers, etc.
    """
    TYPE_CHOICES = [
        ('CUSTOMER', _('Customer')),
        ('SUPPLIER', _('Supplier')),
        ('AGENT', _('Agent')),
    ]
    
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='counterparties')
    name = models.CharField(_('Name'), max_length=255)
    inn = models.CharField(_('INN'), max_length=20)
    type = models.CharField(_('Type'), max_length=20, choices=TYPE_CHOICES)
    phone = models.CharField(_('Phone'), max_length=50, blank=True)
    email = models.EmailField(_('Email'), blank=True)
    address = models.TextField(_('Address'), blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ('tenant', 'inn')
        verbose_name = _('Counterparty')
        verbose_name_plural = _('Counterparties')
        
    def __str__(self):
        return self.name


class ContactPerson(models.Model):
    """
    Контактное лицо - Contact persons for counterparty.
    """
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    counterparty = models.ForeignKey(Counterparty, on_delete=models.CASCADE, related_name='contacts')
    name = models.CharField(_('Name'), max_length=255)
    position = models.CharField(_('Position'), max_length=100, blank=True)
    phone = models.CharField(_('Phone'), max_length=50, blank=True)
    email = models.EmailField(_('Email'), blank=True)
    comment = models.TextField(_('Comment'), blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ('counterparty', 'email')
        verbose_name = _('Contact Person')
        verbose_name_plural = _('Contact Persons')
    
    def __str__(self):
        return f"{self.name} ({self.counterparty})"


class Contract(models.Model):
    """
    Contracts determine currency and financial terms.
    """
    CONTRACT_TYPES = [
        ('SALES', _('Sales Contract')),
        ('PURCHASE', _('Purchase Contract')),
        ('COMMISSION', _('Commission Agent')),
    ]
    
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='contracts')
    counterparty = models.ForeignKey(Counterparty, on_delete=models.CASCADE, related_name='contracts')
    number = models.CharField(_('Contract Number'), max_length=50)
    date = models.DateField(_('Contract Date'))
    currency = models.ForeignKey(Currency, on_delete=models.PROTECT)
    contract_type = models.CharField(_('Type'), max_length=20, choices=CONTRACT_TYPES)
    
    is_active = models.BooleanField(default=True)
    
    class Meta:
        verbose_name = _('Contract')
        verbose_name_plural = _('Contracts')
        
    def __str__(self):
        return f"№{self.number} ({self.currency})"


class Warehouse(models.Model):
    """
    Physical or Logical storage location.
    """
    TYPES = [
        ('PHYSICAL', _('Physical Store/Warehouse')),
        ('VIRTUAL', _('Virtual/Logical')),
        ('TRANSIT', _('Goods in Transit')),
    ]
    
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='warehouses')
    name = models.CharField(_('Name'), max_length=100)
    address = models.CharField(_('Address'), max_length=255, blank=True)
    warehouse_type = models.CharField(_('Type'), max_length=20, choices=TYPES, default='PHYSICAL')
    
    is_active = models.BooleanField(_('Active'), default=True)
    
    class Meta:
        verbose_name = _('Warehouse')
        verbose_name_plural = _('Warehouses')
        
    def __str__(self):
        return self.name


class Item(models.Model):
    """
    Products and Services.
    """
    ITEM_TYPES = [
        ('GOODS', _('Good')),
        ('SERVICE', _('Service')),
    ]
    
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='items')
    name = models.CharField(_('Name'), max_length=255)
    sku = models.CharField(_('SKU'), max_length=50)
    item_type = models.CharField(_('Type'), max_length=20, choices=ITEM_TYPES, default='GOODS')
    unit = models.CharField(_('Unit'), max_length=20, default='pcs')
    
    purchase_price = models.DecimalField(_('Purchase Price'), max_digits=15, decimal_places=2, default=0)
    selling_price = models.DecimalField(_('Selling Price'), max_digits=15, decimal_places=2, default=0)
    
    category = models.ForeignKey('ItemCategory', on_delete=models.SET_NULL, null=True, blank=True, related_name='items')
    
    class Meta:
        unique_together = ('tenant', 'sku')
        verbose_name = _('Item')
        verbose_name_plural = _('Items')
        
    def __str__(self):
        return f"{self.name} ({self.sku})"


class ItemPackage(models.Model):
    """
    UOM / Packaging (Упаковки).
    Always relative to Item.base_unit (coefficient).
    """
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name='packages')
    name = models.CharField(_('Package Name'), max_length=50) # e.g. "Box"
    coefficient = models.DecimalField(_('Coefficient'), max_digits=10, decimal_places=3, default=1) # e.g. 12
    is_default = models.BooleanField(_('Is Default'), default=False)
    
    class Meta:
        verbose_name = _('Item Package')
        verbose_name_plural = _('Item Packages')
        
    def __str__(self):
        return f"{self.name} (x{self.coefficient})"


class BankAccount(models.Model):
    """
    Расчетные счета организации (Company Bank Accounts).
    """
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='bank_accounts')
    name = models.CharField(_('Name'), max_length=100, help_text="User-friendly name, e.g. Main Account")
    ACCOUNT_TYPE_CHOICES = [
        ('settlement', _('Settlement')),
        ('foreign', _('Foreign Currency')),
        ('deposit', _('Deposit')),
    ]
    account_type = models.CharField(_('Account Type'), max_length=20, choices=ACCOUNT_TYPE_CHOICES, default='settlement')
    bank_name = models.CharField(_('Bank Name'), max_length=100)
    account_number = models.CharField(_('Account Number'), max_length=50) # IBAN or local
    bik = models.CharField(_('BIK'), max_length=20, blank=True, help_text="Bank Identification Code")
    correspondent_account = models.CharField(_('Correspondent Account'), max_length=50, blank=True)
    swift_code = models.CharField(_('SWIFT Code'), max_length=20, blank=True)
    accounting_account = models.ForeignKey(
        'accounting.ChartOfAccounts',
        on_delete=models.PROTECT,
        related_name='bank_accounts',
        null=True,
        blank=True
    )
    currency = models.ForeignKey(Currency, on_delete=models.PROTECT)
    is_default = models.BooleanField(_('Default For Tenant'), default=False)
    is_active = models.BooleanField(default=True)
    opening_date = models.DateField(_('Opening Date'), null=True, blank=True)

    overdraft_allowed = models.BooleanField(_('Overdraft Allowed'), default=False)
    overdraft_limit = models.DecimalField(_('Overdraft Limit'), max_digits=15, decimal_places=2, default=0)
    minimum_balance = models.DecimalField(_('Minimum Balance'), max_digits=15, decimal_places=2, default=0)
    comment = models.TextField(_('Comment'), blank=True)
    
    class Meta:
        verbose_name = _('Bank Account')
        verbose_name_plural = _('Bank Accounts')
        
    def __str__(self):
        return f"{self.bank_name} ({self.currency}) - {self.account_number}"

    def clean(self):
        from django.core.exceptions import ValidationError

        if self.account_type == 'foreign' and not self.swift_code:
            raise ValidationError({'swift_code': _('SWIFT code is required for foreign currency accounts.')})

        if not self.overdraft_allowed and self.overdraft_limit:
            raise ValidationError({'overdraft_limit': _('Set overdraft limit only when overdraft is allowed.')})

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.is_default:
            BankAccount.objects.filter(
                tenant=self.tenant,
                is_default=True
            ).exclude(pk=self.pk).update(is_default=False)


class BankExchangeSettings(models.Model):
    """
    Bank exchange configuration (import/export settings per bank account).
    """
    FORMAT_CHOICES = [
        ('CSV', _('CSV')),
        ('CLIENT_BANK_1C', _('1C ClientBank')),
        ('ISO20022', _('ISO20022')),
        ('API', _('Bank API')),
    ]
    ENCODING_CHOICES = [
        ('WINDOWS-1251', _('Windows (CP1251)')),
        ('DOS-866', _('DOS (CP866)')),
        ('UTF-8', _('UTF-8')),
    ]

    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='bank_exchange_settings')
    bank_account = models.OneToOneField(
        BankAccount,
        on_delete=models.CASCADE,
        related_name='exchange_settings'
    )
    exchange_format = models.CharField(_('Exchange Format'), max_length=30, choices=FORMAT_CHOICES, default='CSV')
    bank_program_name = models.CharField(_('Bank Program Name'), max_length=100, blank=True)
    encoding = models.CharField(_('Encoding'), max_length=20, choices=ENCODING_CHOICES, default='UTF-8')

    # Import behavior
    auto_create_counterparties = models.BooleanField(_('Auto Create Counterparties'), default=True)
    new_counterparty_group_name = models.CharField(_('New Counterparty Group'), max_length=100, blank=True)
    auto_detect_bank_fees = models.BooleanField(_('Auto Detect Bank Fees'), default=True)
    auto_post_incoming = models.BooleanField(_('Auto Post Incoming'), default=False)
    auto_post_outgoing = models.BooleanField(_('Auto Post Outgoing'), default=False)
    show_form_before_import = models.BooleanField(_('Show Form Before Import'), default=True)

    # Export behavior
    export_payment_orders = models.BooleanField(_('Export Payment Orders'), default=True)
    export_payment_claims = models.BooleanField(_('Export Payment Claims'), default=False)
    validate_document_number = models.BooleanField(_('Validate Document Number'), default=True)
    validate_exchange_security = models.BooleanField(_('Validate Exchange Security'), default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _('Bank Exchange Settings')
        verbose_name_plural = _('Bank Exchange Settings')

    def __str__(self):
        return f"{self.bank_account} ({self.exchange_format})"


class BankOperationType(models.Model):
    """
    Bank operation semantics (templates for posting and validation).
    """
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='bank_operation_types')
    code = models.CharField(_('Code'), max_length=50)
    name = models.CharField(_('Name'), max_length=255)

    debit_account = models.ForeignKey(
        'accounting.ChartOfAccounts',
        on_delete=models.PROTECT,
        related_name='bank_operation_types_debit'
    )
    credit_account = models.ForeignKey(
        'accounting.ChartOfAccounts',
        on_delete=models.PROTECT,
        related_name='bank_operation_types_credit'
    )

    requires_counterparty = models.BooleanField(default=False)
    requires_contract = models.BooleanField(default=False)
    requires_tax = models.BooleanField(default=False)
    auto_create_payment = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = _('Bank Operation Type')
        verbose_name_plural = _('Bank Operation Types')
        unique_together = ('tenant', 'code')
        ordering = ['code']

    def __str__(self):
        return f"{self.code} - {self.name}"


class Employee(models.Model):
    """
    Сотрудники (Employees).
    """
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='employees')
    first_name = models.CharField(_('First Name'), max_length=100)
    last_name = models.CharField(_('Last Name'), max_length=100)
    middle_name = models.CharField(_('Middle Name'), max_length=100, blank=True)
    
    inn = models.CharField(_('INN'), max_length=20, blank=True)
    position = models.CharField(_('Position'), max_length=100, blank=True)
    hiring_date = models.DateField(_('Hiring Date'), null=True, blank=True)
    
    # Salary
    base_salary = models.DecimalField(_('Base Salary'), max_digits=15, decimal_places=2, default=0)
    
    # Contact
    phone = models.CharField(_('Phone'), max_length=50, blank=True)
    email = models.EmailField(_('Email'), blank=True)
    address = models.TextField(_('Address'), blank=True)
    
    # System User Link
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='employee_profile')
    
    is_active = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = _('Employee')
        verbose_name_plural = _('Employees')
        ordering = ['last_name', 'first_name']
        
    def __str__(self):
        return f"{self.last_name} {self.first_name} {self.middle_name}".strip()


class Department(models.Model):
    """
    Подразделения (Departments).
    Cost centers for analytics.
    """
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='departments')
    name = models.CharField(_('Name'), max_length=100)
    code = models.CharField(_('Code'), max_length=20, blank=True)
    
    parent = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='children')
    is_active = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = _('Department')
        verbose_name_plural = _('Departments')
        ordering = ['name']
        
    def __str__(self):
        return self.name


class Project(models.Model):
    """
    Проекты (Projects).
    P&L centers for analytics.
    """
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='projects')
    name = models.CharField(_('Name'), max_length=100)
    code = models.CharField(_('Code'), max_length=20, blank=True)
    
    start_date = models.DateField(_('Start Date'), null=True, blank=True)
    end_date = models.DateField(_('End Date'), null=True, blank=True)
    
    is_active = models.BooleanField(default=True)
    status = models.CharField(_('Status'), max_length=20, default='ACTIVE', choices=[
        ('ACTIVE', _('Active')),
        ('COMPLETED', _('Completed')),
        ('CANCELLED', _('Cancelled')),
    ])
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = _('Project')
        verbose_name_plural = _('Projects')
        ordering = ['-created_at']
        
    def __str__(self):
        return self.name


class CashFlowItem(models.Model):
    """
    Статьи движения денежных средств (Cash Flow Items).
    """
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='cash_flow_items')
    name = models.CharField(_('Name'), max_length=255)
    
    TYPE_CHOICES = [
        ('OPERATING', _('Operating Activities')),
        ('INVESTING', _('Investing Activities')),
        ('FINANCING', _('Financing Activities')),
    ]
    activity_type = models.CharField(_('Activity Type'), max_length=20, choices=TYPE_CHOICES)
    
    is_active = models.BooleanField(default=True)
    
    class Meta:
        unique_together = ('tenant', 'name')
        verbose_name = _('Cash Flow Item')
        verbose_name_plural = _('Cash Flow Items')
        ordering = ['activity_type', 'name']
    
    def __str__(self):
        return self.name
