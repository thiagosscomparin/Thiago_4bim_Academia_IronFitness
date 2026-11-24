// ============================================================
// funcionarioController.js - CRUD de Funcionários (somente gerente)
// Funcionário = uma PESSOA já cadastrada + cargo + salário + data de admissão.
// Excluir remove só o vínculo de funcionário (a pessoa continua cadastrada).
// ============================================================
const { query } = require('../database');
const { REGEX_CPF } = require('../utils/validacao');

// Valida e normaliza os campos. Devolve { erros, cargoId, salario, dataAdmissao }
function lerCampos(d) {
    const erros = [];
    const cargoId = Number(d.cargoId);
    if (!Number.isInteger(cargoId) || cargoId <= 0) erros.push('Selecione um cargo.');

    let salario = null;
    if (d.salario !== '' && d.salario !== null && d.salario !== undefined) {
        salario = Number(d.salario);
        if (!Number.isFinite(salario) || salario < 0 || salario > 99999999) erros.push('Salário inválido.');
    }
    let dataAdmissao = d.dataAdmissao || null;
    if (dataAdmissao) {
        const dt = new Date(dataAdmissao);
        if (isNaN(dt) || dt > new Date()) erros.push('Data de admissão inválida.');
    }
    return { erros, cargoId, salario, dataAdmissao };
}

