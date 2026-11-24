// ============================================================
// matriculaController.js - CRUD de Matrículas (somente gerente)
// Matrícula = aluno + plano + período (início e vencimento) + situação.
// Situação mostrada = ATIVA que passou da data final aparece como VENCIDA.
// ============================================================
const { query, transacao } = require('../database');
const { REGEX_CPF } = require('../utils/validacao');

const SITUACOES = ['ATIVA', 'PENDENTE', 'VENCIDA', 'CANCELADA'];
const STATUS_EDITAVEIS = ['ATIVA', 'PENDENTE', 'CANCELADA']; // VENCIDA é calculada, não escolhida
const REGEX_DATA = /^\d{4}-\d{2}-\d{2}$/;

function dataValida(texto) {
    return REGEX_DATA.test(texto) && !isNaN(new Date(texto));
}

function lerCampos(d) {
    const erros = [];
    const planoId = Number(d.planoId);
    if (!Number.isInteger(planoId) || planoId <= 0) erros.push('Selecione o plano.');
    if (!dataValida(String(d.dataInicio || ''))) erros.push('Informe a data de início.');
    if (d.dataFim && !dataValida(String(d.dataFim))) erros.push('Data de vencimento inválida.');
    if (d.dataFim && dataValida(String(d.dataInicio || '')) && String(d.dataFim) < String(d.dataInicio)) {
        erros.push('O vencimento não pode ser anterior ao início.');
    }
    if (!STATUS_EDITAVEIS.includes(d.status)) erros.push('Situação inválida.');
    return { erros, planoId, dataInicio: d.dataInicio, dataFim: d.dataFim || null, status: d.status };
}

// Vencimento padrão = início + duração do plano - 1 dia (ex.: 01/11 + 1 mês = 30/11)
async function calcularFim(dataInicio, planoId) {
    const r = await query(`SELECT to_char(($1::date + make_interval(months => duracao_meses_plano) - INTERVAL '1 day')::date, 'YYYY-MM-DD') AS fim
                             FROM plano WHERE id_plano = $2`, [dataInicio, planoId]);
    return r.rows[0] ? r.rows[0].fim : null;
}

// Um aluno não pode ter dois períodos vigentes (ATIVA/PENDENTE) que se sobreponham
async function temSobreposicao(cpf, inicio, fim, idIgnorar) {
    const r = await query(`SELECT 1 FROM matricula
                            WHERE aluno_pessoa_cpf_pessoa = $1 AND status_matricula IN ('ATIVA', 'PENDENTE')
                              AND id_matricula <> $4 AND data_inicio_matricula <= $3::date AND data_fim_matricula >= $2::date`,
        [cpf, inicio, fim, idIgnorar]);
    return r.rows.length > 0;
}

