"""
VAT Models for Uzbekistan.

All VAT-related models in one place:
- VATRate
- VATTransaction
- ElectronicInvoice (E-Soliq)
- ESoliqIntegrationLog
- VATDeclaration
"""
from django.db import models
from django.utils.translation import gettext_lazy as _
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey
from django.conf import settings
from tenants.models import Tenant
from directories.models import Currency, Counterparty


class VATRate(models.Model):
    """
    Ставки НДС (VAT Rates).
    
    Узбекистан:
    - 12% - основная ставка (с 2023)
    - 0% - экспорт
    - Освобождение - льготные категории
    """
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='vat_rates')
    code = models.CharField(_('Code'), max_length=20, help_text="e.g., '12%', '0%'")
    rate = models.DecimalField(_('Rate'), max_digits=5, decimal_places=2, help_text="e.g., 12.00 for 12%")
    is_default = models.BooleanField(_('Default Rate'), default=False)
    is_active = models.BooleanField(_('Active'), default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = _('VAT Rate')
        verbose_name_plural = _('VAT Rates')
        unique_together = ('tenant', 'code')
        ordering = ['-rate']
    
    def __str__(self):
        return f"{self.code} ({self.rate}%)"
    
    def save(self, *args, **kwargs):
        # Ensure only one default rate per tenant
        if self.is_default:
            VATRate.objects.filter(tenant=self.tenant, is_default=True).update(is_default=False)
        super().save(*args, **kwargs)


class ElectronicInvoice(models.Model):
    """
    Электронный счёт-фактура (E-Soliq) - Узбекистан.
    
    🔴 БЕЗ ЭТОГО НДС В УЗБЕКИСТАНЕ НЕ СУЩЕСТВУЕТ!
    
    Это ЦЕНТР всей системы НДС в Узбекистане!
    """
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='electronic_invoices')
    
    # Expanded Invoice Types for Uzbekistan E-Soliq
    INVOICE_TYPES = [
        ('OUT', _('Реализация (Sale)')),
        ('IN', _('Поступление (Purchase)')),
        ('RETURN_OUT', _('Возврат покупателю (Return Out)')),
        ('RETURN_IN', _('Возврат от поставщика (Return In)')),
        ('ADJUSTMENT', _('Корректировка (Adjustment)')),
        ('EXPORT', _('Экспорт (Export)')),
        ('AGENT', _('Агентский (Agent)')),
    ]
    invoice_type = models.CharField(_('Invoice Type'), max_length=20, choices=INVOICE_TYPES)
    
    number = models.CharField(_('Number'), max_length=50)
    date = models.DateField(_('Date'))
    
    counterparty = models.ForeignKey(Counterparty, on_delete=models.PROTECT, related_name='electronic_invoices')
    counterparty_tin = models.CharField(_('Counterparty TIN/INN'), max_length=50,
                                       help_text="ИНН контрагента (ОБЯЗАТЕЛЬНО для E-Soliq!)")
    
    base_amount = models.DecimalField(_('Base Amount'), max_digits=15, decimal_places=2)
    vat_rate = models.ForeignKey(VATRate, on_delete=models.PROTECT, related_name='electronic_invoices')
    vat_amount = models.DecimalField(_('VAT Amount'), max_digits=15, decimal_places=2)
    total_amount = models.DecimalField(_('Total Amount'), max_digits=15, decimal_places=2)
    
    related_content_type = models.ForeignKey(ContentType, on_delete=models.PROTECT, null=True, blank=True)
    related_object_id = models.PositiveIntegerField(null=True, blank=True)
    related_document = GenericForeignKey('related_content_type', 'related_object_id')
    
    STATUS_CHOICES = [
        ('DRAFT', _('Черновик')),
        ('SENT', _('Отправлен в E-Soliq')),
        ('ACCEPTED', _('Принят (Signed)')),
        ('REJECTED', _('Отклонён (Rejected)')),
        ('CANCELLED', _('Отменён (Cancelled)')),
        ('ERROR', _('Ошибка (Error)')),
    ]
    status = models.CharField(_('Status'), max_length=20, choices=STATUS_CHOICES, default='DRAFT')
    
    esoliq_uuid = models.CharField(_('E-Soliq UUID'), max_length=100, null=True, blank=True, unique=True)
    esoliq_sent_at = models.DateTimeField(null=True, blank=True)
    esoliq_accepted_at = models.DateTimeField(null=True, blank=True)
    esoliq_rejection_reason = models.TextField(blank=True)
    
    vat_transaction = models.ForeignKey('VATTransaction', on_delete=models.PROTECT, null=True, blank=True, related_name='source_invoice')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='created_einvoices')
    
    class Meta:
        verbose_name = _('Electronic Invoice (E-Soliq)')
        verbose_name_plural = _('Electronic Invoices (E-Soliq)')
        unique_together = ('tenant', 'invoice_type', 'number', 'date')
        ordering = ['-date', '-created_at']
        indexes = [
            models.Index(fields=['tenant', 'status', 'date']),
            models.Index(fields=['counterparty', 'date']),
            models.Index(fields=['esoliq_uuid']),
        ]
    
    def __str__(self):
        return f"{self.get_invoice_type_display()} #{self.number} - {self.counterparty}"
    
    def send_to_esoliq(self):
        """Отправка СФ в E-Soliq"""
        from django.utils import timezone
        
        if self.status != 'DRAFT':
            raise ValueError(f"Cannot send invoice with status {self.status}")
        
        self.status = 'SENT'
        self.esoliq_sent_at = timezone.now()
        self.save()
        
        ESoliqIntegrationLog.objects.create(
            tenant=self.tenant,
            invoice=self,
            action='SEND_INVOICE',
            request_data={'number': self.number, 'total_amount': str(self.total_amount)},
            response_data={},
            status='PENDING'
        )
    
    def mark_as_accepted(self, esoliq_uuid=None):
        """
        Пометить как принятый и создать VATTransaction.
        
        КРИТИЧНО: 
        1. Проверка периода (нельзя принять в закрытом периоде!)
        2. Защита от дублей VATTransaction
        """
        from django.utils import timezone
        from accounting.models import PeriodClosing
        
        # 1. Period Validation
        PeriodClosing.validate_period_is_open(
            self.date, 
            self.tenant, 
            check_type='ACCOUNTING'
        )

        if esoliq_uuid:
            self.esoliq_uuid = esoliq_uuid
        
        self.status = 'ACCEPTED'
        self.esoliq_accepted_at = timezone.now()
        self.save()
        
        # 2. Create VAT Transaction (with guard)
        self.create_vat_transaction()
    
    def mark_as_rejected(self, reason):
        """Пометить как отклонённый"""
        self.status = 'REJECTED'
        self.esoliq_rejection_reason = reason
        self.save()
    
    def create_vat_transaction(self):
        """
        Создание VATTransaction после ACCEPTED.
        
        Guards:
        - Must be ACCEPTED
        - No existing transaction
        - Period must be open (double check)
        """
        if self.status != 'ACCEPTED':
            raise ValueError("Cannot create VAT transaction - not ACCEPTED!")
        
        # Guard: Check if already exists
        if self.vat_transaction:
            return self.vat_transaction
            
        # Optional: Double check period open (in case called separately)
        from accounting.models import PeriodClosing
        PeriodClosing.validate_period_is_open(self.date, self.tenant, check_type='ACCOUNTING')
        
        # Determine VAT type
        if self.invoice_type in ['OUT', 'RETURN_IN', 'EXPORT', 'AGENT']:
            vat_type = 'OUTPUT'  # Мы платим НДС (реализация)
        elif self.invoice_type in ['IN', 'RETURN_OUT']:
            vat_type = 'INPUT'   # Мы принимаем к вычету (покупка)
        elif self.invoice_type == 'ADJUSTMENT':
            if self.created_by: # Мы создали
                vat_type = 'OUTPUT'
            else:
                vat_type = 'INPUT'
        else:
             vat_type = 'OUTPUT' # Default fall back
        
        # Ensure date is datetime for VATTransaction
        from datetime import datetime
        vat_date = datetime.combine(self.date, datetime.min.time())
        
        vat_trans = VATTransaction.objects.create(
            tenant=self.tenant,
            date=vat_date,
            period=self.date.replace(day=1),
            vat_type=vat_type,
            base_amount=self.base_amount,
            vat_amount=self.vat_amount,
            total_amount=self.total_amount,
            vat_rate=self.vat_rate,
            currency=self.tenant.base_currency,
            electronic_invoice=self
        )
        
        self.vat_transaction = vat_trans
        self.save()
        
        return vat_trans


