import random
import string

from django.db import migrations, models


def _generate_code(name: str) -> str:
    prefix = ''.join(c for c in name.upper().split()[0] if c.isalnum())[:6]
    suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
    return f'{prefix}-{suffix}'


def populate_join_codes(apps, schema_editor):
    Tenant = apps.get_model('tenants', 'Tenant')
    used = set()
    for tenant in Tenant.objects.all():
        if not tenant.join_code:
            code = _generate_code(tenant.name)
            while code in used or Tenant.objects.filter(join_code=code).exists():
                code = _generate_code(tenant.name)
            tenant.join_code = code
            used.add(code)
            tenant.save(update_fields=['join_code'])


class Migration(migrations.Migration):

    dependencies = [
        ('tenants', '0003_tenant_support_hours_consumed_and_more'),
    ]

    operations = [
        # 1. Add the field without unique constraint first
        migrations.AddField(
            model_name='tenant',
            name='join_code',
            field=models.CharField(blank=True, max_length=20, default=''),
            preserve_default=False,
        ),
        # 2. Populate existing rows
        migrations.RunPython(populate_join_codes, migrations.RunPython.noop),
        # 3. Now add unique + index
        migrations.AlterField(
            model_name='tenant',
            name='join_code',
            field=models.CharField(blank=True, db_index=True, max_length=20, unique=True),
        ),
    ]
