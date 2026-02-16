"""
API Serializers for documents app.
"""
from rest_framework import serializers
from documents.models import (
    SalesDocument, SalesDocumentLine,
    PurchaseDocument, PurchaseDocumentLine,
    PaymentDocument,
    TransferDocument, TransferDocumentLine,
    SalesOrder, SalesOrderLine,
    InventoryDocument, InventoryDocumentLine,
    BankStatement, BankStatementLine,
    CashOrder,
    PayrollDocument, PayrollDocumentLine,
    ProductionDocument, ProductionProductLine, ProductionMaterialLine,
)
from directories.api.serializers import (
    CounterpartyListSerializer, ContractSerializer, 
    WarehouseSerializer, ItemSerializer, CurrencySerializer
)


# ─────────────────────────────────────────────────────────────────────
# Sales Document
# ─────────────────────────────────────────────────────────────────────

class SalesDocumentLineSerializer(serializers.ModelSerializer):
    """Serializer for SalesDocumentLine."""
    item_name = serializers.CharField(source='item.name', read_only=True)
    item_sku = serializers.CharField(source='item.sku', read_only=True)
    package_name = serializers.CharField(source='package.name', read_only=True, allow_null=True)
    
    class Meta:
        model = SalesDocumentLine
        fields = [
            'id', 'item', 'item_name', 'item_sku',
            'quantity', 'package', 'package_name', 'coefficient',
            'price', 'discount', 'amount', 
            'vat_rate', 'vat_amount', 'total_with_vat',
            'price_base', 'amount_base'
        ]
        read_only_fields = ['amount', 'vat_amount', 'total_with_vat', 'price_base', 'amount_base']


class SalesDocumentListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for sales document list."""
    counterparty_name = serializers.CharField(source='counterparty.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    currency_code = serializers.CharField(source='currency.code', read_only=True)
    
    class Meta:
        model = SalesDocument
        fields = [
            'id', 'number', 'date', 'status', 'status_display',
            'counterparty_name', 'currency_code', 'total_amount', 'total_amount_base'
        ]


class SalesDocumentDetailSerializer(serializers.ModelSerializer):
    """Full serializer for sales document detail."""
    counterparty = CounterpartyListSerializer(read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)
    currency_code = serializers.CharField(source='currency.code', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    lines = SalesDocumentLineSerializer(many=True, read_only=True)
    
    total_amount_base = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    
    # Document Chain (1C-style)
    base_document_display = serializers.CharField(source='get_base_document_display', read_only=True, allow_null=True)
    base_document_url = serializers.CharField(source='get_base_document_url', read_only=True, allow_null=True)
    
    # Permissions (Backend as Brain)
    can_edit = serializers.BooleanField(read_only=True)
    can_post = serializers.BooleanField(read_only=True)
    can_unpost = serializers.BooleanField(read_only=True)
    period_is_closed = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = SalesDocument
        fields = [
            'id', 'number', 'date', 'status', 'status_display', 'comment',
            'counterparty', 'contract', 'warehouse', 'warehouse_name',
            'currency', 'currency_code',
            'project', 'department', 'manager',
            'subtotal', 'tax_amount', 'total_amount', 'total_amount_base',
            'lines', 'created_at', 'updated_at', 'posted_at',
            # Document Chain
            'base_document_display', 'base_document_url',
            # State Flags
            'can_edit', 'can_post', 'can_unpost', 'period_is_closed'
        ]


class SalesDocumentCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating sales documents."""
    lines = SalesDocumentLineSerializer(many=True, required=False)
    
    class Meta:
        model = SalesDocument
        fields = [
            'number', 'date', 'comment',
            'counterparty', 'contract', 'warehouse', 'currency',
            'project', 'department', 'manager',
            'lines'
        ]
    
    def create(self, validated_data):
        lines_data = validated_data.pop('lines', [])
        validated_data['tenant'] = self.context['request'].user.tenant
        validated_data['created_by'] = self.context['request'].user
        
        doc = super().create(validated_data)
        
        for line_data in lines_data:
            SalesDocumentLine.objects.create(document=doc, **line_data)
            
        doc.recalculate_totals()
        return doc

    def update(self, instance, validated_data):
        lines_data = validated_data.pop('lines', [])
        
        # Update main fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Update lines: Simplest approach - delete all and recreate (for now)
        # Or smart update if IDs are provided.
        # Given 1C style "Snapshot", recreating is often safer to ensure consistency unless IDs are strictly managed.
        # But let's try to preserve IDs if possible, or just nuke/recreate for simplicity/robustness first.
        
        # For this stage, let's go with "Delete all and Recreate" to avoid sync issues.
        instance.lines.all().delete()
        for line_data in lines_data:
            # Remove id if present to force create
            if 'id' in line_data:
                del line_data['id']
            SalesDocumentLine.objects.create(document=instance, **line_data)
            
        instance.recalculate_totals()
        return instance


