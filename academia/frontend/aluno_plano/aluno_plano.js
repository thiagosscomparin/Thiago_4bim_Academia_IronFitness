// aluno_plano.js - Meu plano: situação atual, contratar/renovar e histórico (conversa com /aluno/plano)
const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const BADGE = { ATIVA: 'status-ok', PENDENTE: 'status-warn', VENCIDA: 'status-off', CANCELADA: 'status-off' };
const ROTULO = { ATIVA: 'Ativa', PENDENTE: 'Pendente', VENCIDA: 'Vencida', CANCELADA: 'Cancelada' };

function textoAulas(n) {
  if (n === null) return 'Ilimitadas';
  return n === 0 ? 'Não incluídas (musculação livre)' : 'Até ' + n + ' por semana';
}
const textoDuracao = (m) => (m === 1 ? '1 mês' : m + ' meses');

async function carregar() {
  try {
    const { matriculas, planos } = await requisicaoAPI('/aluno/plano');
    const vigente = matriculas.find((m) => m.vigente);
    const atual = vigente || matriculas[0];

    preencherTabelaCrud('tbAtual', atual ? [
      ['Plano', atual.nome_plano],
      ['Valor', moeda.format(atual.valor_plano)],
      ['Duração', textoDuracao(atual.duracao_meses_plano)],
      ['Início', atual.inicio],
      ['Vencimento', atual.vencimento + (atual.vigente ? ` (${atual.dias_restantes} dia(s) restantes)` : '')],
      ['Aulas coletivas', textoAulas(atual.aulas_semana_plano)],
      ['Situação', { etiquetas: [{ texto: ROTULO[atual.situacao], classe: BADGE[atual.situacao] }] }]
    ] : [], 2, 'Você ainda não tem um plano. Escolha um abaixo para começar.');

    // "Renovar" se já tem plano vigente; senão "Contratar"
    const verbo = vigente ? 'Renovar' : 'Contratar';
    preencherTabelaCrud('tbPlanos', planos.map((p) => [
      { texto: p.nome_plano, classe: 'valor' }, moeda.format(p.valor_plano), textoDuracao(p.duracao_meses_plano), textoAulas(p.aulas_semana_plano),
      { botoes: [{ texto: verbo, classe: '', aoClicar: () => contratar(p, verbo) }] }
    ]), 5, 'Nenhum plano disponível no momento.');

    preencherTabelaCrud('tbHistorico', matriculas.map((m) => [
      m.nome_plano, m.inicio, m.vencimento, { etiquetas: [{ texto: ROTULO[m.situacao], classe: BADGE[m.situacao] }] }
    ]), 4, 'Nenhuma matrícula anterior.');
    return { planos, verbo };
  } catch (erro) { mostrarToast(erro.message, 'error'); }
}

async function contratar(p, verbo) {
  const texto = `${verbo} o plano ${p.nome_plano} por ${moeda.format(p.valor_plano)}? Será criada uma matrícula pendente e um pagamento para você pagar pelo Pix.`;
  if (!(await confirmarAcao(texto, verbo))) return;
  try {
    const dados = await requisicaoAPI('/aluno/plano/contratar', { method: 'POST', body: JSON.stringify({ planoId: p.id_plano }) });
    mostrarToast(dados.mensagem);
    setTimeout(() => { window.location.href = '/aluno_pagamentos/aluno_pagamentos.html'; }, 1200); // leva direto para pagar
  } catch (erro) { mostrarToast(erro.message, 'error'); await carregar(); }
}

(async () => {
  const usuario = await exigirSessao(['aluno']);
  if (!usuario) return;
  preencherMenuUsuario(usuario);
  const info = await carregar();

  // Vindo do cadastro ou da página inicial (?plano=ID): já abre a confirmação do plano escolhido.
  // O parâmetro é apagado da URL para não reabrir a confirmação ao atualizar a página.
  const escolhido = Number(new URLSearchParams(window.location.search).get('plano'));
  if (info && Number.isInteger(escolhido) && escolhido > 0) {
    window.history.replaceState(null, '', window.location.pathname);
    const p = info.planos.find((x) => x.id_plano === escolhido);
    if (p) await contratar(p, info.verbo);
  }
})();