// GET /matricula/listar?busca=&situacao=
exports.listarMatriculas = async (req, res) => {
    try {
        const busca = String(req.query.busca || '').trim();
        const situacao = SITUACOES.includes(req.query.situacao) ? req.query.situacao : '';
        const r = await query(`
            SELECT * FROM (
                SELECT m.id_matricula, m.aluno_pessoa_cpf_pessoa AS cpf, p.nome_pessoa, pl.nome_plano,
                       to_char(m.data_inicio_matricula, 'DD/MM/YYYY') AS inicio,
                       to_char(m.data_fim_matricula, 'DD/MM/YYYY')    AS vencimento,
                       m.data_inicio_matricula AS ordem,
                       CASE WHEN m.status_matricula = 'ATIVA' AND m.data_fim_matricula < CURRENT_DATE
                            THEN 'VENCIDA' ELSE m.status_matricula END AS situacao
                  FROM matricula m
                  JOIN pessoa p ON p.cpf_pessoa = m.aluno_pessoa_cpf_pessoa
                  JOIN plano pl ON pl.id_plano  = m.plano_id_plano
            ) x
             WHERE ($1 = '' OR x.nome_pessoa ILIKE '%' || $1 || '%' OR x.cpf LIKE '%' || $1 || '%')
               AND ($2 = '' OR x.situacao = $2)
             ORDER BY x.ordem DESC, x.id_matricula DESC`, [busca, situacao]);
        return res.json({ sucesso: true, matriculas: r.rows });
    } catch (error) {
        console.error('Erro ao listar matrículas:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};

// GET /matricula/alunos  e  GET /matricula/planos  (listas do formulário)
exports.listarAlunos = async (req, res) => {
    try {
        const r = await query(`SELECT a.pessoa_cpf_pessoa AS cpf, p.nome_pessoa
                                 FROM aluno a JOIN pessoa p ON p.cpf_pessoa = a.pessoa_cpf_pessoa ORDER BY p.nome_pessoa`);
        return res.json({ sucesso: true, alunos: r.rows });
    } catch (error) {
        console.error('Erro ao listar alunos:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};

exports.listarPlanosAtivos = async (req, res) => {
    try {
        const r = await query(`SELECT id_plano, nome_plano, valor_plano, duracao_meses_plano
                                 FROM plano WHERE ativo_plano ORDER BY valor_plano, nome_plano`);
        return res.json({ sucesso: true, planos: r.rows.map((p) => ({ ...p, valor_plano: Number(p.valor_plano) })) });
    } catch (error) {
        console.error('Erro ao listar planos:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};

// GET /matricula/:id
exports.obterMatricula = async (req, res) => {
    try {
        const r = await query(`
            SELECT m.id_matricula, m.aluno_pessoa_cpf_pessoa AS cpf, p.nome_pessoa, m.plano_id_plano,
                   pl.nome_plano, pl.valor_plano, pl.duracao_meses_plano,
                   to_char(m.data_inicio_matricula, 'YYYY-MM-DD') AS data_inicio,
                   to_char(m.data_fim_matricula, 'YYYY-MM-DD')    AS data_fim,
                   m.status_matricula
              FROM matricula m JOIN pessoa p ON p.cpf_pessoa = m.aluno_pessoa_cpf_pessoa
              JOIN plano pl ON pl.id_plano = m.plano_id_plano WHERE m.id_matricula = $1`, [req.params.id]);
        if (r.rows.length === 0) return res.status(404).json({ sucesso: false, mensagem: 'Matrícula não encontrada.' });
        return res.json({ sucesso: true, matricula: { ...r.rows[0], valor_plano: Number(r.rows[0].valor_plano) } });
    } catch (error) {
        console.error('Erro ao obter matrícula:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};

// POST /matricula   corpo: { alunoCpf, planoId, dataInicio, dataFim, status }
exports.criarMatricula = async (req, res) => {
    try {
        const d = req.body || {};
        const c = lerCampos(d);
        if (!REGEX_CPF.test(String(d.alunoCpf || ''))) c.erros.push('Selecione o aluno.');
        if (c.erros.length) return res.status(400).json({ sucesso: false, mensagem: c.erros.join(' ') });

        const plano = await query('SELECT ativo_plano FROM plano WHERE id_plano = $1', [c.planoId]);
        if (plano.rows.length === 0) return res.status(400).json({ sucesso: false, mensagem: 'Plano inexistente.' });
        if (!plano.rows[0].ativo_plano) return res.status(409).json({ sucesso: false, mensagem: 'Este plano está inativo e não pode receber novas matrículas.' });

        const fim = c.dataFim || await calcularFim(c.dataInicio, c.planoId);
        if (c.status !== 'CANCELADA' && await temSobreposicao(d.alunoCpf, c.dataInicio, fim, 0)) {
            return res.status(409).json({ sucesso: false, mensagem: 'Este aluno já possui uma matrícula vigente que coincide com este período.' });
        }
        await query(`INSERT INTO matricula (aluno_pessoa_cpf_pessoa, plano_id_plano, data_inicio_matricula, data_fim_matricula, status_matricula)
                     VALUES ($1, $2, $3, $4, $5)`, [d.alunoCpf, c.planoId, c.dataInicio, fim, c.status]);
        return res.status(201).json({ sucesso: true, mensagem: 'Matrícula cadastrada com sucesso.' });
    } catch (error) {
        if (error.code === '23503') return res.status(400).json({ sucesso: false, mensagem: 'Aluno ou plano inexistente.' });
        console.error('Erro ao criar matrícula:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};

// PUT /matricula/:id   (o aluno não muda; altera plano, datas e situação)
exports.atualizarMatricula = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const c = lerCampos(req.body || {});
        if (c.erros.length) return res.status(400).json({ sucesso: false, mensagem: c.erros.join(' ') });

        const atual = await query('SELECT aluno_pessoa_cpf_pessoa AS cpf, plano_id_plano FROM matricula WHERE id_matricula = $1', [id]);
        if (atual.rows.length === 0) return res.status(404).json({ sucesso: false, mensagem: 'Matrícula não encontrada.' });

        if (atual.rows[0].plano_id_plano !== c.planoId) { // trocar de plano exige plano ativo
            const plano = await query('SELECT ativo_plano FROM plano WHERE id_plano = $1', [c.planoId]);
            if (plano.rows.length === 0) return res.status(400).json({ sucesso: false, mensagem: 'Plano inexistente.' });
            if (!plano.rows[0].ativo_plano) return res.status(409).json({ sucesso: false, mensagem: 'Este plano está inativo.' });
        }
        const fim = c.dataFim || await calcularFim(c.dataInicio, c.planoId);
        if (c.status !== 'CANCELADA' && await temSobreposicao(atual.rows[0].cpf, c.dataInicio, fim, id)) {
            return res.status(409).json({ sucesso: false, mensagem: 'Este aluno já possui outra matrícula vigente que coincide com este período.' });
        }
        await query(`UPDATE matricula SET plano_id_plano = $2, data_inicio_matricula = $3, data_fim_matricula = $4, status_matricula = $5
                      WHERE id_matricula = $1`, [id, c.planoId, c.dataInicio, fim, c.status]);
        return res.json({ sucesso: true, mensagem: 'Matrícula atualizada com sucesso.' });
    } catch (error) {
        if (error.code === '23503') return res.status(400).json({ sucesso: false, mensagem: 'Plano inexistente.' });
        console.error('Erro ao atualizar matrícula:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};

// PATCH /matricula/:id/cancelar
// Cancela a matrícula e, se o aluno ficar sem nenhuma outra vigente, cancela as reservas futuras dele.
exports.cancelarMatricula = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const atual = await query('SELECT aluno_pessoa_cpf_pessoa AS cpf, status_matricula FROM matricula WHERE id_matricula = $1', [id]);
        if (atual.rows.length === 0) return res.status(404).json({ sucesso: false, mensagem: 'Matrícula não encontrada.' });
        if (atual.rows[0].status_matricula === 'CANCELADA') return res.status(409).json({ sucesso: false, mensagem: 'Esta matrícula já está cancelada.' });

        await transacao(async (cliente) => {
            await cliente.query("UPDATE matricula SET status_matricula = 'CANCELADA' WHERE id_matricula = $1", [id]);
            await cliente.query(`
                UPDATE reserva SET status_reserva = 'CANCELADA'
                 WHERE aluno_pessoa_cpf_pessoa = $1 AND status_reserva = 'CONFIRMADA' AND data_aula_reserva >= CURRENT_DATE
                   AND NOT EXISTS (SELECT 1 FROM matricula m WHERE m.aluno_pessoa_cpf_pessoa = $1
                                      AND m.status_matricula = 'ATIVA' AND m.data_fim_matricula >= CURRENT_DATE)`,
                [atual.rows[0].cpf]);
        });
        return res.json({ sucesso: true, mensagem: 'Matrícula cancelada.' });
    } catch (error) {
        console.error('Erro ao cancelar matrícula:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};

// DELETE /matricula/:id  (matrícula com pagamentos não pode ser excluída: cancele)
exports.deletarMatricula = async (req, res) => {
    try {
        const r = await query('DELETE FROM matricula WHERE id_matricula = $1', [req.params.id]);
        if (r.rowCount === 0) return res.status(404).json({ sucesso: false, mensagem: 'Matrícula não encontrada.' });
        return res.json({ sucesso: true, mensagem: 'Matrícula excluída com sucesso.' });
    } catch (error) {
        if (error.code === '23503') {
            return res.status(409).json({ sucesso: false, mensagem: 'Esta matrícula possui pagamentos e não pode ser excluída. Cancele-a.' });
        }
        console.error('Erro ao excluir matrícula:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};