from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from decimal import Decimal
from datetime import datetime

from directories.models import Item, Counterparty, Warehouse
from documents.models import SalesDocumentLine, PurchaseDocumentLine
from accounting.models import ChartOfAccounts


@api_view(['GET'])
def get_item_context(request, item_id):
    """
    Get complete context for an item when adding to document.
    
    Auto-fills: price, account, tax rate, default package, stock balance
    """
    item = get_object_or_404(Item, id=item_id)
    
    # Get parameters
    customer_id = request.GET.get('customer')
    warehouse_id = request.GET.get('warehouse')
    date_str = request.GET.get('date')
    doc_type = request.GET.get('doc_type', 'sales')  # sales or purchase
    
    context = {
        'item': {
            'id': item.id,
            'name': item.name,
            'base_unit': item.unit,
        },
        'defaults': {},
        'pricing': {},
        'stock': {},
    }
    
    # 1. Get default account
    try:
        if doc_type == 'sales':
            account = ChartOfAccounts.objects.get(tenant=item.tenant, code='41')
        else:
            account = ChartOfAccounts.objects.get(tenant=item.tenant, code='41')
        
        context['defaults']['account'] = account.code
        context['defaults']['account_name'] = account.name
    except ChartOfAccounts.DoesNotExist:
        pass
    
    # 2. Get default VAT rate (from item or general default)
    context['defaults']['vat_rate'] = item.vat_rate if hasattr(item, 'vat_rate') else 15
    
    # 3. Get default package
    default_package = item.packages.filter(is_default=True).first()
    if not default_package:
        default_package = item.packages.first()
    
    if default_package:
        context['defaults']['default_package_id'] = default_package.id
        context['defaults']['default_package_name'] = default_package.name
        context['defaults']['coefficient'] = float(default_package.coefficient)
    else:
        context['defaults']['default_package_id'] = None
        context['defaults']['coefficient'] = 1
    
    # 4. Get pricing (last sale price or from price list)
    if customer_id and doc_type == 'sales':
        # Try to get last sale price to this customer
        last_sale_line = SalesDocumentLine.objects.filter(
            item=item,
            document__counterparty_id=customer_id,
            document__status='posted'
        ).order_by('-document__date').first()
        
        if last_sale_line:
            context['pricing']['price'] = float(last_sale_line.price)
            context['pricing']['price_source'] = 'last_sale'
            context['pricing']['price_date'] = last_sale_line.document.date.isoformat()
        else:
            # Default price from item (if exists)
            context['pricing']['price'] = float(item.price) if hasattr(item, 'price') else 0
            context['pricing']['price_source'] = 'default'
    
    elif doc_type == 'purchase':
        # Get last purchase price
        last_purchase_line = PurchaseDocumentLine.objects.filter(
            item=item,
            document__status='posted'
        ).order_by('-document__date').first()
        
        if last_purchase_line:
            context['pricing']['price'] = float(last_purchase_line.price)
            context['pricing']['price_source'] = 'last_purchase'
            context['pricing']['price_date'] = last_purchase_line.document.date.isoformat()
        else:
            context['pricing']['price'] = 0
            context['pricing']['price_source'] = 'none'
    
    # 5. Get stock balance
    if warehouse_id:
        from registers.services import StockService
        
        try:
            warehouse = Warehouse.objects.get(id=warehouse_id)
            stock_info = StockService.get_stock_balance(
                item=item,
                warehouse=warehouse,
                tenant=item.tenant
            )
            
            context['stock']['on_hand'] = float(stock_info.get('on_hand', 0))
            context['stock']['reserved'] = float(stock_info.get('reserved', 0))
            context['stock']['available'] = float(stock_info.get('available', 0))
            
            # Calculate in packages
            if default_package and default_package.coefficient > 1:
                coef = float(default_package.coefficient)
                context['stock']['available_packages'] = int(context['stock']['available'] / coef)
                context['stock']['package_unit'] = default_package.name
            
        except Warehouse.DoesNotExist:
            context['stock']['on_hand'] = 0
            context['stock']['reserved'] = 0
            context['stock']['available'] = 0
    
    return Response(context)
