// aula.js - Tela de cadastro de aulas (conversa com /aula/..., /modalidade/listar)
const DIAS = ['', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
let idEmEdicao = null; // null = cadastrando
let todasAulas = [];
const $ = (id) => document.getElementById(id);
function opcao(valor, texto) { const o = document.createElement('option'); o.value = valor; o.textContent = texto; return o; }

// ---------- Lista (com filtro por dia, feito no navegador) ----------
function desenharTabela() {
  const filtro = $('filtroDia').value;
  const aulas = filtro ? todasAulas.filter((a) => String(a.dia_semana_aula) === filtro) : todasAulas;
  preencherTabelaCrud('tbAulas', aulas.map((a) => [
    DIAS[a.dia_semana_aula],
    a.horario + ' · ' + a.duracao_minutos_aula + ' min',
    a.nome_modalidade,
    a.instrutor,
    String(a.vagas_aula),
    String(a.reservas_futuras),
    { botoes: [
      { texto: 'Editar', classe: 'btn-secondary', aoClicar: () => abrirEdicao(a.id_aula) },
      { texto: 'Excluir', classe: 'btn-danger', aoClicar: () => excluirAula(a) }
    ] }
  ]), 7, 'Nenhuma aula encontrada.');
}

async function carregarAulas() {
  try {
    const { aulas } = await requisicaoAPI('/aula/listar');
    todasAulas = aulas;
    desenharTabela();
  } catch (erro) { mostrarToast(erro.message, 'error'); }
}

// ---------- Formulário ----------
async function preencherListas(modalidadeSel, instrutorSel) {
  const [{ modalidades }, { instrutores }] = await Promise.all([requisicaoAPI('/modalidade/listar'), requisicaoAPI('/aula/instrutores')]);
  $('modalidade').replaceChildren(opcao('', 'Selecione...'), ...modalidades.map((m) => opcao(m.id_modalidade, m.nome_modalidade)));
  $('instrutor').replaceChildren(opcao('', 'Selecione...'), ...instrutores.map((i) => opcao(i.cpf, i.nome_pessoa + ' · ' + i.nome_cargo)));
  $('modalidade').value = modalidadeSel || '';
  $('instrutor').value = instrutorSel || '';
}

async function abrirNova() {
  try {
    idEmEdicao = null;
    $('formAula').reset();
    $('erroForm').hidden = true;
    $('tituloModal').textContent = 'Nova aula';
    await preencherListas('', '');
    abrirModal('modalAula');
  } catch (erro) { mostrarToast(erro.message, 'error'); }
}

async function abrirEdicao(id) {
  try {
    const { aula: a } = await requisicaoAPI('/aula/' + id);
    idEmEdicao = a.id_aula;
    $('formAula').reset();
    $('erroForm').hidden = true;
    $('tituloModal').textContent = 'Editar aula';
    await preencherListas(a.modalidade_id_modalidade, a.instrutor_cpf);
    $('dia').value = a.dia_semana_aula;
    $('horario').value = a.horario;
    $('duracao').value = a.duracao_minutos_aula;
    $('vagas').value = a.vagas_aula;
    abrirModal('modalAula');
  } catch (erro) { mostrarToast(erro.message, 'error'); }
}

async function salvar(evento) {
  evento.preventDefault();
  const corpo = {
    modalidadeId: $('modalidade').value, instrutorCpf: $('instrutor').value, dia: $('dia').value,
    horario: $('horario').value, duracao: $('duracao').value, vagas: $('vagas').value
  };
  $('btnSalvar').disabled = true;
  try {
    const editando = idEmEdicao !== null;
    const dados = await requisicaoAPI(editando ? '/aula/' + idEmEdicao : '/aula', {
      method: editando ? 'PUT' : 'POST', body: JSON.stringify(corpo)
    });
    fecharModal('modalAula');
    mostrarToast(dados.mensagem);
    await carregarAulas();
  } catch (erro) {
    $('erroForm').textContent = erro.message; // ex.: conflito de horário do instrutor
    $('erroForm').hidden = false;
  } finally { $('btnSalvar').disabled = false; }
}

async function excluirAula(a) {
  const texto = `Excluir a aula de ${a.nome_modalidade} (${DIAS[a.dia_semana_aula]}, ${a.horario})?`;
  if (!(await confirmarAcao(texto, 'Excluir'))) return;
  try {
    const dados = await requisicaoAPI('/aula/' + a.id_aula, { method: 'DELETE' });
    mostrarToast(dados.mensagem);
    await carregarAulas();
  } catch (erro) { mostrarToast(erro.message, 'error'); }
}

// Dias da semana nos dois selects (filtro e formulário)
for (let d = 1; d <= 7; d++) { $('filtroDia').append(opcao(d, DIAS[d])); $('dia').append(opcao(d, DIAS[d])); }
$('dia').prepend(opcao('', 'Selecione...'));

$('btnNova').addEventListener('click', abrirNova);
$('btnCancelar').addEventListener('click', () => fecharModal('modalAula'));
$('formAula').addEventListener('submit', salvar);
$('filtroDia').addEventListener('change', desenharTabela);

(async () => {
  const usuario = await exigirSessao(['gerente']);
  if (!usuario) return;
  preencherMenuUsuario(usuario);
  await carregarAulas();
})();