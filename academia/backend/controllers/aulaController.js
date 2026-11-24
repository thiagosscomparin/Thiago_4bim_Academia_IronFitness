// ============================================================
// aulaController.js - CRUD de Aulas (somente gerente)
// Aula = modalidade + instrutor + dia da semana + horário + duração + vagas.
// dia_semana_aula: 1 = segunda ... 7 = domingo.
// O gerente é quem monta a grade; o aluno só reserva (outro módulo).
// ============================================================
const { query } = require('../database');
const { REGEX_CPF } = require('../utils/validacao');

const REGEX_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

// Valida e normaliza os campos
function lerCampos(d) {
    const erros = [];
    const modalidadeId = Number(d.modalidadeId);
    const dia = Number(d.dia);
    const duracao = Number(d.duracao);
    const vagas = Number(d.vagas);
    const horario = String(d.horario || '');

    if (!Number.isInteger(modalidadeId) || modalidadeId <= 0) erros.push('Selecione a modalidade.');
    if (!REGEX_CPF.test(String(d.instrutorCpf || ''))) erros.push('Selecione o instrutor.');
    if (!Number.isInteger(dia) || dia < 1 || dia > 7) erros.push('Selecione o dia da semana.');
    if (!REGEX_HORA.test(horario)) erros.push('Informe um horário válido (HH:MM).');
    if (!Number.isInteger(duracao) || duracao < 15 || duracao > 240) erros.push('A duração deve ser de 15 a 240 minutos.');
    if (!Number.isInteger(vagas) || vagas < 1 || vagas > 200) erros.push('As vagas devem ser de 1 a 200.');
    // A aula precisa terminar no mesmo dia (evita virar a meia-noite)
    if (REGEX_HORA.test(horario) && Number.isInteger(duracao)) {
        const [h, m] = horario.split(':').map(Number);
        if (h * 60 + m + duracao > 24 * 60) erros.push('A aula não pode passar da meia-noite.');
    }
    return { erros, modalidadeId, instrutorCpf: d.instrutorCpf, dia, horario, duracao, vagas };
}

// Só funcionário com cargo de instrutor pode ministrar aula
async function ehInstrutor(cpf) {
    const r = await query(`SELECT 1 FROM funcionario f JOIN cargo c ON c.id_cargo = f.cargo_id_cargo
                            WHERE f.pessoa_cpf_pessoa = $1 AND c.instrutor_cargo`, [cpf]);
    return r.rows.length > 0;
}

// O mesmo instrutor não pode ter duas aulas se sobrepondo no mesmo dia.
// Duas faixas de horário se sobrepõem quando: início_A < fim_B  E  fim_A > início_B
async function temConflito(c, idIgnorar) {
    const r = await query(`
        SELECT 1 FROM aula a
         WHERE a.funcionario_pessoa_cpf_pessoa = $1 AND a.dia_semana_aula = $2 AND a.id_aula <> $5
           AND a.horario_inicio_aula < ($3::time + make_interval(mins => $4::int))
           AND (a.horario_inicio_aula + make_interval(mins => a.duracao_minutos_aula)) > $3::time`,
        [c.instrutorCpf, c.dia, c.horario, c.duracao, idIgnorar]);
    return r.rows.length > 0;
}

// Validações que dependem do banco (criação e edição)
async function validarRegras(c, idIgnorar) {
    if (!(await ehInstrutor(c.instrutorCpf))) return 'O funcionário selecionado não tem cargo de instrutor.';
    if (await temConflito(c, idIgnorar)) return 'Este instrutor já tem outra aula que se sobrepõe a este horário.';
    return null;
}

