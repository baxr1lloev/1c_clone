"""
Batch Service - Партийный учёт (Lot/Batch Accounting)

This service implements FIFO/AVG/LIFO algorithms for inventory valuation.
Critical for proper cost accounting in 1C-style ERP.
"""
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from django.contrib.contenttypes.models import ContentType
from .models import StockBatch, StockMovement
from accounting.models import AccountingPolicy


class BatchService:
    """
    Service for batch-based inventory accounting.
    
    Philosophy (как в 1С):
    - Each purchase creates a batch with specific cost
    - Each sale consumes from batches according to valuation method (FIFO/AVG)
    - Cost of Goods Sold (COGS) is calculated from actual batches consumed
    """
    
    @staticmethod
    @transaction.atomic
    def create_batch_from_purchase(tenant, warehouse, item, quantity, unit_cost, 
                                   incoming_date, source_document):
        """
        Create a new batch from purchase.
        
        Args:
            tenant: Tenant instance
            warehouse: Warehouse instance
            item: Item instance
            quantity: Decimal - quantity purchased
            unit_cost: Decimal - cost per unit in base currency
            incoming_date: datetime - when goods arrived
            source_document: Document instance (PurchaseDocument)
        
        Returns:
            StockBatch instance
        """
        batch = StockBatch.objects.create(
            tenant=tenant,
            item=item,
            warehouse=warehouse,
            incoming_document_type=ContentType.objects.get_for_model(source_document),
            incoming_document_id=source_document.id,
            incoming_date=incoming_date,
            qty_initial=quantity,
            qty_remaining=quantity,
            unit_cost=unit_cost
        )
        
        # Create stock movement for the batch
        StockMovement.objects.create(
            tenant=tenant,
            date=incoming_date,
            warehouse=warehouse,
            item=item,
            quantity=quantity,
            type='IN',
            batch=batch,
            content_type=ContentType.objects.get_for_model(source_document),
            object_id=source_document.id
        )
        
        return batch
    
    @staticmethod
    def get_valuation_method(tenant):
        """
        Get the accounting policy valuation method for tenant.
        
        Returns:
            str: 'FIFO', 'AVG', or 'LIFO'
        """
        try:
            policy = AccountingPolicy.objects.get(tenant=tenant)
            return policy.stock_valuation_method
        except AccountingPolicy.DoesNotExist:
            # Default to FIFO if no policy set
            return 'FIFO'
    
    @classmethod
    @transaction.atomic
    def consume_batches(cls, tenant, warehouse, item, quantity, consumption_date, 
                       source_document, method=None):
        """
        Consume batches according to valuation method.
        
        Args:
            tenant: Tenant instance
            warehouse: Warehouse instance
            item: Item instance
            quantity: Decimal - quantity to consume
            consumption_date: datetime - when consumed
            source_document: Document instance (SalesDocument, etc.)
            method: str - override valuation method (optional)
        
        Returns:
            dict: {
                'batches_consumed': [(batch, qty_consumed, cost), ...],
                'total_cost': Decimal,
                'movements': [StockMovement, ...]
            }
        
        Raises:
            ValueError: If not enough stock available
        """
        if method is None:
            method = cls.get_valuation_method(tenant)
        
        if method == 'FIFO':
            return cls._consume_fifo(tenant, warehouse, item, quantity, 
                                    consumption_date, source_document)
        elif method == 'AVG':
            return cls._consume_avg(tenant, warehouse, item, quantity, 
                                   consumption_date, source_document)
        elif method == 'LIFO':
            return cls._consume_lifo(tenant, warehouse, item, quantity, 
                                    consumption_date, source_document)
        else:
            raise ValueError(f"Unknown valuation method: {method}")
    
    @staticmethod
    @transaction.atomic
    def _consume_fifo(tenant, warehouse, item, quantity, consumption_date, source_document):
        """
        FIFO: First In, First Out
        Consume from oldest batches first.
        
        Example:
            Batch 1: 10 units @ $10 (2024-01-01)
            Batch 2: 20 units @ $12 (2024-01-15)
            
            Sell 15 units:
            - Take 10 from Batch 1 → COGS = 10 * $10 = $100
            - Take 5 from Batch 2 → COGS = 5 * $12 = $60
            - Total COGS = $160
        """
        # Get batches ordered by date (oldest first)
        batches = StockBatch.objects.filter(
            tenant=tenant,
            warehouse=warehouse,
            item=item,
            qty_remaining__gt=0
        ).order_by('incoming_date', 'id')
        
        remaining_to_consume = Decimal(str(quantity))
        batches_consumed = []
        movements = []
        total_cost = Decimal('0')
        
        for batch in batches:
            if remaining_to_consume <= 0:
                break
            
            # How much to take from this batch
            qty_from_batch = min(batch.qty_remaining, remaining_to_consume)
            cost_from_batch = qty_from_batch * batch.unit_cost
            
            # Update batch
            batch.qty_remaining -= qty_from_batch
            batch.save()
            
            # Create movement
            movement = StockMovement.objects.create(
                tenant=tenant,
                date=consumption_date,
                warehouse=warehouse,
                item=item,
                quantity=qty_from_batch,
                type='OUT',
                batch=batch,
                content_type=ContentType.objects.get_for_model(source_document),
                object_id=source_document.id
            )
            
            batches_consumed.append((batch, qty_from_batch, cost_from_batch))
            movements.append(movement)
            total_cost += cost_from_batch
            remaining_to_consume -= qty_from_batch
        
        if remaining_to_consume > 0:
            raise ValueError(
                f"Not enough stock for {item}. "
                f"Need {quantity}, available {quantity - remaining_to_consume}"
            )
        
        return {
            'batches_consumed': batches_consumed,
            'total_cost': total_cost,
            'movements': movements
        }
    
    @staticmethod
    @transaction.atomic
    def _consume_avg(tenant, warehouse, item, quantity, consumption_date, source_document):
        """
        Weighted Average Cost
        Calculate average cost from all available batches.
        
        Example:
            Batch 1: 10 units @ $10 = $100
            Batch 2: 20 units @ $12 = $240
            
            Avg cost = ($100 + $240) / (10 + 20) = $11.33
            
            Sell 15 units:
            - COGS = 15 * $11.33 = $170
        """
        batches = StockBatch.objects.filter(
            tenant=tenant,
            warehouse=warehouse,
            item=item,
            qty_remaining__gt=0
        ).order_by('incoming_date', 'id')
        
        if not batches.exists():
            raise ValueError(f"No stock available for {item}")
        
        # Calculate weighted average cost
        total_qty = sum(b.qty_remaining for b in batches)
        total_value = sum(b.qty_remaining * b.unit_cost for b in batches)
        
        if total_qty < quantity:
            raise ValueError(
                f"Not enough stock for {item}. "
                f"Need {quantity}, available {total_qty}"
            )
        
        avg_cost = total_value / total_qty if total_qty > 0 else Decimal('0')
        
        # Consume from batches proportionally
        remaining_to_consume = Decimal(str(quantity))
        batches_consumed = []
        movements = []
        total_cost = Decimal('0')
        
        for batch in batches:
            if remaining_to_consume <= 0:
                break
            
            qty_from_batch = min(batch.qty_remaining, remaining_to_consume)
            # Use average cost, not batch cost
            cost_from_batch = qty_from_batch * avg_cost
            
            batch.qty_remaining -= qty_from_batch
            batch.save()
            
            movement = StockMovement.objects.create(
                tenant=tenant,
                date=consumption_date,
                warehouse=warehouse,
                item=item,
                quantity=qty_from_batch,
                type='OUT',
                batch=batch,
                content_type=ContentType.objects.get_for_model(source_document),
                object_id=source_document.id
            )
            
            batches_consumed.append((batch, qty_from_batch, cost_from_batch))
            movements.append(movement)
            total_cost += cost_from_batch
            remaining_to_consume -= qty_from_batch
        
        return {
            'batches_consumed': batches_consumed,
            'total_cost': total_cost,
            'movements': movements,
            'avg_cost': avg_cost
        }
    
    @staticmethod
    @transaction.atomic
    def _consume_lifo(tenant, warehouse, item, quantity, consumption_date, source_document):
        """
        LIFO: Last In, First Out
        Consume from newest batches first.
        
        Example:
            Batch 1: 10 units @ $10 (2024-01-01)
            Batch 2: 20 units @ $12 (2024-01-15)
            
            Sell 15 units:
            - Take 15 from Batch 2 → COGS = 15 * $12 = $180
        """
        # Get batches ordered by date (newest first)
        batches = StockBatch.objects.filter(
            tenant=tenant,
            warehouse=warehouse,
            item=item,
            qty_remaining__gt=0
        ).order_by('-incoming_date', '-id')
        
        remaining_to_consume = Decimal(str(quantity))
        batches_consumed = []
        movements = []
        total_cost = Decimal('0')
        
        for batch in batches:
            if remaining_to_consume <= 0:
                break
            
            qty_from_batch = min(batch.qty_remaining, remaining_to_consume)
            cost_from_batch = qty_from_batch * batch.unit_cost
            
            batch.qty_remaining -= qty_from_batch
            batch.save()
            
            movement = StockMovement.objects.create(
                tenant=tenant,
                date=consumption_date,
                warehouse=warehouse,
                item=item,
                quantity=qty_from_batch,
                type='OUT',
                batch=batch,
                content_type=ContentType.objects.get_for_model(source_document),
                object_id=source_document.id
            )
            
            batches_consumed.append((batch, qty_from_batch, cost_from_batch))
            movements.append(movement)
            total_cost += cost_from_batch
            remaining_to_consume -= qty_from_batch
        
        if remaining_to_consume > 0:
            raise ValueError(
                f"Not enough stock for {item}. "
                f"Need {quantity}, available {quantity - remaining_to_consume}"
            )
        
        return {
            'batches_consumed': batches_consumed,
            'total_cost': total_cost,
            'movements': movements
        }
    
    @staticmethod
    @transaction.atomic
    def transfer_batches(tenant, from_warehouse, to_warehouse, item, quantity, 
                        transfer_date, source_document):
        """
        Transfer batches between warehouses.
        Uses FIFO to select which batches to transfer.
        
        Creates:
        - OUT movements from source warehouse
        - New batches in destination warehouse
        - IN movements to destination warehouse
        """
        # Consume from source using FIFO
        result = BatchService._consume_fifo(
            tenant, from_warehouse, item, quantity, 
            transfer_date, source_document
        )
        
        # Create new batches in destination
        new_batches = []
        for batch, qty_transferred, cost in result['batches_consumed']:
            new_batch = StockBatch.objects.create(
                tenant=tenant,
                item=item,
                warehouse=to_warehouse,
                incoming_document_type=ContentType.objects.get_for_model(source_document),
                incoming_document_id=source_document.id,
                incoming_date=transfer_date,
                qty_initial=qty_transferred,
                qty_remaining=qty_transferred,
                unit_cost=batch.unit_cost  # Keep original cost
            )
            
            # Create IN movement
            StockMovement.objects.create(
                tenant=tenant,
                date=transfer_date,
                warehouse=to_warehouse,
                item=item,
                quantity=qty_transferred,
                type='IN',
                batch=new_batch,
                content_type=ContentType.objects.get_for_model(source_document),
                object_id=source_document.id
            )
            
            new_batches.append(new_batch)
        
        return {
            'batches_consumed': result['batches_consumed'],
            'batches_created': new_batches,
            'total_cost': result['total_cost']
        }
    
    @staticmethod
    def get_available_quantity(tenant, warehouse, item):
        """
        Get total available quantity from all batches.
        
        Returns:
            Decimal: Total quantity available
        """
        from django.db.models import Sum
        
        result = StockBatch.objects.filter(
            tenant=tenant,
            warehouse=warehouse,
            item=item,
            qty_remaining__gt=0
        ).aggregate(total=Sum('qty_remaining'))
        
        return result['total'] or Decimal('0')
    
    @staticmethod
    def get_inventory_value(tenant, warehouse=None, item=None):
        """
        Calculate total inventory value.
        
        Args:
            tenant: Tenant instance
            warehouse: Optional warehouse filter
            item: Optional item filter
        
        Returns:
            Decimal: Total value of inventory
        """
        filters = {'tenant': tenant, 'qty_remaining__gt': 0}
        if warehouse:
            filters['warehouse'] = warehouse
        if item:
            filters['item'] = item
        
        batches = StockBatch.objects.filter(**filters)
        
        total_value = sum(
            batch.qty_remaining * batch.unit_cost 
            for batch in batches
        )
        
        return Decimal(str(total_value))
