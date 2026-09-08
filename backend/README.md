# Backend InsightHub

Documentação principal:

- ver o `README.md` na raiz do repositório

Comandos locais:

```bash
pip install -r requirements.txt
python manage.py migrate --settings=config.settings.dev
python manage.py runserver --settings=config.settings.dev
python manage.py check
python manage.py test
```

Observações:

- produção deve usar `config.settings.prod`
- `seed_demo` é apenas para demonstração local
- a integração Power BI em produção exige credenciais reais e variáveis de ambiente preenchidas
