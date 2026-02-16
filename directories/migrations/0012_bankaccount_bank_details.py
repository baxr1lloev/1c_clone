# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("directories", "0011_cashflowitem"),
    ]

    operations = [
        migrations.AddField(
            model_name="bankaccount",
            name="bik",
            field=models.CharField(blank=True, help_text="Bank Identification Code", max_length=20, verbose_name="BIK"),
        ),
        migrations.AddField(
            model_name="bankaccount",
            name="correspondent_account",
            field=models.CharField(blank=True, max_length=50, verbose_name="Correspondent Account"),
        ),
        migrations.AddField(
            model_name="bankaccount",
            name="swift_code",
            field=models.CharField(blank=True, max_length=20, verbose_name="SWIFT Code"),
        ),
    ]
