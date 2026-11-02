/*
  app.js - Visualizador de NF-e

  Le o XML padrao SEFAZ (nfeProc ou NFe) de NF-e modelo 55 e NFC-e modelo 65,
  extrai os campos para um objeto e preenche a interface. Nada e enviado e nada
  e gravado: o arquivo e lido no navegador e descartado ao recarregar.
*/
(function () {
  'use strict';

  var FALLBACK = '\u2014';

  // Status conhecidos; 135 depende do tipo do evento e fica como alerta, nao cancelamento.
  var STATUS_TONE = {
    100: 'ok', 150: 'ok',
    101: 'err', 151: 'err', 155: 'err',
    110: 'err', 205: 'err', 301: 'err', 302: 'err',
    135: 'warn', 204: 'warn'
  };

  var MODALIDADE_FRETE = {
    0: 'Emitente',
    1: 'Destinatário',
    2: 'Terceiros',
    3: 'Próprio (remetente)',
    4: 'Próprio (destinatário)',
    9: 'Sem frete'
  };

  var state = { data: null, fileName: '' };
  var bound = false;

  function $(id) {
    return document.getElementById(id);
  }

  function init() {
    checkSession();
  }

  // ---------- Sessao (mesmo contrato das outras ferramentas) ----------

  function checkSession() {
    var client = getSupabaseClient();

    if (!client) {
      showBootError('Não foi possível validar a sessão. Verifique a conexão e recarregue.');
      return;
    }

    client.auth.getSession().then(function (result) {
      if (result.error || !result.data.session) {
        window.location.replace(CONFIG.PORTAL_URL);
        return;
      }

      revealApp();
      bindUI();

      client.auth.onAuthStateChange(function (event) {
        if (event === 'SIGNED_OUT') {
          window.location.replace(CONFIG.PORTAL_URL);
        }
      });
    }).catch(function (err) {
      console.error('Falha ao validar a sessão:', err);
      window.location.replace(CONFIG.PORTAL_URL);
    });
  }

  function revealApp() {
    $('boot').hidden = true;
    $('app').hidden = false;
  }

  function showBootError(message) {
    $('boot-text').textContent = message;
    $('boot-retry').hidden = false;
    $('boot-retry').addEventListener('click', function () {
      window.location.reload();
    }, { once: true });
  }

  // ---------- UI ----------

  function bindUI() {
    if (bound) return;
    bound = true;

    $('btn-open').addEventListener('click', openPicker);
    $('btn-sample').addEventListener('click', loadSample);
    $('btn-json').addEventListener('click', exportJson);
    $('btn-print').addEventListener('click', function () { window.print(); });
    $('btn-copy').addEventListener('click', copyKey);
    $('alert-close').addEventListener('click', hideAlert);

    $('file').addEventListener('change', function (event) {
      if (event.target.files && event.target.files[0]) readFile(event.target.files[0]);
      event.target.value = '';
    });

    var drop = $('drop');
    drop.addEventListener('click', openPicker);
    drop.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openPicker();
      }
    });

    ['dragenter', 'dragover'].forEach(function (name) {
      drop.addEventListener(name, function (event) {
        event.preventDefault();
        drop.classList.add('is-over');
      });
    });

    ['dragleave', 'drop'].forEach(function (name) {
      drop.addEventListener(name, function (event) {
        event.preventDefault();
        drop.classList.remove('is-over');
      });
    });

    drop.addEventListener('drop', function (event) {
      var files = event.dataTransfer && event.dataTransfer.files;
      if (files && files[0]) readFile(files[0]);
    });

    document.querySelectorAll('.tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        activateTab(tab.getAttribute('data-tab'));
      });
    });
  }

  function openPicker() {
    $('file').click();
  }

  function activateTab(name) {
    document.querySelectorAll('.tab').forEach(function (tab) {
      var active = tab.getAttribute('data-tab') === name;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    document.querySelectorAll('.panel').forEach(function (panel) {
      panel.hidden = panel.id !== 'panel-' + name;
    });
  }

  function showAlert(message) {
    $('alert-text').textContent = message;
    $('alert').hidden = false;
  }

  function hideAlert() {
    $('alert').hidden = true;
  }

  // ---------- Leitura do arquivo ----------

  function readFile(file) {
    if (!/\.xml$/i.test(file.name)) {
      showAlert('Selecione um arquivo .xml de NF-e ou NFC-e.');
      return;
    }

    var reader = new FileReader();

    reader.onload = function (event) {
      try {
        render(parseNfe(event.target.result), file.name);
      } catch (err) {
        showAlert(err.message);
      }
    };

    reader.onerror = function () {
      showAlert('Não foi possível ler o arquivo. Tente novamente.');
    };

    reader.readAsText(file, 'UTF-8');
  }

  function loadSample() {
    try {
      render(parseNfe(SAMPLE_XML), 'exemplo-nfe.xml');
    } catch (err) {
      showAlert('Falha no exemplo: ' + err.message);
    }
  }

  // ---------- Parse do XML ----------

  function parseNfe(xmlString) {
    var doc = new DOMParser().parseFromString(xmlString, 'text/xml');

    if (doc.querySelector('parsererror')) {
      throw new Error('O arquivo não é um XML válido.');
    }

    var rootName = doc.documentElement && doc.documentElement.localName;
    if (rootName !== 'nfeProc' && rootName !== 'NFe') {
      throw new Error('O XML precisa ter nfeProc ou NFe como elemento raiz.');
    }

    var infNFe = first(doc.documentElement, 'infNFe');
    var ide = first(infNFe, 'ide');
    var emit = first(infNFe, 'emit');

    if (!infNFe) {
      throw new Error('Este XML não é uma NF-e ou NFC-e: elemento infNFe não encontrado.');
    }
    if (!ide || !emit) {
      throw new Error('XML de NF-e incompleto: faltam os elementos ide ou emit.');
    }

    var infProt = first(first(doc, 'protNFe'), 'infProt');
    var chave = getTagValue(infProt, 'chNFe') ||
      (infNFe.getAttribute('Id') || '').replace(/^NFe/, '');

    var mod = getTagValue(ide, 'mod');
    if (mod !== '55' && mod !== '65') {
      throw new Error('Modelo de documento não suportado. São aceitos NF-e 55 e NFC-e 65.');
    }
    var modeloNome = mod === '65' ? 'NFC-e' : (mod === '55' ? 'NF-e' : 'Modelo ' + (mod || '?'));

    var emitEnder = first(emit, 'enderEmit');
    var dest = first(doc, 'dest');
    var destEnder = first(dest, 'enderDest');
    var total = first(doc, 'total');
    var icmsTot = first(total, 'ICMSTot');
    var ibsCbsTot = first(total, 'IBSCBSTot');
    var infAdic = first(doc, 'infAdic');
    var transp = first(doc, 'transp');
    var supl = first(doc, 'infNFeSupl');

    var itens = [];
    var dets = infNFe.getElementsByTagName('det');

    for (var i = 0; i < dets.length; i++) {
      var det = dets[i];
      var prod = first(det, 'prod');
      var imposto = first(det, 'imposto');
      var icmsNode = first(imposto, 'ICMS');
      var icmsChild = icmsNode && icmsNode.children.length ? icmsNode.children[0] : null;

      itens.push({
        nItem: det.getAttribute('nItem') || String(i + 1),
        cProd: getTagValue(prod, 'cProd'),
        xProd: getTagValue(prod, 'xProd'),
        NCM: getTagValue(prod, 'NCM'),
        CEST: getTagValue(prod, 'CEST'),
        CFOP: getTagValue(prod, 'CFOP'),
        uCom: getTagValue(prod, 'uCom'),
        qCom: getTagValue(prod, 'qCom'),
        vUnCom: getTagValue(prod, 'vUnCom'),
        vProd: getTagValue(prod, 'vProd'),
        cst: getTagValue(icmsChild, 'CST') || getTagValue(icmsChild, 'CSOSN')
      });
    }

    var pagamentos = [];
    var pagos = doc.getElementsByTagName('detPag');

    for (var j = 0; j < pagos.length; j++) {
      var dp = pagos[j];
      var tPag = getTagValue(dp, 'tPag');
      pagamentos.push({
        tPag: tPag,
        descricao: getTagValue(dp, 'xPag') || FORMAS_PAGAMENTO[tPag] || ('Forma ' + (tPag || '?')),
        vPag: getTagValue(dp, 'vPag'),
        dPag: getTagValue(dp, 'dPag')
      });
    }

    return {
      chave: chave,
      ide: {
        mod: mod,
        modeloNome: modeloNome,
        serie: getTagValue(ide, 'serie'),
        nNF: getTagValue(ide, 'nNF'),
        dhEmi: getTagValue(ide, 'dhEmi'),
        tpNF: getTagValue(ide, 'tpNF') === '0' ? 'Entrada' : 'Saída',
        tpAmb: getTagValue(ide, 'tpAmb') === '2' ? 'Homologação' : 'Produção',
        natOp: getTagValue(ide, 'natOp'),
        verProc: getTagValue(ide, 'verProc')
      },
      protocolo: {
        nProt: getTagValue(infProt, 'nProt'),
        dhRecbto: getTagValue(infProt, 'dhRecbto'),
        cStat: getTagValue(infProt, 'cStat'),
        xMotivo: getTagValue(infProt, 'xMotivo')
      },
      emitente: {
        nome: getTagValue(emit, 'xNome'),
        documento: formatDoc(getTagValue(emit, 'CNPJ') || getTagValue(emit, 'CPF')),
        ie: getTagValue(emit, 'IE'),
        logradouro: getTagValue(emitEnder, 'xLgr'),
        numero: getTagValue(emitEnder, 'nro'),
        bairro: getTagValue(emitEnder, 'xBairro'),
        municipio: getTagValue(emitEnder, 'xMun'),
        uf: getTagValue(emitEnder, 'UF'),
        cep: formatCep(getTagValue(emitEnder, 'CEP')),
        fone: formatFone(getTagValue(emitEnder, 'fone'))
      },
      destinatario: {
        nome: getTagValue(dest, 'xNome'),
        documento: formatDoc(getTagValue(dest, 'CNPJ') || getTagValue(dest, 'CPF')),
        email: getTagValue(dest, 'email'),
        ie: getTagValue(dest, 'IE'),
        municipio: getTagValue(destEnder, 'xMun'),
        uf: getTagValue(destEnder, 'UF')
      },
      itens: itens,
      totais: {
        vProd: getTagValue(icmsTot, 'vProd'),
        vFrete: getTagValue(icmsTot, 'vFrete'),
        vDesc: getTagValue(icmsTot, 'vDesc'),
        vNF: getTagValue(icmsTot, 'vNF'),
        vBC: getTagValue(icmsTot, 'vBC'),
        vICMS: getTagValue(icmsTot, 'vICMS'),
        vBCST: getTagValue(icmsTot, 'vBCST'),
        vST: getTagValue(icmsTot, 'vST'),
        vPIS: getTagValue(icmsTot, 'vPIS'),
        vCOFINS: getTagValue(icmsTot, 'vCOFINS'),
        vIPI: getTagValue(icmsTot, 'vIPI'),
        vTotTrib: getTagValue(icmsTot, 'vTotTrib'),
        vIBS: getTagValue(ibsCbsTot, 'vIBS'),
        vCBS: getTagValue(ibsCbsTot, 'vCBS'),
        vBCIBS: getTagValue(ibsCbsTot, 'vBCIBSCBS')
      },
      pagamentos: pagamentos,
      transporte: getTagValue(transp, 'modFrete'),
      consulta: {
        qrCode: getTagValue(supl, 'qrCode'),
        urlChave: getTagValue(supl, 'urlChave')
      },
      infAdic: getTagValue(infAdic, 'infCpl') || getTagValue(infAdic, 'infAdFisco')
    };
  }

  var FORMAS_PAGAMENTO = {
    '01': 'Dinheiro', '02': 'Cheque', '03': 'Cartão de crédito', '04': 'Cartão de débito',
    '05': 'Crédito loja', '10': 'Vale alimentação', '11': 'Vale refeição', '12': 'Vale presente',
    '13': 'Vale combustível', '14': 'Duplicata mercantil', '15': 'Boleto bancário',
    '16': 'Depósito bancário', '17': 'PIX', '18': 'Transferência / carteira digital',
    '19': 'Fidelidade / cashback', '90': 'Sem pagamento', '99': 'Outros'
  };

  // ---------- Render ----------

  function render(data, fileName) {
    state.data = data;
    state.fileName = fileName;

    hideAlert();
    $('empty').hidden = true;
    $('doc').hidden = false;
    $('btn-json').disabled = false;
    $('btn-print').disabled = false;

    $('file-chip').textContent = fileName;
    $('file-chip').hidden = false;

    var status = statusInfo(data.protocolo);
    $('pill-model').textContent = data.ide.modeloNome;
    $('pill-status').textContent = status.label;
    $('pill-status').className = 'pill' + (status.tone ? ' is-' + status.tone : '');
    $('hero-number').textContent = data.ide.nNF ? 'NF nº ' + data.ide.nNF : '';

    $('hero-emitter').textContent = orDash(data.emitente.nome);
    $('hero-client').textContent = orDash(data.destinatario.nome);
    $('hero-date').textContent = fmtDateTime(data.ide.dhEmi);
    $('hero-key').textContent = data.chave ? data.chave.slice(0, 18) + '...' : FALLBACK;
    $('hero-total').textContent = brl(data.totais.vNF);

    // Visao geral
    setText('emit-nome', data.emitente.nome);
    setText('emit-doc', data.emitente.documento);
    setText('emit-ie', data.emitente.ie);
    setText('emit-endereco', join([data.emitente.logradouro, data.emitente.numero], ', '));
    setText('emit-cidade', join([data.emitente.bairro, join([data.emitente.municipio, data.emitente.uf], '/')], ', '));
    setText('emit-cep', data.emitente.cep);
    setText('emit-fone', data.emitente.fone);

    setText('dest-nome', data.destinatario.nome);
    setText('dest-doc', data.destinatario.documento);
    setText('dest-email', data.destinatario.email);
    setText('dest-ie', data.destinatario.ie);
    setText('dest-cidade', data.destinatario.municipio
      ? join([data.destinatario.municipio, data.destinatario.uf], '/')
      : 'Presencial');

    renderPayments(data.pagamentos);
    setText('tot-prod', brl(data.totais.vProd));
    setText('tot-frete', brl(data.totais.vFrete));
    setText('tot-desc', brl(data.totais.vDesc));
    setText('tot-nf', brl(data.totais.vNF));

    setText('meta-modelo', data.ide.mod + ' / série ' + orDash(data.ide.serie));
    setText('meta-numero', data.ide.nNF);
    setText('meta-emissao', fmtDateTime(data.ide.dhEmi));
    setText('meta-operacao', data.ide.tpNF);
    setText('meta-natureza', data.ide.natOp);
    setText('meta-ambiente', data.ide.tpAmb);
    setText('meta-versao', data.ide.verProc);

    // Itens
    $('tab-item-count').textContent = String(data.itens.length);
    renderItems(data.itens);

    // Tributacao
    setText('trib-bc', brl(data.totais.vBC));
    setText('trib-icms', brl(data.totais.vICMS));
    setText('trib-bcst', brl(data.totais.vBCST));
    setText('trib-st', brl(data.totais.vST));
    setText('trib-total', brl(data.totais.vTotTrib));
    setText('trib-pis', brl(data.totais.vPIS));
    setText('trib-cofins', brl(data.totais.vCOFINS));
    setText('trib-ipi', brl(data.totais.vIPI));
    setText('trib-ibs', moneyOrDash(data.totais.vIBS));
    setText('trib-cbs', moneyOrDash(data.totais.vCBS));
    setText('trib-bcibs', moneyOrDash(data.totais.vBCIBS));

    // Protocolo
    setText('prot-numero', data.protocolo.nProt);
    setText('prot-data', fmtDateTime(data.protocolo.dhRecbto));
    setText('prot-status', data.protocolo.cStat
      ? data.protocolo.cStat + ' · ' + orDash(data.protocolo.xMotivo)
      : 'Sem protocolo de autorização');
    setText('prot-chave', data.chave);
    setText('prot-transporte', MODALIDADE_FRETE[data.transporte] || orDash(data.transporte));
    setText('prot-adicionais', data.infAdic);

    renderConsulta(data.consulta);

    activateTab('geral');
  }

  function renderPayments(pagamentos) {
    var box = $('payments');
    box.innerHTML = '';

    if (!pagamentos.length) {
      box.appendChild(row('Forma de pagamento', 'Não informada'));
      return;
    }

    pagamentos.forEach(function (pagamento) {
      box.appendChild(row(pagamento.descricao, brl(pagamento.vPag)));
    });
  }

  function row(label, value) {
    var el = document.createElement('div');
    el.className = 'row';

    var l = document.createElement('span');
    l.className = 'row-label';
    l.textContent = label;

    var v = document.createElement('span');
    v.className = 'row-value';
    v.textContent = value;

    el.appendChild(l);
    el.appendChild(v);
    return el;
  }

  function renderItems(itens) {
    var body = $('items-body');
    body.innerHTML = '';

    if (!itens.length) {
      var tr = document.createElement('tr');
      var td = document.createElement('td');
      td.colSpan = 7;
      td.textContent = 'Nenhum item no documento.';
      tr.appendChild(td);
      body.appendChild(tr);
      return;
    }

    itens.forEach(function (item) {
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td class="col-n">' + esc(item.nItem) + '</td>' +
        '<td class="mono">' + esc(item.cProd) + '</td>' +
        '<td><div class="item-name">' + esc(item.xProd) + '</div>' +
        '<div class="item-meta">' + itemMeta(item) + '</div></td>' +
        '<td class="col-un">' + esc(item.uCom) + '</td>' +
        '<td class="col-num">' + qty(item.qCom) + '</td>' +
        '<td class="col-num">' + brl(item.vUnCom) + '</td>' +
        '<td class="col-num item-total">' + brl(item.vProd) + '</td>';
      body.appendChild(tr);
    });
  }

  function itemMeta(item) {
    var parts = [];
    if (item.NCM) parts.push('NCM ' + esc(item.NCM));
    if (item.CFOP) parts.push('CFOP ' + esc(item.CFOP));
    if (item.CEST) parts.push('CEST ' + esc(item.CEST));
    if (item.cst) parts.push('CST ' + esc(item.cst));
    return parts.join(' &nbsp; ');
  }

  function renderConsulta(consulta) {
    var card = $('card-consulta');
    var link = $('consulta-link');
    var note = $('consulta-note');
    var qr = consulta.qrCode;
    var url = consulta.urlChave;
    var target = isHttp(url) ? url : (isHttp(qr) ? qr : '');

    if (!target && !qr) {
      card.hidden = true;
      return;
    }

    card.hidden = false;
    link.hidden = !target;
    if (target) link.href = target;

    note.textContent = isHttp(url)
      ? 'URL informada no XML. Antes de abrir, confira se o domínio pertence à SEFAZ.'
      : 'URL retirada do QR Code do documento. Confira o domínio antes de abrir.';
    $('consulta-qr').textContent = qr || '';
  }

  function statusInfo(protocolo) {
    if (!protocolo.cStat) return { tone: '', label: 'Sem protocolo' };
    return {
      tone: STATUS_TONE[protocolo.cStat] || 'warn',
      label: protocolo.xMotivo || ('cStat ' + protocolo.cStat)
    };
  }

  // ---------- Exportacao ----------

  function exportJson() {
    if (!state.data) return;

    var payload = {
      arquivo: state.fileName,
      geradoEm: new Date().toISOString(),
      ...state.data
    };

    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = 'nota-fiscal.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function copyKey() {
    if (!state.data || !state.data.chave) return;

    var button = $('btn-copy');
    var original = 'Copiar chave';

    navigator.clipboard.writeText(state.data.chave).then(function () {
      button.textContent = 'Copiado';
      setTimeout(function () { button.textContent = original; }, 1500);
    }).catch(function () {
      window.prompt('Copie a chave manualmente:', state.data.chave);
    });
  }

  // ---------- Helpers ----------

  function first(parent, tag) {
    return parent ? parent.getElementsByTagName(tag)[0] || null : null;
  }

  function getTagValue(parent, tag) {
    var el = first(parent, tag);
    return el ? el.textContent.trim() : '';
  }

  function setText(id, value) {
    $(id).textContent = orDash(value);
  }

  function orDash(value) {
    return value == null || value === '' ? FALLBACK : String(value);
  }

  function join(parts, separator) {
    var clean = parts.filter(function (part) { return part; });
    return clean.length ? clean.join(separator) : '';
  }

  function moneyOrDash(value) {
    return value === '' || value == null ? FALLBACK : brl(value);
  }

  function brl(value) {
    var number = parseFloat(value);
    if (isNaN(number)) return FALLBACK;
    return number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function qty(value) {
    var number = parseFloat(value);
    if (isNaN(number)) return FALLBACK;
    return number.toLocaleString('pt-BR', { maximumFractionDigits: 4 });
  }

  function fmtDateTime(iso) {
    var match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(iso || '');
    if (!match) return orDash(iso);
    return match[3] + '/' + match[2] + '/' + match[1] + ' ' + match[4] + ':' + match[5];
  }

  function formatDoc(value) {
    var clean = String(value || '').replace(/\D/g, '');
    if (clean.length === 14) return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    if (clean.length === 11) return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    return value || '';
  }

  function formatCep(value) {
    var clean = String(value || '').replace(/\D/g, '');
    return clean.length === 8 ? clean.replace(/(\d{5})(\d{3})/, '$1-$2') : (value || '');
  }

  function formatFone(value) {
    var clean = String(value || '').replace(/\D/g, '');
    if (clean.length === 11) return clean.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    if (clean.length === 10) return clean.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    return value || '';
  }

  function isHttp(value) {
    return /^https?:\/\//i.test(String(value || ''));
  }

  // Escapa o conteudo do XML antes de entrar em innerHTML: o arquivo e entrada
  // nao confiavel, mesmo sendo escolhido pelo proprio usuario.
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }

  // ---------- Exemplo sintetico ----------
  // Dados ficticios: nenhum nome, documento ou valor real.

  var SAMPLE_XML = '<?xml version="1.0" encoding="UTF-8"?>' +
    '<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">' +
    '<NFe><infNFe Id="NFe35261011222333000181550010000001231876543210" versao="4.00">' +
    '<ide><cUF>35</cUF><cNF>87654321</cNF><natOp>VENDA DE MERCADORIA</natOp><mod>55</mod>' +
    '<serie>1</serie><nNF>123</nNF><dhEmi>2026-10-14T09:32:00-03:00</dhEmi><tpNF>1</tpNF>' +
    '<idDest>1</idDest><cMunFG>3509502</cMunFG><tpImp>1</tpImp><tpEmis>1</tpEmis><cDV>0</cDV>' +
    '<tpAmb>1</tpAmb><finNFe>1</finNFe><indFinal>1</indFinal><indPres>9</indPres>' +
    '<procEmi>0</procEmi><verProc>Emissor Exemplo 1.0</verProc></ide>' +
    '<emit><CNPJ>11222333000181</CNPJ><xNome>ENERGIA SOLAR COMPONENTES LTDA</xNome>' +
    '<xFant>SOLAR COMPONENTES</xFant><enderEmit><xLgr>RUA DAS PLACAS</xLgr><nro>120</nro>' +
    '<xBairro>DISTRITO INDUSTRIAL</xBairro><cMun>3509502</cMun><xMun>Campinas</xMun>' +
    '<UF>SP</UF><CEP>13052000</CEP><cPais>1058</cPais><xPais>BRASIL</xPais><fone>1933334444</fone>' +
    '</enderEmit><IE>123456789012</IE><CRT>3</CRT></emit>' +
    '<dest><CNPJ>11444777000161</CNPJ><xNome>CONSTRUTORA HORIZONTE LTDA</xNome>' +
    '<enderDest><xLgr>AVENIDA CENTRAL</xLgr><nro>900</nro><xBairro>CENTRO</xBairro>' +
    '<cMun>3106200</cMun><xMun>Belo Horizonte</xMun><UF>MG</UF><CEP>30140071</CEP>' +
    '<cPais>1058</cPais><xPais>BRASIL</xPais></enderDest><indIEDest>9</indIEDest>' +
    '<IE>987654321</IE><email>compras@exemplo.com.br</email></dest>' +
    '<det nItem="1"><prod><cProd>MOD-550</cProd><cEAN>SEM GTIN</cEAN>' +
    '<xProd>MODULO FOTOVOLTAICO 550W MONOCRISTALINO</xProd><NCM>85414300</NCM>' +
    '<CEST>1709300</CEST><CFOP>5102</CFOP><uCom>UN</uCom><qCom>40.0000</qCom>' +
    '<vUnCom>850.0000000000</vUnCom><vProd>34000.00</vProd><cEANTrib>SEM GTIN</cEANTrib>' +
    '<uTrib>UN</uTrib><qTrib>40.0000</qTrib><vUnTrib>850.0000</vUnTrib><indTot>1</indTot></prod>' +
    '<imposto><vTotTrib>7280.00</vTotTrib><ICMS><ICMS00><orig>0</orig><CST>00</CST>' +
    '<modBC>3</modBC><vBC>34000.00</vBC><pICMS>18.0000</pICMS><vICMS>6120.00</vICMS>' +
    '</ICMS00></ICMS><IPI><cEnq>999</cEnq><IPITrib><CST>50</CST><vBC>0.00</vBC>' +
    '<pIPI>0.0000</pIPI><vIPI>0.00</vIPI></IPITrib></IPI><PIS><PISAliq><CST>01</CST>' +
    '<vBC>34000.00</vBC><pPIS>1.6500</pPIS><vPIS>561.00</vPIS></PISAliq></PIS>' +
    '<COFINS><COFINSAliq><CST>01</CST><vBC>34000.00</vBC><pCOFINS>7.6000</pCOFINS>' +
    '<vCOFINS>2584.00</vCOFINS></COFINSAliq></COFINS></imposto></det>' +
    '<det nItem="2"><prod><cProd>INV-50K</cProd><cEAN>SEM GTIN</cEAN>' +
    '<xProd>INVERSOR STRING TRIFASICO 50KW</xProd><NCM>85044090</NCM><CFOP>5102</CFOP>' +
    '<uCom>UN</uCom><qCom>2.0000</qCom><vUnCom>18500.0000000000</vUnCom>' +
    '<vProd>37000.00</vProd><cEANTrib>SEM GTIN</cEANTrib><uTrib>UN</uTrib><qTrib>2.0000</qTrib>' +
    '<vUnTrib>18500.0000</vUnTrib><indTot>1</indTot></prod>' +
    '<imposto><vTotTrib>7920.00</vTotTrib><ICMS><ICMS00><orig>0</orig><CST>00</CST>' +
    '<modBC>3</modBC><vBC>37000.00</vBC><pICMS>18.0000</pICMS><vICMS>6660.00</vICMS>' +
    '</ICMS00></ICMS><IPI><cEnq>999</cEnq><IPITrib><CST>50</CST><vBC>0.00</vBC>' +
    '<pIPI>0.0000</pIPI><vIPI>0.00</vIPI></IPITrib></IPI><PIS><PISAliq><CST>01</CST>' +
    '<vBC>37000.00</vBC><pPIS>1.6500</pPIS><vPIS>610.50</vPIS></PISAliq></PIS>' +
    '<COFINS><COFINSAliq><CST>01</CST><vBC>37000.00</vBC><pCOFINS>7.6000</pCOFINS>' +
    '<vCOFINS>2812.00</vCOFINS></COFINSAliq></COFINS></imposto></det>' +
    '<total><ICMSTot><vBC>71000.00</vBC><vICMS>12780.00</vICMS><vICMSDeson>0.00</vICMSDeson>' +
    '<vFCP>0.00</vFCP><vBCST>0.00</vBCST><vST>0.00</vST><vFCPST>0.00</vFCPST>' +
    '<vFCPSTRet>0.00</vFCPSTRet><vProd>71000.00</vProd><vFrete>1200.00</vFrete>' +
    '<vSeg>0.00</vSeg><vDesc>500.00</vDesc><vII>0.00</vII><vIPI>0.00</vIPI>' +
    '<vIPIDevol>0.00</vIPIDevol><vPIS>1171.50</vPIS><vCOFINS>5396.00</vCOFINS>' +
    '<vOutro>0.00</vOutro><vNF>71700.00</vNF><vTotTrib>15200.00</vTotTrib></ICMSTot>' +
    '<IBSCBSTot><vBCIBSCBS>71000.00</vBCIBSCBS><vIBS>0.00</vIBS><vCBS>0.00</vCBS></IBSCBSTot>' +
    '</total>' +
    '<transp><modFrete>0</modFrete><transporta><CNPJ>22333444000155</CNPJ>' +
    '<xNome>TRANSPORTES RAPIDO SUL LTDA</xNome><xMun>Campinas</xMun><UF>SP</UF></transporta>' +
    '</transp>' +
    '<pag><detPag><indPag>0</indPag><tPag>17</tPag><vPag>35850.00</vPag>' +
    '<dPag>2026-10-14</dPag></detPag><detPag><indPag>1</indPag><tPag>15</tPag>' +
    '<vPag>35850.00</vPag><dPag>2026-11-14</dPag></detPag></pag>' +
    '<infAdic><infCpl>Pedido de compra 2026/0142. Entrega na obra: Av. Central, 900 - Belo Horizonte/MG.</infCpl></infAdic>' +
    '<infRespTec><CNPJ>11222333000181</CNPJ><xContato>Suporte Fiscal</xContato>' +
    '<email>suporte@exemplo.com.br</email><fone>1933334444</fone></infRespTec>' +
    '</infNFe></NFe>' +
    '<protNFe versao="4.00"><infProt><tpAmb>1</tpAmb><verAplic>SP_NFE_PL_010_V400</verAplic>' +
    '<chNFe>35261011222333000181550010000001231876543210</chNFe>' +
    '<dhRecbto>2026-10-14T09:32:07-03:00</dhRecbto><nProt>135260000000001</nProt>' +
    '<digVal>0000000000000000000000000000</digVal><cStat>100</cStat>' +
    '<xMotivo>Autorizado o uso da NF-e</xMotivo></infProt></protNFe>' +
    '</nfeProc>';

  init();
})();
