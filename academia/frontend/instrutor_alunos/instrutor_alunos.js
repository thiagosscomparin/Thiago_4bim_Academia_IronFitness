// instrutor_alunos.js - Meus alunos, SOMENTE CONSULTA (conversa com /instrutor/alunos)
const BADGE_PLANO = { ATIVA: 'status-ok', PENDENTE: 'status-warn', VENCIDA: 'status-off', CANCELADA: 'status-off' };
const ROTULO_PLANO = { ATIVA: 'Ativo', PENDENTE: 'Pendente', VENCIDA: 'Vencido', CANCELADA: 'Cancelado' };
const FICHA = {
  MINHA: { texto: 'Minha ficha', classe: 'status-ok' },
  OUTRO: { texto: 'De outro instrutor', classe: 'status-off' },
  SEM_RESPONSAVEL: { texto: 'Sem instrutor definido', classe: 'status-warn' }
};
const SEM_FICHA = { texto: 'Sem ficha', classe: 'status-off' };

let alunos = [];

// Tira acentos e maiúsculas para a busca achar "Jose" ao digitar "josé"
const normalizar = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function desenhar() {
  const termo = normalizar(document.getElementById('busca').value.trim());
  const lista = termo
    ? alunos.filter((a) => normalizar(a.nome).includes(termo) || normalizar(a.objetivo).includes(termo))
    : alunos;

  document.getElementById('contador').textContent =
    lista.length === 1 ? '1 aluno' : lista.length + ' alunos';

  preencherTabelaCrud('tbAlunos', lista.map((a) => [
    { texto: a.nome, classe: 'valor' },
    a.objetivo,
    a.nome_plano,
    a.situacao_plano
      ? { etiquetas: [{ texto: ROTULO_PLANO[a.situacao_plano] || a.situacao_plano, classe: BADGE_PLANO[a.situacao_plano] || 'status-off' }] }
      : { etiquetas: [{ texto: 'Sem matrícula', classe: 'status-off' }] },
    { etiquetas: [FICHA[a.ficha] || SEM_FICHA] },
    String(a.aulas_comigo),
    a.proxima_aula
  ]), 7, termo ? 'Nenhum aluno encontrado para essa busca.' : 'Você ainda não tem alunos. Eles aparecem quando reservam uma aula sua ou recebem uma ficha sua.');
}

async function carregar() {
  try {
    const dados = await requisicaoAPI('/instrutor/alunos');
    alunos = dados.alunos;
    desenhar();
  } catch (erro) { mostrarToast(erro.message, 'error'); }
}

document.getElementById('busca').addEventListener('input', atrasar(desenhar, 200));

(async () => {
  const usuario = await exigirSessao(['instrutor']);
  if (!usuario) return;
  preencherMenuUsuario(usuario);
  await carregar();
})();