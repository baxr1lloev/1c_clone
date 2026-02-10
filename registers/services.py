"""
FIFO Service for Cost of Goods Sold Calculation

This service implements FIFO (First In, First Out) costing for accurate
cost calculation in Uzbekistan business context.
"""

from decimal import Decimal
from django.db import transaction
from django.utils.translation import gettext_lazy as _


class FIFOService:
    """
    FIFO cost calculation service for accurate COGS
    """
    
    @staticmethod
    def calculate_cogs(item, warehouse, quantity_sold, sale_date, tenant):
        """
        Calculate Cost of Goods Sold using FIFO method
        
        Args:
            item: Item object
            warehouse: Warehouse object
            quantity_sold: Decimal - quantity being sold
            sale_date: DateTime - sale date
            tenant: Tenant object
            
        Returns:
            tuple: (total_cost, batch_consumptions)
            
        Raises:
            ValueError: If insufficient stock available
        """
        from registers.models import StockBatch
        
        # Get available batches in FIFO order (oldest first)
        batches = StockBatch.objects.filter(
            tenant=tenant,
            item=item,
            warehouse=warehouse,
            qty_remaining__gt=0,
            incoming_date__lte=sale_date
        ).order_by('incoming_date')  # FIFO!
        
        total_cost = Decimal('0')
        remaining_qty = quantity_sold
        batch_consumptions = []
        
        for batch in batches:
            if remaining_qty <= 0:
                break
            
            # Take from this batch
            qty_from_batch = min(batch.qty_remaining, remaining_qty)
            cost_from_batch = qty_from_batch * batch.unit_cost
            
            total_cost += cost_from_batch
            batch_consumptions.append({
                'batch': batch,
                'quantity': qty_from_batch,
                'cost': cost_from_batch,
                'unit_cost': batch.unit_cost
            })
            
            remaining_qty -= qty_from_batch
        
        # Check if we have enough stock
        if remaining_qty > 0:
            available = quantity_sold - remaining_qty
            raise ValueError(
                f"Insufficient stock for {item.name}! "
                f"Requested: {quantity_sold}, Available: {available}"
            )
        
        return total_cost, batch_consumptions
    
    @staticmethod
    @transaction.atomic
    def consume_batches(batch_consumptions):
        """
        Update batch quantities after sale
        
        Args:
            batch_consumptions: List of dicts with batch consumption info
        """
        for consumption in batch_consumptions:
            batch = consumption['batch']
            qty = consumption['quantity']
            
            # Decrease remaining quantity
            batch.qty_remaining -= qty
            batch.save(update_fields=['qty_remaining'])
    
    @staticmethod
    @transaction.atomic
    def return_to_batches(batch_consumptions):
        """
        Return quantities to batches (for unposting/returns)
        
        Args:
            batch_consumptions: List of dicts with batch consumption info
        """
        for consumption in batch_consumptions:
            batch = consumption['batch']
            qty = consumption['quantity']
            
            # Increase remaining quantity
            batch.qty_remaining += qty
            batch.save(update_fields=['qty_remaining'])
    
    @staticmethod
    def get_available_batches(item, warehouse, tenant):
        """
        Get all available batches for an item in a warehouse
        
        Returns:
            QuerySet of StockBatch objects with qty_remaining > 0
        """
        from registers.models import StockBatch
        
        return StockBatch.objects.filter(
            tenant=tenant,
            item=item,
            warehouse=warehouse,
            qty_remaining__gt=0
        ).order_by('incoming_date')
    
    @staticmethod
    def get_inventory_valuation(tenant, warehouse=None, item=None):
        """
        Calculate total inventory value using FIFO
        
        Args:
            tenant: Tenant object
            warehouse: Optional Warehouse filter
            item: Optional Item filter
            
        Returns:
            dict with total_quantity and total_value
        """
        from registers.models import StockBatch
        from django.db.models import Sum, F
        
        queryset = StockBatch.objects.filter(
            tenant=tenant,
            qty_remaining__gt=0
        )
        
        if warehouse:
            queryset = queryset.filter(warehouse=warehouse)
        if item:
            queryset = queryset.filter(item=item)
        
        # Calculate total value
        result = queryset.aggregate(
            total_quantity=Sum('qty_remaining'),
            total_value=Sum(F('qty_remaining') * F('unit_cost'))
        )
        
        return {
            'total_quantity': result['total_quantity'] or Decimal('0'),
            'total_value': result['total_value'] or Decimal('0')
        }
