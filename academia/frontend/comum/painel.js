// painel.js - funções compartilhadas pelos dashboards (instrutor e aluno)
const formatoMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const DIAS_SEMANA = ['', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

function escrever(id, valor) { document.getElementById(id).textContent = valor; }

// Linha de tabela. Célula = texto, ou { texto, badge } (etiqueta colorida), ou { texto, classe }.
// Usa textContent (nunca innerHTML) para um nome jamais ser interpretado como código.
function adicionarLinha(tbody, celulas) {
  const tr = document.createElement('tr');
  celulas.forEach((c) => {
    const td = document.createElement('td');
    if (typeof c === 'object' && c.badge) {
      const span = document.createElement('span');
      span.className = 'status ' + c.badge;
      span.textContent = c.texto;
      td.appendChild(span);
    } else if (typeof c === 'object') {
      td.textContent = c.texto;
      if (c.classe) td.className = c.classe;
    } else {
      td.textContent = c;
    }
    tr.appendChild(td);
  });
  tbody.appendChild(tr);
}

function preencherTabela(idTbody, linhas, colunas, mensagemVazia) {
  const tbody = document.getElementById(idTbody);
  tbody.replaceChildren();
  if (linhas.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = colunas; td.className = 'empty-state'; td.textContent = mensagemVazia;
    tr.appendChild(td); tbody.appendChild(tr);
    return;
  }
  linhas.forEach((l) => adicionarLinha(tbody, l));
}

function marcarStatus(ok) {
  const el = document.getElementById('statusCarga');
  el.className = 'status ' + (ok ? 'status-ok' : 'status-warn');
  el.textContent = ok ? '● Dados atualizados' : '● Falha ao carregar';
}

// Preenche nome, primeiro nome, avatar e data do subtítulo
function preencherUsuario(usuario, textoSubtitulo) {
  const nome = usuario.nome || usuario.email || 'Usuário';
  escrever('nomeUsuario', nome);
  escrever('primeiroNome', nome.split(' ')[0]);
  escrever('avatar', nome.split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase());
  const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  escrever('subtitulo', textoSubtitulo + ' · ' + hoje);
}

// O botão ☰ do celular: se a página usa o menu.js, é ele quem cuida disso (senão abriria e fecharia 2 vezes)
if (typeof montarMenu === 'undefined') {
  document.getElementById('menuBtn')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });
}