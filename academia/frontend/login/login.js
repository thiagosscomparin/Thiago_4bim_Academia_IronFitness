// ============================================================
// login.js - Login integrado ao backend de sessões da IRON FITNESS
// ============================================================
const formLogin = document.getElementById('formLogin');
const mensagem = document.getElementById('mensagem');
const btnEntrar = document.getElementById('btnEntrar');

function exibirMensagem(texto, tipo = 'error') {
  mensagem.replaceChildren();
  const alerta = document.createElement('div');
  alerta.className = `alert alert-${tipo}`;
  alerta.textContent = texto;
  mensagem.appendChild(alerta);
}

function redirecionar(destino) {
  // O destino é definido pelo backend (AREAS), não pelo formulário.
  window.location.assign(destino || '/');
}

function mostrarEscolhaPerfil(perfis) {
  mensagem.replaceChildren();

  const bloco = document.createElement('div');
  bloco.className = 'alert alert-info';

  const titulo = document.createElement('p');
  titulo.textContent = 'Seu usuário possui mais de um acesso. Escolha como deseja entrar:';
  bloco.appendChild(titulo);

  const seletor = document.createElement('select');
  seletor.id = 'perfilEscolhido';
  seletor.className = 'input';
  seletor.setAttribute('aria-label', 'Escolha seu perfil');

  const nomes = {
    gerente: 'Gerência',
    instrutor: 'Instrutor',
    aluno: 'Aluno'
  };

  perfis.forEach((perfil) => {
    const opcao = document.createElement('option');
    opcao.value = perfil;
    opcao.textContent = nomes[perfil] || perfil;
    seletor.appendChild(opcao);
  });

  const botao = document.createElement('button');
  botao.type = 'button';
  botao.className = 'btn';
  botao.textContent = 'CONTINUAR';
  botao.addEventListener('click', async () => {
    botao.disabled = true;
    botao.textContent = 'VALIDANDO...';
    try {
      const dados = await requisicaoAPI('/auth/escolher-perfil', {
        method: 'POST',
        body: JSON.stringify({ perfil: seletor.value })
      });
      if (!dados.sucesso) throw new Error(dados.mensagem || 'Não foi possível selecionar o perfil.');
      redirecionar(dados.redirecionar);
    } catch (erro) {
      exibirMensagem(erro.message || 'Erro ao selecionar o perfil.');
      botao.disabled = false;
      botao.textContent = 'CONTINUAR';
    }
  });

  bloco.append(seletor, botao);
  mensagem.appendChild(bloco);
}

document.getElementById('toggleSenha').addEventListener('click', () => {
  const campo = document.getElementById('senha');
  const visivel = campo.type === 'password';
  campo.type = visivel ? 'text' : 'password';
  document.getElementById('toggleSenha').textContent = visivel ? 'OCULTAR' : 'MOSTRAR';
});

formLogin.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  mensagem.replaceChildren();
  btnEntrar.disabled = true;
  btnEntrar.textContent = 'VALIDANDO ACESSO...';

  const email = document.getElementById('email').value.trim();
  const senha = document.getElementById('senha').value;

  try {
    const dados = await requisicaoAPI('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, senha })
    });

    if (!dados.sucesso) throw new Error(dados.mensagem || 'Não foi possível entrar.');

    if (dados.escolherPerfil) {
      mostrarEscolhaPerfil(dados.perfis || []);
      return;
    }

    redirecionar(dados.redirecionar);
  } catch (erro) {
    exibirMensagem(erro.message || 'Não foi possível entrar. Verifique seus dados e tente novamente.');
  } finally {
    btnEntrar.disabled = false;
    btnEntrar.innerHTML = 'ENTRAR NA MINHA CONTA <span aria-hidden="true">→</span>';
  }
});
