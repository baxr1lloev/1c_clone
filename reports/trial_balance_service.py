from datetime import date
from decimal import Decimal
from django.db.models import Sum, Q, F
from accounting.models import ChartOfAccounts, AccountingEntry, TrialBalance

class TrialBalanceService:
    @staticmethod
    @staticmethod
    def _to_float(val):
        return float(val) if val is not None else 0.0

    @classmethod
    def get_trial_balance(cls, tenant, start_date, end_date):
        # ... (same fetching logic)
        accounts = ChartOfAccounts.objects.filter(tenant=tenant).order_by('code')
        
        data = {}
        for account in accounts:
            data[account.id] = {
                'id': account.id,
                'code': account.code,
                'name': account.name,
                'parent_id': account.parent_id,
                'level': 0,
                'type': account.account_type,
                'opening_debit': Decimal('0'),
                'opening_credit': Decimal('0'),
                'turnover_debit': Decimal('0'),
                'turnover_credit': Decimal('0'),
                'closing_debit': Decimal('0'),
                'closing_credit': Decimal('0'),
                'children': []
            }

        # 2. Opening Balance
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

        # 3. Turnover
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

        # calculate net opening
        for account_id, row in data.items():
            net_opening = row['opening_debit'] - row['opening_credit']
            if net_opening >= 0:
                row['opening_debit'] = net_opening
                row['opening_credit'] = Decimal('0')
            else:
                row['opening_debit'] = Decimal('0')
                row['opening_credit'] = abs(net_opening)
        
        # Build tree and calculate closing + rollups
        tree_map = {id: node for id, node in data.items()}
        roots = []
        
        for id, node in tree_map.items():
            if node['parent_id']:
                parent = tree_map.get(node['parent_id'])
                if parent:
                    parent['children'].append(node)
                else:
                    roots.append(node)
            else:
                roots.append(node)
                
        def calculate_totals(node, level=0):
            node['level'] = level
            node['children'].sort(key=lambda x: x['code'])
            
            for child in node['children']:
                calculate_totals(child, level + 1)
                
                # Rollup
                node['opening_debit'] += child['opening_debit']
                node['opening_credit'] += child['opening_credit']
                node['turnover_debit'] += child['turnover_debit']
                node['turnover_credit'] += child['turnover_credit']
            
            # Calculate Closing Balance for this node (after rollup!)
            # Closing = Opening + Turnover (Dr - Cr)
            # Actually, standard OSV logic:
            # Active: OpDr - OpCr + TurnDr - TurnCr
            # Net result -> ClDr or ClCr
            
            # Since we rolled up, we can just use the aggregates
            net_result = (node['opening_debit'] - node['opening_credit']) + \
                         (node['turnover_debit'] - node['turnover_credit'])
                         
            if net_result >= 0:
                node['closing_debit'] = net_result
                node['closing_credit'] = Decimal('0')
            else:
                node['closing_debit'] = Decimal('0')
                node['closing_credit'] = abs(net_result)

        for root in roots:
            calculate_totals(root)

        # Flatten and Convert to Float
        result_rows = []
        def flatten(node):
            row_copy = {
                'id': node['id'],
                'code': node['code'],
                'name': node['name'],
                'level': node['level'],
                'has_children': len(node['children']) > 0,
                'opening_debit': cls._to_float(node['opening_debit']),
                'opening_credit': cls._to_float(node['opening_credit']),
                'turnover_debit': cls._to_float(node['turnover_debit']),
                'turnover_credit': cls._to_float(node['turnover_credit']),
                'closing_debit': cls._to_float(node['closing_debit']),
                'closing_credit': cls._to_float(node['closing_credit']),
            }
            result_rows.append(row_copy)
            for child in node['children']:
                flatten(child)
                
        roots.sort(key=lambda x: x['code'])
        for root in roots:
            flatten(root)
            
        return result_rows
