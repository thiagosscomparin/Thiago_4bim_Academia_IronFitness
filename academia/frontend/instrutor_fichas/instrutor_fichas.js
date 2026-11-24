// instrutor_fichas.js - Fichas sob responsabilidade do instrutor, SOMENTE CONSULTA
// (conversa com /instrutor/fichas e /instrutor/fichas/:id)
let fichas = [];

const normalizar = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function elemento(tag, classe, texto) {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texto !== undefined) e.textContent = texto;
  return e;
}

function desenhar() {
  const termo = normalizar(document.getElementById('busca').value.trim());
  const soAtivas = document.getElementById('filtro').value === 'ativas';

  const lista = fichas.filter((f) =>
    (!soAtivas || f.ativa) &&
    (!termo || [f.aluno, f.titulo_ficha_treino, f.objetivo_ficha_treino].some((c) => normalizar(c).includes(termo))));

  preencherTabelaCrud('tbFichas', lista.map((f) => [
    { texto: f.aluno, classe: 'valor' },
    f.titulo_ficha_treino,
    f.objetivo_ficha_treino,
    String(f.exercicios),
    f.criada,
    { etiquetas: [f.ativa ? { texto: 'Ativa', classe: 'status-ok' } : { texto: 'Histórico', classe: 'status-off' }] },
    { botoes: [{ texto: 'Ver ficha', classe: '', aoClicar: () => verFicha(f) }] }
  ]), 7, termo || !soAtivas
    ? 'Nenhuma ficha encontrada.'
    : 'Nenhuma ficha ativa sob a sua responsabilidade.');
}

async function carregar() {
  try {
    const dados = await requisicaoAPI('/instrutor/fichas');
    fichas = dados.fichas;
    desenhar();
  } catch (erro) { mostrarToast(erro.message, 'error'); }
}

// ---------- janela com a ficha completa ----------
function painelResumo(f) {
  const bloco = elemento('div', '');
  [['Aluno', f.aluno], ['Objetivo', f.objetivo_ficha_treino], ['Criada em', f.criada],
   ['Situação', f.ativa ? 'Ativa' : 'Histórico (substituída por outra ficha)'], ['Observações', f.observacoes_ficha_treino]]
    .forEach(([rotulo, valor]) => {
      if (!valor) return;
      const linha = elemento('p', '');
      linha.append(elemento('strong', '', rotulo + ': '), document.createTextNode(valor));
      bloco.append(linha);
    });
  return bloco;
}

function painelDivisao(nome, indice) {
  const p = elemento('div', 'panel');
  p.style.marginTop = '16px';
  p.append(elemento('h3', '', nome));
  const envolve = elemento('div', 'table-wrap');
  const tabela = elemento('table');
  const cab = elemento('thead');
  const trCab = elemento('tr');
  ['Exercício', 'Séries', 'Repetições', 'Descanso', 'Orientações'].forEach((c) => trCab.append(elemento('th', '', c)));
  cab.append(trCab);
  const corpo = elemento('tbody');
  corpo.id = 'tbDivisao' + indice;
  tabela.append(cab, corpo);
  envolve.append(tabela);
  p.append(envolve);
  return { painel: p, idCorpo: corpo.id };
}

async function verFicha(f) {
  try {
    const { ficha, exercicios } = await requisicaoAPI('/instrutor/fichas/' + f.id_ficha_treino);
    document.getElementById('tituloFicha').textContent = ficha.titulo_ficha_treino;

    const area = document.getElementById('conteudoFicha');
    area.replaceChildren(painelResumo(ficha));

    if (exercicios.length === 0) {
      area.append(elemento('p', 'empty-state', 'Esta ficha ainda não tem exercícios.'));
    }

    const grupos = {};
    exercicios.forEach((e) => { (grupos[e.divisao] = grupos[e.divisao] || []).push(e); });
    Object.keys(grupos).sort().forEach((nome, i) => {
      const { painel, idCorpo } = painelDivisao(nome, i);
      area.append(painel); // precisa estar na página antes de preencher a tabela
      preencherTabelaCrud(idCorpo, grupos[nome].map((e) => [
        { texto: e.nome, classe: 'valor' }, String(e.series), e.repeticoes,
        e.descanso === null ? '—' : e.descanso + ' s', e.orientacoes
      ]), 5, 'Sem exercícios.');
    });

    abrirModal('modalFicha');
  } catch (erro) { mostrarToast(erro.message, 'error'); }
}

document.getElementById('busca').addEventListener('input', atrasar(desenhar, 200));
document.getElementById('filtro').addEventListener('change', desenhar);
document.getElementById('btnFechar').addEventListener('click', () => fecharModal('modalFicha'));

(async () => {
  const usuario = await exigirSessao(['instrutor']);
  if (!usuario) return;
  preencherMenuUsuario(usuario);
  await carregar();
})();