// ============================================================
// pessoaController.js - CRUD de Pessoas (somente gerente)
// Segue o padrão do CandyShop: listar / obter / criar / atualizar / deletar.
// "Aluno" é um vínculo: existir uma linha em aluno com o mesmo CPF.
// O vínculo de funcionário é feito no módulo Funcionários.
// ============================================================
const bcrypt = require('bcryptjs');
const { query, transacao } = require('../database');
const { validarPessoa } = require('../utils/validacao');

// Traduz erros do PostgreSQL em mensagens que o gerente entende
function responderErroBanco(error, res, acao) {
    if (error.code === '23505') { // violação de UNIQUE
        const msg = String(error.constraint).includes('email')
            ? 'Já existe uma pessoa com este e-mail.'
            : 'Já existe uma pessoa com este CPF.';
        return res.status(409).json({ sucesso: false, mensagem: msg });
    }
    if (error.code === '23503') { // violação de chave estrangeira
        return res.status(409).json({
            sucesso: false,
            mensagem: `Não foi possível ${acao}: há registros vinculados (matrículas, aulas, reservas ou fichas).`
        });
    }
    console.error(`Erro ao ${acao} pessoa:`, error);
    return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
}

// GET /pessoa/listar?busca=texto
exports.listarPessoas = async (req, res) => {
    try {
        const busca = String(req.query.busca || '').trim();
        const resultado = await query(`
            SELECT p.cpf_pessoa, p.nome_pessoa, p.email_pessoa,
                   to_char(p.data_nascimento_pessoa, 'DD/MM/YYYY') AS nascimento,
                   (a.pessoa_cpf_pessoa IS NOT NULL) AS eh_aluno,
                   (f.pessoa_cpf_pessoa IS NOT NULL) AS eh_funcionario
              FROM pessoa p
              LEFT JOIN aluno a       ON a.pessoa_cpf_pessoa = p.cpf_pessoa
              LEFT JOIN funcionario f ON f.pessoa_cpf_pessoa = p.cpf_pessoa
             WHERE $1 = ''
                OR p.nome_pessoa  ILIKE '%' || $1 || '%'
                OR p.cpf_pessoa   LIKE  '%' || $1 || '%'
                OR p.email_pessoa ILIKE '%' || $1 || '%'
             ORDER BY p.nome_pessoa
        `, [busca]);
        return res.json({ sucesso: true, pessoas: resultado.rows });
    } catch (error) {
        console.error('Erro ao listar pessoas:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};

// GET /pessoa/:cpf  (nunca devolve a senha)
exports.obterPessoa = async (req, res) => {
    try {
        const resultado = await query(`
            SELECT p.cpf_pessoa, p.nome_pessoa, p.email_pessoa, p.endereco_pessoa,
                   to_char(p.data_nascimento_pessoa, 'YYYY-MM-DD') AS data_nascimento,
                   (a.pessoa_cpf_pessoa IS NOT NULL) AS eh_aluno,
                   a.objetivo_aluno
              FROM pessoa p LEFT JOIN aluno a ON a.pessoa_cpf_pessoa = p.cpf_pessoa
             WHERE p.cpf_pessoa = $1
        `, [req.params.cpf]);
        if (resultado.rows.length === 0) {
            return res.status(404).json({ sucesso: false, mensagem: 'Pessoa não encontrada.' });
        }
        return res.json({ sucesso: true, pessoa: resultado.rows[0] });
    } catch (error) {
        console.error('Erro ao obter pessoa:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};

// POST /pessoa   corpo: { cpf, nome, email, senha, dataNascimento, endereco, ehAluno, objetivo }
exports.criarPessoa = async (req, res) => {
    try {
        const d = req.body || {};
        const erros = validarPessoa(d, { criando: true });
        if (erros.length) return res.status(400).json({ sucesso: false, mensagem: erros.join(' ') });

        const hash = await bcrypt.hash(String(d.senha), 10); // a senha NUNCA é gravada pura

        // Transação: ou grava pessoa + vínculo de aluno, ou não grava nada
        await transacao(async (cliente) => {
            await cliente.query(
                `INSERT INTO pessoa (cpf_pessoa, nome_pessoa, data_nascimento_pessoa, endereco_pessoa, email_pessoa, senha_pessoa)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [d.cpf, String(d.nome).trim(), d.dataNascimento || null, d.endereco || null, String(d.email).trim().toLowerCase(), hash]
            );
            if (d.ehAluno) {
                await cliente.query(
                    'INSERT INTO aluno (pessoa_cpf_pessoa, objetivo_aluno) VALUES ($1, $2)',
                    [d.cpf, d.objetivo || null]
                );
            }
        });
        return res.status(201).json({ sucesso: true, mensagem: 'Pessoa cadastrada com sucesso.' });
    } catch (error) {
        return responderErroBanco(error, res, 'cadastrar');
    }
};

// PUT /pessoa/:cpf   (senha em branco = mantém a atual)
exports.atualizarPessoa = async (req, res) => {
    try {
        const cpf = req.params.cpf;
        const d = { ...(req.body || {}), cpf };
        const erros = validarPessoa(d, { criando: false });
        if (erros.length) return res.status(400).json({ sucesso: false, mensagem: erros.join(' ') });

        const encontrada = await transacao(async (cliente) => {
            const atual = await cliente.query(
                `UPDATE pessoa SET nome_pessoa = $2, data_nascimento_pessoa = $3,
                        endereco_pessoa = $4, email_pessoa = $5
                  WHERE cpf_pessoa = $1`,
                [cpf, String(d.nome).trim(), d.dataNascimento || null, d.endereco || null, String(d.email).trim().toLowerCase()]
            );
            if (atual.rowCount === 0) return false;

            if (d.senha) {
                await cliente.query('UPDATE pessoa SET senha_pessoa = $2 WHERE cpf_pessoa = $1',
                    [cpf, await bcrypt.hash(String(d.senha), 10)]);
            }
            if (d.ehAluno) { // cria o vínculo ou só atualiza o objetivo
                await cliente.query(
                    `INSERT INTO aluno (pessoa_cpf_pessoa, objetivo_aluno) VALUES ($1, $2)
                     ON CONFLICT (pessoa_cpf_pessoa) DO UPDATE SET objetivo_aluno = EXCLUDED.objetivo_aluno`,
                    [cpf, d.objetivo || null]
                );
            } else { // remover o vínculo falha (erro 23503) se o aluno já tiver matrículas
                await cliente.query('DELETE FROM aluno WHERE pessoa_cpf_pessoa = $1', [cpf]);
            }
            return true;
        });
        if (!encontrada) return res.status(404).json({ sucesso: false, mensagem: 'Pessoa não encontrada.' });
        return res.json({ sucesso: true, mensagem: 'Pessoa atualizada com sucesso.' });
    } catch (error) {
        return responderErroBanco(error, res, 'atualizar');
    }
};

// DELETE /pessoa/:cpf
exports.deletarPessoa = async (req, res) => {
    try {
        // Regra: o gerente não pode apagar o próprio cadastro (ficaria sem acesso)
        if (req.params.cpf === req.session.usuario.cpf) {
            return res.status(400).json({ sucesso: false, mensagem: 'Você não pode excluir o seu próprio cadastro.' });
        }
        const resultado = await query('DELETE FROM pessoa WHERE cpf_pessoa = $1', [req.params.cpf]);
        if (resultado.rowCount === 0) {
            return res.status(404).json({ sucesso: false, mensagem: 'Pessoa não encontrada.' });
        }
        return res.json({ sucesso: true, mensagem: 'Pessoa excluída com sucesso.' });
    } catch (error) {
        return responderErroBanco(error, res, 'excluir');
    }
};