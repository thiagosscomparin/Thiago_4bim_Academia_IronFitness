// ficha_treino.js - Tela de fichas de treino (conversa com /ficha_treino/..., /matricula/alunos, /aula/instrutores)
let idEmEdicao = null; // null = cadastrando
const $ = (id) => document.getElementById(id);
const DIVISOES = ['Treino A', 'Treino B', 'Treino C', 'Treino D', 'Treino E', 'Treino F'];
function opcao(valor, texto) { const o = document.createElement('option'); o.value = valor; o.textContent = texto; return o; }

// ---------- Lista ----------
async function carregarFichas() {
  try {
    const params = new URLSearchParams({ busca: $('busca').value.trim(), situacao: $('filtroSituacao').value });
    const { fichas } = await requisicaoAPI('/ficha_treino/listar?' + params);
    preencherTabelaCrud('tbFichas', fichas.map((f) => [
      f.aluno, f.titulo_ficha_treino, f.objetivo_ficha_treino, f.instrutor, f.criada, String(f.exercicios),
      { etiquetas: [f.ativa_ficha_treino ? { texto: 'Ativa', classe: 'status-ok' } : { texto: 'Histórico', classe: 'status-off' }] },
      { botoes: [
        { texto: 'Editar', classe: 'btn-secondary', aoClicar: () => abrirEdicao(f.id_ficha_treino) },
        ...(f.ativa_ficha_treino ? [] : [{ texto: 'Reativar', classe: 'btn-secondary', aoClicar: () => reativar(f) }]),
        { texto: 'Excluir', classe: 'btn-danger', aoClicar: () => excluir(f) }
      ] }
    ]), 8, 'Nenhuma ficha encontrada.');
  } catch (erro) { mostrarToast(erro.message, 'error'); }
}

// ---------- Linhas de exercício ----------
function campo(rotulo, elemento, largo) {
  const div = document.createElement('div');
  if (largo) div.className = 'campo-largo';
  const l = document.createElement('label'); l.textContent = rotulo;
  div.append(l, elemento);
  return div;
}

function criarInput(tipo, valor, extra = {}) {
  const i = document.createElement('input');
  i.type = tipo; i.value = valor ?? '';
  Object.assign(i, extra);
  return i;
}

function adicionarExercicio(e = {}) {
  const lista = $('listaExercicios');
  lista.querySelector('.sem-exercicios')?.remove();

  const linha = document.createElement('div');
  linha.className = 'linha-exercicio';

  const divisao = document.createElement('select');
  DIVISOES.forEach((d) => divisao.append(opcao(d, d)));
  // sem divisão informada, repete a do último exercício (ou Treino A)
  const ultima = lista.querySelectorAll('.linha-exercicio').length ? [...lista.querySelectorAll('select[data-campo="divisao"]')].pop().value : 'Treino A';
  divisao.value = e.divisao || ultima;

  const nome = criarInput('text', e.nome, { maxLength: 80, placeholder: 'Ex.: Supino reto' });
  const series = criarInput('number', e.series ?? 3, { min: 1, max: 20 });
  const reps = criarInput('text', e.repeticoes ?? '12', { maxLength: 20, placeholder: '12 ou 8-10' });
  const descanso = criarInput('number', e.descanso, { min: 0, max: 600, placeholder: 'seg' });
  const orient = criarInput('text', e.orientacoes, { maxLength: 300, placeholder: 'Ex.: descer devagar, sem quicar' });

  [[divisao, 'divisao'], [nome, 'nome'], [series, 'series'], [reps, 'repeticoes'], [descanso, 'descanso'], [orient, 'orientacoes']]
    .forEach(([el, chave]) => { el.dataset.campo = chave; });

  const remover = document.createElement('button');
  remover.type = 'button'; remover.className = 'btn btn-danger btn-sm'; remover.textContent = 'Remover';
  remover.addEventListener('click', () => {
    linha.remove();
    if (!lista.querySelector('.linha-exercicio')) mostrarSemExercicios();
  });

  linha.append(campo('Divisão', divisao), campo('Exercício', nome), campo('Séries', series), campo('Repetições', reps),
               campo('Descanso (s)', descanso), remover, campo('Orientações', orient, true));
  lista.append(linha);
}

function mostrarSemExercicios() {
  const v = document.createElement('div');
  v.className = 'sem-exercicios';
  v.textContent = 'Nenhum exercício. Clique em “+ Adicionar exercício”.';
  $('listaExercicios').append(v);
}

// Lê os campos de cada linha e monta a lista que o servidor valida
function coletarExercicios() {
  return [...document.querySelectorAll('.linha-exercicio')].map((linha) => {
    const v = (c) => linha.querySelector(`[data-campo="${c}"]`).value;
    return { divisao: v('divisao'), nome: v('nome').trim(), series: v('series'), repeticoes: v('repeticoes').trim(),
             descanso: v('descanso'), orientacoes: v('orientacoes').trim() };
  });
}

