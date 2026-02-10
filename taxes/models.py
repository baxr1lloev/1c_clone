from django.db import models
from django.utils.translation import gettext_lazy as _
from tenants.models import Tenant

class TaxScheme(models.Model):
    """
    Tax Scheme Configuration (e.g., UZ_VAT_2024).
    Not tenant-specific, can be global or tenant custom.
    """
    country = models.CharField(_('Country Code'), max_length=2)  # UZ, RU, KZ
    name = models.CharField(_('Scheme Name'), max_length=100)
    description = models.TextField(_('Description'), blank=True)
    version = models.CharField(_('Version'), max_length=20)
    is_active = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = _('Tax Scheme')
        verbose_name_plural = _('Tax Schemes')
        unique_together = ('country', 'name', 'version')

    def __str__(self):
        return f"{self.country} - {self.name} ({self.version})"

class TaxForm(models.Model):
    """
    Definition of a Tax Report Form (e.g., VAT Calculation).
    """
    PERIOD_TYPES = [
        ('MONTH', _('Monthly')),
        ('QUARTER', _('Quarterly')),
        ('YEAR', _('Yearly')),
    ]
    
    scheme = models.ForeignKey(TaxScheme, on_delete=models.CASCADE, related_name='forms')
    code = models.CharField(_('Form Code'), max_length=50)  # e.g. VAT_UZ_2024
    name = models.CharField(_('Name'), max_length=255)
    period_type = models.CharField(_('Period Type'), max_length=20, choices=PERIOD_TYPES)
    
    def __str__(self):
        return f"{self.code} ({self.scheme})"

class TaxField(models.Model):
    """
    A specific field in a Tax Form (e.g., Line 010, Line 020).
    """
    SOURCE_TYPES = [
        ('LEDGER', _('Ledger Query')),
        ('FORMULA', _('Formula')),
        ('MANUAL', _('Manual Input')),
    ]
    
    form = models.ForeignKey(TaxForm, on_delete=models.CASCADE, related_name='fields')
    code = models.CharField(_('Line Code'), max_length=20)  # 010, 020
    label = models.CharField(_('Label'), max_length=255)
    source_type = models.CharField(_('Source Type'), max_length=20, choices=SOURCE_TYPES)
    
    # Logic configuration
    formula = models.TextField(_('Formula/Query'), blank=True, 
                              help_text="For FORMULA: expression (010+020). For LEDGER: JSON query config.")
    is_required = models.BooleanField(default=False)
    order = models.IntegerField(default=0)
    
    class Meta:
        ordering = ['order', 'code']
        unique_together = ('form', 'code')

    def __str__(self):
        return f"{self.code} - {self.label}"

class TaxReport(models.Model):
    """
    Instance of a Tax Report for a specific Tenant and Period.
    
    IMPORTANT: Tax reports are HISTORICAL SNAPSHOTS.
    - Data is captured at generation time
    - Once submitted, reports are READ-ONLY
    - Changes require creating a NEW version
    """
    STATUS_DRAFT = 'draft'
    STATUS_SUBMITTED = 'submitted'
    STATUS_SUPERSEDED = 'superseded'  # Replaced by newer version
    
    STATUS_CHOICES = [
        (STATUS_DRAFT, _('Draft')),
        (STATUS_SUBMITTED, _('Submitted/Finalized')),
        (STATUS_SUPERSEDED, _('Superseded')),
    ]
    
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='tax_reports')
    form = models.ForeignKey(TaxForm, on_delete=models.PROTECT)
    period_start = models.DateField(_('Period Start'))
    period_end = models.DateField(_('Period End'))
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_DRAFT)
    
    # Snapshot metadata
    snapshot_date = models.DateTimeField(_('Snapshot Date'), auto_now_add=True,
                                        help_text="When this report was generated")
    ledger_frozen_at = models.DateTimeField(_('Ledger Frozen At'), null=True, blank=True,
                                           help_text="Timestamp when ledger data was captured")
    
    # Versioning
    version = models.IntegerField(default=1, help_text="Report version number")
    superseded_by = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True,
                                     related_name='supersedes',
                                     help_text="The newer version that replaced this report")
    
    # Audit
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    submitted_by = models.CharField(max_length=255, blank=True)
    
    class Meta:
        verbose_name = _('Tax Report')
        verbose_name_plural = _('Tax Reports')
        ordering = ['-period_start', '-version']

    def __str__(self):
        return f"{self.form.code} for {self.tenant} ({self.period_start}) v{self.version}"
    
    def is_editable(self):
        """Check if report can be edited."""
        return self.status == self.STATUS_DRAFT
    
    def submit(self, user=None):
        """Submit/finalize the report. Makes it read-only."""
        if not self.is_editable():
            raise ValueError("Cannot submit a report that is not in draft status")
        
        from django.utils import timezone
        self.status = self.STATUS_SUBMITTED
        self.submitted_at = timezone.now()
        if user:
            self.submitted_by = str(user)
        self.save()


class TaxReportLine(models.Model):
    """
    Data value for a specific field in a report.
    """
    report = models.ForeignKey(TaxReport, on_delete=models.CASCADE, related_name='lines')
    field = models.ForeignKey(TaxField, on_delete=models.PROTECT)
    
    value_numeric = models.DecimalField(_('Value'), max_digits=19, decimal_places=2, default=0)
    value_text = models.TextField(_('Text Value'), blank=True)
    
    is_manual_override = models.BooleanField(default=False)
    
    class Meta:
        unique_together = ('report', 'field')