// GET /aula/listar
exports.listarAulas = async (req, res) => {
    try {
        const r = await query(`
            SELECT a.id_aula, m.nome_modalidade, p.nome_pessoa AS instrutor, a.dia_semana_aula,
                   to_char(a.horario_inicio_aula, 'HH24:MI') AS horario,
                   a.duracao_minutos_aula, a.vagas_aula,
                   (SELECT COUNT(*) FROM reserva r WHERE r.aula_id_aula = a.id_aula
                       AND r.status_reserva = 'CONFIRMADA' AND r.data_aula_reserva >= CURRENT_DATE)::int AS reservas_futuras
              FROM aula a
              JOIN modalidade m ON m.id_modalidade = a.modalidade_id_modalidade
              JOIN pessoa p     ON p.cpf_pessoa = a.funcionario_pessoa_cpf_pessoa
             ORDER BY a.dia_semana_aula, a.horario_inicio_aula`);
        return res.json({ sucesso: true, aulas: r.rows });
    } catch (error) {
        console.error('Erro ao listar aulas:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};

// GET /aula/instrutores -> funcionários com cargo de instrutor (para o formulário)
exports.listarInstrutores = async (req, res) => {
    try {
        const r = await query(`
            SELECT f.pessoa_cpf_pessoa AS cpf, p.nome_pessoa, c.nome_cargo
              FROM funcionario f
              JOIN pessoa p ON p.cpf_pessoa = f.pessoa_cpf_pessoa
              JOIN cargo c  ON c.id_cargo = f.cargo_id_cargo
             WHERE c.instrutor_cargo ORDER BY p.nome_pessoa`);
        return res.json({ sucesso: true, instrutores: r.rows });
    } catch (error) {
        console.error('Erro ao listar instrutores:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};

// GET /aula/:id
exports.obterAula = async (req, res) => {
    try {
        const r = await query(`
            SELECT id_aula, modalidade_id_modalidade, funcionario_pessoa_cpf_pessoa AS instrutor_cpf,
                   dia_semana_aula, to_char(horario_inicio_aula, 'HH24:MI') AS horario,
                   duracao_minutos_aula, vagas_aula
              FROM aula WHERE id_aula = $1`, [req.params.id]);
        if (r.rows.length === 0) return res.status(404).json({ sucesso: false, mensagem: 'Aula não encontrada.' });
        return res.json({ sucesso: true, aula: r.rows[0] });
    } catch (error) {
        console.error('Erro ao obter aula:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};

// POST /aula   corpo: { modalidadeId, instrutorCpf, dia, horario, duracao, vagas }
exports.criarAula = async (req, res) => {
    try {
        const c = lerCampos(req.body || {});
        if (c.erros.length) return res.status(400).json({ sucesso: false, mensagem: c.erros.join(' ') });
        const problema = await validarRegras(c, 0);
        if (problema) return res.status(409).json({ sucesso: false, mensagem: problema });

        await query(`INSERT INTO aula (modalidade_id_modalidade, funcionario_pessoa_cpf_pessoa, dia_semana_aula,
                                       horario_inicio_aula, duracao_minutos_aula, vagas_aula)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
            [c.modalidadeId, c.instrutorCpf, c.dia, c.horario, c.duracao, c.vagas]);
        return res.status(201).json({ sucesso: true, mensagem: 'Aula cadastrada com sucesso.' });
    } catch (error) {
        if (error.code === '23503') return res.status(400).json({ sucesso: false, mensagem: 'Modalidade ou instrutor inexistente.' });
        console.error('Erro ao criar aula:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};

// PUT /aula/:id
exports.atualizarAula = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const c = lerCampos(req.body || {});
        if (c.erros.length) return res.status(400).json({ sucesso: false, mensagem: c.erros.join(' ') });

        const atual = await query('SELECT dia_semana_aula FROM aula WHERE id_aula = $1', [id]);
        if (atual.rows.length === 0) return res.status(404).json({ sucesso: false, mensagem: 'Aula não encontrada.' });

        const problema = await validarRegras(c, id);
        if (problema) return res.status(409).json({ sucesso: false, mensagem: problema });

        // Reservas futuras confirmadas protegem a aula contra mudanças que as invalidariam
        const futuras = await query(`
            SELECT COUNT(*)::int AS total, COALESCE(MAX(qtd), 0)::int AS maior
              FROM (SELECT COUNT(*) AS qtd FROM reserva
                     WHERE aula_id_aula = $1 AND status_reserva = 'CONFIRMADA' AND data_aula_reserva >= CURRENT_DATE
                     GROUP BY data_aula_reserva) x`, [id]);
        const { total, maior } = futuras.rows[0];
        if (total > 0 && atual.rows[0].dia_semana_aula !== c.dia) {
            return res.status(409).json({ sucesso: false, mensagem: 'Há reservas futuras nesta aula; não é possível mudar o dia da semana.' });
        }
        if (c.vagas < maior) {
            return res.status(409).json({ sucesso: false, mensagem: `Há uma data com ${maior} reservas confirmadas; as vagas não podem ser menores que isso.` });
        }

        await query(`UPDATE aula SET modalidade_id_modalidade = $2, funcionario_pessoa_cpf_pessoa = $3, dia_semana_aula = $4,
                            horario_inicio_aula = $5, duracao_minutos_aula = $6, vagas_aula = $7 WHERE id_aula = $1`,
            [id, c.modalidadeId, c.instrutorCpf, c.dia, c.horario, c.duracao, c.vagas]);
        return res.json({ sucesso: true, mensagem: 'Aula atualizada com sucesso.' });
    } catch (error) {
        if (error.code === '23503') return res.status(400).json({ sucesso: false, mensagem: 'Modalidade ou instrutor inexistente.' });
        console.error('Erro ao atualizar aula:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};

// DELETE /aula/:id
exports.deletarAula = async (req, res) => {
    try {
        // A tabela reserva apaga as linhas em cascata junto com a aula. Por isso a regra
        // precisa ser conferida AQUI: aula com qualquer reserva não pode ser excluída.
        const reservas = await query('SELECT 1 FROM reserva WHERE aula_id_aula = $1 LIMIT 1', [req.params.id]);
        if (reservas.rows.length > 0) {
            return res.status(409).json({ sucesso: false, mensagem: 'Esta aula possui reservas (histórico) e não pode ser excluída.' });
        }
        const r = await query('DELETE FROM aula WHERE id_aula = $1', [req.params.id]);
        if (r.rowCount === 0) return res.status(404).json({ sucesso: false, mensagem: 'Aula não encontrada.' });
        return res.json({ sucesso: true, mensagem: 'Aula excluída com sucesso.' });
    } catch (error) {
        if (error.code === '23503') {
            return res.status(409).json({ sucesso: false, mensagem: 'Esta aula possui reservas (histórico) e não pode ser excluída.' });
        }
        console.error('Erro ao excluir aula:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};