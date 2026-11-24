// pessoa.js - Tela de cadastro de pessoas (conversa com /pessoa/... no servidor)

let cpfEmEdicao = null; // null = cadastrando; CPF = editando

const $ = (id) => document.getElementById(id);
const urlPessoa = (cpf) => '/pessoa/' + encodeURIComponent(cpf);

// ---------- Lista ----------
async function carregarPessoas() {
  try {
    const dados = await requisicaoAPI('/pessoa/listar?busca=' + encodeURIComponent($('busca').value.trim()));
    desenharTabela(dados.pessoas);
  } catch (erro) {
    mostrarToast(erro.message, 'error');
  }
}

function celulaTexto(texto) { const td = document.createElement('td'); td.textContent = texto || '—'; return td; }

function desenharTabela(pessoas) {
  const tbody = $('tbPessoas');
  tbody.replaceChildren();
  if (pessoas.length === 0) {
    const tr = document.createElement('tr'), td = document.createElement('td');
    td.colSpan = 6; td.className = 'empty-state'; td.textContent = 'Nenhuma pessoa encontrada.';
    tr.append(td); tbody.append(tr);
    return;
  }
  pessoas.forEach((p) => {
    const tr = document.createElement('tr');
    tr.append(celulaTexto(p.nome_pessoa), celulaTexto(p.cpf_pessoa), celulaTexto(p.email_pessoa), celulaTexto(p.nascimento));

    const vinculos = document.createElement('td');
    const grupo = document.createElement('div'); grupo.className = 'etiquetas';
    if (p.eh_aluno) { const s = document.createElement('span'); s.className = 'status status-ok'; s.textContent = 'Aluno'; grupo.append(s); }
    if (p.eh_funcionario) { const s = document.createElement('span'); s.className = 'status status-warn'; s.textContent = 'Funcionário'; grupo.append(s); }
    if (!p.eh_aluno && !p.eh_funcionario) grupo.textContent = '—';
    vinculos.append(grupo);

    const acoes = document.createElement('td');
    const div = document.createElement('div'); div.className = 'acoes';
    const editar = document.createElement('button'); editar.className = 'btn btn-secondary btn-sm'; editar.textContent = 'Editar';
    editar.addEventListener('click', () => abrirEdicao(p.cpf_pessoa));
    const excluir = document.createElement('button'); excluir.className = 'btn btn-danger btn-sm'; excluir.textContent = 'Excluir';
    excluir.addEventListener('click', () => excluirPessoa(p));
    div.append(editar, excluir); acoes.append(div);

    tr.append(vinculos, acoes);
    tbody.append(tr);
  });
}

// ---------- Janela de cadastro / edição ----------
function limparFormulario() {
  $('formPessoa').reset();
  $('erroForm').hidden = true;
  $('blocoObjetivo').hidden = true;
}

function abrirNova() {
  cpfEmEdicao = null;
  limparFormulario();
  $('tituloModal').textContent = 'Nova pessoa';
  $('cpf').disabled = false;
  $('senha').required = true;
  $('dicaSenha').textContent = 'Mínimo de 6 caracteres.';
  abrirModal('modalPessoa');
  $('cpf').focus();
}

async function abrirEdicao(cpf) {
  try {
    const { pessoa } = await requisicaoAPI(urlPessoa(cpf));
    cpfEmEdicao = pessoa.cpf_pessoa;
    limparFormulario();
    $('tituloModal').textContent = 'Editar pessoa';
    $('cpf').value = pessoa.cpf_pessoa;
    $('cpf').disabled = true; // o CPF é a chave: não pode ser alterado
    $('nome').value = pessoa.nome_pessoa;
    $('email').value = pessoa.email_pessoa;
    $('nascimento').value = pessoa.data_nascimento || '';
    $('endereco').value = pessoa.endereco_pessoa || '';
    $('ehAluno').checked = pessoa.eh_aluno;
    $('blocoObjetivo').hidden = !pessoa.eh_aluno;
    $('objetivo').value = pessoa.objetivo_aluno || '';
    $('senha').required = false;
    $('dicaSenha').textContent = 'Deixe em branco para manter a senha atual.';
    abrirModal('modalPessoa');
  } catch (erro) {
    mostrarToast(erro.message, 'error');
  }
}

async function salvar(evento) {
  evento.preventDefault();
  const corpo = {
    cpf: $('cpf').value.trim(),
    nome: $('nome').value.trim(),
    email: $('email').value.trim(),
    senha: $('senha').value,
    dataNascimento: $('nascimento').value,
    endereco: $('endereco').value.trim(),
    ehAluno: $('ehAluno').checked,
    objetivo: $('objetivo').value.trim()
  };
  $('btnSalvar').disabled = true;
  try {
    const editando = cpfEmEdicao !== null;
    const dados = await requisicaoAPI(editando ? urlPessoa(cpfEmEdicao) : '/pessoa', {
      method: editando ? 'PUT' : 'POST',
      body: JSON.stringify(corpo)
    });
    fecharModal('modalPessoa');
    mostrarToast(dados.mensagem);
    await carregarPessoas();
  } catch (erro) {
    $('erroForm').textContent = erro.message; // o servidor valida e explica o problema
    $('erroForm').hidden = false;
  } finally {
    $('btnSalvar').disabled = false;
  }
}

async function excluirPessoa(pessoa) {
  const ok = await confirmarAcao(`Excluir ${pessoa.nome_pessoa}? Essa ação não pode ser desfeita.`, 'Excluir');
  if (!ok) return;
  try {
    const dados = await requisicaoAPI(urlPessoa(pessoa.cpf_pessoa), { method: 'DELETE' });
    mostrarToast(dados.mensagem);
    await carregarPessoas();
  } catch (erro) {
    mostrarToast(erro.message, 'error');
  }
}

// Máscara do CPF enquanto digita (000.000.000-00)
$('cpf').addEventListener('input', (e) => {
  const n = e.target.value.replace(/\D/g, '').slice(0, 11);
  e.target.value = n.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
});

$('btnNova').addEventListener('click', abrirNova);
$('btnCancelar').addEventListener('click', () => fecharModal('modalPessoa'));
$('formPessoa').addEventListener('submit', salvar);
$('ehAluno').addEventListener('change', (e) => { $('blocoObjetivo').hidden = !e.target.checked; });
$('busca').addEventListener('input', atrasar(carregarPessoas));

(async () => {
  const usuario = await exigirSessao(['gerente']);
  if (!usuario) return;
  preencherMenuUsuario(usuario);
  await carregarPessoas();
})();