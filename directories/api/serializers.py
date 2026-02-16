"""
API Serializers for directories app.
"""
from rest_framework import serializers
from directories.models import (
    Currency, ExchangeRate, Counterparty, ContactPerson,
    Contract, Warehouse, Item, ItemPackage, BankAccount, BankExchangeSettings, BankOperationType, Employee, ItemCategory,
    Department, Project,
)


class CurrencySerializer(serializers.ModelSerializer):
    """Serializer for Currency model."""
    markup_base_currency_code = serializers.SerializerMethodField()
    
    class Meta:
        model = Currency
        fields = [
            'id', 'code', 'name', 'symbol', 
            'rate_source', 'markup_percent', 'markup_base_currency', 'markup_base_currency_code'
        ]

    def get_markup_base_currency_code(self, obj):
        return obj.markup_base_currency.code if obj.markup_base_currency else None


class CurrencyClassifierSerializer(serializers.Serializer):
    """Serializer for Currency Classifier items (non-database)."""
    code = serializers.CharField()
    name = serializers.CharField()
    symbol = serializers.CharField()


class ExchangeRateSerializer(serializers.ModelSerializer):
    """Serializer for ExchangeRate model."""
    currency_code = serializers.CharField(source='currency.code', read_only=True)
    
    class Meta:
        model = ExchangeRate
        fields = ['id', 'currency', 'currency_code', 'date', 'rate', 'created_at']
        read_only_fields = ['created_at']


class ContactPersonSerializer(serializers.ModelSerializer):
    """Serializer for ContactPerson model (nested in Counterparty)."""
    class Meta:
        model = ContactPerson
        fields = ['id', 'name', 'position', 'phone', 'email', 'comment']


class CounterpartyListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for counterparty list."""
    type_display = serializers.CharField(source='get_type_display', read_only=True)
    
    class Meta:
        model = Counterparty
        fields = ['id', 'name', 'inn', 'type', 'type_display', 'phone', 'email', 'created_at']


class CounterpartyDetailSerializer(serializers.ModelSerializer):
    """Full serializer for counterparty detail."""
    type_display = serializers.CharField(source='get_type_display', read_only=True)
    contacts = ContactPersonSerializer(many=True, read_only=True)
    
    class Meta:
        model = Counterparty
        fields = [
            'id', 'name', 'inn', 'type', 'type_display',
            'phone', 'email', 'address', 'contacts', 'created_at'
        ]


class CounterpartyCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating counterparties."""
    class Meta:
        model = Counterparty
        fields = ['name', 'inn', 'type', 'phone', 'email', 'address']
    
    def create(self, validated_data):
        tenant = self.context['request'].user.tenant
        if not tenant:
            raise serializers.ValidationError({"tenant": "User does not belong to any tenant."})
        validated_data['tenant'] = tenant
        return super().create(validated_data)


class ContractSerializer(serializers.ModelSerializer):
    """Serializer for Contract model."""
    counterparty_name = serializers.CharField(source='counterparty.name', read_only=True)
    currency_code = serializers.CharField(source='currency.code', read_only=True)
    contract_type_display = serializers.CharField(source='get_contract_type_display', read_only=True)
    
    class Meta:
        model = Contract
        fields = [
            'id', 'counterparty', 'counterparty_name', 'number', 'date',
            'currency', 'currency_code', 'contract_type', 'contract_type_display', 'is_active'
        ]


class ContractCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating contracts."""
    class Meta:
        model = Contract
        fields = ['counterparty', 'number', 'date', 'currency', 'contract_type', 'is_active']
    
    def create(self, validated_data):
        tenant = self.context['request'].user.tenant
        if not tenant:
            raise serializers.ValidationError({"tenant": "User does not belong to any tenant."})
        validated_data['tenant'] = tenant
        return super().create(validated_data)


class WarehouseSerializer(serializers.ModelSerializer):
    """Serializer for Warehouse model."""
    warehouse_type_display = serializers.CharField(source='get_warehouse_type_display', read_only=True)
    
    class Meta:
        model = Warehouse
        fields = ['id', 'name', 'address', 'warehouse_type', 'warehouse_type_display', 'is_active']


class WarehouseCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating warehouses."""
    class Meta:
        model = Warehouse
        fields = ['name', 'address', 'warehouse_type', 'is_active']
    
    def create(self, validated_data):
        tenant = self.context['request'].user.tenant
        if not tenant:
            raise serializers.ValidationError({"tenant": "User does not belong to any tenant."})
        validated_data['tenant'] = tenant
        return super().create(validated_data)


class ItemPackageSerializer(serializers.ModelSerializer):
    """Serializer for ItemPackage."""
    class Meta:
        model = ItemPackage
        fields = ['id', 'name', 'coefficient', 'is_default']


class ItemSerializer(serializers.ModelSerializer):
    """Serializer for Item model."""
    item_type_display = serializers.CharField(source='get_item_type_display', read_only=True)
    packages = ItemPackageSerializer(many=True, read_only=True)
    
    class Meta:
        model = Item
        fields = [
            'id', 'name', 'sku', 'item_type', 'item_type_display',
            'unit', 'purchase_price', 'selling_price', 'packages'
        ]


class ItemCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating items."""
    category = serializers.PrimaryKeyRelatedField(
        queryset=ItemCategory.objects.none(),
        allow_null=True,
        required=False,
    )

    class Meta:
        model = Item
        fields = ['name', 'sku', 'item_type', 'unit', 'purchase_price', 'selling_price', 'category']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get('request')
        if request and getattr(request.user, 'tenant', None):
            self.fields['category'].queryset = ItemCategory.objects.filter(tenant=request.user.tenant)

    def create(self, validated_data):
        tenant = self.context['request'].user.tenant
        if not tenant:
            raise serializers.ValidationError({"tenant": "User does not belong to any tenant."})
        validated_data['tenant'] = tenant
        return super().create(validated_data)


class BankAccountSerializer(serializers.ModelSerializer):
    """Serializer for BankAccount model."""
    currency_code = serializers.CharField(source='currency.code', read_only=True)
    account_type_display = serializers.CharField(source='get_account_type_display', read_only=True)
    accounting_account_code = serializers.CharField(source='accounting_account.code', read_only=True)
    
    class Meta:
        model = BankAccount
        fields = [
            'id', 'name', 'bank_name', 'account_number',
            'account_type', 'account_type_display',
            'bik', 'correspondent_account', 'swift_code',
            'currency', 'currency_code',
            'accounting_account', 'accounting_account_code',
            'is_active', 'is_default', 'opening_date',
            'overdraft_allowed', 'overdraft_limit', 'minimum_balance',
            'comment',
        ]


class BankAccountCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating bank accounts."""
    class Meta:
        model = BankAccount
        fields = [
            'name', 'bank_name', 'account_number',
            'account_type',
            'bik', 'correspondent_account', 'swift_code',
            'currency', 'accounting_account',
            'is_active', 'is_default', 'opening_date',
            'overdraft_allowed', 'overdraft_limit', 'minimum_balance',
            'comment',
        ]
    
    def create(self, validated_data):
        tenant = self.context['request'].user.tenant
        if not tenant:
            raise serializers.ValidationError({"tenant": "User does not belong to any tenant."})
        validated_data['tenant'] = tenant
        return super().create(validated_data)

    def validate(self, attrs):
        account_type = attrs.get('account_type') or getattr(self.instance, 'account_type', 'settlement')
        swift = attrs.get('swift_code') or getattr(self.instance, 'swift_code', '')
        if account_type == 'foreign' and not swift:
            raise serializers.ValidationError({'swift_code': 'SWIFT is required for foreign currency accounts.'})
        return attrs


class BankExchangeSettingsSerializer(serializers.ModelSerializer):
    """Serializer for BankExchangeSettings."""
    bank_account_name = serializers.CharField(source='bank_account.name', read_only=True)
    bank_account_number = serializers.CharField(source='bank_account.account_number', read_only=True)

    class Meta:
        model = BankExchangeSettings
        fields = [
            'id',
            'bank_account', 'bank_account_name', 'bank_account_number',
            'exchange_format', 'bank_program_name', 'encoding',
            'auto_create_counterparties', 'new_counterparty_group_name',
            'auto_detect_bank_fees',
            'auto_post_incoming', 'auto_post_outgoing', 'show_form_before_import',
            'export_payment_orders', 'export_payment_claims',
            'validate_document_number', 'validate_exchange_security',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get('request')
        if request and getattr(request.user, 'tenant', None):
            self.fields['bank_account'].queryset = BankAccount.objects.filter(tenant=request.user.tenant)

    def create(self, validated_data):
        tenant = self.context['request'].user.tenant
        if not tenant:
            raise serializers.ValidationError({"tenant": "User does not belong to any tenant."})
        validated_data['tenant'] = tenant
        return super().create(validated_data)


class BankOperationTypeSerializer(serializers.ModelSerializer):
    """Serializer for bank operation type semantics."""
    debit_account_code = serializers.CharField(source='debit_account.code', read_only=True)
    credit_account_code = serializers.CharField(source='credit_account.code', read_only=True)

    class Meta:
        model = BankOperationType
        fields = [
            'id', 'code', 'name',
            'debit_account', 'debit_account_code',
            'credit_account', 'credit_account_code',
            'requires_counterparty', 'requires_contract', 'requires_tax',
            'auto_create_payment', 'is_active'
        ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get('request')
        if request and getattr(request.user, 'tenant', None):
            tenant = request.user.tenant
            self.fields['debit_account'].queryset = self.fields['debit_account'].queryset.filter(tenant=tenant)
            self.fields['credit_account'].queryset = self.fields['credit_account'].queryset.filter(tenant=tenant)

    def create(self, validated_data):
        tenant = self.context['request'].user.tenant
        if not tenant:
            raise serializers.ValidationError({"tenant": "User does not belong to any tenant."})
        validated_data['tenant'] = tenant
        return super().create(validated_data)


class EmployeeSerializer(serializers.ModelSerializer):
    """Serializer for Employee model."""
    class Meta:
        model = Employee
        fields = [
            'id', 'first_name', 'last_name', 'middle_name', 
            'inn', 'position', 'hiring_date', 'base_salary', 
            'phone', 'email', 'address', 'is_active', 'created_at'
        ]


class ItemCategorySerializer(serializers.ModelSerializer):
    """Serializer for ItemCategory (create/update/list with parent support)."""
    parent = serializers.PrimaryKeyRelatedField(
        queryset=ItemCategory.objects.none(),
        allow_null=True,
        required=False,
    )

    class Meta:
        model = ItemCategory
        fields = ['id', 'name', 'code', 'parent']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get('request')
        if request and getattr(request.user, 'tenant', None):
            tenant = request.user.tenant
            self.fields['parent'].queryset = ItemCategory.objects.filter(tenant=tenant)


class DepartmentSerializer(serializers.ModelSerializer):
    """Serializer for Department (cost centers)."""
    class Meta:
        model = Department
        fields = ['id', 'name', 'code', 'parent', 'is_active', 'created_at']


class ProjectSerializer(serializers.ModelSerializer):
    """Serializer for Project (P&L centers)."""
    class Meta:
        model = Project
        fields = ['id', 'name', 'code', 'start_date', 'end_date', 'is_active', 'status', 'created_at']
