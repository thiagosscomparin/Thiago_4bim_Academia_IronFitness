// ============================================================
// server.js - Ponto de entrada do sistema
// Liga tudo: sessão (cookie), segurança, páginas do frontend e
// rotas da API. Para iniciar:  npm run dev  ->  http://localhost:3001
// ============================================================
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const { query } = require('./database');
const { NOME_COOKIE, AREAS, usuarioDaSessao, exigirPagina } = require('./middlewares/auth');

// ------------------------------------------------------------
// 1) Conferências iniciais
// ------------------------------------------------------------
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 16) {
    console.error('❌ SESSION_SECRET ausente ou curto demais no backend/.env (mínimo 16 caracteres).');
    console.error('   Gere um com: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    process.exit(1);
}

const PRODUCAO = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 3001;
const FRONTEND = path.join(__dirname, '../frontend');

const app = express();

// Atrás de um proxy HTTPS (hospedagem), o cookie "secure" precisa disso
if (PRODUCAO) app.set('trust proxy', 1);

// ------------------------------------------------------------
// 2) Segurança e leitura do corpo das requisições
// ------------------------------------------------------------
app.use(helmet({
    contentSecurityPolicy: {
        useDefaults: true,
        directives: {
            // As páginas seguem o padrão do CandyShop, que usa onclick="..." no HTML
            'script-src-attr': ["'unsafe-inline'"],
            // Evita que o navegador force https em localhost
            'upgrade-insecure-requests': null
        }
    }
}));
// Cadastro de modalidade recebe a foto (base64) no corpo: limite maior só nesta rota
app.use('/modalidade', express.json({ limit: '4mb' }));
app.use(express.json({ limit: '100kb' }));

// ------------------------------------------------------------
// 3) Sessão: o servidor guarda quem está logado; o navegador
//    guarda só um cookie com o ID da sessão.
// ------------------------------------------------------------
app.use(session({
    name: NOME_COOKIE,
    secret: process.env.SESSION_SECRET,
    resave: false,              // não regrava a sessão se nada mudou
    saveUninitialized: false,   // não cria cookie para quem nem logou
    rolling: true,              // cada acesso renova o prazo da sessão
    cookie: {
        httpOnly: true,         // JavaScript da página não consegue ler o cookie
        sameSite: 'lax',        // não é enviado em requisições vindas de outros sites
        secure: PRODUCAO,       // em produção, só trafega por HTTPS
        maxAge: 2 * 60 * 60 * 1000 // 2 horas
    }
}));

// ------------------------------------------------------------
// 4) Arquivos públicos (não exigem login)
// ------------------------------------------------------------
app.use('/comum', express.static(path.join(FRONTEND, 'comum')));
app.use('/imagens', express.static(path.join(__dirname, '../imagens')));
app.use('/inicio', express.static(path.join(FRONTEND, 'inicio'), { index: 'inicio.html' }));

// Tela de login: quem já está logado é levado direto ao seu dashboard
app.use('/login', (req, res, next) => {
    const usuario = usuarioDaSessao(req);
    if (usuario) return res.redirect(AREAS[usuario.perfil]);
    return next();
}, express.static(path.join(FRONTEND, 'login'), { index: 'login.html' }));

// Tela de cadastro de novo aluno (pública): quem já está logado vai direto ao seu dashboard
app.use('/cadastro', (req, res, next) => {
    const usuario = usuarioDaSessao(req);
    if (usuario) return res.redirect(AREAS[usuario.perfil]);
    return next();
}, express.static(path.join(FRONTEND, 'cadastro'), { index: 'cadastro.html' }));

// ------------------------------------------------------------
// 5) ROTAS DA API
//    Registre aqui cada novo CRUD (como no CandyShop).
//    IMPORTANTE: as rotas da API vêm ANTES das páginas, para que
//    uma chamada sem permissão receba erro 401/403 em JSON.
// ------------------------------------------------------------
const authRoutes = require('./routes/authRoutes');
app.use('/auth', authRoutes);

const publicoRoutes = require('./routes/publicoRoutes');
app.use('/publico', publicoRoutes); // sem login: só dados públicos, somente leitura

const dashboardRoutes = require('./routes/dashboardRoutes');
app.use('/dashboard', dashboardRoutes);

const pessoaRoutes = require('./routes/pessoaRoutes');
app.use('/pessoa', pessoaRoutes);

const cargoRoutes = require('./routes/cargoRoutes');
app.use('/cargo', cargoRoutes);

const funcionarioRoutes = require('./routes/funcionarioRoutes');
app.use('/funcionario', funcionarioRoutes);

const planoRoutes = require('./routes/planoRoutes');
app.use('/plano', planoRoutes);

const modalidadeRoutes = require('./routes/modalidadeRoutes');
app.use('/modalidade', modalidadeRoutes);

const aulaRoutes = require('./routes/aulaRoutes');
app.use('/aula', aulaRoutes);

const matriculaRoutes = require('./routes/matriculaRoutes');
app.use('/matricula', matriculaRoutes);

const pagamentoRoutes = require('./routes/pagamentoRoutes');
app.use('/pagamento', pagamentoRoutes);

const fichaTreinoRoutes = require('./routes/fichaTreinoRoutes');
app.use('/ficha_treino', fichaTreinoRoutes);

const alunoRoutes = require('./routes/alunoRoutes');
app.use('/aluno', alunoRoutes);

const instrutorRoutes = require('./routes/instrutorRoutes');
app.use('/instrutor', instrutorRoutes);

const contaRoutes = require('./routes/contaRoutes');
app.use('/conta', contaRoutes);

// (os próximos CRUDs entram aqui, ex.: app.use('/pessoa', pessoaRoutes);)

// ------------------------------------------------------------
// 6) PÁGINAS PROTEGIDAS
//    Tabela: pasta do frontend -> perfis que podem abrir.
//    Para cada nova tela, acrescente uma linha.
// ------------------------------------------------------------
const PAGINAS_PROTEGIDAS = {
    dashboard_gerente:   ['gerente'],
    dashboard_instrutor: ['instrutor'],
    dashboard_aluno:     ['aluno'],
    pessoa:              ['gerente'],
    cargo:               ['gerente'],
    funcionario:         ['gerente'],
    plano:               ['gerente'],
    modalidade:          ['gerente'],
    aula:                ['gerente'],
    matricula:           ['gerente'],
    pagamento:           ['gerente'],
    ficha_treino:        ['gerente'],
    aluno_aulas:         ['aluno'],
    aluno_ficha:         ['aluno'],
    aluno_plano:         ['aluno'],
    aluno_pagamentos:    ['aluno'],
    aluno_perfil:        ['aluno'],
    instrutor_alunos:    ['instrutor'],
    instrutor_fichas:    ['instrutor'],
    instrutor_agenda:    ['instrutor']
};

for (const [pasta, perfis] of Object.entries(PAGINAS_PROTEGIDAS)) {
    app.use(
        '/' + pasta,
        exigirPagina(...perfis),
        express.static(path.join(FRONTEND, pasta), { index: pasta + '.html' })
    );
}

// ------------------------------------------------------------
// 7) Página inicial e tratamento de erros
// ------------------------------------------------------------
// A raiz abre a PÁGINA INICIAL pública. Quem está logado vê nela o botão "Meu painel".
app.get('/', (req, res) => res.redirect('/inicio/'));

// Nenhuma rota encontrada
app.use((req, res) => {
    if (req.accepts('html')) return res.status(404).send('Página não encontrada.');
    return res.status(404).json({ sucesso: false, mensagem: 'Rota não encontrada.' });
});

// Erros inesperados (ex.: JSON malformado no corpo da requisição)
app.use((erro, req, res, next) => {
    if (erro.type === 'entity.parse.failed') {
        return res.status(400).json({ sucesso: false, mensagem: 'JSON inválido.' });
    }
    console.error('Erro não tratado:', erro);
    return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
});

// ------------------------------------------------------------
// 8) Inicializa o servidor e testa o PostgreSQL
// ------------------------------------------------------------
const { iniciarRotinas } = require('./utils/rotinas');

app.listen(PORT, async () => {
    console.log('\n=================================');
    console.log(`🚀 Servidor executando na porta ${PORT}`);
    console.log(`🌐 Abra no navegador: http://localhost:${PORT}`);

    try {
        await query('SELECT 1');
        console.log(`✅ Banco de Dados ${process.env.DB_NAME} conectado com sucesso!`);
        iniciarRotinas(); // vence matrículas e conclui reservas passadas (e repete a cada hora)
    } catch (error) {
        console.error('❌ FALHA NA CONEXÃO COM O BANCO DE DADOS:');
        console.error(`   Motivo: ${error.message}`);
        console.error('👉 Ajuste o arquivo backend/.env com a senha correta do seu PostgreSQL.');
    }
    console.log('=================================\n');
});