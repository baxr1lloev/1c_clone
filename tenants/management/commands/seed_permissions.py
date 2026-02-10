from django.core.management.base import BaseCommand
from tenants.models import Permission, Role, RolePermission


# Define all permissions
PERMISSIONS = [
    # Documents
    ('documents.view', 'View Documents'),
    ('documents.create', 'Create Documents'),
    ('documents.edit_draft', 'Edit Draft Documents'),
    ('documents.post', 'Post Documents'),
    ('documents.unpost', 'Unpost Documents'),
    ('documents.delete', 'Delete Documents'),
    
    # Accounting
    ('accounting.view_ledger', 'View Accounting Ledger'),
    ('accounting.view_reports', 'View Financial Reports'),
    ('accounting.edit_coa', 'Edit Chart of Accounts'),
    ('accounting.manual_entry', 'Create Manual Journal Entries'),
    
    # Registers
    ('registers.view', 'View Register Balances'),
    ('registers.close_period', 'Close Accounting Period'),
    ('registers.reopen_period', 'Reopen Closed Period'),
    
    # Directories
    ('directories.view', 'View Directories'),
    ('directories.edit', 'Edit Directories'),
    
    # Taxes
    ('taxes.view_reports', 'View Tax Reports'),
    ('taxes.generate', 'Generate Tax Reports'),
    ('taxes.submit', 'Submit Tax Reports'),
    ('taxes.edit_draft', 'Edit Draft Tax Reports'),
    
    # Admin
    ('admin.manage_users', 'Manage Users'),
    ('admin.assign_roles', 'Assign Roles'),
    ('admin.manage_tenant', 'Manage Tenant Settings'),
]


# Permission assignments per role
ROLE_PERMISSIONS = {
    'OWNER': [
        # Full access to everything
        'documents.view', 'documents.create', 'documents.edit_draft',
        'documents.post', 'documents.unpost', 'documents.delete',
        'accounting.view_ledger', 'accounting.view_reports', 
        'accounting.edit_coa', 'accounting.manual_entry',
        'registers.view', 'registers.close_period', 'registers.reopen_period',
        'directories.view', 'directories.edit',
        'taxes.view_reports', 'taxes.generate', 'taxes.submit', 'taxes.edit_draft',
        'admin.manage_users', 'admin.assign_roles', 'admin.manage_tenant',
    ],
    
    'ACCOUNTANT': [
        # Full accounting access, no admin
        'documents.view', 'documents.create', 'documents.edit_draft', 'documents.post',
        'accounting.view_ledger', 'accounting.view_reports', 
        'accounting.edit_coa', 'accounting.manual_entry',
        'registers.view', 'registers.close_period',
        'directories.view', 'directories.edit',
        'taxes.view_reports', 'taxes.generate', 'taxes.submit', 'taxes.edit_draft',
    ],
    
    'MANAGER': [
        # View reports, create/edit own documents
        'documents.view', 'documents.create', 'documents.edit_draft',
        'accounting.view_ledger', 'accounting.view_reports',
        'registers.view',
        'directories.view', 'directories.edit',
        'taxes.view_reports',
    ],
    
    'WAREHOUSE': [
        # Warehouse operations
        'documents.view', 'documents.create', 'documents.edit_draft',
        'registers.view',
        'directories.view',
    ],
    
    'VIEWER': [
        # Read-only access
        'documents.view',
        'accounting.view_ledger', 'accounting.view_reports',
        'registers.view',
        'directories.view',
        'taxes.view_reports',
    ],
}


class Command(BaseCommand):
    help = 'Seed permissions and assign to roles'

    def handle(self, *args, **options):
        self.stdout.write('Seeding permissions...')
        
        # Create permissions
        created_count = 0
        for code, name in PERMISSIONS:
            permission, created = Permission.objects.get_or_create(
                code=code,
                defaults={'name': name}
            )
            if created:
                created_count += 1
                self.stdout.write(f'  Created: {code}')
        
        self.stdout.write(
            self.style.SUCCESS(
                f'✅ Permissions: {created_count} created, {len(PERMISSIONS) - created_count} already exist'
            )
        )
        
        # Assign permissions to roles
        self.stdout.write('\nAssigning permissions to roles...')
        assigned_count = 0
        
        for role_code, permission_codes in ROLE_PERMISSIONS.items():
            roles = Role.objects.filter(code=role_code)
            
            if not roles.exists():
                self.stdout.write(
                    self.style.WARNING(
                        f'  ⚠️  No roles found with code "{role_code}". Skipping...'
                    )
                )
                continue
            
            for role in roles:
                role_assigned = 0
                for perm_code in permission_codes:
                    try:
                        permission = Permission.objects.get(code=perm_code)
                        _, created = RolePermission.objects.get_or_create(
                            role=role,
                            permission=permission
                        )
                        if created:
                            role_assigned += 1
                            assigned_count += 1
                    except Permission.DoesNotExist:
                        self.stdout.write(
                            self.style.ERROR(
                                f'  ❌ Permission "{perm_code}" not found!'
                            )
                        )
                
                self.stdout.write(
                    f'  {role.name} ({role.tenant}): {role_assigned} new permissions assigned'
                )
        
        self.stdout.write(
            self.style.SUCCESS(
                f'\n✅ Assigned {assigned_count} role-permission relationships'
            )
        )
        
        # Summary
        self.stdout.write('\n' + '='*50)
        self.stdout.write('SUMMARY:')
        for role_code, permission_codes in ROLE_PERMISSIONS.items():
            self.stdout.write(f'  {role_code}: {len(permission_codes)} permissions')
        self.stdout.write('='*50)
