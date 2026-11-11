import uuid

from django.db import migrations, models
import django.db.models.deletion


def enable_rls(apps, schema_editor):
    if schema_editor.connection.vendor == 'postgresql':
        # No anon/authenticated policy: only the trusted backend DB role can read.
        schema_editor.execute('ALTER TABLE dashboards_pythondashboarddataset ENABLE ROW LEVEL SECURITY')


class Migration(migrations.Migration):
    dependencies = [
        ('dashboards', '0002_alter_dashboard_embed_url_and_more'),
        ('tenants', '0004_tenant_join_code'),
    ]
    operations = [
        migrations.CreateModel(
            name='PythonDashboardDataset',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('data', models.JSONField()),
                ('tenant', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='python_dashboard_dataset', to='tenants.tenant')),
            ],
            options={'abstract': False},
        ),
        migrations.RunPython(enable_rls, migrations.RunPython.noop),
    ]
