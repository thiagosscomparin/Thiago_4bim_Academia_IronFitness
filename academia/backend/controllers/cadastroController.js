// ============================================================
// cadastroController.js - Cadastro PÚBLICO de aluno (sem login)
// A pessoa cria a própria conta e vira ALUNO. O perfil é sempre 'aluno':
// ninguém consegue se cadastrar como gerente ou instrutor por aqui.
// Depois do cadastro a pessoa já fica logada e é levada a escolher o plano.
// ============================================================
const bcrypt = require('bcryptjs');
const { transacao } = require('../database');
const { REGEX_CPF, validarPessoa } = require('../utils/validacao');

const DESTINO_APOS_CADASTRO = '/aluno_plano/aluno_plano.html';

// Confere os dois dígitos verificadores do CPF (o formato 000.000.000-00 já foi validado antes).
// Rejeita também sequências como 111.111.111-11, que passam na conta mas não existem.
function cpfValido(cpf) {
    const d = String(cpf).replace(/\D/g, '').split('').map(Number);
    if (d.length !== 11 || d.every((n) => n === d[0])) return false;
    const digito = (qtd) => {
        let soma = 0;
        for (let i = 0; i < qtd; i++) soma += d[i] * (qtd + 1 - i);
        const resto = (soma * 10) % 11;
        return resto === 10 ? 0 : resto;
    };
    return digito(9) === d[9] && digito(10) === d[10];
}

// Transformam os callbacks da sessão em Promises (para usar await)
function regenerarSessao(req) {
    return new Promise((resolve, reject) => req.session.regenerate((e) => (e ? reject(e) : resolve())));
}
function salvarSessao(req) {
    return new Promise((resolve, reject) => req.session.save((e) => (e ? reject(e) : resolve())));
}

// POST /auth/cadastro   corpo: { nome, cpf, email, senha, dataNascimento?, objetivo? }
exports.cadastrar = async (req, res) => {
    try {
        const corpo = req.body || {};
        const dados = {
            nome: String(corpo.nome || '').trim(),
            cpf: String(corpo.cpf || '').trim(),
            email: String(corpo.email || '').trim().toLowerCase(),
            senha: String(corpo.senha || ''),
            dataNascimento: corpo.dataNascimento ? String(corpo.dataNascimento) : null,
            objetivo: String(corpo.objetivo || '').trim() || null
        };

        const erros = validarPessoa(dados, { criando: true });
        if (REGEX_CPF.test(dados.cpf) && !cpfValido(dados.cpf)) erros.push('CPF inválido. Confira os números.');
        if (dados.dataNascimento) {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(dados.dataNascimento) || dados.dataNascimento < '1900-01-01') {
                erros.push('Data de nascimento inválida.');
            }
        }
        if (erros.length) return res.status(400).json({ sucesso: false, mensagem: erros.join(' ') });

        const hash = await bcrypt.hash(dados.senha, 10); // a senha NUNCA é gravada pura

        // Transação: ou grava pessoa + aluno, ou não grava nada
        await transacao(async (cliente) => {
            await cliente.query(
                `INSERT INTO pessoa (cpf_pessoa, nome_pessoa, data_nascimento_pessoa, email_pessoa, senha_pessoa)
                 VALUES ($1, $2, $3, $4, $5)`,
                [dados.cpf, dados.nome, dados.dataNascimento, dados.email, hash]
            );
            await cliente.query(
                'INSERT INTO aluno (pessoa_cpf_pessoa, objetivo_aluno) VALUES ($1, $2)',
                [dados.cpf, dados.objetivo]
            );
        });

        // Já deixa a pessoa logada (troca o ID da sessão, como no login)
        await regenerarSessao(req);
        req.session.usuario = { cpf: dados.cpf, nome: dados.nome, email: dados.email, perfil: 'aluno' };
        await salvarSessao(req);

        return res.status(201).json({
            sucesso: true,
            mensagem: 'Conta criada! Agora é só escolher o seu plano.',
            redirecionar: DESTINO_APOS_CADASTRO
        });
    } catch (error) {
        if (error.code === '23505') { // violação de UNIQUE (CPF ou e-mail já existem)
            const porEmail = String(error.constraint).includes('email');
            return res.status(409).json({
                sucesso: false,
                mensagem: porEmail
                    ? 'Já existe uma conta com este e-mail. Entre com a sua conta.'
                    : 'Já existe um cadastro com este CPF. Entre com a sua conta ou procure a recepção.'
            });
        }
        console.error('Erro no cadastro de aluno:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};