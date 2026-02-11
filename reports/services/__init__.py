from django.db.models import Sum
from registers.models import SettlementsBalance, StockBalance, CounterpartyStockBalance
from directories.models import Counterparty

class FinancialReportService:
    """
    Service to calculate where the money is.
    """
    
    @staticmethod
    def get_customer_money_report(tenant):
        """
        Returns a list of dicts:
        [
          {
            'counterparty': 'Client A',
            'debt': 1000,          # Money they owe us
            'stock_at_warehouse': 500, # Value of reserved stock? (Logic check needed)
            'stock_at_agent': 200,     # Value of goods we gave them but not sold
            'total_exposure': 1700
          }, ...
        ]
        """
        report_data = []
        counterparties = Counterparty.objects.filter(tenant=tenant)
        
        for cp in counterparties:
            # 1. Money owed (Settlements)
            # Positive amount = Debit (They owe us)
            settlements = SettlementsBalance.objects.filter(
                tenant=tenant, counterparty=cp
            ).aggregate(total=Sum('amount'))['total'] or 0
            
            # 2. Goods at Agent (Counterparty Stock)
            agent_stock_val = CounterpartyStockBalance.objects.filter(
                tenant=tenant, counterparty=cp
            ).aggregate(total=Sum('amount'))['total'] or 0
            
            # 3. Stock reserved? (Optional, usually stock on OUR warehouse doesn't belong to client yet unless paid & reserved)
            # For "Where is money", we usually look at Debt + AgentStock
            
            if settlements != 0 or agent_stock_val != 0:
                report_data.append({
                    'id': cp.id,
                    'name': cp.name,
                    'debt': settlements,
                    'agent_stock': agent_stock_val,
                    'total': settlements + agent_stock_val
                })
                
        return report_data
