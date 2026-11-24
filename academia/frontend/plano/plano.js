// plano.js - Tela de cadastro de planos (conversa com /plano/... no servidor)
let idEmEdicao = null; // null = cadastrando
const $ = (id) => document.getElementById(id);
const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function textoAulas(n) {
  if (n === null) return 'Ilimitadas';
  return n === 0 ? 'Não incluídas' : 'Até ' + n + ' por semana';
}

async function carregarPlanos() {
  try {
    const { planos } = await requisicaoAPI('/plano/listar');
    preencherTabelaCrud('tbPlanos', planos.map((p) => [
      p.nome_plano,
      { texto: moeda.format(p.valor_plano), classe: 'valor' },
      p.duracao_meses_plano + (p.duracao_meses_plano === 1 ? ' mês' : ' meses'),
      textoAulas(p.aulas_semana_plano),
      String(p.matriculas),
      { etiquetas: [p.ativo_plano ? { texto: 'Ativo', classe: 'status-ok' } : { texto: 'Inativo', classe: 'status-off' }] },
      { botoes: [
        { texto: 'Editar', classe: 'btn-secondary', aoClicar: () => abrirEdicao(p.id_plano) },
        { texto: p.ativo_plano ? 'Desativar' : 'Ativar', classe: 'btn-secondary', aoClicar: () => alterarAtivo(p) },
        { texto: 'Excluir', classe: 'btn-danger', aoClicar: () => excluirPlano(p) }
      ] }
    ]), 7, 'Nenhum plano cadastrado.');
  } catch (erro) { mostrarToast(erro.message, 'error'); }
}

function abrirNovo() {
  idEmEdicao = null;
  $('formPlano').reset();
  $('erroForm').hidden = true;
  $('tituloModal').textContent = 'Novo plano';
  abrirModal('modalPlano');
  $('nome').focus();
}

async function abrirEdicao(id) {
  try {
    const { plano: p } = await requisicaoAPI('/plano/' + id);
    idEmEdicao = p.id_plano;
    $('formPlano').reset();
    $('erroForm').hidden = true;
    $('tituloModal').textContent = 'Editar plano';
    $('nome').value = p.nome_plano;
    $('descricao').value = p.descricao_plano || '';
    $('valor').value = p.valor_plano;
    $('duracao').value = p.duracao_meses_plano;
    $('aulasSemana').value = p.aulas_semana_plano === null ? '' : p.aulas_semana_plano;
    abrirModal('modalPlano');
  } catch (erro) { mostrarToast(erro.message, 'error'); }
}

async function salvar(evento) {
  evento.preventDefault();
  const corpo = {
    nome: $('nome').value.trim(), descricao: $('descricao').value.trim(), valor: $('valor').value,
    duracao: $('duracao').value, aulasSemana: $('aulasSemana').value
  };
  $('btnSalvar').disabled = true;
  try {
    const editando = idEmEdicao !== null;
    const dados = await requisicaoAPI(editando ? '/plano/' + idEmEdicao : '/plano', {
      method: editando ? 'PUT' : 'POST', body: JSON.stringify(corpo)
    });
    fecharModal('modalPlano');
    mostrarToast(dados.mensagem);
    await carregarPlanos();
  } catch (erro) {
    $('erroForm').textContent = erro.message;
    $('erroForm').hidden = false;
  } finally { $('btnSalvar').disabled = false; }
}

async function alterarAtivo(p) {
  const acao = p.ativo_plano ? 'Desativar' : 'Ativar';
  if (!(await confirmarAcao(`${acao} o plano "${p.nome_plano}"?`, acao))) return;
  try {
    const dados = await requisicaoAPI('/plano/' + p.id_plano + '/ativo', { method: 'PATCH', body: JSON.stringify({ ativo: !p.ativo_plano }) });
    mostrarToast(dados.mensagem);
    await carregarPlanos();
  } catch (erro) { mostrarToast(erro.message, 'error'); }
}

async function excluirPlano(p) {
  if (!(await confirmarAcao(`Excluir o plano "${p.nome_plano}"? Essa ação não pode ser desfeita.`, 'Excluir'))) return;
  try {
    const dados = await requisicaoAPI('/plano/' + p.id_plano, { method: 'DELETE' });
    mostrarToast(dados.mensagem);
    await carregarPlanos();
  } catch (erro) { mostrarToast(erro.message, 'error'); }
}

$('btnNovo').addEventListener('click', abrirNovo);
$('btnCancelar').addEventListener('click', () => fecharModal('modalPlano'));
$('formPlano').addEventListener('submit', salvar);

(async () => {
  const usuario = await exigirSessao(['gerente']);
  if (!usuario) return;
  preencherMenuUsuario(usuario);
  await carregarPlanos();
})();