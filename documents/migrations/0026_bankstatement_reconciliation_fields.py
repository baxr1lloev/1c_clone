# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('documents', '0025_paymentdocument_bank_operation_type'),
    ]

    operations = [
        migrations.AddField(
            model_name='bankstatement',
            name='accounting_balance_difference',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=15, verbose_name='Accounting Balance Difference'),
        ),
        migrations.AddField(
            model_name='bankstatement',
            name='is_balanced',
            field=models.BooleanField(default=True, verbose_name='Is Balanced'),
        ),
        migrations.AddField(
            model_name='bankstatement',
            name='source',
            field=models.CharField(choices=[('manual', 'Manual'), ('imported', 'Imported')], default='manual', max_length=20, verbose_name='Source'),
        ),
    ]
