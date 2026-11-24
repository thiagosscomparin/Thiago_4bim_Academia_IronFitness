// pagamento.js - Tela de pagamentos (conversa com /pagamento/... no servidor)
let idEmEdicao = null; // null = cadastrando
let matriculas = [];
const $ = (id) => document.getElementById(id);
const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
function opcao(valor, texto) { const o = document.createElement('option'); o.value = valor; o.textContent = texto; return o; }

const BADGE = { PENDENTE: 'status-warn', ATRASADO: 'status-off', PAGO: 'status-ok', ESTORNADO: 'status-off' };
const ROTULO = { PENDENTE: 'Pendente', ATRASADO: 'Atrasado', PAGO: 'Pago', ESTORNADO: 'Estornado' };

// ---------- Lista ----------
async function carregarPagamentos() {
  try {
    const params = new URLSearchParams({ busca: $('busca').value.trim(), situacao: $('filtroSituacao').value });
    const { pagamentos } = await requisicaoAPI('/pagamento/listar?' + params);
    preencherTabelaCrud('tbPagamentos', pagamentos.map((p) => {
      const aberto = p.situacao === 'PENDENTE' || p.situacao === 'ATRASADO';
      const botoes = [];
      if (aberto) {
        botoes.push({ texto: 'Pix', classe: 'btn-secondary', aoClicar: () => mostrarPix(p) });
        botoes.push({ texto: 'Marcar como pago', classe: '', aoClicar: () => marcarPago(p) });
        botoes.push({ texto: 'Editar', classe: 'btn-secondary', aoClicar: () => abrirEdicao(p.id_pagamento) });
        botoes.push({ texto: 'Excluir', classe: 'btn-danger', aoClicar: () => excluir(p) });
      } else if (p.situacao === 'PAGO') {
        botoes.push({ texto: 'Estornar', classe: 'btn-danger', aoClicar: () => estornar(p) });
      }
      return [
        p.nome_pessoa, p.nome_plano, { texto: moeda.format(p.valor_pagamento), classe: 'valor' }, p.forma, p.data,
        { etiquetas: [{ texto: ROTULO[p.situacao], classe: BADGE[p.situacao] }] },
        botoes.length ? { botoes } : '—'
      ];
    }), 7, 'Nenhum pagamento encontrado.');
  } catch (erro) { mostrarToast(erro.message, 'error'); }
}

// ---------- Formulário ----------
function sugerirValor() {
  const m = matriculas.find((x) => String(x.id_matricula) === $('matricula').value);
  if (!m) { $('dicaMatricula').textContent = ' '; return; }
  const restante = Math.max(0, Math.round((m.valor_plano - m.registrado) * 100) / 100);
  const quitada = restante === 0;
  $('dicaMatricula').textContent = quitada
    ? `Esta matrícula já está quitada: o plano (${moeda.format(m.valor_plano)}) está totalmente registrado.`
    : `Plano: ${moeda.format(m.valor_plano)} · já registrado: ${moeda.format(m.registrado)} · restante: ${moeda.format(restante)}`;
  // Ao cadastrar, o valor sugerido é o que falta pagar (e fica vazio se a matrícula já está quitada)
  if (idEmEdicao === null) $('valor').value = quitada ? '' : restante.toFixed(2);
}

async function preencherListas() {
  const [m, f] = await Promise.all([requisicaoAPI('/pagamento/matriculas'), requisicaoAPI('/pagamento/formas')]);
  matriculas = m.matriculas;
  $('matricula').replaceChildren(opcao('', 'Selecione...'),
    ...matriculas.map((x) => opcao(x.id_matricula, `${x.nome_pessoa} · ${x.nome_plano} · início ${x.inicio}`)));
  $('forma').replaceChildren(opcao('', 'Selecione...'), ...f.formas.map((x) => opcao(x.id_forma_pagamento, x.nome_forma_pagamento)));
}

async function abrirNovo() {
  try {
    idEmEdicao = null;
    $('formPagamento').reset();
    $('erroForm').hidden = true;
    $('tituloModal').textContent = 'Novo pagamento';
    $('blocoStatus').hidden = false;
    $('dicaMatricula').textContent = ' ';
    await preencherListas();
    abrirModal('modalPagamento');
  } catch (erro) { mostrarToast(erro.message, 'error'); }
}

