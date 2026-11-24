// ============================================================
// planoController.js - CRUD de Planos (somente gerente)
// Plano com matrículas não pode ser excluído: o correto é DESATIVAR
// (ele deixa de ser oferecido, mas o histórico dos alunos continua).
// aulas_semana_plano: 0 = sem aulas coletivas | N = até N por semana | NULL = ilimitado
// ============================================================
const { query } = require('../database');

// Valida e normaliza os campos. Devolve { erros, nome, descricao, valor, duracao, aulasSemana }
function lerCampos(d) {
    const erros = [];
    const nome = String(d.nome || '').trim();
    const descricao = String(d.descricao || '').trim();
    const valor = Number(d.valor);
    const duracao = Number(d.duracao);

    if (nome.length < 2 || nome.length > 50) erros.push('O nome deve ter de 2 a 50 caracteres.');
    if (descricao.length > 200) erros.push('A descrição deve ter no máximo 200 caracteres.');
    if (d.valor === '' || d.valor === null || !Number.isFinite(valor) || valor < 0 || valor > 99999999) erros.push('Valor inválido.');
    if (!Number.isInteger(duracao) || duracao < 1 || duracao > 60) erros.push('A duração deve ser de 1 a 60 meses.');

    let aulasSemana = null; // vazio = ilimitado
    if (d.aulasSemana !== '' && d.aulasSemana !== null && d.aulasSemana !== undefined) {
        aulasSemana = Number(d.aulasSemana);
        if (!Number.isInteger(aulasSemana) || aulasSemana < 0 || aulasSemana > 21) erros.push('Aulas por semana deve ser um número de 0 a 21 (ou vazio para ilimitado).');
    }
    return { erros, nome, descricao, valor, duracao, aulasSemana };
}

async function nomeJaExiste(nome, idIgnorar) {
    const r = await query('SELECT 1 FROM plano WHERE LOWER(nome_plano) = LOWER($1) AND id_plano <> $2', [nome, idIgnorar]);
    return r.rows.length > 0;
}

// GET /plano/listar
exports.listarPlanos = async (req, res) => {
    try {
        const r = await query(`
            SELECT p.id_plano, p.nome_plano, p.descricao_plano, p.valor_plano, p.duracao_meses_plano,
                   p.aulas_semana_plano, p.ativo_plano,
                   (SELECT COUNT(*) FROM matricula m WHERE m.plano_id_plano = p.id_plano)::int AS matriculas
              FROM plano p ORDER BY p.ativo_plano DESC, p.valor_plano, p.nome_plano`);
        return res.json({ sucesso: true, planos: r.rows.map((p) => ({ ...p, valor_plano: Number(p.valor_plano) })) });
    } catch (error) {
        console.error('Erro ao listar planos:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};

// GET /plano/:id
exports.obterPlano = async (req, res) => {
    try {
        const r = await query(`SELECT id_plano, nome_plano, descricao_plano, valor_plano, duracao_meses_plano, aulas_semana_plano, ativo_plano
                                 FROM plano WHERE id_plano = $1`, [req.params.id]);
        if (r.rows.length === 0) return res.status(404).json({ sucesso: false, mensagem: 'Plano não encontrado.' });
        return res.json({ sucesso: true, plano: { ...r.rows[0], valor_plano: Number(r.rows[0].valor_plano) } });
    } catch (error) {
        console.error('Erro ao obter plano:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};

// POST /plano   corpo: { nome, descricao, valor, duracao, aulasSemana }
exports.criarPlano = async (req, res) => {
    try {
        const c = lerCampos(req.body || {});
        if (c.erros.length) return res.status(400).json({ sucesso: false, mensagem: c.erros.join(' ') });
        if (await nomeJaExiste(c.nome, 0)) return res.status(409).json({ sucesso: false, mensagem: 'Já existe um plano com este nome.' });

        await query(`INSERT INTO plano (nome_plano, descricao_plano, valor_plano, duracao_meses_plano, aulas_semana_plano)
                     VALUES ($1, $2, $3, $4, $5)`, [c.nome, c.descricao || null, c.valor, c.duracao, c.aulasSemana]);
        return res.status(201).json({ sucesso: true, mensagem: 'Plano cadastrado com sucesso.' });
    } catch (error) {
        console.error('Erro ao criar plano:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};

// PUT /plano/:id
exports.atualizarPlano = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const c = lerCampos(req.body || {});
        if (c.erros.length) return res.status(400).json({ sucesso: false, mensagem: c.erros.join(' ') });
        if (await nomeJaExiste(c.nome, id)) return res.status(409).json({ sucesso: false, mensagem: 'Já existe um plano com este nome.' });

        const r = await query(`UPDATE plano SET nome_plano = $2, descricao_plano = $3, valor_plano = $4,
                                      duracao_meses_plano = $5, aulas_semana_plano = $6 WHERE id_plano = $1`,
            [id, c.nome, c.descricao || null, c.valor, c.duracao, c.aulasSemana]);
        if (r.rowCount === 0) return res.status(404).json({ sucesso: false, mensagem: 'Plano não encontrado.' });
        return res.json({ sucesso: true, mensagem: 'Plano atualizado com sucesso.' });
    } catch (error) {
        console.error('Erro ao atualizar plano:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};

// PATCH /plano/:id/ativo   corpo: { ativo: true | false }
exports.alterarAtivo = async (req, res) => {
    try {
        const ativo = req.body && req.body.ativo;
        if (typeof ativo !== 'boolean') return res.status(400).json({ sucesso: false, mensagem: 'Informe ativo como verdadeiro ou falso.' });
        const r = await query('UPDATE plano SET ativo_plano = $2 WHERE id_plano = $1', [req.params.id, ativo]);
        if (r.rowCount === 0) return res.status(404).json({ sucesso: false, mensagem: 'Plano não encontrado.' });
        return res.json({ sucesso: true, mensagem: ativo ? 'Plano ativado.' : 'Plano desativado.' });
    } catch (error) {
        console.error('Erro ao alterar status do plano:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};

// DELETE /plano/:id
exports.deletarPlano = async (req, res) => {
    try {
        const r = await query('DELETE FROM plano WHERE id_plano = $1', [req.params.id]);
        if (r.rowCount === 0) return res.status(404).json({ sucesso: false, mensagem: 'Plano não encontrado.' });
        return res.json({ sucesso: true, mensagem: 'Plano excluído com sucesso.' });
    } catch (error) {
        if (error.code === '23503') {
            return res.status(409).json({ sucesso: false, mensagem: 'Este plano possui matrículas e não pode ser excluído. Desative-o para parar de oferecê-lo.' });
        }
        console.error('Erro ao excluir plano:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};