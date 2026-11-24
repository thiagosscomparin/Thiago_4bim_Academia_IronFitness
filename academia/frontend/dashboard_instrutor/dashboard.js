// dashboard.js - Dashboard do instrutor (usa as funções de ../comum/painel.js)
async function carregarDados() {
  const aviso = document.getElementById('avisoErro');
  try {
    const d = await requisicaoAPI('/dashboard/instrutor', { method: 'GET' });
    aviso.hidden = true;

    escrever('v-aulas', d.totais.aulas);
    escrever('v-alunos', d.totais.alunos);
    escrever('v-fichas', d.totais.fichas);
    escrever('v-reservas', d.totais.reservas_futuras);

    preencherTabela('tbAgenda', d.agenda.map((a) => [
      DIAS_SEMANA[a.dia_semana_aula], a.horario + ' (' + a.duracao_minutos_aula + ' min)', a.nome_modalidade, String(a.vagas_aula)
    ]), 4, 'Você ainda não tem aulas cadastradas.');

    preencherTabela('tbReservas', d.proximasReservas.map((r) => [
      r.data, r.horario, r.nome_modalidade, r.nome_pessoa
    ]), 4, 'Nenhuma reserva futura nas suas aulas.');

    preencherTabela('tbFichas', d.fichas.map((f) => [
      f.nome_pessoa, f.titulo_ficha_treino, f.objetivo_ficha_treino || '—', String(f.exercicios)
    ]), 4, 'Nenhuma ficha sob sua responsabilidade.');

    marcarStatus(true);
  } catch (erro) {
    aviso.textContent = erro.message;
    aviso.hidden = false;
    marcarStatus(false);
  }
}

(async () => {
  const usuario = await exigirSessao(['instrutor']);
  if (!usuario) return;
  preencherUsuario(usuario, 'Sua rotina na academia');
  await carregarDados();
})();