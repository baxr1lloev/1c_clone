"""
Cash Order serializers for API.
"""
from rest_framework import serializers
from documents.models import CashOrder
from directories.api.serializers import CounterpartyListSerializer

# ─────────────────────────────────────────────────────────────────────
# Cash Order (PKO/RKO)
# ─────────────────────────────────────────────────────────────────────

class CashOrderListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for cash order list."""
    order_type_display = serializers.CharField(source='get_order_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    currency_code = serializers.CharField(source='currency.code', read_only=True)
    cash_desk = serializers.CharField(read_only=True)
    
    class Meta:
        model = CashOrder
        fields = [
            'id', 'number', 'date', 'order_type', 'order_type_display',
            'status', 'status_display', 'counterparty_name',
            'amount', 'currency_code', 'cash_desk', 'purpose'
        ]


class CashOrderDetailSerializer(serializers.ModelSerializer):
    """Full serializer for cash order detail."""
    order_type_display = serializers.CharField(source='get_order_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    currency_code = serializers.CharField(source='currency.code', read_only=True)
    cash_flow_item_name = serializers.CharField(source='cash_flow_item.name', read_only=True)
    debit_account_code = serializers.CharField(source='debit_account.code', read_only=True)
    credit_account_code = serializers.CharField(source='credit_account.code', read_only=True)
    counterparty_data = CounterpartyListSerializer(source='counterparty', read_only=True)
    
    # Permissions (Backend as Brain)
    can_edit = serializers.BooleanField(read_only=True)
    can_post = serializers.BooleanField(read_only=True)
    can_unpost = serializers.BooleanField(read_only=True)
    period_is_closed = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = CashOrder
        fields = [
            'id', 'number', 'date', 'order_type', 'order_type_display',
            'status', 'status_display', 'comment',
            'counterparty_name', 'counterparty', 'counterparty_data',
            'amount', 'currency', 'currency_code',
            'cash_desk', 'purpose', 'basis',
            'cash_flow_item', 'cash_flow_item_name',
            'debit_account', 'debit_account_code',
            'credit_account', 'credit_account_code',
            'created_at', 'updated_at', 'posted_at',
            # State Flags
            'can_edit', 'can_post', 'can_unpost', 'period_is_closed'
        ]


class CashOrderCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating cash orders."""
    
    class Meta:
        model = CashOrder
        fields = [
            'number', 'date', 'order_type', 'comment',
            'counterparty_name', 'counterparty',
            'amount', 'currency', 'cash_desk', 'purpose', 'basis',
            'cash_flow_item', 'debit_account', 'credit_account',
        ]
    
    def create(self, validated_data):
        validated_data['tenant'] = self.context['request'].user.tenant
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)
    
    def update(self, instance, validated_data):
        # Only allow updates if can_edit
        if not instance.can_edit:
            raise serializers.ValidationError("Cannot edit posted or cancelled documents.")
        return super().update(instance, validated_data)
