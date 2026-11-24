// ============================================================
// dashboard.js - Dashboard do gerente
// 1) confere a sessão  2) pede os dados ao servidor (GET /dashboard/gerente)
// 3) desenha números e tabelas. Nada aqui é dado fictício.
// ============================================================

const formatoMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

// Atalho: coloca um texto dentro do elemento com esse id
function escrever(id, valor) {
  document.getElementById(id).textContent = valor;
}

// Cria uma linha <tr> a partir de uma lista de células.
// Cada célula é um texto ou { texto, classe } (para badges e valores).
// Usamos textContent (e não innerHTML) para o navegador nunca interpretar
// um nome como código.
function adicionarLinha(tbody, celulas) {
  const tr = document.createElement('tr');
  celulas.forEach((celula) => {
    const td = document.createElement('td');
    if (typeof celula === 'object') {
      if (celula.badge) {
        const span = document.createElement('span');
        span.className = 'status ' + celula.badge;
        span.textContent = celula.texto;
        td.appendChild(span);
      } else {
        td.textContent = celula.texto;
        if (celula.classe) td.className = celula.classe;
      }
    } else {
      td.textContent = celula;
    }
    tr.appendChild(td);
  });
  tbody.appendChild(tr);
}

// Quando a lista vem vazia, mostra uma mensagem amigável
function mostrarVazio(tbody, colunas, mensagem) {
  const tr = document.createElement('tr');
  const td = document.createElement('td');
  td.colSpan = colunas;
  td.className = 'empty-state';
  td.textContent = mensagem;
  tr.appendChild(td);
  tbody.appendChild(tr);
}

function textoDias(dias) {
  if (dias === 0) return 'Vence hoje';
  return dias === 1 ? '1 dia' : dias + ' dias';
}

function badgePagamento(status) {
  const mapa = {
    PAGO:      { badge: 'status-ok',   texto: 'Pago' },
    PENDENTE:  { badge: 'status-warn', texto: 'Pendente' },
    ESTORNADO: { badge: 'status-off',  texto: 'Estornado' }
  };
  return mapa[status] || { badge: 'status-off', texto: status };
}

function desenharDados(dados) {
  const t = dados.totais;
  escrever('v-alunos', t.alunos);
  escrever('v-funcionarios', t.funcionarios);
  escrever('v-matriculas', t.matriculas_ativas);
  escrever('v-planos', t.planos_ativos);
  escrever('v-aulas', t.aulas);
  escrever('v-pagamentos', t.pagamentos);
  escrever('v-pendentes', t.pagamentos_pendentes);
  escrever('v-receita', formatoMoeda.format(dados.receitaMes));

  // Tabela: matrículas a vencer
  const tbVencer = document.getElementById('tbVencer');
  tbVencer.replaceChildren();
  if (dados.matriculasAVencer.length === 0) {
    mostrarVazio(tbVencer, 4, 'Nenhuma matrícula vence nos próximos 7 dias.');
  } else {
    dados.matriculasAVencer.forEach((m) => adicionarLinha(tbVencer, [
      m.nome_pessoa,
      m.nome_plano,
      m.vencimento,
      { badge: 'status-warn', texto: textoDias(m.dias_restantes) }
    ]));
  }

  // Tabela: últimos pagamentos
  const tbPag = document.getElementById('tbPagamentos');
  tbPag.replaceChildren();
  if (dados.ultimosPagamentos.length === 0) {
    mostrarVazio(tbPag, 4, 'Nenhum pagamento registrado ainda.');
  } else {
    dados.ultimosPagamentos.forEach((p) => adicionarLinha(tbPag, [
      p.nome_pessoa,
      { texto: formatoMoeda.format(p.valor_pagamento), classe: 'valor' },
      p.data || '—',
      badgePagamento(p.status_pagamento)
    ]));
  }
}

function marcarStatus(ok) {
  const el = document.getElementById('statusCarga');
  el.className = 'status ' + (ok ? 'status-ok' : 'status-warn');
  el.textContent = ok ? '● Dados atualizados' : '● Falha ao carregar';
}

async function carregarDados() {
  const aviso = document.getElementById('avisoErro');
  try {
    const dados = await requisicaoAPI('/dashboard/gerente', { method: 'GET' });
    aviso.hidden = true;
    desenharDados(dados);
    marcarStatus(true);
  } catch (erro) {
    aviso.textContent = erro.message;
    aviso.hidden = false;
    marcarStatus(false);
  }
}

(async () => {
  // Confere a sessão (o servidor também bloqueia; isto melhora a experiência)
  const usuario = await exigirSessao(['gerente']);
  if (!usuario) return;

  const nome = usuario.nome || usuario.email || 'Usuário';
  escrever('nomeUsuario', nome);
  escrever('primeiroNome', nome.split(' ')[0]);
  escrever('avatar', nome.split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase());

  const hoje = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
  escrever('subtitulo', 'Resumo da academia · ' + hoje);

  await carregarDados();
})();