class VATTransaction(models.Model):
    """
    VAT Transaction - движения НДС (КРИТИЧНО для Узбекистана!)
    
    Формула: НДС к уплате = SUM(OUTPUT) - SUM(INPUT)
    """
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    date = models.DateTimeField(_('Date'))
    period = models.DateField(_('Period (YYYY-MM-01)'))
    
    VAT_TYPES = [
        ('INPUT', _('Входящий НДС (к зачёту)')),
        ('OUTPUT', _('Исходящий НДС (к уплате)')),
    ]
    vat_type = models.CharField(_('VAT Type'), max_length=10, choices=VAT_TYPES)
    
    base_amount = models.DecimalField(_('Base Amount'), max_digits=15, decimal_places=2)
    vat_amount = models.DecimalField(_('VAT Amount'), max_digits=15, decimal_places=2)
    total_amount = models.DecimalField(_('Total Amount'), max_digits=15, decimal_places=2)
    vat_rate = models.ForeignKey(VATRate, on_delete=models.PROTECT)
    currency = models.ForeignKey(Currency, on_delete=models.PROTECT)
    
    content_type = models.ForeignKey(ContentType, on_delete=models.PROTECT, null=True, blank=True)
    object_id = models.PositiveIntegerField(null=True, blank=True)
    document = GenericForeignKey('content_type', 'object_id')
    
    electronic_invoice = models.ForeignKey(ElectronicInvoice, on_delete=models.PROTECT, null=True, blank=True, related_name='vat_transactions')
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = _('VAT Transaction')
        verbose_name_plural = _('VAT Transactions')
        ordering = ['-date']
        indexes = [
            models.Index(fields=['tenant', 'period', 'vat_type']),
            models.Index(fields=['electronic_invoice']),
        ]
    
    def __str__(self):
        return f"{self.get_vat_type_display()} - {self.vat_amount} ({self.date.date()})"
    
    @classmethod
    def calculate_vat_payable(cls, tenant, period):
        """НДС к уплате = OUTPUT - INPUT"""
        from django.db.models import Sum
        
        output_vat = cls.objects.filter(tenant=tenant, period=period, vat_type='OUTPUT').aggregate(Sum('vat_amount'))['vat_amount__sum'] or 0
        input_vat = cls.objects.filter(tenant=tenant, period=period, vat_type='INPUT').aggregate(Sum('vat_amount'))['vat_amount__sum'] or 0
        
        return output_vat - input_vat


