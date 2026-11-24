// ============================================================
// auth.js - "Porteiros" do sistema
// Middleware = função que roda ANTES do controller. Ela olha a
// sessão e decide: deixa passar (next) ou barra a requisição.
// A verificação é feita no BACKEND; esconder botão no frontend
// não protege nada sozinho.
// ============================================================

// Nome do cookie de sessão (usado também no server.js e no logout)
const NOME_COOKIE = 'academia.sid';

// Página inicial (dashboard) de cada perfil.
// Seguindo o padrão do CandyShop: pasta/arquivo com o mesmo nome.
const AREAS = {
    gerente: '/dashboard_gerente/dashboard_gerente.html',
    instrutor: '/dashboard_instrutor/dashboard_instrutor.html',
    aluno: '/dashboard_aluno/dashboard_aluno.html'
};

// Quem está logado? (a sessão guarda req.session.usuario no login)
function usuarioDaSessao(req) {
    return req.session && req.session.usuario ? req.session.usuario : null;
}

// --- Para ROTAS DA API: responde em JSON ---------------------

// Exige apenas estar logado (qualquer perfil)
function exigirLogin(req, res, next) {
    if (usuarioDaSessao(req)) return next();
    return res.status(401).json({ sucesso: false, mensagem: 'Faça login para continuar.' });
}

// Exige estar logado E ter um dos perfis informados.
// Uso: router.get('/', exigirPerfil('gerente'), controller.listar)
//      router.get('/', exigirPerfil('gerente', 'instrutor'), ...)
function exigirPerfil(...perfisPermitidos) {
    return (req, res, next) => {
        const usuario = usuarioDaSessao(req);
        if (!usuario) {
            return res.status(401).json({ sucesso: false, mensagem: 'Faça login para continuar.' });
        }
        if (!perfisPermitidos.includes(usuario.perfil)) {
            return res.status(403).json({ sucesso: false, mensagem: 'Você não tem permissão para esta operação.' });
        }
        return next();
    };
}

// --- Para PÁGINAS (HTML/CSS/JS): responde com redirecionamento ---

// Protege uma pasta inteira do frontend (ex.: frontend/pessoa) para um ou
// mais perfis.  Uso: app.use('/pessoa', exigirPagina('gerente'), express.static(...))
//   Sem login             -> manda para /login/
//   Login de outro perfil -> manda para o dashboard do próprio perfil
function exigirPagina(...perfisPermitidos) {
    return (req, res, next) => {
        // Evita que o botão "voltar" do navegador mostre página protegida após o logout
        res.set('Cache-Control', 'no-store');

        const usuario = usuarioDaSessao(req);
        if (!usuario) return res.redirect('/login/');
        if (!perfisPermitidos.includes(usuario.perfil)) return res.redirect(AREAS[usuario.perfil]);
        return next();
    };
}

module.exports = { NOME_COOKIE, AREAS, usuarioDaSessao, exigirLogin, exigirPerfil, exigirPagina };