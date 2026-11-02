# AGENTS — Visualizador de NF-e

Regras locais; valem também as diretrizes globais do Workbench.

## Escopo e stack

- `index.html`: estrutura e textos; `styles.css`: tokens e impressão; `app.js`: parse, estado e
  renderização; `config.js` / `supabase.js`: sessão; `sql/setup.sql`: registry.
- HTML, CSS e JavaScript nativos. Sem framework, bundler, dependência nova ou persistência.
- Manter o tema dark e usar as cores/tipografia/raios do DESIGN.md, inclusive na impressão.

## Segurança e privacidade

- XML é entrada não confiável. Nunca inserir valores do XML em `innerHTML` sem escapar; preferir
  `textContent` e criação de elementos.
- Não enviar nem persistir conteúdo do documento. O JSON exportado pode conter dados pessoais.
- Links extraídos do XML só podem ser abertos com esquema HTTP(S), em nova aba com `rel=noopener`.
- O exemplo embutido deve ser totalmente sintético.
- Não colocar credenciais privadas no cliente.

## Parse e interface

- Usar `DOMParser` nativo e validar raiz/dados essenciais antes de renderizar.
- Aceitar apenas raízes `NFe`/`nfeProc` e modelos 55/65.
- Preservar `cStat` e `xMotivo`; não assumir que todo protocolo significa autorização.
- Datas não devem ser deslocadas pelo fuso local.
- Interface sem sessão permanece oculta; tratar erros de leitura/parse com mensagem visível.
- Event listeners de elementos estáticos são registrados uma vez.
- Na impressão, manter os tokens do tema; mostrar todas as abas, sem depender da aba ativa.
- Recarregar limpa o documento; não usar localStorage, cookies ou banco para guardar XML.

## Registry e validação

- `sql/setup.sql` só insere/atualiza `applications` e insere `user_applications` com conflito
  tratado. Nunca recriar policies do registry.
- Ao concluir: `node --check app.js`; testar exemplo, XML inválido, status não autorizado,
  tentativa de injeção, exportação JSON, abas e impressão; registrar no CHANGELOG.
