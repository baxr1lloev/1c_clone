"""
API Serializers for registers app.
Registers are read-only views of accumulated data.
"""
from rest_framework import serializers
from registers.models import (
    StockBalance, StockMovement, StockBatch, StockReservation,
    SettlementsBalance, CounterpartyStockBalance, GoodsInTransit,
    ItemPrice
)


class StockBalanceSerializer(serializers.ModelSerializer):
    """Serializer for StockBalance (current stock levels)."""
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)
    item_name = serializers.CharField(source='item.name', read_only=True)
    item_sku = serializers.CharField(source='item.sku', read_only=True)
    
    class Meta:
        model = StockBalance
        fields = [
            'id', 'warehouse', 'warehouse_name', 'item', 'item_name', 'item_sku',
            'quantity', 'amount', 'last_updated'
        ]


class StockMovementSerializer(serializers.ModelSerializer):
    """Serializer for StockMovement (transaction history)."""
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)
    item_name = serializers.CharField(source='item.name', read_only=True)
    type_display = serializers.CharField(source='get_type_display', read_only=True)
    document_type = serializers.CharField(source='content_type.model', read_only=True)
    
    class Meta:
        model = StockMovement
        fields = [
            'id', 'date', 'warehouse', 'warehouse_name', 'item', 'item_name',
            'quantity', 'type', 'type_display', 'is_reversal', 'reversed_at',
            'document_type', 'object_id', 'created_at'
        ]


class StockBatchSerializer(serializers.ModelSerializer):
    """Serializer for StockBatch (lot tracking)."""
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)
    item_name = serializers.CharField(source='item.name', read_only=True)
    
    class Meta:
        model = StockBatch
        fields = [
            'id', 'warehouse', 'warehouse_name', 'item', 'item_name',
            'incoming_date', 'qty_initial', 'qty_remaining', 'unit_cost', 'created_at'
        ]


class StockReservationSerializer(serializers.ModelSerializer):
    """Serializer for StockReservation."""
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)
    item_name = serializers.CharField(source='item.name', read_only=True)
    document_type = serializers.CharField(source='document_type.model', read_only=True)
    
    class Meta:
        model = StockReservation
        fields = [
            'id', 'warehouse', 'warehouse_name', 'item', 'item_name',
            'quantity', 'document_type', 'document_id', 'created_at'
        ]


class SettlementsBalanceSerializer(serializers.ModelSerializer):
    """Serializer for SettlementsBalance (debts/receivables)."""
    counterparty_name = serializers.CharField(source='counterparty.name', read_only=True)
    contract_number = serializers.CharField(source='contract.number', read_only=True)
    currency_code = serializers.CharField(source='currency.code', read_only=True)
    
    class Meta:
        model = SettlementsBalance
        fields = [
            'id', 'counterparty', 'counterparty_name', 'contract', 'contract_number',
            'currency', 'currency_code', 'amount', 'last_updated'
        ]


class CounterpartyStockBalanceSerializer(serializers.ModelSerializer):
    """Serializer for CounterpartyStockBalance (goods at agent)."""
    counterparty_name = serializers.CharField(source='counterparty.name', read_only=True)
    item_name = serializers.CharField(source='item.name', read_only=True)
    
    class Meta:
        model = CounterpartyStockBalance
        fields = [
            'id', 'counterparty', 'counterparty_name', 'item', 'item_name',
            'quantity', 'amount', 'last_updated'
        ]


class GoodsInTransitSerializer(serializers.ModelSerializer):
    """Serializer for GoodsInTransit."""
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    destination_warehouse_name = serializers.CharField(source='destination_warehouse.name', read_only=True)
    item_name = serializers.CharField(source='item.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    risk_status_display = serializers.CharField(source='get_risk_status_display', read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)
    days_until_arrival = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = GoodsInTransit
        fields = [
            'id', 'supplier', 'supplier_name', 'item', 'item_name', 'quantity',
            'destination_warehouse', 'destination_warehouse_name',
            'shipped_date', 'expected_date', 'actual_arrival_date',
            'carrier', 'tracking_number',
            'status', 'status_display', 'risk_status', 'risk_status_display',
            'is_overdue', 'days_until_arrival',
            'created_at', 'updated_at'
        ]

class ItemPriceSerializer(serializers.ModelSerializer):
    """Serializer for ItemPrice (Periodic Register)."""
    item_name = serializers.CharField(source='item.name', read_only=True)
    currency_code = serializers.CharField(source='currency.code', read_only=True)
    price_type_display = serializers.CharField(source='get_price_type_display', read_only=True)
    
    class Meta:
        model = ItemPrice
        fields = [
            'id', 'tenant', 'item', 'item_name', 'date', 'price_type', 
            'price_type_display', 'price', 'currency', 'currency_code', 'created_at'
        ]
        read_only_fields = ['tenant', 'created_at']
