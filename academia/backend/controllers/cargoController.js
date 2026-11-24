// ============================================================
// cargoController.js - CRUD de Cargos (somente gerente)
// O cargo define as PERMISSÕES: acesso_admin_cargo = área do gerente;
// instrutor_cargo = área do instrutor. O funcionário herda do cargo.
// ============================================================
const { query } = require('../database');

function validarCargo(d) {
    const erros = [];
    const nome = String(d.nome || '').trim();
    if (nome.length < 2 || nome.length > 45) erros.push('O nome do cargo deve ter de 2 a 45 caracteres.');
    return erros;
}

// GET /cargo/listar
exports.listarCargos = async (req, res) => {
    try {
        const r = await query(`
            SELECT c.id_cargo, c.nome_cargo, c.acesso_admin_cargo, c.instrutor_cargo,
                   (SELECT COUNT(*) FROM funcionario f WHERE f.cargo_id_cargo = c.id_cargo)::int AS funcionarios
              FROM cargo c ORDER BY c.nome_cargo`);
        return res.json({ sucesso: true, cargos: r.rows });
    } catch (error) {
        console.error('Erro ao listar cargos:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};

// GET /cargo/:id
exports.obterCargo = async (req, res) => {
    try {
        const r = await query('SELECT id_cargo, nome_cargo, acesso_admin_cargo, instrutor_cargo FROM cargo WHERE id_cargo = $1', [req.params.id]);
        if (r.rows.length === 0) return res.status(404).json({ sucesso: false, mensagem: 'Cargo não encontrado.' });
        return res.json({ sucesso: true, cargo: r.rows[0] });
    } catch (error) {
        console.error('Erro ao obter cargo:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};

// Impede dois cargos com o mesmo nome (o banco não tem essa restrição)
async function nomeJaExiste(nome, idIgnorar) {
    const r = await query('SELECT 1 FROM cargo WHERE LOWER(nome_cargo) = LOWER($1) AND id_cargo <> $2', [nome, idIgnorar]);
    return r.rows.length > 0;
}

// POST /cargo   corpo: { nome, acessoAdmin, instrutor }
exports.criarCargo = async (req, res) => {
    try {
        const d = req.body || {};
        const erros = validarCargo(d);
        if (erros.length) return res.status(400).json({ sucesso: false, mensagem: erros.join(' ') });
        const nome = String(d.nome).trim();
        if (await nomeJaExiste(nome, 0)) return res.status(409).json({ sucesso: false, mensagem: 'Já existe um cargo com este nome.' });

        await query('INSERT INTO cargo (nome_cargo, acesso_admin_cargo, instrutor_cargo) VALUES ($1, $2, $3)',
            [nome, !!d.acessoAdmin, !!d.instrutor]);
        return res.status(201).json({ sucesso: true, mensagem: 'Cargo cadastrado com sucesso.' });
    } catch (error) {
        console.error('Erro ao criar cargo:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};

// PUT /cargo/:id
exports.atualizarCargo = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const d = req.body || {};
        const erros = validarCargo(d);
        if (erros.length) return res.status(400).json({ sucesso: false, mensagem: erros.join(' ') });
        const nome = String(d.nome).trim();
        if (await nomeJaExiste(nome, id)) return res.status(409).json({ sucesso: false, mensagem: 'Já existe um cargo com este nome.' });

        // Regra: o gerente logado não pode tirar o acesso administrativo do próprio cargo
        if (!d.acessoAdmin) {
            const meu = await query('SELECT cargo_id_cargo FROM funcionario WHERE pessoa_cpf_pessoa = $1', [req.session.usuario.cpf]);
            if (meu.rows[0] && meu.rows[0].cargo_id_cargo === id) {
                return res.status(400).json({ sucesso: false, mensagem: 'Você não pode remover o acesso administrativo do seu próprio cargo.' });
            }
        }
        const r = await query('UPDATE cargo SET nome_cargo = $2, acesso_admin_cargo = $3, instrutor_cargo = $4 WHERE id_cargo = $1',
            [id, nome, !!d.acessoAdmin, !!d.instrutor]);
        if (r.rowCount === 0) return res.status(404).json({ sucesso: false, mensagem: 'Cargo não encontrado.' });
        return res.json({ sucesso: true, mensagem: 'Cargo atualizado com sucesso.' });
    } catch (error) {
        console.error('Erro ao atualizar cargo:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};

// DELETE /cargo/:id
exports.deletarCargo = async (req, res) => {
    try {
        const r = await query('DELETE FROM cargo WHERE id_cargo = $1', [req.params.id]);
        if (r.rowCount === 0) return res.status(404).json({ sucesso: false, mensagem: 'Cargo não encontrado.' });
        return res.json({ sucesso: true, mensagem: 'Cargo excluído com sucesso.' });
    } catch (error) {
        if (error.code === '23503') {
            return res.status(409).json({ sucesso: false, mensagem: 'Não é possível excluir: existem funcionários com este cargo.' });
        }
        console.error('Erro ao excluir cargo:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};