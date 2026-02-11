from decimal import Decimal
from django.core.exceptions import ValidationError
from typing import List, Dict, Any

from .models import BaseDocument, SalesDocument, PurchaseDocument
from accounting.models import PeriodClosing
from registers.services import StockService


class ValidationResult:
    def __init__(self):
        self.errors: List[Dict[str, Any]] = []
        self.warnings: List[Dict[str, Any]] = []
    
    def add_error(self, error_type: str, message: str, **kwargs):
        self.errors.append({
            'type': error_type,
            'message': message,
            **kwargs
        })
    
    def add_warning(self, warning_type: str, message: str, **kwargs):
        self.warnings.append({
            'type': warning_type,
            'message': message,
            **kwargs
        })
    
    def is_valid(self) -> bool:
        return len(self.errors) == 0
    
    def to_dict(self):
        return {
            'is_valid': self.is_valid(),
            'errors': self.errors,
            'warnings': self.warnings,
            'can_post': self.is_valid()
        }


class DocumentValidator:
    """1C-style real-time document validation"""
    
    @staticmethod
    def validate_sales_document(document: SalesDocument, lines: List = None) -> ValidationResult:
        """Validate sales document before posting"""
        result = ValidationResult()
        
        # 1. Check period is open
        if PeriodClosing.is_period_closed(document.date, document.tenant, check_type='ACCOUNTING'):
            result.add_error(
                'period_closed',
                f'Period {document.date.strftime("%B %Y")} is closed for posting'
            )
        
        # 2. Check required fields
        if not document.counterparty_id:
            result.add_error('missing_field', 'Customer is required')
        
        if not document.warehouse_id:
            result.add_error('missing_field', 'Warehouse is required')
        
        # 3. Validate lines
        if lines is None:
            lines = document.lines.all()
        
        if not lines or len(lines) == 0:
            result.add_error('no_lines', 'Document must have at least one line item')
            return result
        
        # 4. Check each line
        for idx, line in enumerate(lines, 1):
            # Check price
            if not line.price or line.price <= 0:
                result.add_warning(
                    'no_price',
                    f'Line {idx}: Price not set for {line.item.name}',
                    line_id=line.id if line.id else idx,
                    item_name=line.item.name
                )
            
            # Check stock availability
            try:
                stock = StockService.get_stock_balance(
                    item=line.item,
                    warehouse=document.warehouse,
                    tenant=document.tenant
                )
                
                available = stock.get('available', 0)
                
                if line.quantity > available:
                    result.add_error(
                        'insufficient_stock',
                        f'Line {idx}: Insufficient stock for {line.item.name} - need {line.quantity}, available {available}',
                        line_id=line.id if line.id else idx,
                        item_name=line.item.name,
                        required=float(line.quantity),
                        available=float(available),
                        short=float(line.quantity - available)
                    )
                
                # Warning if stock is getting low
                elif available < line.quantity * 2:
                    result.add_warning(
                        'low_stock',
                        f'Line {idx}: Low stock for {line.item.name} - {available} remaining after this sale',
                        line_id=line.id if line.id else idx,
                        remaining=float(available - line.quantity)
                    )
                    
            except Exception as e:
                result.add_warning(
                    'stock_check_failed',
                    f'Line {idx}: Could not verify stock for {line.item.name}',
                    line_id=line.id if line.id else idx
                )
        
        # 5. Check totals
        if document.total_amount <= 0:
            result.add_warning('zero_total', 'Document total is zero')
        
        return result
    
    @staticmethod
    def validate_purchase_document(document: PurchaseDocument, lines: List = None) -> ValidationResult:
        """Validate purchase document"""
        result = ValidationResult()
        
        # Check period
        if PeriodClosing.is_period_closed(document.date, document.tenant, check_type='ACCOUNTING'):
            result.add_error(
                'period_closed',
                f'Period {document.date.strftime("%B %Y")} is closed for posting'
            )
        
        # Check required fields
        if not document.counterparty_id:
            result.add_error('missing_field', 'Supplier is required')
        
        if not document.warehouse_id:
            result.add_error('missing_field', 'Warehouse is required')
        
        # Validate lines
        if lines is None:
            lines = document.lines.all()
        
        if not lines or len(lines) == 0:
            result.add_error('no_lines', 'Document must have at least one line item')
            return result
        
        for idx, line in enumerate(lines, 1):
            if not line.price or line.price <= 0:
                result.add_warning(
                    'no_price',
                    f'Line {idx}: Price not set for {line.item.name}',
                    line_id=line.id if line.id else idx
                )
        
        return result
