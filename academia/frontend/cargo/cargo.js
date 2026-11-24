// cargo.js - Tela de cadastro de cargos (conversa com /cargo/... no servidor)
let idEmEdicao = null; // null = cadastrando
const $ = (id) => document.getElementById(id);

function etiquetasAcesso(c) {
  const e = [];
  if (c.acesso_admin_cargo) e.push({ texto: 'Gerente', classe: 'status-ok' });
  if (c.instrutor_cargo) e.push({ texto: 'Instrutor', classe: 'status-warn' });
  if (e.length === 0) e.push({ texto: 'Sem acesso', classe: 'status-off' });
  return e;
}

async function carregarCargos() {
  try {
    const { cargos } = await requisicaoAPI('/cargo/listar');
    preencherTabelaCrud('tbCargos', cargos.map((c) => [
      c.nome_cargo,
      { etiquetas: etiquetasAcesso(c) },
      String(c.funcionarios),
      { botoes: [
        { texto: 'Editar', classe: 'btn-secondary', aoClicar: () => abrirEdicao(c) },
        { texto: 'Excluir', classe: 'btn-danger', aoClicar: () => excluirCargo(c) }
      ] }
    ]), 4, 'Nenhum cargo cadastrado.');
  } catch (erro) { mostrarToast(erro.message, 'error'); }
}

function abrirFormulario(titulo, c) {
  $('formCargo').reset();
  $('erroForm').hidden = true;
  $('tituloModal').textContent = titulo;
  idEmEdicao = c ? c.id_cargo : null;
  if (c) {
    $('nome').value = c.nome_cargo;
    $('acessoAdmin').checked = c.acesso_admin_cargo;
    $('instrutor').checked = c.instrutor_cargo;
  }
  abrirModal('modalCargo');
  $('nome').focus();
}
const abrirNovo = () => abrirFormulario('Novo cargo', null);
const abrirEdicao = (c) => abrirFormulario('Editar cargo', c);

async function salvar(evento) {
  evento.preventDefault();
  const corpo = { nome: $('nome').value.trim(), acessoAdmin: $('acessoAdmin').checked, instrutor: $('instrutor').checked };
  $('btnSalvar').disabled = true;
  try {
    const editando = idEmEdicao !== null;
    const dados = await requisicaoAPI(editando ? '/cargo/' + idEmEdicao : '/cargo', {
      method: editando ? 'PUT' : 'POST', body: JSON.stringify(corpo)
    });
    fecharModal('modalCargo');
    mostrarToast(dados.mensagem);
    await carregarCargos();
  } catch (erro) {
    $('erroForm').textContent = erro.message;
    $('erroForm').hidden = false;
  } finally { $('btnSalvar').disabled = false; }
}

async function excluirCargo(c) {
  if (!(await confirmarAcao(`Excluir o cargo "${c.nome_cargo}"?`, 'Excluir'))) return;
  try {
    const dados = await requisicaoAPI('/cargo/' + c.id_cargo, { method: 'DELETE' });
    mostrarToast(dados.mensagem);
    await carregarCargos();
  } catch (erro) { mostrarToast(erro.message, 'error'); }
}

$('btnNovo').addEventListener('click', abrirNovo);
$('btnCancelar').addEventListener('click', () => fecharModal('modalCargo'));
$('formCargo').addEventListener('submit', salvar);

(async () => {
  const usuario = await exigirSessao(['gerente']);
  if (!usuario) return;
  preencherMenuUsuario(usuario);
  await carregarCargos();
})();