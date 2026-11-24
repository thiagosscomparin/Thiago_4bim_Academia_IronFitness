// aluno_perfil.js - Meu perfil e troca de senha (conversa com /aluno/perfil e /conta/senha)
const $ = (id) => document.getElementById(id);

async function carregar() {
  try {
    const { perfil: p } = await requisicaoAPI('/aluno/perfil');
    $('cpf').value = p.cpf;
    $('nome').value = p.nome_pessoa;
    $('email').value = p.email_pessoa;
    $('nascimento').value = p.data_nascimento || '';
    $('endereco').value = p.endereco_pessoa || '';
    $('objetivo').value = p.objetivo_aluno || '';
  } catch (erro) { mostrarToast(erro.message, 'error'); }
}

async function salvarPerfil(evento) {
  evento.preventDefault();
  $('erroPerfil').hidden = true;
  $('btnSalvarPerfil').disabled = true;
  try {
    const dados = await requisicaoAPI('/aluno/perfil', { method: 'PUT', body: JSON.stringify({
      nome: $('nome').value.trim(), email: $('email').value.trim(), dataNascimento: $('nascimento').value,
      endereco: $('endereco').value.trim(), objetivo: $('objetivo').value.trim()
    }) });
    mostrarToast(dados.mensagem);
    preencherMenuUsuario({ nome: $('nome').value.trim() }); // atualiza o nome no menu
  } catch (erro) {
    $('erroPerfil').textContent = erro.message;
    $('erroPerfil').hidden = false;
  } finally { $('btnSalvarPerfil').disabled = false; }
}

async function salvarSenha(evento) {
  evento.preventDefault();
  $('erroSenha').hidden = true;
  if ($('novaSenha').value !== $('confirmaSenha').value) {
    $('erroSenha').textContent = 'A confirmação não é igual à nova senha.';
    $('erroSenha').hidden = false;
    return;
  }
  $('btnSalvarSenha').disabled = true;
  try {
    const dados = await requisicaoAPI('/conta/senha', { method: 'POST', body: JSON.stringify({
      senhaAtual: $('senhaAtual').value, novaSenha: $('novaSenha').value
    }) });
    mostrarToast(dados.mensagem);
    $('formSenha').reset();
  } catch (erro) {
    $('erroSenha').textContent = erro.message;
    $('erroSenha').hidden = false;
  } finally { $('btnSalvarSenha').disabled = false; }
}

$('formPerfil').addEventListener('submit', salvarPerfil);
$('formSenha').addEventListener('submit', salvarSenha);

(async () => {
  const usuario = await exigirSessao(['aluno']);
  if (!usuario) return;
  preencherMenuUsuario(usuario);
  await carregar();
})();