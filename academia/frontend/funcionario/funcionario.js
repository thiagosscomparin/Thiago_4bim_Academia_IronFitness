// funcionario.js - Tela de cadastro de funcionários (conversa com /funcionario/... e /cargo/listar)
let cpfEmEdicao = null; // null = cadastrando
const $ = (id) => document.getElementById(id);
const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const urlFuncionario = (cpf) => '/funcionario/' + encodeURIComponent(cpf);

function etiquetasAcesso(f) {
  const e = [];
  if (f.acesso_admin_cargo) e.push({ texto: 'Gerente', classe: 'status-ok' });
  if (f.instrutor_cargo) e.push({ texto: 'Instrutor', classe: 'status-warn' });
  if (e.length === 0) e.push({ texto: 'Sem acesso', classe: 'status-off' });
  return e;
}

async function carregarFuncionarios() {
  try {
    const { funcionarios } = await requisicaoAPI('/funcionario/listar?busca=' + encodeURIComponent($('busca').value.trim()));
    preencherTabelaCrud('tbFuncionarios', funcionarios.map((f) => [
      f.nome_pessoa, f.nome_cargo, { etiquetas: etiquetasAcesso(f) },
      f.salario_funcionario === null ? '—' : moeda.format(f.salario_funcionario),
      f.admissao,
      { botoes: [
        { texto: 'Editar', classe: 'btn-secondary', aoClicar: () => abrirEdicao(f.cpf) },
        { texto: 'Excluir', classe: 'btn-danger', aoClicar: () => excluirFuncionario(f) }
      ] }
    ]), 6, 'Nenhum funcionário encontrado.');
  } catch (erro) { mostrarToast(erro.message, 'error'); }
}

function opcao(valor, texto) { const o = document.createElement('option'); o.value = valor; o.textContent = texto; return o; }

async function preencherCargos(selecionado) {
  const { cargos } = await requisicaoAPI('/cargo/listar');
  $('cargo').replaceChildren(opcao('', 'Selecione...'), ...cargos.map((c) => opcao(c.id_cargo, c.nome_cargo)));
  $('cargo').value = selecionado || '';
}

async function abrirNovo() {
  try {
    cpfEmEdicao = null;
    $('formFuncionario').reset();
    $('erroForm').hidden = true;
    $('tituloModal').textContent = 'Novo funcionário';
    const { pessoas } = await requisicaoAPI('/funcionario/disponiveis');
    $('pessoa').replaceChildren(opcao('', 'Selecione...'), ...pessoas.map((p) => opcao(p.cpf_pessoa, p.nome_pessoa + ' · ' + p.cpf_pessoa)));
    $('pessoa').disabled = false;
    $('dicaPessoa').hidden = false;
    await preencherCargos('');
    abrirModal('modalFuncionario');
  } catch (erro) { mostrarToast(erro.message, 'error'); }
}

async function abrirEdicao(cpf) {
  try {
    const { funcionario: f } = await requisicaoAPI(urlFuncionario(cpf));
    cpfEmEdicao = f.cpf;
    $('formFuncionario').reset();
    $('erroForm').hidden = true;
    $('tituloModal').textContent = 'Editar funcionário';
    $('pessoa').replaceChildren(opcao(f.cpf, f.nome_pessoa + ' · ' + f.cpf));
    $('pessoa').disabled = true; // a pessoa não muda; só cargo, salário e admissão
    $('dicaPessoa').hidden = true;
    await preencherCargos(f.cargo_id_cargo);
    $('salario').value = f.salario_funcionario === null ? '' : f.salario_funcionario;
    $('admissao').value = f.data_admissao || '';
    abrirModal('modalFuncionario');
  } catch (erro) { mostrarToast(erro.message, 'error'); }
}

async function salvar(evento) {
  evento.preventDefault();
  const corpo = { cpf: $('pessoa').value, cargoId: $('cargo').value, salario: $('salario').value, dataAdmissao: $('admissao').value };
  $('btnSalvar').disabled = true;
  try {
    const editando = cpfEmEdicao !== null;
    const dados = await requisicaoAPI(editando ? urlFuncionario(cpfEmEdicao) : '/funcionario', {
      method: editando ? 'PUT' : 'POST', body: JSON.stringify(corpo)
    });
    fecharModal('modalFuncionario');
    mostrarToast(dados.mensagem);
    await carregarFuncionarios();
  } catch (erro) {
    $('erroForm').textContent = erro.message;
    $('erroForm').hidden = false;
  } finally { $('btnSalvar').disabled = false; }
}

async function excluirFuncionario(f) {
  if (!(await confirmarAcao(`Remover o vínculo de funcionário de ${f.nome_pessoa}? A pessoa continua cadastrada.`, 'Remover'))) return;
  try {
    const dados = await requisicaoAPI(urlFuncionario(f.cpf), { method: 'DELETE' });
    mostrarToast(dados.mensagem);
    await carregarFuncionarios();
  } catch (erro) { mostrarToast(erro.message, 'error'); }
}

$('btnNovo').addEventListener('click', abrirNovo);
$('btnCancelar').addEventListener('click', () => fecharModal('modalFuncionario'));
$('formFuncionario').addEventListener('submit', salvar);
$('busca').addEventListener('input', atrasar(carregarFuncionarios));

(async () => {
  const usuario = await exigirSessao(['gerente']);
  if (!usuario) return;
  preencherMenuUsuario(usuario);
  await carregarFuncionarios();
})();