# PRD — Visualizador de NF-e

**Slug:** `visualizador-nfe` · **Categoria:** Financeiro · **URL:**
`https://allanuchoa.github.io/visualizador-nfe/`

## Objetivo

Ler um XML de NF-e modelo 55 ou NFC-e modelo 65 no navegador e apresentar os principais dados
em seções navegáveis. O arquivo não é enviado nem armazenado.

## Usuário e fluxo

1. Acesso pelo portal → bridge valida sessão → ferramenta aparece.
2. Usuário escolhe um XML ou arrasta para a área de entrada.
3. A ferramenta valida o XML, extrai os campos e mostra quatro abas: visão geral, itens,
   tributação, protocolo e adicionais.
4. Usuário pode copiar a chave, exportar os dados estruturados em JSON, abrir consulta da SEFAZ
  quando o XML fornece uma URL HTTP(S), ou imprimir/salvar PDF.

## Escopo inicial

- NF-e (modelo 55) e NFC-e (modelo 65) autorizadas, além de documentos com protocolo cancelado,
  denegado ou ausente, com status apresentado conforme o código de retorno.
- Identificação de emitente e destinatário, dados da operação, produtos, totais, tributos,
  pagamentos, transporte, protocolo, informações adicionais e dados de consulta presentes no XML.
- Exemplo sintético, sem dados pessoais reais.
- Importação individual, arrastar/soltar, copiar chave, exportação JSON e impressão.
- Interface escura alinhada estritamente aos tokens do DESIGN.md.

## Fora de escopo

- Lote de arquivos, persistência, OCR, validação de assinatura digital e consulta automática
  a serviços da SEFAZ.
- Cálculo ou validação fiscal: os valores são exibidos conforme declarados no XML.
- Geração de imagem QR por serviço externo, pois enviaria dados do documento a terceiros.

## Aceitação

- XML inválido, XML de outro documento e XML de NF-e incompleto produzem mensagem visível,
  preservando a interface.
- Apenas raízes `NFe`/`nfeProc` com modelo 55 ou 65 são aceitas.
- Campos vindos do XML são tratados como texto não confiável; não executam HTML ou scripts.
- Status conhecido não aparece como autorizado quando o código indica cancelamento ou denegação.
- Datas preservam os componentes locais do XML, sem conversão pelo fuso do computador.
- Arquivo de exemplo não contém nome, e-mail, CPF/CNPJ ou valores reais do usuário.
- Imprimir inclui todas as seções da nota, independentemente da aba aberta.
- Em largura móvel de 390px, a página não ganha overflow horizontal; tabelas podem rolar
  internamente.

O conteúdo do QR Code do XML é exibido como texto e a URL contida no documento pode ser aberta
pelo usuário após conferir o domínio. Não gerar imagem QR por serviço remoto, pois isso enviaria
dados do documento a terceiros.
