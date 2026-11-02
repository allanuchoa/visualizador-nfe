# Visualizador de NF-e

Ferramenta estática do **Allan Workbench** para leitura local de XML de NF-e (modelo 55) e
NFC-e (modelo 65). O arquivo é processado no navegador; não é enviado nem armazenado.

## Rodar localmente

```bash
python -m http.server 8000
# abra http://localhost:8000
```

Para usar o SSO localmente, sirva o portal e a ferramenta no mesmo origin e ajuste `PORTAL_URL`
em `config.js` sem commitar a mudança. Para validar apenas a interface, substitua
temporariamente a chamada `checkSession()` em `app.js` por `revealApp(); bindUI();`.

## Estrutura

```text
index.html                    interface e estado inicial
styles.css                    tokens do DESIGN.md, responsividade e impressão
app.js                        leitura XML, renderização e exportação JSON
config.js                     configuração pública do Supabase e URL do portal
supabase.js                   client Supabase com sessão compartilhada
.github/workflows/deploy.yml  deploy do GitHub Pages
docs/                         PRD, regras locais e histórico
sql/setup.sql                 registro idempotente no registry do portal
```

Sem framework, bundler ou dependências de runtime além do SDK Supabase via CDN e das fontes.

## Deploy e portal

Em conta GitHub Free, o repositório precisa estar público para servir GitHub Pages. Ao tornar o
repo público, habilite Pages com GitHub Actions em Settings → Pages e execute manualmente o
workflow **Deploy to GitHub Pages**. O workflow não publica enquanto o repo é privado.

Para registrar o card **Visualizador de NF-e**, execute `sql/setup.sql` no SQL Editor do
Supabase. O script só insere/atualiza o registro da ferramenta e a associação do usuário; não
recria policies do registry.

## Privacidade

O XML selecionado é lido com `FileReader` e analisado com `DOMParser` no cliente. Não há upload,
persistência ou consulta externa automática. A URL presente no XML só é aberta quando acionada
pelo usuário; confira o domínio antes. O JSON exportado contém os dados extraídos do documento,
incluindo dados pessoais se existirem no XML.