// GET /funcionario/listar?busca=
exports.listarFuncionarios = async (req, res) => {
    try {
        const busca = String(req.query.busca || '').trim();
        const r = await query(`
            SELECT f.pessoa_cpf_pessoa AS cpf, p.nome_pessoa, p.email_pessoa, c.nome_cargo,
                   c.acesso_admin_cargo, c.instrutor_cargo, f.salario_funcionario,
                   to_char(f.data_admissao_funcionario, 'DD/MM/YYYY') AS admissao
              FROM funcionario f
              JOIN pessoa p ON p.cpf_pessoa = f.pessoa_cpf_pessoa
              JOIN cargo  c ON c.id_cargo   = f.cargo_id_cargo
             WHERE $1 = '' OR p.nome_pessoa ILIKE '%' || $1 || '%' OR c.nome_cargo ILIKE '%' || $1 || '%'
                OR p.cpf_pessoa LIKE '%' || $1 || '%'
             ORDER BY p.nome_pessoa`, [busca]);
        return res.json({
            sucesso: true,
            funcionarios: r.rows.map((f) => ({ ...f, salario_funcionario: f.salario_funcionario === null ? null : Number(f.salario_funcionario) }))
        });
    } catch (error) {
        console.error('Erro ao listar funcionários:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};

// GET /funcionario/disponiveis  -> pessoas que AINDA não são funcionárias (para o formulário)
exports.listarDisponiveis = async (req, res) => {
    try {
        const r = await query(`
            SELECT p.cpf_pessoa, p.nome_pessoa FROM pessoa p
             WHERE NOT EXISTS (SELECT 1 FROM funcionario f WHERE f.pessoa_cpf_pessoa = p.cpf_pessoa)
             ORDER BY p.nome_pessoa`);
        return res.json({ sucesso: true, pessoas: r.rows });
    } catch (error) {
        console.error('Erro ao listar pessoas disponíveis:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};

// GET /funcionario/:cpf
exports.obterFuncionario = async (req, res) => {
    try {
        const r = await query(`
            SELECT f.pessoa_cpf_pessoa AS cpf, p.nome_pessoa, f.cargo_id_cargo, f.salario_funcionario,
                   to_char(f.data_admissao_funcionario, 'YYYY-MM-DD') AS data_admissao
              FROM funcionario f JOIN pessoa p ON p.cpf_pessoa = f.pessoa_cpf_pessoa
             WHERE f.pessoa_cpf_pessoa = $1`, [req.params.cpf]);
        if (r.rows.length === 0) return res.status(404).json({ sucesso: false, mensagem: 'Funcionário não encontrado.' });
        return res.json({ sucesso: true, funcionario: r.rows[0] });
    } catch (error) {
        console.error('Erro ao obter funcionário:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};

// POST /funcionario   corpo: { cpf, cargoId, salario, dataAdmissao }
exports.criarFuncionario = async (req, res) => {
    try {
        const d = req.body || {};
        const { erros, cargoId, salario, dataAdmissao } = lerCampos(d);
        if (!REGEX_CPF.test(String(d.cpf || ''))) erros.push('Selecione uma pessoa.');
        if (erros.length) return res.status(400).json({ sucesso: false, mensagem: erros.join(' ') });

        await query('INSERT INTO funcionario (pessoa_cpf_pessoa, cargo_id_cargo, salario_funcionario, data_admissao_funcionario) VALUES ($1, $2, $3, $4)',
            [d.cpf, cargoId, salario, dataAdmissao]);
        return res.status(201).json({ sucesso: true, mensagem: 'Funcionário cadastrado com sucesso.' });
    } catch (error) {
        if (error.code === '23505') return res.status(409).json({ sucesso: false, mensagem: 'Esta pessoa já é funcionária.' });
        if (error.code === '23503') return res.status(400).json({ sucesso: false, mensagem: 'Pessoa ou cargo inexistente.' });
        console.error('Erro ao criar funcionário:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};

// PUT /funcionario/:cpf   (o CPF não muda; altera cargo, salário e admissão)
exports.atualizarFuncionario = async (req, res) => {
    try {
        const cpf = req.params.cpf;
        const { erros, cargoId, salario, dataAdmissao } = lerCampos(req.body || {});
        if (erros.length) return res.status(400).json({ sucesso: false, mensagem: erros.join(' ') });

        // Regra: o gerente logado não pode se colocar em um cargo sem acesso administrativo
        if (cpf === req.session.usuario.cpf) {
            const cargo = await query('SELECT acesso_admin_cargo FROM cargo WHERE id_cargo = $1', [cargoId]);
            if (cargo.rows[0] && !cargo.rows[0].acesso_admin_cargo) {
                return res.status(400).json({ sucesso: false, mensagem: 'Você não pode trocar o seu próprio cargo por um sem acesso administrativo.' });
            }
        }
        const r = await query('UPDATE funcionario SET cargo_id_cargo = $2, salario_funcionario = $3, data_admissao_funcionario = $4 WHERE pessoa_cpf_pessoa = $1',
            [cpf, cargoId, salario, dataAdmissao]);
        if (r.rowCount === 0) return res.status(404).json({ sucesso: false, mensagem: 'Funcionário não encontrado.' });
        return res.json({ sucesso: true, mensagem: 'Funcionário atualizado com sucesso.' });
    } catch (error) {
        if (error.code === '23503') return res.status(400).json({ sucesso: false, mensagem: 'Cargo inexistente.' });
        console.error('Erro ao atualizar funcionário:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};

// DELETE /funcionario/:cpf  (remove só o vínculo)
exports.deletarFuncionario = async (req, res) => {
    try {
        if (req.params.cpf === req.session.usuario.cpf) {
            return res.status(400).json({ sucesso: false, mensagem: 'Você não pode remover o seu próprio vínculo de funcionário.' });
        }
        const r = await query('DELETE FROM funcionario WHERE pessoa_cpf_pessoa = $1', [req.params.cpf]);
        if (r.rowCount === 0) return res.status(404).json({ sucesso: false, mensagem: 'Funcionário não encontrado.' });
        return res.json({ sucesso: true, mensagem: 'Vínculo de funcionário removido com sucesso.' });
    } catch (error) {
        if (error.code === '23503') {
            return res.status(409).json({ sucesso: false, mensagem: 'Não é possível remover: este funcionário é instrutor de aulas cadastradas.' });
        }
        console.error('Erro ao excluir funcionário:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};