# ─────────────────────────────────────────────────────────────────────
# Purchase Document
# ─────────────────────────────────────────────────────────────────────

class PurchaseDocumentLineSerializer(serializers.ModelSerializer):
    """Serializer for PurchaseDocumentLine."""
    item_name = serializers.CharField(source='item.name', read_only=True)
    item_sku = serializers.CharField(source='item.sku', read_only=True)
    
    class Meta:
        model = PurchaseDocumentLine
        fields = [
            'id', 'item', 'item_name', 'item_sku',
            'package', 'coefficient', 
            'quantity', 'price', 'amount', 
            'vat_rate', 'vat_amount', 'total_with_vat',
            'price_base', 'amount_base'
        ]
        read_only_fields = ['amount', 'vat_amount', 'total_with_vat', 'price_base', 'amount_base']


class PurchaseDocumentListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for purchase document list."""
    counterparty_name = serializers.CharField(source='counterparty.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    currency_code = serializers.CharField(source='currency.code', read_only=True)
    
    class Meta:
        model = PurchaseDocument
        fields = [
            'id', 'number', 'date', 'status', 'status_display',
            'counterparty_name', 'currency_code', 'total_amount', 'total_amount_base'
        ]


class PurchaseDocumentDetailSerializer(serializers.ModelSerializer):
    """Full serializer for purchase document detail."""
    counterparty = CounterpartyListSerializer(read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)
    currency_code = serializers.CharField(source='currency.code', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    lines = PurchaseDocumentLineSerializer(many=True, read_only=True)
    
    # Document Chain (1C-style)
    base_document_display = serializers.CharField(source='get_base_document_display', read_only=True, allow_null=True)
    base_document_url = serializers.CharField(source='get_base_document_url', read_only=True, allow_null=True)
    
    class Meta:
        model = PurchaseDocument
        fields = [
            'id', 'number', 'date', 'status', 'status_display', 'comment',
            'counterparty', 'contract', 'warehouse', 'warehouse_name',
            'currency', 'currency_code', 'rate',
            'project', 'department',
            'subtotal', 'tax_amount', 'total_amount', 'total_amount_base',
            'lines', 'created_at', 'updated_at', 'posted_at',
            # Document Chain
            'base_document_display', 'base_document_url',
        ]


class PurchaseDocumentCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating purchase documents."""
    lines = PurchaseDocumentLineSerializer(many=True, required=False)
    
    class Meta:
        model = PurchaseDocument
        fields = [
            'number', 'date', 'comment',
            'counterparty', 'contract', 'warehouse', 'currency', 'rate',
            'project', 'department',
            'lines'
        ]
    
    def create(self, validated_data):
        lines_data = validated_data.pop('lines', [])
        validated_data['tenant'] = self.context['request'].user.tenant
        validated_data['created_by'] = self.context['request'].user
        
        doc = super().create(validated_data)
        
        for line_data in lines_data:
            PurchaseDocumentLine.objects.create(document=doc, **line_data)
            
        # doc.recalculate_totals() # Assuming PurchaseDocument also has this
        return doc

    def update(self, instance, validated_data):
        lines_data = validated_data.pop('lines', [])
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Replace lines
        instance.lines.all().delete()
        for line_data in lines_data:
            if 'id' in line_data: del line_data['id']
            PurchaseDocumentLine.objects.create(document=instance, **line_data)
            
        # instance.recalculate_totals()
        return instance


# ─────────────────────────────────────────────────────────────────────
# Inventory Document
# ─────────────────────────────────────────────────────────────────────

class InventoryDocumentLineSerializer(serializers.ModelSerializer):
    """Serializer for InventoryDocumentLine."""
    item_name = serializers.CharField(source='item.name', read_only=True)

    class Meta:
        model = InventoryDocumentLine
        fields = [
            'id', 'item', 'item_name',
            'quantity_book', 'quantity_actual', 'price', 'amount'
        ]
        read_only_fields = ['amount']


class InventoryDocumentListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for inventory document list."""
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = InventoryDocument
        fields = [
            'id', 'number', 'date', 'status', 'status_display',
            'warehouse_name', 'total_amount'
        ]


class InventoryDocumentDetailSerializer(serializers.ModelSerializer):
    """Full serializer for inventory document detail."""
    warehouse = WarehouseSerializer(read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    lines = InventoryDocumentLineSerializer(many=True, read_only=True)

    class Meta:
        model = InventoryDocument
        fields = [
            'id', 'number', 'date', 'status', 'status_display', 'comment',
            'warehouse', 'responsible',
            'total_amount', 'lines',
            'created_at', 'updated_at'
        ]


class InventoryDocumentCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating inventory documents."""
    lines = serializers.ListField(
        child=serializers.DictField(),
        write_only=True,
        required=False # Make lines optional for update if not provided
    )
    
    class Meta:
        model = InventoryDocument
        fields = ['date', 'number', 'warehouse', 'responsible', 'comment', 'lines']
        
    def create(self, validated_data):
        lines_data = validated_data.pop('lines', []) # Handle case where lines are not provided
        validated_data['tenant'] = self.context['request'].user.tenant
        validated_data['created_by'] = self.context['request'].user
        
        doc = super().create(validated_data)
        
        for line in lines_data:
            InventoryDocumentLine.objects.create(
                document=doc,
                item_id=line['item'],
                quantity_book=line['quantity_book'],
                quantity_actual=line['quantity_actual'],
                price=line.get('price', 0)
            )
        doc.recalculate_totals()
        return doc
        
    def update(self, instance, validated_data):
        lines_data = validated_data.pop('lines', None)
        
        # Update header
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        if lines_data is not None:
            # Replace lines
            instance.lines.all().delete()
            for line in lines_data:
                InventoryDocumentLine.objects.create(
                    document=instance,
                    item_id=line['item'],
                    quantity_book=line['quantity_book'],
                    quantity_actual=line['quantity_actual'],
                    price=line.get('price', 0)
                )
        instance.recalculate_totals()
        return instance


# ─────────────────────────────────────────────────────────────────────
# Payment Document
# ─────────────────────────────────────────────────────────────────────

