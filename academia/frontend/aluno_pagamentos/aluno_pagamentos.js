// aluno_pagamentos.js - Meus pagamentos e Pix (conversa com /aluno/pagamentos)
const $ = (id) => document.getElementById(id);
const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const BADGE = { PENDENTE: 'status-warn', ATRASADO: 'status-off', PAGO: 'status-ok', ESTORNADO: 'status-off' };
const ROTULO = { PENDENTE: 'Pendente', ATRASADO: 'Atrasado', PAGO: 'Pago', ESTORNADO: 'Estornado' };

async function carregar() {
  try {
    const { pagamentos } = await requisicaoAPI('/aluno/pagamentos');
    preencherTabelaCrud('tbPagamentos', pagamentos.map((p) => {
      const aberto = p.situacao === 'PENDENTE' || p.situacao === 'ATRASADO';
      return [
        p.nome_plano, { texto: moeda.format(p.valor_pagamento), classe: 'valor' }, p.forma, p.data,
        { etiquetas: [{ texto: ROTULO[p.situacao], classe: BADGE[p.situacao] }] },
        aberto ? { botoes: [{ texto: 'Pagar com Pix', classe: '', aoClicar: () => mostrarPix(p) }] } : '—'
      ];
    }), 6, 'Você ainda não tem pagamentos. Contrate um plano em “Meu plano”.');
  } catch (erro) { mostrarToast(erro.message, 'error'); }
}

async function mostrarPix(p) {
  try {
    const dados = await requisicaoAPI('/aluno/pagamentos/' + p.id_pagamento + '/pix');
    $('pixValor').textContent = `${p.nome_plano} · ${moeda.format(dados.valor)}`;
    $('pixQr').src = dados.qrcode;
    $('pixCodigo').value = dados.payload;
    abrirModal('modalPix');
  } catch (erro) { mostrarToast(erro.message, 'error'); }
}

async function copiar() {
  try {
    await navigator.clipboard.writeText($('pixCodigo').value);
    mostrarToast('Código Pix copiado.');
  } catch (e) {
    $('pixCodigo').select();
    mostrarToast('Selecione e copie o código manualmente (Ctrl+C).', 'error');
  }
}

$('btnCopiar').addEventListener('click', copiar);
$('btnFecharPix').addEventListener('click', () => { fecharModal('modalPix'); carregar(); });

(async () => {
  const usuario = await exigirSessao(['aluno']);
  if (!usuario) return;
  preencherMenuUsuario(usuario);
  await carregar();
})();