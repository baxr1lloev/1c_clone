# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("documents", "0023_merge_0012_bankstatementline_0022_salesdocument"),
    ]

    operations = [
        migrations.AddField(
            model_name="bankstatementline",
            name="operation_type",
            field=models.CharField(
                blank=True,
                choices=[
                    ("CUSTOMER_PAYMENT", "Customer Payment"),
                    ("SUPPLIER_PAYMENT", "Supplier Payment"),
                    ("TAX_PAYMENT", "Tax Payment"),
                    ("BANK_FEE", "Bank Fee"),
                    ("TRANSFER_INTERNAL", "Internal Transfer"),
                    ("SALARY_PAYMENT", "Salary Payment"),
                    ("LOAN_RETURN", "Loan Return"),
                ],
                max_length=30,
                verbose_name="Operation Type",
            ),
        ),
    ]
