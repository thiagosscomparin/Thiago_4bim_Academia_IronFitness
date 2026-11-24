// instrutor_agenda.js - Agenda do instrutor, SOMENTE CONSULTA
// (conversa com /instrutor/agenda e /instrutor/agenda/alunos)
const DIAS = ['', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
const ROTULO_RESERVA = { CONFIRMADA: 'Confirmada', CONCLUIDA: 'Concluída' };

function situacao(x) {
  if (x.ja_passou) return { etiquetas: [{ texto: 'Já aconteceu', classe: 'status-off' }] };
  if (x.hoje) return { etiquetas: [{ texto: 'Hoje', classe: 'status-ok' }] };
  return '—';
}

async function carregar() {
  try {
    const d = await requisicaoAPI('/instrutor/agenda');

    preencherTabelaCrud('tbProximas', d.proximas.map((x) => [
      `${x.data} · ${DIAS[x.dia_semana_aula]}`,
      `${x.horario} (${x.duracao_minutos_aula} min)`,
      { texto: x.nome_modalidade, classe: 'valor' },
      `${x.ocupadas} de ${x.vagas_aula}`,
      situacao(x),
      { botoes: [{ texto: 'Ver alunos', classe: '', aoClicar: () => verAlunos(x) }] }
    ]), 6, 'Você não tem aulas nos próximos 14 dias.');

    preencherTabelaCrud('tbSemana', d.semana.map((x) => [
      DIAS[x.dia_semana_aula], x.horario, { texto: x.nome_modalidade, classe: 'valor' },
      x.duracao_minutos_aula + ' min', String(x.vagas_aula)
    ]), 5, 'Você ainda não tem aulas na grade. A gerência cadastra as aulas.');
  } catch (erro) { mostrarToast(erro.message, 'error'); }
}

async function verAlunos(x) {
  try {
    const q = new URLSearchParams({ aulaId: x.id_aula, data: x.data_iso });
    const d = await requisicaoAPI('/instrutor/agenda/alunos?' + q.toString());

    document.getElementById('tituloAlunos').textContent = `${d.aula.modalidade} · ${x.data} às ${d.aula.horario}`;
    document.getElementById('resumoAlunos').textContent =
      `${d.alunos.length} de ${d.aula.vagas} vagas ocupadas · ${DIAS[x.dia_semana_aula]}`;

    preencherTabelaCrud('tbAlunosAula', d.alunos.map((a) => [
      { texto: a.nome, classe: 'valor' },
      a.objetivo,
      { etiquetas: [{ texto: ROTULO_RESERVA[a.status_reserva] || a.status_reserva, classe: a.status_reserva === 'CONFIRMADA' ? 'status-ok' : 'status-off' }] }
    ]), 3, 'Nenhum aluno reservou esta aula ainda.');

    abrirModal('modalAlunos');
  } catch (erro) { mostrarToast(erro.message, 'error'); }
}

document.getElementById('btnFechar').addEventListener('click', () => fecharModal('modalAlunos'));

(async () => {
  const usuario = await exigirSessao(['instrutor']);
  if (!usuario) return;
  preencherMenuUsuario(usuario);
  await carregar();
})();