class ESoliqIntegrationLog(models.Model):
    """Журнал интеграции с E-Soliq"""
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    invoice = models.ForeignKey(ElectronicInvoice, on_delete=models.SET_NULL, null=True, blank=True, related_name='integration_logs')
    
    ACTION_TYPES = [
        ('SEND_INVOICE', _('Отправка СФ')),
        ('CHECK_STATUS', _('Проверка статуса')),
        ('CANCEL_INVOICE', _('Отмена СФ')),
        ('GET_INVOICES', _('Получение списка СФ')),
        ('SUBMIT_DECLARATION', _('Подача декларации')),
    ]
    action = models.CharField(_('Action'), max_length=30, choices=ACTION_TYPES)
    
    request_data = models.JSONField(default=dict)
    response_data = models.JSONField(default=dict)
    
    STATUS_CHOICES = [
        ('SUCCESS', _('Успешно')),
        ('ERROR', _('Ошибка')),
        ('PENDING', _('В процессе')),
    ]
    status = models.CharField(_('Status'), max_length=20, choices=STATUS_CHOICES)
    error_message = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = _('E-Soliq Integration Log')
        verbose_name_plural = _('E-Soliq Integration Logs')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['tenant', 'action', 'status']),
            models.Index(fields=['invoice']),
        ]
    
    def __str__(self):
        return f"{self.get_action_display()} - {self.get_status_display()}"


