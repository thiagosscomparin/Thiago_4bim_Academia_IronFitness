// dashboard.js - Dashboard do aluno (usa as funções de ../comum/painel.js)

const BADGE_SITUACAO = { ATIVA: 'status-ok', PENDENTE: 'status-warn', VENCIDA: 'status-off', CANCELADA: 'status-off' };
const BADGE_PAGAMENTO = {
  PAGO: { badge: 'status-ok', texto: 'Pago' },
  PENDENTE: { badge: 'status-warn', texto: 'Pendente' },
  ESTORNADO: { badge: 'status-off', texto: 'Estornado' }
};

function textoAulasSemana(n) {
  if (n === null || n === undefined) return 'Ilimitadas';
  return n === 0 ? 'Não incluídas (musculação livre)' : 'Até ' + n + ' por semana';
}

function desenharAvisos(avisos) {
  const area = document.getElementById('avisos');
  area.replaceChildren();
  avisos.forEach((a) => {
    const div = document.createElement('div');
    div.className = 'alert alert-' + (a.tipo === 'warn' ? 'warn' : a.tipo);
    div.textContent = a.texto;
    area.appendChild(div);
  });
}

function desenhar(d) {
  desenharAvisos(d.avisos);
  const m = d.matricula;

  // Cards
  escrever('v-plano', m ? m.nome_plano : 'Sem plano');
  escrever('n-plano', m ? formatoMoeda.format(m.valor_plano) + ' · ' + m.duracao_meses_plano + ' mês(es)' : 'Procure a recepção');
  escrever('v-situacao', m ? m.situacao : '—');
  escrever('v-vencimento', m ? m.vencimento : '—');
  escrever('n-vencimento', m ? (m.dias_restantes >= 0 ? m.dias_restantes + ' dia(s) restantes' : 'Vencida') : ' ');
  escrever('v-aulas', d.proximasAulas.length);

  // Tabela "Meu plano"
  preencherTabela('tbPlano', m ? [
    ['Plano', m.nome_plano],
    ['Valor', formatoMoeda.format(m.valor_plano)],
    ['Duração', m.duracao_meses_plano + ' mês(es)'],
    ['Início', m.inicio],
    ['Vencimento', m.vencimento],
    ['Aulas coletivas', textoAulasSemana(m.aulas_semana_plano)],
    ['Situação', { badge: BADGE_SITUACAO[m.situacao] || 'status-off', texto: m.situacao }]
  ] : [], 2, 'Você ainda não possui matrícula.');

  // Próximas aulas
  preencherTabela('tbAulas', d.proximasAulas.map((a) => [a.data, a.horario, a.nome_modalidade, a.instrutor]),
    4, 'Você não tem aulas reservadas.');

  // Ficha de treino (somente visualização)
  const f = d.ficha;
  preencherTabela('tbFicha', f ? [
    ['Ficha', f.titulo_ficha_treino],
    ['Objetivo', f.objetivo_ficha_treino || '—'],
    ['Instrutor', f.instrutor || '—'],
    ['Exercícios', String(f.exercicios)],
    ['Criada em', f.criada]
  ] : [], 2, 'Nenhuma ficha de treino disponível ainda.');

  // Pagamentos
  preencherTabela('tbPagamentos', d.pagamentos.map((p) => [
    p.data || '—',
    { texto: formatoMoeda.format(p.valor_pagamento), classe: 'valor' },
    BADGE_PAGAMENTO[p.status_pagamento] || { badge: 'status-off', texto: p.status_pagamento }
  ]), 3, 'Nenhum pagamento registrado.');
}

async function carregarDados() {
  const aviso = document.getElementById('avisoErro');
  try {
    desenhar(await requisicaoAPI('/dashboard/aluno', { method: 'GET' }));
    aviso.hidden = true;
    marcarStatus(true);
  } catch (erro) {
    aviso.textContent = erro.message;
    aviso.hidden = false;
    marcarStatus(false);
  }
}

(async () => {
  const usuario = await exigirSessao(['aluno']);
  if (!usuario) return;
  preencherUsuario(usuario, 'Seu treino em um só lugar');
  await carregarDados();
})();