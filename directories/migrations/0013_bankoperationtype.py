# Generated manually

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounting', '0011_accountingentry_cash_flow_item'),
        ('directories', '0012_bankaccount_bank_details'),
    ]

    operations = [
        migrations.CreateModel(
            name='BankOperationType',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('code', models.CharField(max_length=50, verbose_name='Code')),
                ('name', models.CharField(max_length=255, verbose_name='Name')),
                ('requires_counterparty', models.BooleanField(default=False)),
                ('requires_contract', models.BooleanField(default=False)),
                ('requires_tax', models.BooleanField(default=False)),
                ('auto_create_payment', models.BooleanField(default=True)),
                ('is_active', models.BooleanField(default=True)),
                ('credit_account', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='bank_operation_types_credit', to='accounting.chartofaccounts')),
                ('debit_account', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='bank_operation_types_debit', to='accounting.chartofaccounts')),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='bank_operation_types', to='tenants.tenant')),
            ],
            options={
                'verbose_name': 'Bank Operation Type',
                'verbose_name_plural': 'Bank Operation Types',
                'ordering': ['code'],
                'unique_together': {('tenant', 'code')},
            },
        ),
    ]
