import apps.tenants.models
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tenants', '0003_tenant_support_hours_consumed_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='tenant',
            name='join_code',
            field=models.CharField(blank=True, db_index=True, max_length=20, unique=True),
        ),
    ]
