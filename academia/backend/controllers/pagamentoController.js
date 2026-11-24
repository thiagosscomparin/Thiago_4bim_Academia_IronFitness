// ============================================================
// pagamentoController.js - Pagamentos (somente gerente)
// O sistema só REGISTRA pagamentos (sem integração com banco). O Pix gera o QR
// para o aluno pagar; o gerente confirma o recebimento em "Marcar como pago".
// Situação mostrada: PENDENTE de matrícula que já começou aparece como ATRASADO.
// ============================================================
const { query, transacao } = require('../database');
const pix = require('../utils/pix');

const SITUACOES = ['PENDENTE', 'ATRASADO', 'PAGO', 'ESTORNADO'];

function lerCampos(d) {
    const erros = [];
    const matriculaId = Number(d.matriculaId);
    const formaId = Number(d.formaId);
    const valor = Number(d.valor);
    if (!Number.isInteger(matriculaId) || matriculaId <= 0) erros.push('Selecione a matrícula.');
    if (!Number.isInteger(formaId) || formaId <= 0) erros.push('Selecione a forma de pagamento.');
    if (d.valor === '' || d.valor === null || !Number.isFinite(valor) || valor <= 0 || valor > 99999999) erros.push('Informe um valor maior que zero.');
    return { erros, matriculaId, formaId, valor: Math.round(valor * 100) / 100 };
}

// Confere a matrícula e se o total registrado não ultrapassa o valor do plano.
// Devolve uma mensagem de erro ou null.
async function conferirMatricula(matriculaId, valor, idIgnorar) {
    const r = await query(`
        SELECT m.status_matricula, pl.valor_plano,
               COALESCE((SELECT SUM(g.valor_pagamento) FROM pagamento g
                          WHERE g.matricula_id_matricula = m.id_matricula
                            AND g.status_pagamento IN ('PENDENTE', 'PAGO') AND g.id_pagamento <> $2), 0) AS registrado
          FROM matricula m JOIN plano pl ON pl.id_plano = m.plano_id_plano
         WHERE m.id_matricula = $1`, [matriculaId, idIgnorar]);
    if (r.rows.length === 0) return 'Matrícula inexistente.';
    if (r.rows[0].status_matricula === 'CANCELADA') return 'Não é possível registrar pagamento de uma matrícula cancelada.';
    if (Number(r.rows[0].registrado) + valor > Number(r.rows[0].valor_plano) + 0.001) {
        return `O total dos pagamentos não pode passar do valor do plano (R$ ${Number(r.rows[0].valor_plano).toFixed(2)}). Já registrado: R$ ${Number(r.rows[0].registrado).toFixed(2)}.`;
    }
    return null;
}

