// ============================================================
// sessao.js - Utilitários compartilhados de autenticação
// A IRON FITNESS usa express-session com cookie HTTP-only.
// Não armazenamos token nem dados sensíveis no sessionStorage.
// ============================================================

const API_URL = '';

async function requisicaoAPI(caminho, opcoes = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(opcoes.headers || {})
  };

  const resposta = await fetch(`${API_URL}${caminho}`, {
    ...opcoes,
    headers,
    credentials: 'same-origin'
  });

  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    throw new Error(dados.mensagem || 'Não foi possível concluir a solicitação.');
  }
  return dados;
}

async function obterUsuarioSessao() {
  try {
    const dados = await requisicaoAPI('/auth/me', { method: 'GET' });
    return dados.usuario || null;
  } catch {
    return null;
  }
}

async function encerrarSessao() {
  try {
    await requisicaoAPI('/auth/logout', { method: 'POST' });
  } finally {
    window.location.href = '/login/';
  }
}

async function exigirSessao(perfisPermitidos = []) {
  const usuario = await obterUsuarioSessao();
  if (!usuario) {
    window.location.href = '/login/';
    return null;
  }

  if (perfisPermitidos.length && !perfisPermitidos.includes(usuario.perfil)) {
    const destinos = {
      gerente: '/dashboard_gerente/dashboard_gerente.html',
      instrutor: '/dashboard_instrutor/dashboard_instrutor.html',
      aluno: '/dashboard_aluno/dashboard_aluno.html'
    };
    window.location.href = destinos[usuario.perfil] || '/login/';
    return null;
  }

  return usuario;
}