class PaymentDocumentSerializer(serializers.ModelSerializer):
    """Serializer for PaymentDocument."""
    counterparty_name = serializers.CharField(source='counterparty.name', read_only=True)
    bank_account_name = serializers.CharField(source='bank_account.bank_name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    payment_type_display = serializers.CharField(source='get_payment_type_display', read_only=True)
    currency_code = serializers.CharField(source='currency.code', read_only=True)
    cash_flow_item_name = serializers.CharField(source='cash_flow_item.name', read_only=True)
    debit_account_code = serializers.CharField(source='debit_account.code', read_only=True)
    credit_account_code = serializers.CharField(source='credit_account.code', read_only=True)
    bank_operation_type_code = serializers.CharField(source='bank_operation_type.code', read_only=True)
    bank_operation_type_name = serializers.CharField(source='bank_operation_type.name', read_only=True)
    
    # Document Chain (1C-style)
    base_document_display = serializers.CharField(source='get_base_document_display', read_only=True, allow_null=True)
    base_document_url = serializers.CharField(source='get_base_document_url', read_only=True, allow_null=True)
    
    # Permissions
    can_post = serializers.BooleanField(read_only=True)
    can_unpost = serializers.BooleanField(read_only=True)
    period_is_closed = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = PaymentDocument
        fields = [
            'id', 'number', 'date', 'status', 'status_display', 'comment',
            'counterparty', 'counterparty_name', 'contract',
            'bank_account', 'bank_account_name',
            'bank_operation_type', 'bank_operation_type_code', 'bank_operation_type_name',
            'debit_account', 'debit_account_code', 'credit_account', 'credit_account_code',
            'amount', 'currency', 'currency_code', 'rate',
            'vat_amount',
            'payment_type', 'payment_type_display',
            'purpose', 'basis', 'cash_flow_item', 'cash_flow_item_name',
            'payment_priority', 'payment_kind',
            'created_at', 'updated_at', 'posted_at',
            # Document Chain
            'base_document_display', 'base_document_url',
            'can_post', 'can_unpost', 'period_is_closed'
        ]


class PaymentDocumentCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating payment documents."""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get('request')
        if request and getattr(request.user, 'tenant', None):
            tenant = request.user.tenant
            self.fields['counterparty'].queryset = self.fields['counterparty'].queryset.filter(tenant=tenant)
            self.fields['contract'].queryset = self.fields['contract'].queryset.filter(tenant=tenant)
            self.fields['bank_account'].queryset = self.fields['bank_account'].queryset.filter(tenant=tenant)
            self.fields['bank_operation_type'].queryset = self.fields['bank_operation_type'].queryset.filter(tenant=tenant, is_active=True)
            self.fields['cash_flow_item'].queryset = self.fields['cash_flow_item'].queryset.filter(tenant=tenant)
            self.fields['debit_account'].queryset = self.fields['debit_account'].queryset.filter(tenant=tenant)
            self.fields['credit_account'].queryset = self.fields['credit_account'].queryset.filter(tenant=tenant)
            self.fields['currency'].queryset = self.fields['currency'].queryset

    class Meta:
        model = PaymentDocument
        fields = [
            'number', 'date', 'comment',
            'counterparty', 'contract', 'bank_account', 'bank_operation_type',
            'amount', 'currency', 'rate', 'vat_amount',
            'payment_type', 'purpose', 'basis', 'cash_flow_item',
            'debit_account', 'credit_account',
            'payment_priority', 'payment_kind',
        ]

    def validate(self, attrs):
        instance = getattr(self, 'instance', None)
        amount = attrs.get('amount', getattr(instance, 'amount', None))
        bank_account = attrs.get('bank_account', getattr(instance, 'bank_account', None))
        currency = attrs.get('currency', getattr(instance, 'currency', None))
        debit_account = attrs.get('debit_account', getattr(instance, 'debit_account', None))
        credit_account = attrs.get('credit_account', getattr(instance, 'credit_account', None))
        bank_operation_type = attrs.get('bank_operation_type', getattr(instance, 'bank_operation_type', None))
        counterparty = attrs.get('counterparty', getattr(instance, 'counterparty', None))
        contract = attrs.get('contract', getattr(instance, 'contract', None))
        cash_flow_item = attrs.get('cash_flow_item', getattr(instance, 'cash_flow_item', None))

        if amount is None or amount <= 0:
            raise serializers.ValidationError({'amount': 'Amount must be greater than zero.'})

        if bank_account and currency and bank_account.currency_id != currency.id:
            raise serializers.ValidationError({'currency': 'Currency must match selected bank account currency.'})

        if (debit_account and not credit_account) or (credit_account and not debit_account):
            raise serializers.ValidationError({'debit_account': 'Debit and credit accounts must both be set or both be empty.'})

        if debit_account and credit_account and debit_account.id == credit_account.id:
            raise serializers.ValidationError({'credit_account': 'Debit and credit accounts cannot be the same.'})

        if bank_operation_type:
            if not debit_account:
                attrs['debit_account'] = bank_operation_type.debit_account
                debit_account = attrs['debit_account']
            if not credit_account:
                attrs['credit_account'] = bank_operation_type.credit_account
                credit_account = attrs['credit_account']

            if debit_account.id != bank_operation_type.debit_account_id:
                raise serializers.ValidationError({'debit_account': 'Debit account does not match selected operation type template.'})
            if credit_account.id != bank_operation_type.credit_account_id:
                raise serializers.ValidationError({'credit_account': 'Credit account does not match selected operation type template.'})

            if bank_operation_type.requires_counterparty and not counterparty:
                raise serializers.ValidationError({'counterparty': 'Counterparty is required for selected operation type.'})
            if bank_operation_type.requires_contract and not contract:
                raise serializers.ValidationError({'contract': 'Contract is required for selected operation type.'})

            if bank_operation_type.code == 'BANK_FEE' and not cash_flow_item:
                raise serializers.ValidationError({'cash_flow_item': 'Cash flow item is required for BANK_FEE operation type.'})
            if bank_operation_type.code == 'CUSTOMER_PAYMENT' and not counterparty:
                raise serializers.ValidationError({'counterparty': 'Counterparty is required for CUSTOMER_PAYMENT operation type.'})

        # Extra safety for posted docs even if route protection is bypassed.
        if instance and instance.status == 'posted':
            if 'currency' in attrs and attrs['currency'].id != instance.currency_id:
                raise serializers.ValidationError({'currency': 'Cannot change currency for a posted document.'})
            if 'bank_account' in attrs and attrs['bank_account'] and attrs['bank_account'].id != instance.bank_account_id:
                raise serializers.ValidationError({'bank_account': 'Cannot change bank account for a posted document.'})

        return attrs
    
    def create(self, validated_data):
        validated_data['tenant'] = self.context['request'].user.tenant
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)


# ─────────────────────────────────────────────────────────────────────
# Transfer Document
# ─────────────────────────────────────────────────────────────────────

class TransferDocumentLineSerializer(serializers.ModelSerializer):
    """Serializer for TransferDocumentLine."""
    item_name = serializers.CharField(source='item.name', read_only=True)
    
    class Meta:
        model = TransferDocumentLine
        fields = ['id', 'item', 'item_name', 'quantity']


class TransferDocumentSerializer(serializers.ModelSerializer):
    """Serializer for TransferDocument."""
    from_warehouse_name = serializers.CharField(source='from_warehouse.name', read_only=True)
    to_warehouse_name = serializers.CharField(source='to_warehouse.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    lines = TransferDocumentLineSerializer(many=True, read_only=True)
    
    class Meta:
        model = TransferDocument
        fields = [
            'id', 'number', 'date', 'status', 'status_display', 'comment',
            'from_warehouse', 'from_warehouse_name',
            'to_warehouse', 'to_warehouse_name',
            'counterparty', 'lines',
            'created_at', 'updated_at'
        ]


# ─────────────────────────────────────────────────────────────────────
# Sales Order
# ─────────────────────────────────────────────────────────────────────

class SalesOrderLineSerializer(serializers.ModelSerializer):
    """Serializer for SalesOrderLine."""
    item_name = serializers.CharField(source='item.name', read_only=True)
    
    class Meta:
        model = SalesOrderLine
        fields = [
            'id', 'item', 'item_name',
            'quantity', 'price', 'amount'
        ]
        read_only_fields = ['amount']



class SalesOrderListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for sales order list."""
    counterparty_name = serializers.CharField(source='counterparty.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = SalesOrder
        fields = [
            'id', 'number', 'date', 'status', 'status_display',
            'counterparty_name', 'total_amount'
        ]


class SalesOrderDetailSerializer(serializers.ModelSerializer):
    """Full serializer for sales order detail."""
    counterparty = CounterpartyListSerializer(read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    lines = SalesOrderLineSerializer(many=True, read_only=True)
    
    # Document Chain (1C-style)
    base_document_display = serializers.CharField(source='get_base_document_display', read_only=True, allow_null=True)
    base_document_url = serializers.CharField(source='get_base_document_url', read_only=True, allow_null=True)
    
    class Meta:
        model = SalesOrder
        fields = [
            'id', 'number', 'date', 'status', 'status_display', 'comment',
            'counterparty', 'contract', 'warehouse', 'currency',
            'total_amount', 'lines',
            'created_at', 'updated_at',
            # Document Chain
            'base_document_display', 'base_document_url',
        ]


class SalesOrderCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating sales orders."""
    lines = SalesOrderLineSerializer(many=True, required=False)
    
    class Meta:
        model = SalesOrder
        fields = [
            'number', 'date', 'comment',
            'counterparty', 'contract', 'warehouse', 'currency', 'rate',
            'order_date', 'delivery_date',
            'lines'
        ]
        extra_kwargs = {
            'order_date': {'required': False},
        }
    
    def create(self, validated_data):
        lines_data = validated_data.pop('lines', [])
        validated_data['tenant'] = self.context['request'].user.tenant
        validated_data['created_by'] = self.context['request'].user
        
        if 'order_date' not in validated_data and 'date' in validated_data:
            validated_data['order_date'] = validated_data['date'].date()
            
        doc = super().create(validated_data)
        
        for line_data in lines_data:
            SalesOrderLine.objects.create(document=doc, **line_data)
            
        doc.recalculate_totals()
        return doc

    def update(self, instance, validated_data):
        lines_data = validated_data.pop('lines', [])
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        instance.lines.all().delete()
        for line_data in lines_data:
            if 'id' in line_data: del line_data['id']
            SalesOrderLine.objects.create(document=instance, **line_data)
            
        instance.recalculate_totals()
        return instance


# ─────────────────────────────────────────────────────────────────────
# Transfer Document
# ─────────────────────────────────────────────────────────────────────

class TransferDocumentLineSerializer(serializers.ModelSerializer):
    """Serializer for TransferDocumentLine."""
    item_name = serializers.CharField(source='item.name', read_only=True)
    
    class Meta:
        model = TransferDocumentLine
        fields = ['id', 'item', 'item_name', 'quantity']


class TransferDocumentListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for transfer document list."""
    from_warehouse_name = serializers.CharField(source='from_warehouse.name', read_only=True)
    to_warehouse_name = serializers.CharField(source='to_warehouse.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = TransferDocument
        fields = [
            'id', 'number', 'date', 'status', 'status_display',
            'from_warehouse_name', 'to_warehouse_name',
            'created_at', 'updated_at'
        ]


class TransferDocumentDetailSerializer(serializers.ModelSerializer):
    """Full serializer for transfer document detail."""
    from_warehouse_name = serializers.CharField(source='from_warehouse.name', read_only=True)
    to_warehouse_name = serializers.CharField(source='to_warehouse.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    lines = TransferDocumentLineSerializer(many=True, read_only=True)
    
    class Meta:
        model = TransferDocument
        fields = [
            'id', 'number', 'date', 'status', 'status_display', 'comment',
            'from_warehouse', 'from_warehouse_name',
            'to_warehouse', 'to_warehouse_name',
            'counterparty', 'lines',
            'created_at', 'updated_at'
        ]


class TransferDocumentCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating transfer documents."""
    lines = TransferDocumentLineSerializer(many=True, required=False)
    
    class Meta:
        model = TransferDocument
        fields = [
            'number', 'date', 'comment',
            'from_warehouse', 'to_warehouse', 'counterparty',
            'lines'
        ]
    
    def create(self, validated_data):
        lines_data = validated_data.pop('lines', [])
        validated_data['tenant'] = self.context['request'].user.tenant
        validated_data['created_by'] = self.context['request'].user
        
        doc = super().create(validated_data)
        
        for line_data in lines_data:
            TransferDocumentLine.objects.create(document=doc, **line_data)
        
        return doc
    
    def update(self, instance, validated_data):
        lines_data = validated_data.pop('lines', [])
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        instance.lines.all().delete()
        for line_data in lines_data:
            if 'id' in line_data: del line_data['id']
            TransferDocumentLine.objects.create(document=instance, **line_data)
        
        return instance


# ─────────────────────────────────────────────────────────────────────
# Inventory Document
# ─────────────────────────────────────────────────────────────────────

class InventoryDocumentLineSerializer(serializers.ModelSerializer):
    """Serializer for InventoryDocumentLine."""
    item_name = serializers.CharField(source='item.name', read_only=True)
    difference = serializers.DecimalField(max_digits=15, decimal_places=3, read_only=True)
    
    class Meta:
        model = InventoryDocumentLine
        fields = [
            'id', 'item', 'item_name',
            'quantity_book', 'quantity_actual', 'difference'
        ]


class InventoryDocumentLineSerializer(serializers.ModelSerializer):
    """Serializer for InventoryDocumentLine."""
    item_name = serializers.CharField(source='item.name', read_only=True)
    difference = serializers.DecimalField(max_digits=15, decimal_places=3, read_only=True)

    class Meta:
        model = InventoryDocumentLine
        fields = ['id', 'item', 'item_name', 'quantity_book', 'quantity_actual', 'difference', 'price', 'amount']


class InventoryDocumentSerializer(serializers.ModelSerializer):
    """Serializer for InventoryDocument."""
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    lines = InventoryDocumentLineSerializer(many=True, read_only=True)
    period_is_closed = serializers.BooleanField(read_only=True)

    class Meta:
        model = InventoryDocument
        fields = [
            'id', 'number', 'date', 'status', 'status_display', 'comment',
            'warehouse', 'warehouse_name', 'responsible', 'lines',
            'created_at', 'updated_at', 'period_is_closed'
        ]


class InventoryDocumentCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating inventory documents."""
    lines = InventoryDocumentLineSerializer(many=True, required=False)
    
    class Meta:
        model = InventoryDocument
        fields = [
            'number', 'date', 'comment',
            'warehouse', 'responsible',
            'lines'
        ]
    
    def create(self, validated_data):
        lines_data = validated_data.pop('lines', [])
        validated_data['tenant'] = self.context['request'].user.tenant
        validated_data['created_by'] = self.context['request'].user
        
        doc = super().create(validated_data)
        
        for line_data in lines_data:
            InventoryDocumentLine.objects.create(document=doc, **line_data)
        
        return doc
    
    def update(self, instance, validated_data):
        lines_data = validated_data.pop('lines', [])
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        instance.lines.all().delete()
        for line_data in lines_data:
            if 'id' in line_data: del line_data['id']
            InventoryDocumentLine.objects.create(document=instance, **line_data)
        
        return instance


# ─────────────────────────────────────────────────────────────────────
# Bank Statement
# ─────────────────────────────────────────────────────────────────────

class BankStatementLineSerializer(serializers.ModelSerializer):
    """Serializer for BankStatementLine."""
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    operation_type_display = serializers.CharField(source='get_operation_type_display', read_only=True)
    amount = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    transaction_type = serializers.CharField(read_only=True)
    created_payment_document_number = serializers.CharField(
        source='created_payment_document.number', 
        read_only=True, 
        allow_null=True
    )
    contract_number = serializers.CharField(source='contract.number', read_only=True)
    
    class Meta:
        model = BankStatementLine
        fields = [
            'id', 'transaction_date', 'bank_document_number', 'description', 'payment_purpose', 'counterparty_name',
            'debit_amount', 'credit_amount', 'balance', 'amount', 'transaction_type',
            'operation_type', 'operation_type_display',
            'status', 'status_display', 'counterparty', 'contract', 'contract_number', 'matched_document_type', 
            'matched_document_id', 'created_payment_document', 'created_payment_document_number',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['amount', 'transaction_type', 'balance']


class BankStatementListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for bank statement list."""
    bank_account_name = serializers.CharField(source='bank_account.bank_name', read_only=True)
    bank_account_number = serializers.CharField(source='bank_account.account_number', read_only=True)
    currency_code = serializers.CharField(source='currency.code', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    matching_percentage = serializers.SerializerMethodField()
    unmatched_count = serializers.SerializerMethodField()
    
    class Meta:
        model = BankStatement
        fields = [
            'id', 'number', 'date', 'statement_date', 'status', 'status_display',
            'source', 'is_balanced', 'accounting_balance_difference',
            'bank_account_name', 'bank_account_number',
            'currency', 'currency_code',
            'opening_balance', 'closing_balance', 'total_receipts', 'total_payments',
            'lines_count', 'matched_count', 'unmatched_count', 'matching_percentage',
            'created_at', 'updated_at'
        ]
    
    def get_matching_percentage(self, obj):
        """Calculate matching percentage."""
        if obj.lines_count == 0:
            return 0
        return round((obj.matched_count / obj.lines_count) * 100)

    def get_unmatched_count(self, obj):
        return max((obj.lines_count or 0) - (obj.matched_count or 0), 0)


class BankStatementDetailSerializer(serializers.ModelSerializer):
    """Full serializer for bank statement detail."""
    bank_account_name = serializers.CharField(source='bank_account.bank_name', read_only=True)
    bank_account_number = serializers.CharField(source='bank_account.account_number', read_only=True)
    currency_code = serializers.CharField(source='currency.code', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    lines = BankStatementLineSerializer(many=True, read_only=True)
    matching_percentage = serializers.SerializerMethodField()
    unmatched_count = serializers.SerializerMethodField()
    
    # Permissions
    can_post = serializers.BooleanField(read_only=True)
    can_unpost = serializers.BooleanField(read_only=True)
    period_is_closed = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = BankStatement
        fields = [
            'id', 'number', 'date', 'statement_date', 'status', 'status_display', 'comment',
            'source', 'is_balanced', 'accounting_balance_difference',
            'bank_account', 'bank_account_name', 'bank_account_number',
            'currency', 'currency_code',
            'opening_balance', 'closing_balance', 'total_receipts', 'total_payments',
            'lines_count', 'matched_count', 'unmatched_count', 'matching_percentage',
            'file', 'lines',
            'created_at', 'updated_at', 'posted_at',
            'can_post', 'can_unpost', 'period_is_closed'
        ]
    
    def get_matching_percentage(self, obj):
        """Calculate matching percentage."""
        if obj.lines_count == 0:
            return 0
        return round((obj.matched_count / obj.lines_count) * 100)

    def get_unmatched_count(self, obj):
        return max((obj.lines_count or 0) - (obj.matched_count or 0), 0)


class BankStatementCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating bank statements."""
    class Meta:
        model = BankStatement
        fields = [
            'number', 'date', 'statement_date', 'comment',
            'source', 'bank_account', 'currency', 'opening_balance', 'closing_balance', 'file'
        ]

    def validate(self, attrs):
        tenant = self.context['request'].user.tenant
        bank_account = attrs.get('bank_account') or getattr(self.instance, 'bank_account', None)
        statement_date = attrs.get('statement_date') or getattr(self.instance, 'statement_date', None)

        if not bank_account or not statement_date:
            return attrs

        latest = BankStatement.get_latest_statement(tenant, bank_account.id)
        if latest:
            current_id = getattr(self.instance, 'id', None)
            if latest.id != current_id and statement_date < latest.statement_date:
                raise serializers.ValidationError({
                    'statement_date': f"Cannot create statement older than latest existing statement date ({latest.statement_date})."
                })

        return attrs
    
    def create(self, validated_data):
        from django.utils import timezone
        validated_data['source'] = validated_data.get('source') or 'manual'
        validated_data['tenant'] = self.context['request'].user.tenant
        validated_data['created_by'] = self.context['request'].user
        if 'date' not in validated_data:
            validated_data['date'] = timezone.now()

        previous = BankStatement.get_previous_statement(
            validated_data['tenant'],
            validated_data['bank_account'].id,
            validated_data['statement_date']
        )
        if not validated_data.get('currency'):
            validated_data['currency'] = validated_data['bank_account'].currency
        if previous:
            validated_data['opening_balance'] = previous.closing_balance
        # Number will be auto-generated by BaseDocument.save()
        return super().create(validated_data)


# ─────────────────────────────────────────────────────────────────────
# Payroll Document
# ─────────────────────────────────────────────────────────────────────

class PayrollDocumentLineSerializer(serializers.ModelSerializer):
    """Serializer for PayrollDocumentLine."""
    employee_name = serializers.SerializerMethodField()
    
    class Meta:
        model = PayrollDocumentLine
        fields = ['id', 'employee', 'employee_name', 'accrual_type', 'amount']
        
    def get_employee_name(self, obj):
        return f"{obj.employee.last_name} {obj.employee.first_name}"


class PayrollDocumentSerializer(serializers.ModelSerializer):
    """Serializer for PayrollDocument."""
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    lines = PayrollDocumentLineSerializer(many=True, read_only=True)
    
    class Meta:
        model = PayrollDocument
        fields = [
            'id', 'number', 'date', 'status', 'status_display', 'comment',
            'period_start', 'period_end', 'amount',
            'lines', 'created_at', 'updated_at', 'posted_at'
        ]


class PayrollDocumentCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating payroll documents."""
    lines = PayrollDocumentLineSerializer(many=True, required=False)
    
    class Meta:
        model = PayrollDocument
        fields = [
            'number', 'date', 'comment',
            'period_start', 'period_end',
            'lines'
        ]
        
    def create(self, validated_data):
        lines_data = validated_data.pop('lines', [])
        validated_data['tenant'] = self.context['request'].user.tenant
        validated_data['created_by'] = self.context['request'].user
        
        doc = super().create(validated_data)
        
        total = 0
        for line_data in lines_data:
            line_data.pop('employee_name', None) # Read only
            line = PayrollDocumentLine.objects.create(document=doc, **line_data)
            total += line.amount
            
        doc.amount = total
        doc.save(update_fields=['amount'])
        return doc
        
    def update(self, instance, validated_data):
        lines_data = validated_data.pop('lines', [])
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Replace lines
        if lines_data is not None:
            instance.lines.all().delete()
            total = 0
            for line_data in lines_data:
                line_data.pop('employee_name', None)
                if 'id' in line_data: del line_data['id']
                line = PayrollDocumentLine.objects.create(document=instance, **line_data)
                total += line.amount
            
            instance.amount = total
            instance.save(update_fields=['amount'])
            
        return instance


# ─────────────────────────────────────────────────────────────────────
# Production Document
# ─────────────────────────────────────────────────────────────────────

class ProductionProductLineSerializer(serializers.ModelSerializer):
    """Serializer for ProductionProductLine."""
    item_name = serializers.CharField(source='item.name', read_only=True)
    item_sku = serializers.CharField(source='item.sku', read_only=True)
    unit = serializers.CharField(source='item.unit.code', read_only=True)
    
    class Meta:
        model = ProductionProductLine
        fields = ['id', 'item', 'item_name', 'item_sku', 'unit', 'quantity', 'price', 'amount']


class ProductionMaterialLineSerializer(serializers.ModelSerializer):
    """Serializer for ProductionMaterialLine."""
    item_name = serializers.CharField(source='item.name', read_only=True)
    item_sku = serializers.CharField(source='item.sku', read_only=True)
    unit = serializers.CharField(source='item.unit.code', read_only=True)
    
    class Meta:
        model = ProductionMaterialLine
        fields = ['id', 'item', 'item_name', 'item_sku', 'unit', 'quantity', 'cost_price', 'amount']


class ProductionDocumentSerializer(serializers.ModelSerializer):
    """Serializer for ProductionDocument."""
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)
    materials_warehouse_name = serializers.CharField(source='materials_warehouse.name', read_only=True)
    products = ProductionProductLineSerializer(many=True, read_only=True)
    materials = ProductionMaterialLineSerializer(many=True, read_only=True)
    
    class Meta:
        model = ProductionDocument
        fields = [
            'id', 'number', 'date', 'status', 'status_display', 'comment',
            'warehouse', 'warehouse_name', 
            'materials_warehouse', 'materials_warehouse_name',
            'production_account_code',
            'products', 'materials',
            'created_at', 'updated_at', 'posted_at'
        ]


class ProductionDocumentCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating production documents."""
    products = ProductionProductLineSerializer(many=True, required=False)
    materials = ProductionMaterialLineSerializer(many=True, required=False)
    
    class Meta:
        model = ProductionDocument
        fields = [
            'number', 'date', 'comment',
            'warehouse', 'materials_warehouse',
            'production_account_code',
            'products', 'materials'
        ]
        
    def create(self, validated_data):
        products_data = validated_data.pop('products', [])
        materials_data = validated_data.pop('materials', [])
        
        validated_data['tenant'] = self.context['request'].user.tenant
        validated_data['created_by'] = self.context['request'].user
        
        doc = super().create(validated_data)
        
        # Create Products
        for line_data in products_data:
            line_data.pop('item_name', None)
            line_data.pop('item_sku', None)
            line_data.pop('unit', None)
            ProductionProductLine.objects.create(document=doc, **line_data)
            
        # Create Materials
        for line_data in materials_data:
            line_data.pop('item_name', None)
            line_data.pop('item_sku', None)
            line_data.pop('unit', None)
            ProductionMaterialLine.objects.create(document=doc, **line_data)
            
        return doc
        
    def update(self, instance, validated_data):
        products_data = validated_data.pop('products', [])
        materials_data = validated_data.pop('materials', [])
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Replace Products
        if products_data is not None:
            instance.products.all().delete()
            for line_data in products_data:
                line_data.pop('item_name', None)
                line_data.pop('item_sku', None)
                line_data.pop('unit', None)
                if 'id' in line_data: del line_data['id']
                ProductionProductLine.objects.create(document=instance, **line_data)

        # Replace Materials
        if materials_data is not None:
            instance.materials.all().delete()
            for line_data in materials_data:
                line_data.pop('item_name', None)
                line_data.pop('item_sku', None)
                line_data.pop('unit', None)
                if 'id' in line_data: del line_data['id']
                ProductionMaterialLine.objects.create(document=instance, **line_data)
            
        return instance