async function abrirEdicao(id) {
  try {
    const { pagamento: p } = await requisicaoAPI('/pagamento/' + id);
    idEmEdicao = p.id_pagamento;
    $('formPagamento').reset();
    $('erroForm').hidden = true;
    $('tituloModal').textContent = 'Editar pagamento';
    $('blocoStatus').hidden = true; // a situação muda pelos botões da lista
    await preencherListas();
    $('matricula').value = p.matricula_id_matricula;
    $('forma').value = p.forma_pagamento_id_forma_pagamento;
    $('valor').value = p.valor_pagamento;
    sugerirValor();
    abrirModal('modalPagamento');
  } catch (erro) { mostrarToast(erro.message, 'error'); }
}

async function salvar(evento) {
  evento.preventDefault();
  const corpo = { matriculaId: $('matricula').value, formaId: $('forma').value, valor: $('valor').value, status: $('status').value };
  $('btnSalvar').disabled = true;
  try {
    const editando = idEmEdicao !== null;
    const dados = await requisicaoAPI(editando ? '/pagamento/' + idEmEdicao : '/pagamento', {
      method: editando ? 'PUT' : 'POST', body: JSON.stringify(corpo)
    });
    fecharModal('modalPagamento');
    mostrarToast(dados.mensagem);
    await carregarPagamentos();
  } catch (erro) {
    $('erroForm').textContent = erro.message;
    $('erroForm').hidden = false;
  } finally { $('btnSalvar').disabled = false; }
}

// ---------- Ações da lista ----------
async function marcarPago(p) {
  if (!(await confirmarAcao(`Confirmar o recebimento de ${moeda.format(p.valor_pagamento)} de ${p.nome_pessoa}?`, 'Confirmar'))) return;
  try {
    const dados = await requisicaoAPI('/pagamento/' + p.id_pagamento + '/pagar', { method: 'PATCH' });
    mostrarToast(dados.mensagem);
    await carregarPagamentos();
  } catch (erro) { mostrarToast(erro.message, 'error'); }
}

async function estornar(p) {
  if (!(await confirmarAcao(`Estornar o pagamento de ${moeda.format(p.valor_pagamento)} de ${p.nome_pessoa}?`, 'Estornar'))) return;
  try {
    const dados = await requisicaoAPI('/pagamento/' + p.id_pagamento + '/estornar', { method: 'PATCH' });
    mostrarToast(dados.mensagem);
    await carregarPagamentos();
  } catch (erro) { mostrarToast(erro.message, 'error'); }
}

async function excluir(p) {
  if (!(await confirmarAcao(`Excluir o pagamento pendente de ${p.nome_pessoa}?`, 'Excluir'))) return;
  try {
    const dados = await requisicaoAPI('/pagamento/' + p.id_pagamento, { method: 'DELETE' });
    mostrarToast(dados.mensagem);
    await carregarPagamentos();
  } catch (erro) { mostrarToast(erro.message, 'error'); }
}

// ---------- Pix ----------
async function mostrarPix(p) {
  try {
    const dados = await requisicaoAPI('/pagamento/' + p.id_pagamento + '/pix');
    $('pixValor').textContent = `${p.nome_pessoa} · ${moeda.format(dados.valor)}`;
    $('pixQr').src = dados.qrcode;
    $('pixCodigo').value = dados.payload;
    abrirModal('modalPix');
  } catch (erro) { mostrarToast(erro.message, 'error'); }
}

async function copiarCodigo() {
  try {
    await navigator.clipboard.writeText($('pixCodigo').value);
    mostrarToast('Código Pix copiado.');
  } catch (e) {
    $('pixCodigo').select(); // se o navegador bloquear, deixa selecionado para Ctrl+C
    mostrarToast('Selecione e copie o código manualmente (Ctrl+C).', 'error');
  }
}

$('btnNovo').addEventListener('click', abrirNovo);
$('btnCancelar').addEventListener('click', () => fecharModal('modalPagamento'));
$('formPagamento').addEventListener('submit', salvar);
$('matricula').addEventListener('change', sugerirValor);
$('btnCopiar').addEventListener('click', copiarCodigo);
$('btnFecharPix').addEventListener('click', () => fecharModal('modalPix'));
$('busca').addEventListener('input', atrasar(carregarPagamentos));
$('filtroSituacao').addEventListener('change', carregarPagamentos);

(async () => {
  const usuario = await exigirSessao(['gerente']);
  if (!usuario) return;
  preencherMenuUsuario(usuario);
  await carregarPagamentos();
})();