class VATDeclaration(models.Model):
    """
    Декларация по НДС (УЗБЕКИСТАН - месячная, упрощённая)
    
    НДС к уплате = OUTPUT - INPUT
    """
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='vat_declarations')
    period = models.DateField(_('Period (YYYY-MM-01)'))
    
    total_output_vat = models.DecimalField(_('Total Output VAT'), max_digits=15, decimal_places=2, default=0)
    total_input_vat = models.DecimalField(_('Total Input VAT'), max_digits=15, decimal_places=2, default=0)
    vat_payable = models.DecimalField(_('VAT Payable'), max_digits=15, decimal_places=2, default=0)
    
    STATUS_CHOICES = [
        ('DRAFT', _('Черновик')),
        ('CALCULATED', _('Рассчитана')),
        ('SUBMITTED', _('Подана')),
        ('ACCEPTED', _('Принята')),
    ]
    status = models.CharField(_('Status'), max_length=20, choices=STATUS_CHOICES, default='DRAFT')
    
    submitted_date = models.DateField(null=True, blank=True)
    submitted_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True)
    
    esoliq_submission_id = models.CharField(max_length=100, null=True, blank=True)
    esoliq_status = models.CharField(max_length=50, null=True, blank=True)
    esoliq_submitted_at = models.DateTimeField(null=True, blank=True)
    esoliq_rejection_reason = models.TextField(blank=True)
    
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = _('VAT Declaration (Monthly)')
        verbose_name_plural = _('VAT Declarations (Monthly)')
        unique_together = ('tenant', 'period')
        ordering = ['-period']
        indexes = [
            models.Index(fields=['tenant', 'status']),
        ]
    
    def __str__(self):
        return f"VAT Declaration {self.period.strftime('%Y-%m')} - {self.tenant}"
    
    def calculate(self):
        """Расчёт НДС (простая формула!)"""
        from django.db.models import Sum
        
        self.total_output_vat = VATTransaction.objects.filter(
            tenant=self.tenant, period=self.period, vat_type='OUTPUT'
        ).aggregate(Sum('vat_amount'))['vat_amount__sum'] or 0
        
        self.total_input_vat = VATTransaction.objects.filter(
            tenant=self.tenant, period=self.period, vat_type='INPUT'
        ).aggregate(Sum('vat_amount'))['vat_amount__sum'] or 0
        
        self.vat_payable = self.total_output_vat - self.total_input_vat
        self.status = 'CALCULATED'
        self.save()
    
    def submit_to_esoliq(self, user):
        """Подача в E-Soliq"""
        from django.utils import timezone
        
        if self.status == 'DRAFT':
            self.calculate()
        
        self.status = 'SUBMITTED'
        self.submitted_date = timezone.now().date()
        self.submitted_by = user
        self.esoliq_submitted_at = timezone.now()
        self.save()
        
        ESoliqIntegrationLog.objects.create(
            tenant=self.tenant,
            action='SUBMIT_DECLARATION',
            request_data={'period': str(self.period), 'vat_payable': str(self.vat_payable)},
            response_data={},
            status='PENDING'
        )
    
    @classmethod
    def create_for_period(cls, tenant, period):
        """Create or get declaration for period"""
        declaration, created = cls.objects.get_or_create(
            tenant=tenant, period=period, defaults={'status': 'DRAFT'}
        )
        if created or declaration.status == 'DRAFT':
            declaration.calculate()
        return declaration
