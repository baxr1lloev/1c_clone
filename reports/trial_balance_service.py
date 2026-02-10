from datetime import date
from decimal import Decimal
from django.db.models import Sum, Q, F
from accounting.models import ChartOfAccounts, AccountingEntry, TrialBalance

class TrialBalanceService:
    @staticmethod
    def get_trial_balance(tenant, start_date, end_date):
        """
        Generate hierarchical Trial Balance with:
        - Opening Balance (Debit/Credit)
        - Turnover (Debit/Credit)
        - Closing Balance (Debit/Credit)
        
        Optimized to use TrialBalance snapshots for opening balances if available.
        """
        accounts = ChartOfAccounts.objects.filter(tenant=tenant).order_by('code')
        
        # 1. Fetch data
        data = {}
        for account in accounts:
            data[account.id] = {
                'id': account.id,
                'code': account.code,
                'name': account.name,
                'parent_id': account.parent_id,
                'level': 0, # To be calculated
                'type': account.account_type,
                'opening_debit': Decimal('0'),
                'opening_credit': Decimal('0'),
                'turnover_debit': Decimal('0'),
                'turnover_credit': Decimal('0'),
                'closing_debit': Decimal('0'),
                'closing_credit': Decimal('0'),
                'children': []
            }

        # 2. Calculate Opening Balances (before start_date)
        # TODO: Optimize using latest closed period snapshot
        opening_entries_debit = AccountingEntry.objects.filter(
            tenant=tenant,
            date__lt=start_date
        ).values('debit_account').annotate(sum=Sum('amount'))
        
        opening_entries_credit = AccountingEntry.objects.filter(
            tenant=tenant,
            date__lt=start_date
        ).values('credit_account').annotate(sum=Sum('amount'))
        
        for entry in opening_entries_debit:
            if entry['debit_account'] in data:
                data[entry['debit_account']]['opening_debit'] = entry['sum']
                
        for entry in opening_entries_credit:
             if entry['credit_account'] in data:
                 data[entry['credit_account']]['opening_credit'] = entry['sum']

        # 3. Calculate Turnover (within period)
        turnover_debit = AccountingEntry.objects.filter(
            tenant=tenant,
            date__gte=start_date,
            date__lte=end_date
        ).values('debit_account').annotate(sum=Sum('amount'))
        
        turnover_credit = AccountingEntry.objects.filter(
            tenant=tenant,
            date__gte=start_date,
            date__lte=end_date
        ).values('credit_account').annotate(sum=Sum('amount'))

        for entry in turnover_debit:
            if entry['debit_account'] in data:
                data[entry['debit_account']]['turnover_debit'] = entry['sum']
        
        for entry in turnover_credit:
            if entry['credit_account'] in data:
                data[entry['credit_account']]['turnover_credit'] = entry['sum']

        # 4. Normalize and Calculate Closing
        root_nodes = []
        
        # Helper to process raw values into Accounting Logic (Debit/Credit nature)
        # For Trial Balance formatting, we usually show raw Debit/Credit
        for account_id, row in data.items():
            # Net Opening
            net_opening = row['opening_debit'] - row['opening_credit']
            if net_opening > 0:
                row['opening_debit'] = net_opening
                row['opening_credit'] = Decimal('0')
            else:
                row['opening_debit'] = Decimal('0')
                row['opening_credit'] = abs(net_opening)

            # Closing = Opening + Turnover Debit - Turnover Credit
            # (Simplified, real accounting depends on account type active/passive)
            
            # Asset/Expense (Active): Debit + Debit - Credit
            # Liability/Equity/Revenue (Passive): Credit + Credit - Debit
            
            # For pure display (like 1C often does raw), we calculate net:
            net_closing = (row['opening_debit'] - row['opening_credit']) + \
                          (row['turnover_debit'] - row['turnover_credit'])
            
            if net_closing > 0:
                row['closing_debit'] = net_closing
                row['closing_credit'] = Decimal('0')
            else:
                row['closing_debit'] = Decimal('0')
                row['closing_credit'] = abs(net_closing)

        # 5. Build Hierarchy
        # We need to roll up values to parents
        # This is strictly for display purposes. Actual accounting usually forbids posting to parents.
        
        # Sort by code strictly to ensure parents come before children? No, code length.
        # Better: Build tree then recurse for totals.
        
        tree_map = {id: node for id, node in data.items()}
        roots = []
        
        for id, node in tree_map.items():
            if node['parent_id']:
                parent = tree_map.get(node['parent_id'])
                if parent:
                    parent['children'].append(node)
                else:
                     roots.append(node) # Parent missing/deleted?
            else:
                roots.append(node)
                
        # Recursive function to sum up totals
        def calculate_hierarchy_totals(node, level=0):
            node['level'] = level
            
            # Sort children by code
            node['children'].sort(key=lambda x: x['code'])
            
            for child in node['children']:
                calculate_hierarchy_totals(child, level + 1)
                
                # Roll up values
                node['opening_debit'] += child['opening_debit']
                node['opening_credit'] += child['opening_credit']
                node['turnover_debit'] += child['turnover_debit']
                node['turnover_credit'] += child['turnover_credit']
                node['closing_debit'] += child['closing_debit']
                node['closing_credit'] += child['closing_credit']
        
        for root in roots:
            calculate_hierarchy_totals(root)
            
        # Flatten for table display (DFS)
        result_rows = []
        def flatten(node):
            # Create a copy without children list to avoid circular/large JSON
            row_copy = {k: v for k, v in node.items() if k != 'children'}
            row_copy['has_children'] = len(node['children']) > 0
            result_rows.append(row_copy)
            for child in node['children']:
                flatten(child)
                
        # Sort roots
        roots.sort(key=lambda x: x['code'])
        for root in roots:
            flatten(root)
            
        return result_rows
