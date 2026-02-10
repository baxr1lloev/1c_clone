"""
API Serializers for VAT system.
Handles JSON serialization and validation.
"""
from rest_framework import serializers
from accounting.vat import (
    ElectronicInvoice, VATTransaction, VATDeclaration, VATRate
)
from accounting.models import (
    ChartOfAccounts, AccountingEntry, TrialBalance, PeriodClosing, Operation
)
from directories.models import Counterparty


class VATRateSerializer(serializers.ModelSerializer):
    """Serializer for VAT rates"""
    class Meta:
        model = VATRate
        fields = ['id', 'code', 'rate', 'is_default', 'is_active']


class CounterpartySerializer(serializers.ModelSerializer):
    """Lightweight serializer for counterparties"""
    class Meta:
        model = Counterparty
        fields = ['id', 'name', 'inn', 'type']


class ElectronicInvoiceListSerializer(serializers.ModelSerializer):
    """Serializer for invoice list (optimized)"""
    counterparty_name = serializers.CharField(source='counterparty.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    type_display = serializers.CharField(source='get_invoice_type_display', read_only=True)
    
    class Meta:
        model = ElectronicInvoice
        fields = [
            'id', 'number', 'date', 'invoice_type', 'type_display',
            'counterparty_name', 'base_amount', 'vat_amount', 'total_amount',
            'status', 'status_display', 'esoliq_uuid'
        ]


class ElectronicInvoiceDetailSerializer(serializers.ModelSerializer):
    """Serializer for invoice detail (full info)"""
    counterparty = CounterpartySerializer(read_only=True)
    vat_rate = VATRateSerializer(read_only=True)
    vat_transaction_id = serializers.IntegerField(source='vat_transaction.id', read_only=True, allow_null=True)
    
    class Meta:
        model = ElectronicInvoice
        fields = [
            'id', 'invoice_type', 'number', 'date',
            'counterparty', 'counterparty_tin',
            'base_amount', 'vat_rate', 'vat_amount', 'total_amount',
            'status', 'esoliq_uuid', 'esoliq_sent_at', 'esoliq_accepted_at',
            'esoliq_rejection_reason', 'vat_transaction_id',
            'created_at', 'updated_at'
        ]


class ElectronicInvoiceCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating invoices"""
    class Meta:
        model = ElectronicInvoice
        fields = [
            'invoice_type', 'number', 'date',
            'counterparty', 'counterparty_tin',
            'base_amount', 'vat_rate', 'vat_amount', 'total_amount'
        ]
    
    def validate(self, data):
        """Custom validation"""
        from accounting.models import PeriodClosing
        
        # Check period is open
        tenant = self.context['request'].user.tenant
        try:
            PeriodClosing.validate_period_is_open(
                data['date'], tenant, check_type='ACCOUNTING'
            )
        except Exception as e:
            raise serializers.ValidationError({
                'date': str(e),
                'code': 'PERIOD_CLOSED'
            })
        
        # Auto-calculate VAT if not provided
        if not data.get('vat_amount'):
            data['vat_amount'] = data['base_amount'] * data['vat_rate'].rate / 100
        
        if not data.get('total_amount'):
            data['total_amount'] = data['base_amount'] + data['vat_amount']
        
        return data
    
    def create(self, validated_data):
        """Create invoice with tenant and user"""
        request = self.context['request']
        validated_data['tenant'] = request.user.tenant
        validated_data['created_by'] = request.user
        return super().create(validated_data)


class VATDeclarationSerializer(serializers.ModelSerializer):
    """Serializer for VAT declarations"""
    submitted_by_name = serializers.CharField(source='submitted_by.get_full_name', read_only=True, allow_null=True)
    
    class Meta:
        model = VATDeclaration
        fields = [
            'id', 'period', 'total_output_vat', 'total_input_vat',
            'vat_payable', 'status', 'submitted_date', 'submitted_by_name',
            'esoliq_submission_id'
        ]
        read_only_fields = ['total_output_vat', 'total_input_vat', 'vat_payable']


class AccountSerializer(serializers.ModelSerializer):
    """Serializer for Chart of Accounts"""
    type_display = serializers.CharField(source='get_account_type_display', read_only=True)
    
    class Meta:
        model = ChartOfAccounts
        fields = [
            'id', 'code', 'name', 'account_type', 'type_display', 
            'parent', 'is_active', 'created_at', 'updated_at'
        ]


class AccountingEntrySerializer(serializers.ModelSerializer):
    """Serializer for Accounting Entries"""
    debit_account_code = serializers.CharField(source='debit_account.code', read_only=True)
    debit_account_name = serializers.CharField(source='debit_account.name', read_only=True)
    credit_account_code = serializers.CharField(source='credit_account.code', read_only=True)
    credit_account_name = serializers.CharField(source='credit_account.name', read_only=True)
    currency_code = serializers.CharField(source='currency.code', read_only=True)
    
    # Analytics Display
    counterparty_name = serializers.CharField(source='counterparty.name', read_only=True, allow_null=True)
    item_name = serializers.CharField(source='item.name', read_only=True, allow_null=True)
    project_name = serializers.CharField(source='project.name', read_only=True, allow_null=True)
    department_name = serializers.CharField(source='department.name', read_only=True, allow_null=True)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True, allow_null=True)
    employee_name = serializers.CharField(source='employee.get_full_name', read_only=True, allow_null=True)
    
    class Meta:
        model = AccountingEntry
        fields = [
            'id', 'date', 'period', 'debit_account', 'debit_account_code', 'debit_account_name',
            'credit_account', 'credit_account_code', 'credit_account_name',
            'amount', 'currency', 'currency_code', 'description', 
            
            # Analytics
            'counterparty', 'counterparty_name',
            'contract', 
            'item', 'item_name',
            'warehouse', 'warehouse_name',
            'project', 'project_name',
            'department', 'department_name',
            'employee', 'employee_name',
            'quantity',
            
            'created_at'
        ]


class TrialBalanceSerializer(serializers.ModelSerializer):
    """Serializer for Trial Balance"""
    account_code = serializers.CharField(source='account.code', read_only=True)
    account_name = serializers.CharField(source='account.name', read_only=True)
    
    class Meta:
        model = TrialBalance
        fields = [
            'id', 'period', 'account', 'account_code', 'account_name',
            'opening_debit', 'opening_credit',
            'turnover_debit', 'turnover_credit',
            'closing_debit', 'closing_credit'
        ]


class PeriodClosingSerializer(serializers.ModelSerializer):
    """Serializer for Period Closing"""
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    closed_by_name = serializers.CharField(source='closed_by.get_full_name', read_only=True)
    
    class Meta:
        model = PeriodClosing
        fields = [
            'id', 'period', 'status', 'status_display', 
            'operational_closed', 'accounting_closed',
            'profit_loss', 'closed_by_name', 'closed_at'
        ]


class OperationSerializer(serializers.ModelSerializer):
    """Serializer for Manual Operations"""
    entries = AccountingEntrySerializer(many=True, read_only=False)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    
    class Meta:
        model = Operation
        fields = ['id', 'number', 'date', 'comment', 'amount', 'created_by_name', 'created_at', 'entries']
        read_only_fields = ['amount', 'created_by']

    def create(self, validated_data):
        entries_data = validated_data.pop('entries', [])
        request = self.context['request']
        validated_data['tenant'] = request.user.tenant
        validated_data['created_by'] = request.user
        
        operation = Operation.objects.create(**validated_data)
        
        # Create entries
        total = 0
        from django.contrib.contenttypes.models import ContentType
        ct = ContentType.objects.get_for_model(Operation)
        
        for entry_data in entries_data:
            entry_data['tenant'] = request.user.tenant
            entry_data['content_type'] = ct
            entry_data['object_id'] = operation.id
            if 'period' not in entry_data:
                entry_data['period'] = operation.date.date().replace(day=1)
            
            # Ensure currency instance is used if serializer returns object, 
            # but ModelSerializer usually returns instance for ForeignKey if validated.
            # Actually validated_data for specific ForeignKey field will be model instance.
            
            AccountingEntry.objects.create(**entry_data)
            total += entry_data.get('amount', 0)
            
        operation.amount = total
        operation.save()
        
        return operation

    def update(self, instance, validated_data):
        entries_data = validated_data.pop('entries', None)
        
        # Update operation fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        if entries_data is not None:
             # Delete old entries linked to this operation
            from django.contrib.contenttypes.models import ContentType
            ct = ContentType.objects.get_for_model(Operation)
            # Use filter safely
            AccountingEntry.objects.filter(
                tenant=instance.tenant,
                content_type=ct, 
                object_id=instance.id
            ).delete()
            
            total = 0
            for entry_data in entries_data:
                entry_data['tenant'] = instance.tenant
                entry_data['content_type'] = ct
                entry_data['object_id'] = instance.id
                if 'period' not in entry_data:
                    entry_data['period'] = instance.date.date().replace(day=1)
                
                AccountingEntry.objects.create(**entry_data)
                total += entry_data.get('amount', 0)
                
            instance.amount = total
            instance.save()
        
        return instance