// GET /pagamento/listar?busca=&situacao=
exports.listarPagamentos = async (req, res) => {
    try {
        const busca = String(req.query.busca || '').trim();
        const situacao = SITUACOES.includes(req.query.situacao) ? req.query.situacao : '';
        const r = await query(`
            SELECT * FROM (
                SELECT g.id_pagamento, p.nome_pessoa, pl.nome_plano, f.nome_forma_pagamento AS forma,
                       g.valor_pagamento, m.aluno_pessoa_cpf_pessoa AS cpf,
                       to_char(g.data_pagamento, 'DD/MM/YYYY') AS data, g.id_pagamento AS ordem,
                       CASE WHEN g.status_pagamento = 'PENDENTE' AND m.data_inicio_matricula < CURRENT_DATE
                            THEN 'ATRASADO' ELSE g.status_pagamento END AS situacao
                  FROM pagamento g
                  JOIN matricula m ON m.id_matricula = g.matricula_id_matricula
                  JOIN pessoa p    ON p.cpf_pessoa   = m.aluno_pessoa_cpf_pessoa
                  JOIN plano pl    ON pl.id_plano    = m.plano_id_plano
                  JOIN forma_pagamento f ON f.id_forma_pagamento = g.forma_pagamento_id_forma_pagamento
            ) x
             WHERE ($1 = '' OR x.nome_pessoa ILIKE '%' || $1 || '%' OR x.cpf LIKE '%' || $1 || '%')
               AND ($2 = '' OR x.situacao = $2)
             ORDER BY x.ordem DESC`, [busca, situacao]);
        return res.json({ sucesso: true, pagamentos: r.rows.map((p) => ({ ...p, valor_pagamento: Number(p.valor_pagamento) })) });
    } catch (error) {
        console.error('Erro ao listar pagamentos:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};

// GET /pagamento/matriculas  (matrículas não canceladas, com quanto já foi registrado)
exports.listarMatriculas = async (req, res) => {
    try {
        const r = await query(`
            SELECT m.id_matricula, p.nome_pessoa, pl.nome_plano, pl.valor_plano,
                   to_char(m.data_inicio_matricula, 'DD/MM/YYYY') AS inicio,
                   COALESCE((SELECT SUM(g.valor_pagamento) FROM pagamento g WHERE g.matricula_id_matricula = m.id_matricula
                              AND g.status_pagamento IN ('PENDENTE', 'PAGO')), 0) AS registrado
              FROM matricula m JOIN pessoa p ON p.cpf_pessoa = m.aluno_pessoa_cpf_pessoa
              JOIN plano pl ON pl.id_plano = m.plano_id_plano
             WHERE m.status_matricula <> 'CANCELADA'
             ORDER BY m.data_inicio_matricula DESC, m.id_matricula DESC`);
        return res.json({ sucesso: true, matriculas: r.rows.map((m) => ({ ...m, valor_plano: Number(m.valor_plano), registrado: Number(m.registrado) })) });
    } catch (error) {
        console.error('Erro ao listar matrículas:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};

// GET /pagamento/formas
exports.listarFormas = async (req, res) => {
    try {
        const r = await query('SELECT id_forma_pagamento, nome_forma_pagamento FROM forma_pagamento ORDER BY nome_forma_pagamento');
        return res.json({ sucesso: true, formas: r.rows });
    } catch (error) {
        console.error('Erro ao listar formas:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};

// GET /pagamento/:id
exports.obterPagamento = async (req, res) => {
    try {
        const r = await query(`
            SELECT g.id_pagamento, g.matricula_id_matricula, g.forma_pagamento_id_forma_pagamento, g.valor_pagamento,
                   g.status_pagamento, p.nome_pessoa, pl.nome_plano
              FROM pagamento g JOIN matricula m ON m.id_matricula = g.matricula_id_matricula
              JOIN pessoa p ON p.cpf_pessoa = m.aluno_pessoa_cpf_pessoa JOIN plano pl ON pl.id_plano = m.plano_id_plano
             WHERE g.id_pagamento = $1`, [req.params.id]);
        if (r.rows.length === 0) return res.status(404).json({ sucesso: false, mensagem: 'Pagamento não encontrado.' });
        return res.json({ sucesso: true, pagamento: { ...r.rows[0], valor_pagamento: Number(r.rows[0].valor_pagamento) } });
    } catch (error) {
        console.error('Erro ao obter pagamento:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};

// POST /pagamento   corpo: { matriculaId, formaId, valor, status: 'PENDENTE' | 'PAGO' }
exports.criarPagamento = async (req, res) => {
    try {
        const d = req.body || {};
        const c = lerCampos(d);
        if (!['PENDENTE', 'PAGO'].includes(d.status)) c.erros.push('Situação inválida.');
        if (c.erros.length) return res.status(400).json({ sucesso: false, mensagem: c.erros.join(' ') });

        const problema = await conferirMatricula(c.matriculaId, c.valor, 0);
        if (problema) return res.status(409).json({ sucesso: false, mensagem: problema });

        // PAGO já nasce com a data/hora do registro; PENDENTE fica sem data
        await query(`INSERT INTO pagamento (matricula_id_matricula, forma_pagamento_id_forma_pagamento, valor_pagamento, data_pagamento, status_pagamento)
                     VALUES ($1, $2, $3, CASE WHEN $4 = 'PAGO' THEN NOW() ELSE NULL END, $4)`,
            [c.matriculaId, c.formaId, c.valor, d.status]);
        return res.status(201).json({ sucesso: true, mensagem: 'Pagamento registrado com sucesso.' });
    } catch (error) {
        if (error.code === '23503') return res.status(400).json({ sucesso: false, mensagem: 'Matrícula ou forma de pagamento inexistente.' });
        console.error('Erro ao criar pagamento:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};

// PUT /pagamento/:id  (só pagamentos PENDENTES podem ser editados)
exports.atualizarPagamento = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const c = lerCampos(req.body || {});
        if (c.erros.length) return res.status(400).json({ sucesso: false, mensagem: c.erros.join(' ') });

        const atual = await query('SELECT status_pagamento FROM pagamento WHERE id_pagamento = $1', [id]);
        if (atual.rows.length === 0) return res.status(404).json({ sucesso: false, mensagem: 'Pagamento não encontrado.' });
        if (atual.rows[0].status_pagamento !== 'PENDENTE') {
            return res.status(409).json({ sucesso: false, mensagem: 'Só é possível editar pagamentos pendentes. Para corrigir um pagamento confirmado, faça o estorno.' });
        }
        const problema = await conferirMatricula(c.matriculaId, c.valor, id);
        if (problema) return res.status(409).json({ sucesso: false, mensagem: problema });

        await query(`UPDATE pagamento SET matricula_id_matricula = $2, forma_pagamento_id_forma_pagamento = $3, valor_pagamento = $4
                      WHERE id_pagamento = $1`, [id, c.matriculaId, c.formaId, c.valor]);
        return res.json({ sucesso: true, mensagem: 'Pagamento atualizado com sucesso.' });
    } catch (error) {
        if (error.code === '23503') return res.status(400).json({ sucesso: false, mensagem: 'Matrícula ou forma de pagamento inexistente.' });
        console.error('Erro ao atualizar pagamento:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};

// PATCH /pagamento/:id/pagar  -> confirma o recebimento
// Se a matrícula estava PENDENTE e o total pago já cobre o plano, ela é ATIVADA junto (mesma transação).
exports.marcarPago = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const atual = await query('SELECT status_pagamento, matricula_id_matricula FROM pagamento WHERE id_pagamento = $1', [id]);
        if (atual.rows.length === 0) return res.status(404).json({ sucesso: false, mensagem: 'Pagamento não encontrado.' });
        if (atual.rows[0].status_pagamento !== 'PENDENTE') {
            return res.status(409).json({ sucesso: false, mensagem: 'Só pagamentos pendentes podem ser confirmados.' });
        }
        const matriculaId = atual.rows[0].matricula_id_matricula;
        const ativada = await transacao(async (cliente) => {
            await cliente.query("UPDATE pagamento SET status_pagamento = 'PAGO', data_pagamento = NOW() WHERE id_pagamento = $1", [id]);
            const m = await cliente.query(`
                UPDATE matricula m SET status_matricula = 'ATIVA'
                 WHERE m.id_matricula = $1 AND m.status_matricula = 'PENDENTE' AND m.data_fim_matricula >= CURRENT_DATE
                   AND (SELECT COALESCE(SUM(g.valor_pagamento), 0) FROM pagamento g
                         WHERE g.matricula_id_matricula = $1 AND g.status_pagamento = 'PAGO')
                       >= (SELECT valor_plano FROM plano WHERE id_plano = m.plano_id_plano)`, [matriculaId]);
            return m.rowCount > 0;
        });
        return res.json({ sucesso: true, mensagem: ativada ? 'Pagamento confirmado e matrícula ativada.' : 'Pagamento confirmado.' });
    } catch (error) {
        console.error('Erro ao confirmar pagamento:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};

// PATCH /pagamento/:id/estornar  (só PAGO)
exports.estornar = async (req, res) => {
    try {
        const r = await query("UPDATE pagamento SET status_pagamento = 'ESTORNADO' WHERE id_pagamento = $1 AND status_pagamento = 'PAGO'", [req.params.id]);
        if (r.rowCount === 0) {
            const existe = await query('SELECT 1 FROM pagamento WHERE id_pagamento = $1', [req.params.id]);
            if (existe.rows.length === 0) return res.status(404).json({ sucesso: false, mensagem: 'Pagamento não encontrado.' });
            return res.status(409).json({ sucesso: false, mensagem: 'Só pagamentos confirmados podem ser estornados.' });
        }
        return res.json({ sucesso: true, mensagem: 'Pagamento estornado.' });
    } catch (error) {
        console.error('Erro ao estornar pagamento:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};

// DELETE /pagamento/:id  (só PENDENTE; o histórico financeiro não é apagado)
exports.deletarPagamento = async (req, res) => {
    try {
        const r = await query("DELETE FROM pagamento WHERE id_pagamento = $1 AND status_pagamento = 'PENDENTE'", [req.params.id]);
        if (r.rowCount === 0) {
            const existe = await query('SELECT 1 FROM pagamento WHERE id_pagamento = $1', [req.params.id]);
            if (existe.rows.length === 0) return res.status(404).json({ sucesso: false, mensagem: 'Pagamento não encontrado.' });
            return res.status(409).json({ sucesso: false, mensagem: 'Só pagamentos pendentes podem ser excluídos. Pagamentos confirmados ficam no histórico (use o estorno).' });
        }
        return res.json({ sucesso: true, mensagem: 'Pagamento excluído com sucesso.' });
    } catch (error) {
        console.error('Erro ao excluir pagamento:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};

// GET /pagamento/:id/pix  -> QR Code e "copia e cola" de um pagamento PENDENTE
exports.gerarPix = async (req, res) => {
    try {
        if (!pix.pixConfigurado()) {
            return res.status(503).json({ sucesso: false, mensagem: 'O Pix ainda não foi configurado. Preencha PIX_CHAVE, PIX_NOME e PIX_CIDADE no arquivo backend/.env e reinicie o servidor.' });
        }
        const r = await query('SELECT valor_pagamento, status_pagamento FROM pagamento WHERE id_pagamento = $1', [req.params.id]);
        if (r.rows.length === 0) return res.status(404).json({ sucesso: false, mensagem: 'Pagamento não encontrado.' });
        if (r.rows[0].status_pagamento !== 'PENDENTE') return res.status(409).json({ sucesso: false, mensagem: 'O Pix só pode ser gerado para pagamentos pendentes.' });

        const valor = Number(r.rows[0].valor_pagamento);
        const payload = pix.gerarPayloadDoEnv(valor, 'PAG' + req.params.id);
        return res.json({ sucesso: true, valor, payload, qrcode: await pix.gerarQrCode(payload) });
    } catch (error) {
        console.error('Erro ao gerar Pix:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro ao gerar o Pix.' });
    }
};