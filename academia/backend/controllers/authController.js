// ============================================================
// authController.js
// Igual ao CandyShop: o controller recebe a requisição, executa o
// SQL (via database.js) e responde. Aqui ficam as regras do LOGIN:
// confere a senha, descobre o perfil e cria a sessão.
// ============================================================
const bcrypt = require('bcryptjs');
const { query } = require('../database');
const { registrarFalha, limparFalhas } = require('../middlewares/limitadorLogin');
const { NOME_COOKIE, AREAS } = require('../middlewares/auth');

// Hash "de mentira". Se o e-mail não existe, comparamos a senha com ele
// só para gastar o mesmo tempo. Assim ninguém descobre quais e-mails
// existem medindo a velocidade da resposta.
const HASH_FALSO = bcrypt.hashSync('senha-falsa-para-igualar-o-tempo', 10);

const MSG_LOGIN_INVALIDO = 'E-mail ou senha inválidos.';

// ------------------------------------------------------------
// Funções auxiliares (usadas só neste arquivo)
// ------------------------------------------------------------

// Busca a pessoa pelo e-mail e já descobre, em UMA consulta, quais
// vínculos ela tem (aluno, funcionário, cargo admin/instrutor).
// LEFT JOIN = traz a pessoa mesmo que não exista o vínculo.
async function buscarUsuarioPorEmail(email) {
    const sql = `
        SELECT p.cpf_pessoa,
               p.nome_pessoa,
               p.email_pessoa,
               p.senha_pessoa,
               (a.pessoa_cpf_pessoa IS NOT NULL)         AS eh_aluno,
               (f.pessoa_cpf_pessoa IS NOT NULL)         AS eh_funcionario,
               COALESCE(c.acesso_admin_cargo, FALSE)     AS eh_gerente,
               COALESCE(c.instrutor_cargo,    FALSE)     AS eh_instrutor
          FROM pessoa p
          LEFT JOIN aluno       a ON a.pessoa_cpf_pessoa = p.cpf_pessoa
          LEFT JOIN funcionario f ON f.pessoa_cpf_pessoa = p.cpf_pessoa
          LEFT JOIN cargo       c ON c.id_cargo           = f.cargo_id_cargo
         WHERE LOWER(p.email_pessoa) = LOWER($1)`;

    const resultado = await query(sql, [email]);
    return resultado.rows[0] || null; // null = e-mail não cadastrado
}

// Transforma os "sim/não" da consulta em uma lista de perfis.
// Uma pessoa pode ter mais de um (ex.: instrutor que também é aluno).
function determinarPerfis(usuario) {
    const perfis = [];
    if (usuario.eh_gerente)   perfis.push('gerente');
    if (usuario.eh_instrutor) perfis.push('instrutor');
    if (usuario.eh_aluno)     perfis.push('aluno');
    return perfis;
}

// Transformam os callbacks da sessão em Promises (para usar await)
function regenerarSessao(req) {
    return new Promise((resolve, reject) => {
        req.session.regenerate((erro) => (erro ? reject(erro) : resolve()));
    });
}

function salvarSessao(req) {
    return new Promise((resolve, reject) => {
        req.session.save((erro) => (erro ? reject(erro) : resolve()));
    });
}

// Dados que ficam guardados no servidor durante a sessão.
// NUNCA guardar a senha (nem o hash) aqui.
function iniciarSessao(req, dados, perfil) {
    req.session.usuario = {
        cpf: dados.cpf,
        nome: dados.nome,
        email: dados.email,
        perfil: perfil
    };
}

// ------------------------------------------------------------
// Funções das rotas
// ------------------------------------------------------------

// POST /auth/login   corpo: { email, senha }
exports.login = async (req, res) => {
    try {
        const corpo = req.body || {};
        const email = String(corpo.email || '').trim();
        const senha = String(corpo.senha || '');

        if (!email || !senha) {
            return res.status(400).json({ sucesso: false, mensagem: 'Informe e-mail e senha.' });
        }
        if (email.length > 80 || senha.length > 100) {
            return res.status(400).json({ sucesso: false, mensagem: MSG_LOGIN_INVALIDO });
        }

        const usuario = await buscarUsuarioPorEmail(email);

        // Sempre roda o bcrypt, exista o e-mail ou não (veja HASH_FALSO)
        const senhaCorreta = await bcrypt.compare(senha, usuario ? usuario.senha_pessoa : HASH_FALSO);

        if (!usuario || !senhaCorreta) {
            registrarFalha(req);
            // Mesma mensagem nos dois casos: não revela se o e-mail existe
            return res.status(401).json({ sucesso: false, mensagem: MSG_LOGIN_INVALIDO });
        }

        const perfis = determinarPerfis(usuario);
        if (perfis.length === 0) {
            return res.status(403).json({
                sucesso: false,
                mensagem: 'Seu cadastro não possui acesso a nenhuma área do sistema. Procure a gerência.'
            });
        }

        limparFalhas(req);

        // Troca o ID da sessão ao logar (evita "session fixation")
        await regenerarSessao(req);

        const dados = { cpf: usuario.cpf_pessoa, nome: usuario.nome_pessoa, email: usuario.email_pessoa };

        // Um único perfil: entra direto
        if (perfis.length === 1) {
            iniciarSessao(req, dados, perfis[0]);
            await salvarSessao(req);
            return res.json({ sucesso: true, redirecionar: AREAS[perfis[0]] });
        }

        // Vários perfis: a senha já foi conferida, falta escolher a área.
        // Fica "pendente" na sessão (assim a senha não é enviada de novo).
        req.session.loginPendente = { ...dados, perfis };
        await salvarSessao(req);
        return res.json({ sucesso: true, escolherPerfil: true, perfis });
    } catch (error) {
        console.error('Erro no login:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};

// POST /auth/escolher-perfil   corpo: { perfil }
exports.escolherPerfil = async (req, res) => {
    try {
        const pendente = req.session.loginPendente;
        if (!pendente) {
            return res.status(400).json({ sucesso: false, mensagem: 'Nenhum login em andamento. Entre novamente.' });
        }

        const perfil = String((req.body && req.body.perfil) || '');
        if (!pendente.perfis.includes(perfil)) {
            return res.status(403).json({ sucesso: false, mensagem: 'Perfil não disponível para este usuário.' });
        }

        delete req.session.loginPendente;
        iniciarSessao(req, pendente, perfil);
        await salvarSessao(req);
        return res.json({ sucesso: true, redirecionar: AREAS[perfil] });
    } catch (error) {
        console.error('Erro ao escolher perfil:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};

// POST /auth/logout
exports.logout = (req, res) => {
    req.session.destroy((erro) => {
        res.clearCookie(NOME_COOKIE);
        if (erro) {
            console.error('Erro ao encerrar sessão:', erro);
            return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
        }
        return res.json({ sucesso: true, redirecionar: '/login/' });
    });
};

// GET /auth/me  (protegida por exigirLogin)
// O frontend usa para saber quem está logado (nome no topo da página).
exports.me = (req, res) => {
    return res.json({ sucesso: true, usuario: req.session.usuario });
};