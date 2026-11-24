// aluno_aulas.js - Aulas disponíveis e reservas do aluno (conversa com /aluno/aulas e /aluno/reservas)
const DIAS = ['', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
const BADGE = { CONFIRMADA: 'status-ok', CONCLUIDA: 'status-off', CANCELADA: 'status-off' };
const ROTULO = { CONFIRMADA: 'Confirmada', CONCLUIDA: 'Concluída', CANCELADA: 'Cancelada' };

async function carregar() {
  try {
    const [a, r] = await Promise.all([requisicaoAPI('/aluno/aulas'), requisicaoAPI('/aluno/reservas')]);

    preencherTabelaCrud('tbAulas', a.aulas.map((x) => {
      const livres = x.vagas_aula - x.ocupadas;
      let acao;
      if (x.reservada) acao = { etiquetas: [{ texto: 'Reservada', classe: 'status-ok' }] };
      else if (livres <= 0) acao = { etiquetas: [{ texto: 'Lotada', classe: 'status-off' }] };
      else acao = { botoes: [{ texto: 'Reservar', classe: '', aoClicar: () => reservar(x) }] };
      return [
        `${x.data} · ${DIAS[x.dia_semana_aula]}`, `${x.horario} (${x.duracao_minutos_aula} min)`, x.nome_modalidade, x.instrutor,
        `${Math.max(livres, 0)} de ${x.vagas_aula}`, acao
      ];
    }), 6, 'Não há aulas disponíveis nos próximos 14 dias.');

    preencherTabelaCrud('tbReservas', r.reservas.map((x) => [
      x.data, x.horario, x.nome_modalidade, x.instrutor,
      { etiquetas: [{ texto: ROTULO[x.status_reserva], classe: BADGE[x.status_reserva] }] },
      x.pode_cancelar
        ? { botoes: [{ texto: 'Cancelar', classe: 'btn-danger', aoClicar: () => cancelar(x) }] }
        : (x.status_reserva === 'CONFIRMADA' ? 'Prazo de cancelamento encerrado' : '—')
    ]), 6, 'Você ainda não fez nenhuma reserva.');
  } catch (erro) { mostrarToast(erro.message, 'error'); }
}

async function reservar(x) {
  if (!(await confirmarAcao(`Reservar ${x.nome_modalidade} em ${x.data} (${DIAS[x.dia_semana_aula]}) às ${x.horario}?`, 'Reservar'))) return;
  try {
    // o servidor confere matrícula, limite do plano, vagas, duplicidade e conflito de horário
    const dados = await requisicaoAPI('/aluno/reservas', { method: 'POST', body: JSON.stringify({ aulaId: x.id_aula, data: x.data_iso }) });
    mostrarToast(dados.mensagem);
  } catch (erro) { mostrarToast(erro.message, 'error'); }
  await carregar(); // atualiza as vagas e a lista de reservas de qualquer forma
}

async function cancelar(x) {
  if (!(await confirmarAcao(`Cancelar a reserva de ${x.nome_modalidade} em ${x.data} às ${x.horario}?`, 'Cancelar reserva'))) return;
  try {
    const dados = await requisicaoAPI('/aluno/reservas/cancelar', { method: 'PATCH', body: JSON.stringify({ aulaId: x.aula_id, data: x.data_iso }) });
    mostrarToast(dados.mensagem);
  } catch (erro) { mostrarToast(erro.message, 'error'); }
  await carregar();
}

(async () => {
  const usuario = await exigirSessao(['aluno']);
  if (!usuario) return;
  preencherMenuUsuario(usuario);
  await carregar();
})();