// ---------- Formulário ----------
async function preencherListas() {
  const [a, i] = await Promise.all([requisicaoAPI('/matricula/alunos'), requisicaoAPI('/aula/instrutores')]);
  $('aluno').replaceChildren(opcao('', 'Selecione...'), ...a.alunos.map((x) => opcao(x.cpf, x.nome_pessoa + ' · ' + x.cpf)));
  $('instrutor').replaceChildren(opcao('', 'Sem responsável definido'), ...i.instrutores.map((x) => opcao(x.cpf, x.nome_pessoa + ' · ' + x.nome_cargo)));
}

function limparFormulario(titulo) {
  $('formFicha').reset();
  $('erroForm').hidden = true;
  $('tituloModal').textContent = titulo;
  $('listaExercicios').replaceChildren();
}

async function abrirNova() {
  try {
    idEmEdicao = null;
    limparFormulario('Nova ficha');
    await preencherListas();
    $('aluno').disabled = false;
    adicionarExercicio();
    abrirModal('modalFicha');
  } catch (erro) { mostrarToast(erro.message, 'error'); }
}

async function abrirEdicao(id) {
  try {
    const { ficha, exercicios } = await requisicaoAPI('/ficha_treino/' + id);
    idEmEdicao = ficha.id_ficha_treino;
    limparFormulario('Editar ficha');
    await preencherListas();
    $('aluno').value = ficha.aluno_cpf;
    $('aluno').disabled = true; // a ficha pertence a este aluno
    $('instrutor').value = ficha.instrutor_cpf || '';
    $('titulo').value = ficha.titulo_ficha_treino;
    $('objetivo').value = ficha.objetivo_ficha_treino || '';
    $('observacoes').value = ficha.observacoes_ficha_treino || '';
    if (exercicios.length) exercicios.forEach(adicionarExercicio); else mostrarSemExercicios();
    abrirModal('modalFicha');
  } catch (erro) { mostrarToast(erro.message, 'error'); }
}

async function salvar(evento) {
  evento.preventDefault();
  const corpo = {
    alunoCpf: $('aluno').value, instrutorCpf: $('instrutor').value, titulo: $('titulo').value.trim(),
    objetivo: $('objetivo').value.trim(), observacoes: $('observacoes').value.trim(), exercicios: coletarExercicios()
  };
  $('btnSalvar').disabled = true;
  try {
    const editando = idEmEdicao !== null;
    const dados = await requisicaoAPI(editando ? '/ficha_treino/' + idEmEdicao : '/ficha_treino', {
      method: editando ? 'PUT' : 'POST', body: JSON.stringify(corpo)
    });
    fecharModal('modalFicha');
    mostrarToast(dados.mensagem);
    await carregarFichas();
  } catch (erro) {
    $('erroForm').textContent = erro.message;
    $('erroForm').hidden = false;
  } finally { $('btnSalvar').disabled = false; }
}

// ---------- Ações da lista ----------
async function reativar(f) {
  if (!(await confirmarAcao(`Reativar a ficha "${f.titulo_ficha_treino}" de ${f.aluno}? A ficha ativa atual vai para o histórico.`, 'Reativar'))) return;
  try {
    const dados = await requisicaoAPI('/ficha_treino/' + f.id_ficha_treino + '/ativar', { method: 'PATCH' });
    mostrarToast(dados.mensagem);
    await carregarFichas();
  } catch (erro) { mostrarToast(erro.message, 'error'); }
}

async function excluir(f) {
  if (!(await confirmarAcao(`Excluir a ficha "${f.titulo_ficha_treino}" de ${f.aluno} e seus exercícios? Essa ação não pode ser desfeita.`, 'Excluir'))) return;
  try {
    const dados = await requisicaoAPI('/ficha_treino/' + f.id_ficha_treino, { method: 'DELETE' });
    mostrarToast(dados.mensagem);
    await carregarFichas();
  } catch (erro) { mostrarToast(erro.message, 'error'); }
}

$('btnNova').addEventListener('click', abrirNova);
$('btnCancelar').addEventListener('click', () => fecharModal('modalFicha'));
$('btnAddExercicio').addEventListener('click', () => adicionarExercicio());
$('formFicha').addEventListener('submit', salvar);
$('busca').addEventListener('input', atrasar(carregarFichas));
$('filtroSituacao').addEventListener('change', carregarFichas);

(async () => {
  const usuario = await exigirSessao(['gerente']);
  if (!usuario) return;
  preencherMenuUsuario(usuario);
  await carregarFichas();
})();