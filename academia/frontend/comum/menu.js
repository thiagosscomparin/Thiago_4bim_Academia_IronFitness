// menu.js - Menu lateral montado por JavaScript para ser IGUAL em todas as telas de cada perfil.
// O perfil vem de <body data-perfil="aluno"> (sem o atributo, vale "gerente").
// Para ativar um módulo novo, basta colocar o "href" dele aqui (sem href = "em breve").
const MENUS = {
  gerente: {
    rotulo: 'Gerência',
    inicio: '/dashboard_gerente/dashboard_gerente.html',
    grupos: [
      { grupo: 'Menu principal', itens: [{ t: 'Visão geral', i: '⌂', href: '/dashboard_gerente/dashboard_gerente.html' }] },
      { grupo: 'Pessoas', itens: [
        { t: 'Pessoas', i: '👤', href: '/pessoa/pessoa.html' },
        { t: 'Funcionários', i: '🧑‍💼', href: '/funcionario/funcionario.html' },
        { t: 'Cargos', i: '🏷️', href: '/cargo/cargo.html' }] },
      { grupo: 'Academia', itens: [
        { t: 'Planos', i: '📋', href: '/plano/plano.html' },
        { t: 'Modalidades', i: '🥊', href: '/modalidade/modalidade.html' },
        { t: 'Aulas', i: '🗓️', href: '/aula/aula.html' },
        { t: 'Fichas de treino', i: '🏋️', href: '/ficha_treino/ficha_treino.html' }] },
      { grupo: 'Financeiro', itens: [
        { t: 'Matrículas', i: '✅', href: '/matricula/matricula.html' },
        { t: 'Pagamentos', i: '💳', href: '/pagamento/pagamento.html' }] }
    ]
  },
  instrutor: {
    rotulo: 'Instrutor',
    inicio: '/dashboard_instrutor/dashboard_instrutor.html',
    grupos: [
      { grupo: 'Menu principal', itens: [{ t: 'Visão geral', i: '⌂', href: '/dashboard_instrutor/dashboard_instrutor.html' }] },
      { grupo: 'Acompanhamento', itens: [
        { t: 'Meus alunos', i: '👥', href: '/instrutor_alunos/instrutor_alunos.html' },
        { t: 'Fichas de treino', i: '🏋️', href: '/instrutor_fichas/instrutor_fichas.html' },
        { t: 'Agenda de aulas', i: '🗓️', href: '/instrutor_agenda/instrutor_agenda.html' }] }
    ]
  },
  aluno: {
    rotulo: 'Aluno',
    inicio: '/dashboard_aluno/dashboard_aluno.html',
    grupos: [
      { grupo: 'Menu principal', itens: [{ t: 'Visão geral', i: '⌂', href: '/dashboard_aluno/dashboard_aluno.html' }] },
      { grupo: 'Meu espaço', itens: [
        { t: 'Meu perfil', i: '👤', href: '/aluno_perfil/aluno_perfil.html' },
        { t: 'Meu plano', i: '📋', href: '/aluno_plano/aluno_plano.html' },
        { t: 'Minha ficha', i: '🏋️', href: '/aluno_ficha/aluno_ficha.html' },
        { t: 'Aulas e reservas', i: '🗓️', href: '/aluno_aulas/aluno_aulas.html' },
        { t: 'Pagamentos', i: '💳', href: '/aluno_pagamentos/aluno_pagamentos.html' }] }
    ]
  }
};

function criar(tag, classe, texto) {
  const el = document.createElement(tag);
  if (classe) el.className = classe;
  if (texto !== undefined) el.textContent = texto;
  return el;
}

function montarMenu() {
  const menu = MENUS[document.body.dataset.perfil] || MENUS.gerente;
  const aside = document.getElementById('sidebar');

  const marca = criar('a', 'brand');
  marca.href = menu.inicio;
  marca.append(criar('div', 'brand-mark', 'I'));
  const nome = criar('div', 'brand-name', 'IRON ');
  nome.append(criar('span', '', 'FITNESS'));
  marca.append(nome);
  aside.append(marca);

  menu.grupos.forEach((g) => {
    aside.append(criar('div', 'side-label', g.grupo));
    const nav = criar('nav', 'side-nav');
    g.itens.forEach((item) => {
      const a = criar('a');
      a.href = item.href || '#';
      if (!item.href) a.classList.add('soon');
      if (item.href === window.location.pathname) a.classList.add('active');
      a.append(criar('span', 'side-icon', item.i), item.t);
      if (!item.href) a.append(criar('em', '', 'em breve'));
      nav.append(a);
    });
    aside.append(nav);
  });

  const rodape = criar('div', 'sidebar-bottom');
  const perfil = criar('div', 'profile-mini');
  const avatar = criar('div', 'avatar'); avatar.id = 'avatar';
  const nomeUsuario = criar('strong', '', 'Usuário'); nomeUsuario.id = 'nomeUsuario';
  const texto = criar('div');
  texto.append(nomeUsuario, criar('small', '', menu.rotulo));
  perfil.append(avatar, texto);

  const btnInicio = criar('a', 'btn btn-secondary', '← Página inicial');
  btnInicio.href = '/inicio/';
  btnInicio.style.cssText = 'width:100%;margin-top:10px;justify-content:center';

  const sair = criar('button', 'btn btn-secondary', 'Sair da conta');
  sair.style.cssText = 'width:100%;margin-top:8px';
  sair.addEventListener('click', () => encerrarSessao());

  rodape.append(perfil, btnInicio, sair);
  aside.append(rodape);

  document.getElementById('menuBtn')?.addEventListener('click', () => aside.classList.toggle('open'));
}

// Chamada depois de conferir a sessão: coloca nome e iniciais no rodapé do menu
function preencherMenuUsuario(usuario) {
  const nome = usuario.nome || usuario.email || 'Usuário';
  document.querySelector('.profile-mini strong').textContent = nome;
  document.querySelector('.profile-mini .avatar').textContent =
    nome.split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

montarMenu();