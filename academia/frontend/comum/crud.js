// crud.js - funções compartilhadas pelas telas de cadastro (janela, aviso, confirmação)

function abrirModal(id) { document.getElementById(id).classList.add('aberto'); }
function fecharModal(id) { document.getElementById(id).classList.remove('aberto'); }

// Aviso temporário no canto da tela. tipo: 'success' ou 'error'
function mostrarToast(texto, tipo = 'success') {
  let area = document.getElementById('toasts');
  if (!area) { area = document.createElement('div'); area.id = 'toasts'; area.className = 'toasts'; document.body.append(area); }
  const t = document.createElement('div');
  t.className = 'alert alert-' + tipo + ' toast';
  t.textContent = texto;
  area.append(t);
  setTimeout(() => t.remove(), 4500);
}

// Janela de confirmação. Devolve uma Promise: true (confirmou) ou false (cancelou).
function confirmarAcao(mensagem, textoBotao = 'Confirmar') {
  return new Promise((resolve) => {
    const fundo = document.createElement('div');
    fundo.className = 'modal-fundo aberto';
    const caixa = document.createElement('div');
    caixa.className = 'modal';
    caixa.style.maxWidth = '420px';
    const titulo = document.createElement('h2'); titulo.textContent = 'Confirmar';
    const p = document.createElement('p'); p.textContent = mensagem; p.style.color = 'var(--muted)';
    const rodape = document.createElement('div'); rodape.className = 'modal-rodape';
    const cancelar = document.createElement('button'); cancelar.className = 'btn btn-secondary'; cancelar.textContent = 'Cancelar';
    const ok = document.createElement('button'); ok.className = 'btn'; ok.textContent = textoBotao;
    const fechar = (valor) => { fundo.remove(); resolve(valor); };
    cancelar.addEventListener('click', () => fechar(false));
    ok.addEventListener('click', () => fechar(true));
    rodape.append(cancelar, ok);
    caixa.append(titulo, p, rodape);
    fundo.append(caixa);
    document.body.append(fundo);
    ok.focus();
  });
}

// Espera o usuário parar de digitar antes de executar (usado na busca)
function atrasar(funcao, ms = 300) {
  let temporizador;
  return (...args) => { clearTimeout(temporizador); temporizador = setTimeout(() => funcao(...args), ms); };
}

// Esc fecha qualquer janela aberta
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') document.querySelectorAll('.modal-fundo.aberto').forEach((m) => m.classList.remove('aberto'));
});

// Preenche a tabela de um cadastro. Cada célula pode ser:
//   texto | { miniatura, alt } | { texto, classe } | { etiquetas: [{texto, classe}] } | { botoes: [{texto, classe, aoClicar}] }
function preencherTabelaCrud(idTbody, linhas, colunas, vazio) {
  const tbody = document.getElementById(idTbody);
  tbody.replaceChildren();
  if (linhas.length === 0) {
    const tr = document.createElement('tr'), td = document.createElement('td');
    td.colSpan = colunas; td.className = 'empty-state'; td.textContent = vazio;
    tr.append(td); tbody.append(tr);
    return;
  }
  linhas.forEach((celulas) => {
    const tr = document.createElement('tr');
    celulas.forEach((c) => {
      const td = document.createElement('td');
      if (c && c.etiquetas) {
        const grupo = document.createElement('div'); grupo.className = 'etiquetas';
        c.etiquetas.forEach((e) => { const s = document.createElement('span'); s.className = 'status ' + e.classe; s.textContent = e.texto; grupo.append(s); });
        td.append(grupo);
      } else if (c && c.botoes) {
        const grupo = document.createElement('div'); grupo.className = 'acoes';
        c.botoes.forEach((b) => { const el = document.createElement('button'); el.className = 'btn btn-sm ' + b.classe; el.textContent = b.texto; el.addEventListener('click', b.aoClicar); grupo.append(el); });
        td.append(grupo);
      } else if (c && typeof c === 'object' && 'miniatura' in c) {
        if (c.miniatura) {
          const img = document.createElement('img');
          img.className = 'miniatura'; img.src = c.miniatura; img.alt = c.alt || ''; img.loading = 'lazy';
          td.append(img);
        } else td.textContent = '—';
      } else if (c && typeof c === 'object') {
        td.textContent = c.texto; if (c.classe) td.className = c.classe;
      } else {
        td.textContent = (c === null || c === undefined || c === '') ? '—' : c;
      }
      tr.append(td);
    });
    tbody.append(tr);
  });
}