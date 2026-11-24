// matricula.js - Tela de matrículas (conversa com /matricula/... no servidor)
let idEmEdicao = null; // null = cadastrando
let planosPorId = {};  // id -> { duracao } (para calcular o vencimento sugerido)
const $ = (id) => document.getElementById(id);
function opcao(valor, texto) { const o = document.createElement('option'); o.value = valor; o.textContent = texto; return o; }
const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const BADGE = { ATIVA: 'status-ok', PENDENTE: 'status-warn', VENCIDA: 'status-off', CANCELADA: 'status-off' };
const ROTULO = { ATIVA: 'Ativa', PENDENTE: 'Pendente', VENCIDA: 'Vencida', CANCELADA: 'Cancelada' };

// ---------- Lista ----------
async function carregarMatriculas() {
  try {
    const params = new URLSearchParams({ busca: $('busca').value.trim(), situacao: $('filtroSituacao').value });
    const { matriculas } = await requisicaoAPI('/matricula/listar?' + params);
    preencherTabelaCrud('tbMatriculas', matriculas.map((m) => [
      m.nome_pessoa, m.nome_plano, m.inicio, m.vencimento,
      { etiquetas: [{ texto: ROTULO[m.situacao], classe: BADGE[m.situacao] }] },
      { botoes: [
        { texto: 'Editar', classe: 'btn-secondary', aoClicar: () => abrirEdicao(m.id_matricula) },
        ...(m.situacao === 'CANCELADA' ? [] : [{ texto: 'Cancelar', classe: 'btn-secondary', aoClicar: () => cancelar(m) }]),
        { texto: 'Excluir', classe: 'btn-danger', aoClicar: () => excluir(m) }
      ] }
    ]), 6, 'Nenhuma matrícula encontrada.');
  } catch (erro) { mostrarToast(erro.message, 'error'); }
}

// ---------- Vencimento sugerido: início + duração do plano - 1 dia ----------
function calcularVencimento(dataIso, meses) {
  const [a, m, d] = dataIso.split('-').map(Number);
  const ultimoDiaDoMesAlvo = new Date(a, m - 1 + meses + 1, 0).getDate();
  const fim = new Date(a, m - 1 + meses, Math.min(d, ultimoDiaDoMesAlvo));
  fim.setDate(fim.getDate() - 1);
  return fim.getFullYear() + '-' + String(fim.getMonth() + 1).padStart(2, '0') + '-' + String(fim.getDate()).padStart(2, '0');
}

function sugerirVencimento() {
  const plano = planosPorId[$('plano').value];
  if (plano && $('inicio').value) $('fim').value = calcularVencimento($('inicio').value, plano.duracao);
}

// ---------- Formulário ----------
async function preencherPlanos(extra) {
  const { planos } = await requisicaoAPI('/matricula/planos');
  planosPorId = {};
  const lista = [...planos];
  // Na edição, o plano atual pode estar inativo: mantém ele na lista
  if (extra && !lista.some((p) => p.id_plano === extra.plano_id_plano)) {
    lista.push({ id_plano: extra.plano_id_plano, nome_plano: extra.nome_plano + ' (inativo)', valor_plano: extra.valor_plano, duracao_meses_plano: extra.duracao_meses_plano });
  }
  lista.forEach((p) => { planosPorId[p.id_plano] = { duracao: p.duracao_meses_plano }; });
  $('plano').replaceChildren(opcao('', 'Selecione...'), ...lista.map((p) => opcao(p.id_plano, `${p.nome_plano} · ${moeda.format(p.valor_plano)}`)));
}

async function abrirNova() {
  try {
    idEmEdicao = null;
    $('formMatricula').reset();
    $('erroForm').hidden = true;
    $('tituloModal').textContent = 'Nova matrícula';
    const { alunos } = await requisicaoAPI('/matricula/alunos');
    $('aluno').replaceChildren(opcao('', 'Selecione...'), ...alunos.map((a) => opcao(a.cpf, a.nome_pessoa + ' · ' + a.cpf)));
    $('aluno').disabled = false;
    await preencherPlanos(null);
    $('inicio').value = new Date().toLocaleDateString('en-CA'); // hoje, formato AAAA-MM-DD
    $('status').value = 'ATIVA';
    abrirModal('modalMatricula');
  } catch (erro) { mostrarToast(erro.message, 'error'); }
}

async function abrirEdicao(id) {
  try {
    const { matricula: m } = await requisicaoAPI('/matricula/' + id);
    idEmEdicao = m.id_matricula;
    $('formMatricula').reset();
    $('erroForm').hidden = true;
    $('tituloModal').textContent = 'Editar matrícula';
    $('aluno').replaceChildren(opcao(m.cpf, m.nome_pessoa + ' · ' + m.cpf));
    $('aluno').disabled = true; // o aluno não muda
    await preencherPlanos(m);
    $('plano').value = m.plano_id_plano;
    $('inicio').value = m.data_inicio;
    $('fim').value = m.data_fim;
    $('status').value = m.status_matricula === 'VENCIDA' ? 'ATIVA' : m.status_matricula;
    abrirModal('modalMatricula');
  } catch (erro) { mostrarToast(erro.message, 'error'); }
}

async function salvar(evento) {
  evento.preventDefault();
  const corpo = { alunoCpf: $('aluno').value, planoId: $('plano').value, dataInicio: $('inicio').value, dataFim: $('fim').value, status: $('status').value };
  $('btnSalvar').disabled = true;
  try {
    const editando = idEmEdicao !== null;
    const dados = await requisicaoAPI(editando ? '/matricula/' + idEmEdicao : '/matricula', {
      method: editando ? 'PUT' : 'POST', body: JSON.stringify(corpo)
    });
    fecharModal('modalMatricula');
    mostrarToast(dados.mensagem);
    await carregarMatriculas();
  } catch (erro) {
    $('erroForm').textContent = erro.message;
    $('erroForm').hidden = false;
  } finally { $('btnSalvar').disabled = false; }
}

async function cancelar(m) {
  if (!(await confirmarAcao(`Cancelar a matrícula de ${m.nome_pessoa}? As reservas futuras dele também serão canceladas.`, 'Cancelar matrícula'))) return;
  try {
    const dados = await requisicaoAPI('/matricula/' + m.id_matricula + '/cancelar', { method: 'PATCH' });
    mostrarToast(dados.mensagem);
    await carregarMatriculas();
  } catch (erro) { mostrarToast(erro.message, 'error'); }
}

async function excluir(m) {
  if (!(await confirmarAcao(`Excluir a matrícula de ${m.nome_pessoa}? Essa ação não pode ser desfeita.`, 'Excluir'))) return;
  try {
    const dados = await requisicaoAPI('/matricula/' + m.id_matricula, { method: 'DELETE' });
    mostrarToast(dados.mensagem);
    await carregarMatriculas();
  } catch (erro) { mostrarToast(erro.message, 'error'); }
}

$('btnNova').addEventListener('click', abrirNova);
$('btnCancelar').addEventListener('click', () => fecharModal('modalMatricula'));
$('formMatricula').addEventListener('submit', salvar);
$('plano').addEventListener('change', sugerirVencimento);
$('inicio').addEventListener('change', sugerirVencimento);
$('busca').addEventListener('input', atrasar(carregarMatriculas));
$('filtroSituacao').addEventListener('change', carregarMatriculas);

(async () => {
  const usuario = await exigirSessao(['gerente']);
  if (!usuario) return;
  preencherMenuUsuario(usuario);
  await carregarMatriculas();
})();