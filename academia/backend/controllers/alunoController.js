// ============================================================
// alunoController.js - Área do ALUNO (somente perfil aluno)
// O CPF vem SEMPRE da sessão (req.session.usuario.cpf): o aluno nunca consegue
// ver nem alterar dados de outro aluno.
// Aqui: aulas disponíveis, reservas (com todas as regras) e a ficha de treino.
// ============================================================
const { query, transacao } = require('../database');
const { validarPessoa } = require('../utils/validacao');
const pix = require('../utils/pix');

const REGEX_DATA = /^\d{4}-\d{2}-\d{2}$/;

// Erro "esperado" de regra de negócio: vira resposta 400/404/409 (e não erro 500)
class ErroRegra extends Error {
    constructor(mensagem, status = 409) { super(mensagem); this.status = status; }
}

// ---------- GET /aluno/aulas ----------
// Aulas dos PRÓXIMOS 14 DIAS (cada data é uma ocorrência), com vagas livres e se o aluno já reservou.
// generate_series cria uma linha por dia; o JOIN pega as aulas cujo dia da semana bate (ISODOW: 1=seg ... 7=dom).
exports.listarAulasDisponiveis = async (req, res) => {
    try {
        const r = await query(`
            SELECT a.id_aula, to_char(d, 'YYYY-MM-DD') AS data_iso, to_char(d, 'DD/MM') AS data,
                   a.dia_semana_aula, to_char(a.horario_inicio_aula, 'HH24:MI') AS horario, a.duracao_minutos_aula,
                   m.nome_modalidade, p.nome_pessoa AS instrutor, a.vagas_aula,
                   (SELECT COUNT(*) FROM reserva r WHERE r.aula_id_aula = a.id_aula
                       AND r.data_aula_reserva = d::date AND r.status_reserva = 'CONFIRMADA')::int AS ocupadas,
                   EXISTS (SELECT 1 FROM reserva r WHERE r.aula_id_aula = a.id_aula AND r.data_aula_reserva = d::date
                       AND r.aluno_pessoa_cpf_pessoa = $1 AND r.status_reserva = 'CONFIRMADA') AS reservada
              FROM generate_series(CURRENT_DATE::timestamp, (CURRENT_DATE + 13)::timestamp, interval '1 day') AS d
              JOIN aula a       ON a.dia_semana_aula = EXTRACT(ISODOW FROM d)::int
              JOIN modalidade m ON m.id_modalidade = a.modalidade_id_modalidade
              JOIN pessoa p     ON p.cpf_pessoa = a.funcionario_pessoa_cpf_pessoa
             WHERE d::date > CURRENT_DATE OR (d::date + a.horario_inicio_aula) > LOCALTIMESTAMP
             ORDER BY d, a.horario_inicio_aula`, [req.session.usuario.cpf]);
        return res.json({ sucesso: true, aulas: r.rows });
    } catch (error) {
        console.error('Erro ao listar aulas do aluno:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};

// ---------- GET /aluno/reservas ----------
exports.listarMinhasReservas = async (req, res) => {
    try {
        const r = await query(`
            SELECT r.aula_id_aula AS aula_id, to_char(r.data_aula_reserva, 'YYYY-MM-DD') AS data_iso,
                   to_char(r.data_aula_reserva, 'DD/MM/YYYY') AS data, to_char(a.horario_inicio_aula, 'HH24:MI') AS horario,
                   m.nome_modalidade, p.nome_pessoa AS instrutor, r.status_reserva,
                   (r.status_reserva = 'CONFIRMADA'
                      AND (r.data_aula_reserva + a.horario_inicio_aula) - LOCALTIMESTAMP >= interval '2 hours') AS pode_cancelar
              FROM reserva r
              JOIN aula a       ON a.id_aula = r.aula_id_aula
              JOIN modalidade m ON m.id_modalidade = a.modalidade_id_modalidade
              JOIN pessoa p     ON p.cpf_pessoa = a.funcionario_pessoa_cpf_pessoa
             WHERE r.aluno_pessoa_cpf_pessoa = $1
             ORDER BY r.data_aula_reserva DESC, a.horario_inicio_aula DESC LIMIT 40`, [req.session.usuario.cpf]);
        return res.json({ sucesso: true, reservas: r.rows });
    } catch (error) {
        console.error('Erro ao listar reservas:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};

// ---------- POST /aluno/reservas   corpo: { aulaId, data: 'AAAA-MM-DD' } ----------
// Tudo acontece dentro de UMA transação. O "FOR UPDATE" trava a linha da aula, então dois alunos
// disputando a última vaga são atendidos um de cada vez (ninguém reserva além do limite).
exports.reservarAula = async (req, res) => {
    try {
        const cpf = req.session.usuario.cpf;
        const aulaId = Number((req.body || {}).aulaId);
        const data = String((req.body || {}).data || '');
        if (!Number.isInteger(aulaId) || aulaId <= 0 || !REGEX_DATA.test(data) || isNaN(new Date(data))) {
            return res.status(400).json({ sucesso: false, mensagem: 'Dados da reserva inválidos.' });
        }

        await transacao(async (c) => {
            // 1) A aula existe? A data é válida para ela? (trava a aula até o fim da transação)
            const aula = await c.query(`
                SELECT a.dia_semana_aula, a.vagas_aula, to_char(a.horario_inicio_aula, 'HH24:MI') AS horario,
                       a.duracao_minutos_aula, ($2::date - CURRENT_DATE) AS dias,
                       EXTRACT(ISODOW FROM $2::date)::int AS iso,
                       (($2::date + a.horario_inicio_aula) > LOCALTIMESTAMP) AS futura
                  FROM aula a WHERE a.id_aula = $1 FOR UPDATE`, [aulaId, data]);
            if (aula.rows.length === 0) throw new ErroRegra('Aula não encontrada.', 404);
            const a = aula.rows[0];
            if (a.dias < 0 || a.dias > 13) throw new ErroRegra('Só é possível reservar aulas dos próximos 14 dias.', 400);
            if (a.iso !== a.dia_semana_aula) throw new ErroRegra('A data escolhida não corresponde ao dia desta aula.', 400);
            if (!a.futura) throw new ErroRegra('Esta aula já começou ou já passou.');

            // 2) Matrícula ATIVA cobrindo a data da aula (pega a de plano mais permissivo)
            const mat = await c.query(`
                SELECT pl.aulas_semana_plano FROM matricula m JOIN plano pl ON pl.id_plano = m.plano_id_plano
                 WHERE m.aluno_pessoa_cpf_pessoa = $1 AND m.status_matricula = 'ATIVA'
                   AND m.data_inicio_matricula <= $2::date AND m.data_fim_matricula >= $2::date
                 ORDER BY pl.aulas_semana_plano IS NULL DESC, pl.aulas_semana_plano DESC LIMIT 1`, [cpf, data]);
            if (mat.rows.length === 0) throw new ErroRegra('Você precisa de uma matrícula ativa na data desta aula.');

            // 3) Limite semanal do plano (0 = sem aulas coletivas | N = até N | NULL = ilimitado)
            const limite = mat.rows[0].aulas_semana_plano;
            if (limite === 0) throw new ErroRegra('Seu plano não inclui aulas coletivas.');
            if (limite !== null) {
                const semana = await c.query(`
                    SELECT COUNT(*)::int AS total FROM reserva r
                     WHERE r.aluno_pessoa_cpf_pessoa = $1 AND r.status_reserva IN ('CONFIRMADA', 'CONCLUIDA')
                       AND date_trunc('week', r.data_aula_reserva::timestamp) = date_trunc('week', $2::date::timestamp)`, [cpf, data]);
                if (semana.rows[0].total >= limite) {
                    throw new ErroRegra(`Seu plano permite até ${limite} aula(s) por semana e você já atingiu esse limite.`);
                }
            }

            // 4) Não pode reservar a mesma aula duas vezes na mesma data
            const ja = await c.query(`SELECT status_reserva FROM reserva
                                       WHERE aluno_pessoa_cpf_pessoa = $1 AND aula_id_aula = $2 AND data_aula_reserva = $3::date`, [cpf, aulaId, data]);
            if (ja.rows[0] && ja.rows[0].status_reserva === 'CONFIRMADA') throw new ErroRegra('Você já reservou esta aula nesta data.');

            // 5) Não pode ter duas aulas se sobrepondo no mesmo dia
            const choque = await c.query(`
                SELECT 1 FROM reserva r JOIN aula b ON b.id_aula = r.aula_id_aula
                 WHERE r.aluno_pessoa_cpf_pessoa = $1 AND r.data_aula_reserva = $2::date AND r.status_reserva = 'CONFIRMADA'
                   AND r.aula_id_aula <> $3
                   AND b.horario_inicio_aula < ($4::time + make_interval(mins => $5::int))
                   AND (b.horario_inicio_aula + make_interval(mins => b.duracao_minutos_aula)) > $4::time`,
                [cpf, data, aulaId, a.horario, a.duracao_minutos_aula]);
            if (choque.rows.length > 0) throw new ErroRegra('Você já tem outra aula reservada neste horário.');

            // 6) Ainda há vaga nesta data?
            const ocup = await c.query(`SELECT COUNT(*)::int AS ocupadas FROM reserva
                                         WHERE aula_id_aula = $1 AND data_aula_reserva = $2::date AND status_reserva = 'CONFIRMADA'`, [aulaId, data]);
            if (ocup.rows[0].ocupadas >= a.vagas_aula) throw new ErroRegra('Não há vagas disponíveis nesta aula.');

            // 7) Grava. A chave da reserva é (aluno, aula, data): se havia uma CANCELADA, ela é reativada.
            await c.query(`INSERT INTO reserva (aluno_pessoa_cpf_pessoa, aula_id_aula, data_aula_reserva, status_reserva)
                           VALUES ($1, $2, $3::date, 'CONFIRMADA')
                           ON CONFLICT (aluno_pessoa_cpf_pessoa, aula_id_aula, data_aula_reserva)
                           DO UPDATE SET status_reserva = 'CONFIRMADA'`, [cpf, aulaId, data]);
        });
        return res.status(201).json({ sucesso: true, mensagem: 'Aula reservada com sucesso.' });
    } catch (error) {
        if (error instanceof ErroRegra) return res.status(error.status).json({ sucesso: false, mensagem: error.message });
        console.error('Erro ao reservar aula:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};

// ---------- PATCH /aluno/reservas/cancelar   corpo: { aulaId, data } ----------
// Regra da academia: só dá para cancelar até 2 HORAS antes do início. A vaga volta
// automaticamente, porque as vagas ocupadas são contadas só entre as reservas CONFIRMADAS.
exports.cancelarReserva = async (req, res) => {
    try {
        const cpf = req.session.usuario.cpf;
        const aulaId = Number((req.body || {}).aulaId);
        const data = String((req.body || {}).data || '');
        if (!Number.isInteger(aulaId) || aulaId <= 0 || !REGEX_DATA.test(data) || isNaN(new Date(data))) {
            return res.status(400).json({ sucesso: false, mensagem: 'Dados da reserva inválidos.' });
        }
        const r = await query(`
            UPDATE reserva r SET status_reserva = 'CANCELADA' FROM aula a
             WHERE a.id_aula = r.aula_id_aula AND r.aluno_pessoa_cpf_pessoa = $1 AND r.aula_id_aula = $2
               AND r.data_aula_reserva = $3::date AND r.status_reserva = 'CONFIRMADA'
               AND (r.data_aula_reserva + a.horario_inicio_aula) - LOCALTIMESTAMP >= interval '2 hours'`, [cpf, aulaId, data]);
        if (r.rowCount > 0) return res.json({ sucesso: true, mensagem: 'Reserva cancelada. A vaga foi liberada.' });

        // Não cancelou: descobre se a reserva não existe ou se passou do prazo
        const existe = await query(`SELECT 1 FROM reserva WHERE aluno_pessoa_cpf_pessoa = $1 AND aula_id_aula = $2
                                     AND data_aula_reserva = $3::date AND status_reserva = 'CONFIRMADA'`, [cpf, aulaId, data]);
        if (existe.rows.length === 0) return res.status(404).json({ sucesso: false, mensagem: 'Reserva não encontrada.' });
        return res.status(409).json({ sucesso: false, mensagem: 'O cancelamento só é permitido até 2 horas antes da aula.' });
    } catch (error) {
        console.error('Erro ao cancelar reserva:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};

// ---------- GET /aluno/ficha  (somente a PRÓPRIA ficha ativa; sem edição) ----------
exports.obterMinhaFicha = async (req, res) => {
    try {
        const f = await query(`
            SELECT f.id_ficha_treino, f.titulo_ficha_treino, f.objetivo_ficha_treino, f.observacoes_ficha_treino,
                   to_char(f.data_criacao_ficha_treino, 'DD/MM/YYYY') AS criada, i.nome_pessoa AS instrutor
              FROM ficha_treino f LEFT JOIN pessoa i ON i.cpf_pessoa = f.funcionario_pessoa_cpf_pessoa
             WHERE f.aluno_pessoa_cpf_pessoa = $1 AND f.ativa_ficha_treino`, [req.session.usuario.cpf]);
        if (f.rows.length === 0) return res.json({ sucesso: true, ficha: null, exercicios: [] });

        const e = await query(`
            SELECT divisao_ficha_exercicio AS divisao, nome_ficha_exercicio AS nome, series_ficha_exercicio AS series,
                   repeticoes_ficha_exercicio AS repeticoes, descanso_segundos_ficha_exercicio AS descanso,
                   orientacoes_ficha_exercicio AS orientacoes
              FROM ficha_exercicio WHERE ficha_treino_id_ficha_treino = $1
             ORDER BY divisao_ficha_exercicio, ordem_ficha_exercicio`, [f.rows[0].id_ficha_treino]);
        return res.json({ sucesso: true, ficha: f.rows[0], exercicios: e.rows });
    } catch (error) {
        console.error('Erro ao obter ficha do aluno:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};


// ============================================================
// MEU PLANO
// ============================================================

// GET /aluno/plano -> minhas matrículas (as 10 mais recentes) + planos que posso contratar
exports.obterMeuPlano = async (req, res) => {
    try {
        const [mat, planos] = await Promise.all([
            query(`
                SELECT m.id_matricula, pl.nome_plano, pl.valor_plano, pl.duracao_meses_plano, pl.aulas_semana_plano,
                       to_char(m.data_inicio_matricula, 'DD/MM/YYYY') AS inicio,
                       to_char(m.data_fim_matricula, 'DD/MM/YYYY')    AS vencimento,
                       (m.data_fim_matricula - CURRENT_DATE)::int     AS dias_restantes,
                       (m.status_matricula = 'ATIVA' AND m.data_inicio_matricula <= CURRENT_DATE
                           AND m.data_fim_matricula >= CURRENT_DATE)  AS vigente,
                       CASE WHEN m.status_matricula = 'ATIVA' AND m.data_fim_matricula < CURRENT_DATE
                            THEN 'VENCIDA' ELSE m.status_matricula END AS situacao
                  FROM matricula m JOIN plano pl ON pl.id_plano = m.plano_id_plano
                 WHERE m.aluno_pessoa_cpf_pessoa = $1
                 ORDER BY m.data_inicio_matricula DESC, m.id_matricula DESC LIMIT 10`, [req.session.usuario.cpf]),
            query(`SELECT id_plano, nome_plano, descricao_plano, valor_plano, duracao_meses_plano, aulas_semana_plano
                     FROM plano WHERE ativo_plano ORDER BY valor_plano, nome_plano`)
        ]);
        return res.json({
            sucesso: true,
            matriculas: mat.rows.map((m) => ({ ...m, valor_plano: Number(m.valor_plano) })),
            planos: planos.rows.map((p) => ({ ...p, valor_plano: Number(p.valor_plano) }))
        });
    } catch (error) {
        console.error('Erro ao obter plano do aluno:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};

// POST /aluno/plano/contratar   corpo: { planoId }
// Cria uma matrícula PENDENTE + um pagamento PENDENTE (Pix). A academia confirma o pagamento
// e a matrícula passa a ATIVA. Se o aluno já tem plano vigente, o novo começa no dia seguinte ao fim dele.
exports.contratarPlano = async (req, res) => {
    try {
        const cpf = req.session.usuario.cpf;
        const planoId = Number((req.body || {}).planoId);
        if (!Number.isInteger(planoId) || planoId <= 0) {
            return res.status(400).json({ sucesso: false, mensagem: 'Selecione um plano.' });
        }
        const pagamentoId = await transacao(async (c) => {
            const plano = await c.query('SELECT valor_plano, duracao_meses_plano, ativo_plano FROM plano WHERE id_plano = $1', [planoId]);
            if (plano.rows.length === 0) throw new ErroRegra('Plano não encontrado.', 404);
            if (!plano.rows[0].ativo_plano) throw new ErroRegra('Este plano não está mais disponível.');

            // Trava o aluno: dois cliques seguidos não criam duas matrículas
            await c.query('SELECT 1 FROM aluno WHERE pessoa_cpf_pessoa = $1 FOR UPDATE', [cpf]);

            const pendente = await c.query(`SELECT 1 FROM matricula WHERE aluno_pessoa_cpf_pessoa = $1
                                             AND status_matricula = 'PENDENTE' AND data_fim_matricula >= CURRENT_DATE`, [cpf]);
            if (pendente.rows.length > 0) {
                throw new ErroRegra('Você já tem uma matrícula aguardando pagamento. Conclua o pagamento antes de contratar outro plano.');
            }

            // Início = hoje, ou o dia seguinte ao fim da matrícula vigente (renovação sem sobrepor períodos)
            const ini = await c.query(`
                SELECT to_char(GREATEST(CURRENT_DATE, COALESCE(MAX(data_fim_matricula) FILTER (
                           WHERE status_matricula IN ('ATIVA', 'PENDENTE') AND data_fim_matricula >= CURRENT_DATE),
                           CURRENT_DATE - 1) + 1), 'YYYY-MM-DD') AS inicio
                  FROM matricula WHERE aluno_pessoa_cpf_pessoa = $1`, [cpf]);

            const mat = await c.query(`
                INSERT INTO matricula (aluno_pessoa_cpf_pessoa, plano_id_plano, data_inicio_matricula, data_fim_matricula, status_matricula)
                VALUES ($1, $4, $2::date, ($2::date + make_interval(months => $3::int) - interval '1 day')::date, 'PENDENTE')
                RETURNING id_matricula`, [cpf, ini.rows[0].inicio, plano.rows[0].duracao_meses_plano, planoId]);

            // Forma de pagamento: Pix (se não existir uma chamada assim, usa a primeira cadastrada)
            const forma = await c.query(`SELECT id_forma_pagamento FROM forma_pagamento
                                          ORDER BY (nome_forma_pagamento ILIKE 'pix%') DESC, id_forma_pagamento LIMIT 1`);
            if (forma.rows.length === 0) throw new ErroRegra('Nenhuma forma de pagamento cadastrada. Procure a recepção.');

            const pag = await c.query(`
                INSERT INTO pagamento (matricula_id_matricula, forma_pagamento_id_forma_pagamento, valor_pagamento, data_pagamento, status_pagamento)
                VALUES ($1, $2, $3, NULL, 'PENDENTE') RETURNING id_pagamento`,
                [mat.rows[0].id_matricula, forma.rows[0].id_forma_pagamento, plano.rows[0].valor_plano]);
            return pag.rows[0].id_pagamento;
        });
        return res.status(201).json({ sucesso: true, pagamentoId, mensagem: 'Matrícula criada! Pague pelo Pix para que a academia confirme e ative o seu plano.' });
    } catch (error) {
        if (error instanceof ErroRegra) return res.status(error.status).json({ sucesso: false, mensagem: error.message });
        console.error('Erro ao contratar plano:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};

// ============================================================
// MEUS PAGAMENTOS (e Pix)
// ============================================================

// GET /aluno/pagamentos
exports.listarMeusPagamentos = async (req, res) => {
    try {
        const r = await query(`
            SELECT g.id_pagamento, pl.nome_plano, g.valor_pagamento, f.nome_forma_pagamento AS forma,
                   to_char(g.data_pagamento, 'DD/MM/YYYY') AS data,
                   CASE WHEN g.status_pagamento = 'PENDENTE' AND m.data_inicio_matricula < CURRENT_DATE
                        THEN 'ATRASADO' ELSE g.status_pagamento END AS situacao
              FROM pagamento g
              JOIN matricula m ON m.id_matricula = g.matricula_id_matricula
              JOIN plano pl    ON pl.id_plano = m.plano_id_plano
              JOIN forma_pagamento f ON f.id_forma_pagamento = g.forma_pagamento_id_forma_pagamento
             WHERE m.aluno_pessoa_cpf_pessoa = $1
             ORDER BY g.id_pagamento DESC`, [req.session.usuario.cpf]);
        return res.json({ sucesso: true, pagamentos: r.rows.map((p) => ({ ...p, valor_pagamento: Number(p.valor_pagamento) })) });
    } catch (error) {
        console.error('Erro ao listar pagamentos do aluno:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};

// GET /aluno/pagamentos/:id/pix  -> só de um pagamento PENDENTE e que seja MEU
exports.gerarMeuPix = async (req, res) => {
    try {
        if (!pix.pixConfigurado()) {
            return res.status(503).json({ sucesso: false, mensagem: 'O pagamento por Pix ainda não está disponível. Procure a recepção.' });
        }
        // O JOIN com a matrícula garante que o pagamento é do aluno logado (de outro aluno vira "não encontrado")
        const r = await query(`SELECT g.valor_pagamento, g.status_pagamento FROM pagamento g
                                 JOIN matricula m ON m.id_matricula = g.matricula_id_matricula
                                WHERE g.id_pagamento = $1 AND m.aluno_pessoa_cpf_pessoa = $2`, [req.params.id, req.session.usuario.cpf]);
        if (r.rows.length === 0) return res.status(404).json({ sucesso: false, mensagem: 'Pagamento não encontrado.' });
        if (r.rows[0].status_pagamento !== 'PENDENTE') return res.status(409).json({ sucesso: false, mensagem: 'Este pagamento não está pendente.' });

        const valor = Number(r.rows[0].valor_pagamento);
        const payload = pix.gerarPayloadDoEnv(valor, 'PAG' + req.params.id);
        return res.json({ sucesso: true, valor, payload, qrcode: await pix.gerarQrCode(payload) });
    } catch (error) {
        console.error('Erro ao gerar Pix do aluno:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro ao gerar o Pix.' });
    }
};

// ============================================================
// MEU PERFIL
// ============================================================

// GET /aluno/perfil
exports.obterMeuPerfil = async (req, res) => {
    try {
        const r = await query(`
            SELECT p.cpf_pessoa AS cpf, p.nome_pessoa, p.email_pessoa, p.endereco_pessoa,
                   to_char(p.data_nascimento_pessoa, 'YYYY-MM-DD') AS data_nascimento,
                   a.objetivo_aluno, to_char(a.data_cadastro_aluno, 'DD/MM/YYYY') AS cadastro
              FROM pessoa p JOIN aluno a ON a.pessoa_cpf_pessoa = p.cpf_pessoa WHERE p.cpf_pessoa = $1`, [req.session.usuario.cpf]);
        if (r.rows.length === 0) return res.status(404).json({ sucesso: false, mensagem: 'Perfil não encontrado.' });
        return res.json({ sucesso: true, perfil: r.rows[0] });
    } catch (error) {
        console.error('Erro ao obter perfil:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};

// PUT /aluno/perfil  (o CPF vem da sessão e NÃO pode ser alterado)
exports.atualizarMeuPerfil = async (req, res) => {
    try {
        const cpf = req.session.usuario.cpf;
        const d = { ...(req.body || {}), cpf, senha: '' };
        const erros = validarPessoa(d, { criando: false });
        if (erros.length) return res.status(400).json({ sucesso: false, mensagem: erros.join(' ') });

        const email = String(d.email).trim().toLowerCase();
        await transacao(async (c) => {
            await c.query(`UPDATE pessoa SET nome_pessoa = $2, data_nascimento_pessoa = $3, endereco_pessoa = $4, email_pessoa = $5
                            WHERE cpf_pessoa = $1`, [cpf, String(d.nome).trim(), d.dataNascimento || null, d.endereco || null, email]);
            await c.query('UPDATE aluno SET objetivo_aluno = $2 WHERE pessoa_cpf_pessoa = $1', [cpf, d.objetivo || null]);
        });
        // mantém o nome/e-mail da sessão em dia (aparecem no menu)
        req.session.usuario.nome = String(d.nome).trim();
        req.session.usuario.email = email;
        return res.json({ sucesso: true, mensagem: 'Perfil atualizado com sucesso.' });
    } catch (error) {
        if (error.code === '23505') return res.status(409).json({ sucesso: false, mensagem: 'Já existe uma pessoa com este e-mail.' });
        console.error('Erro ao atualizar perfil:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};