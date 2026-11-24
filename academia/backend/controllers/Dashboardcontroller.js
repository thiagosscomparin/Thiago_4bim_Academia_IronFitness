// ============================================================
// dashboardController.js
// Monta os números e listas que aparecem nos dashboards.
// Tudo vem do PostgreSQL; nenhum dado é inventado no frontend.
// ============================================================
const { query } = require('../database');

// GET /dashboard/gerente   (só perfil gerente - veja dashboardRoutes.js)
exports.dadosGerente = async (req, res) => {
    try {
        // As 4 consultas são independentes, então rodam ao mesmo tempo (mais rápido)
        const [totais, receita, aVencer, ultimosPagamentos] = await Promise.all([

            // 1) Totais dos cards. Cada (SELECT COUNT...) vira uma coluna.
            //    ::int converte o resultado para número (o COUNT vem como texto).
            //    "Ativa" = status ATIVA e data final ainda não passou.
            query(`
                SELECT
                    (SELECT COUNT(*) FROM aluno)::int        AS alunos,
                    (SELECT COUNT(*) FROM funcionario)::int  AS funcionarios,
                    (SELECT COUNT(*) FROM matricula
                      WHERE status_matricula = 'ATIVA'
                        AND data_fim_matricula >= CURRENT_DATE)::int AS matriculas_ativas,
                    (SELECT COUNT(*) FROM plano WHERE ativo_plano)::int AS planos_ativos,
                    (SELECT COUNT(*) FROM aula)::int         AS aulas,
                    (SELECT COUNT(*) FROM pagamento)::int    AS pagamentos,
                    (SELECT COUNT(*) FROM pagamento
                      WHERE status_pagamento = 'PENDENTE')::int AS pagamentos_pendentes
            `),

            // 2) Receita do mês atual: soma dos pagamentos PAGO cuja data cai neste mês.
            //    COALESCE devolve 0 quando não houver nenhum (SUM de nada dá NULL).
            query(`
                SELECT COALESCE(SUM(valor_pagamento), 0) AS total
                  FROM pagamento
                 WHERE status_pagamento = 'PAGO'
                   AND to_char(data_pagamento, 'YYYY-MM') = to_char(CURRENT_DATE, 'YYYY-MM')
            `),

            // 3) Matrículas ativas que vencem nos próximos 7 dias.
            //    JOIN liga a matrícula ao nome do aluno (pessoa) e ao nome do plano.
            query(`
                SELECT m.id_matricula,
                       p.nome_pessoa,
                       pl.nome_plano,
                       to_char(m.data_fim_matricula, 'DD/MM/YYYY')   AS vencimento,
                       (m.data_fim_matricula - CURRENT_DATE)::int    AS dias_restantes
                  FROM matricula m
                  JOIN pessoa p  ON p.cpf_pessoa = m.aluno_pessoa_cpf_pessoa
                  JOIN plano  pl ON pl.id_plano  = m.plano_id_plano
                 WHERE m.status_matricula = 'ATIVA'
                   AND m.data_fim_matricula BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
                 ORDER BY m.data_fim_matricula, p.nome_pessoa
                 LIMIT 8
            `),

            // 4) Últimos pagamentos. Pendentes não têm data, então ficam por último.
            query(`
                SELECT pg.id_pagamento,
                       p.nome_pessoa,
                       pg.valor_pagamento,
                       pg.status_pagamento,
                       to_char(pg.data_pagamento, 'DD/MM/YYYY') AS data
                  FROM pagamento pg
                  JOIN matricula m ON m.id_matricula = pg.matricula_id_matricula
                  JOIN pessoa p    ON p.cpf_pessoa   = m.aluno_pessoa_cpf_pessoa
                 ORDER BY COALESCE(pg.data_pagamento, '1900-01-01') DESC, pg.id_pagamento DESC
                 LIMIT 6
            `)
        ]);

        return res.json({
            sucesso: true,
            totais: totais.rows[0],
            receitaMes: Number(receita.rows[0].total),   // SUM volta como texto; vira número
            matriculasAVencer: aVencer.rows,
            ultimosPagamentos: ultimosPagamentos.rows.map((pg) => ({
                ...pg,
                valor_pagamento: Number(pg.valor_pagamento)
            }))
        });
    } catch (error) {
        console.error('Erro no dashboard do gerente:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};

// GET /dashboard/instrutor   (só perfil instrutor)
// $1 = CPF de quem está logado (vem da sessão, nunca do navegador)
exports.dadosInstrutor = async (req, res) => {
    try {
        const cpf = req.session.usuario.cpf;

        // "Meus alunos" = quem reservou aulas minhas OU tem ficha sob minha responsabilidade.
        // UNION junta as duas listas e já elimina CPFs repetidos.
        const [totais, agenda, reservas, fichas] = await Promise.all([
            query(`
                SELECT
                    (SELECT COUNT(*) FROM aula WHERE funcionario_pessoa_cpf_pessoa = $1)::int AS aulas,
                    (SELECT COUNT(*) FROM (
                        SELECT r.aluno_pessoa_cpf_pessoa
                          FROM reserva r JOIN aula a ON a.id_aula = r.aula_id_aula
                         WHERE a.funcionario_pessoa_cpf_pessoa = $1
                           AND r.status_reserva IN ('CONFIRMADA', 'CONCLUIDA')
                        UNION
                        SELECT aluno_pessoa_cpf_pessoa FROM ficha_treino
                         WHERE funcionario_pessoa_cpf_pessoa = $1 AND ativa_ficha_treino
                    ) x)::int AS alunos,
                    (SELECT COUNT(*) FROM ficha_treino
                      WHERE funcionario_pessoa_cpf_pessoa = $1 AND ativa_ficha_treino)::int AS fichas,
                    (SELECT COUNT(*) FROM reserva r JOIN aula a ON a.id_aula = r.aula_id_aula
                      WHERE a.funcionario_pessoa_cpf_pessoa = $1
                        AND r.status_reserva = 'CONFIRMADA'
                        AND r.data_aula_reserva >= CURRENT_DATE)::int AS reservas_futuras
            `, [cpf]),

            // Agenda semanal das aulas dele (dia 1 = segunda ... 7 = domingo)
            query(`
                SELECT a.id_aula, m.nome_modalidade, a.dia_semana_aula,
                       to_char(a.horario_inicio_aula, 'HH24:MI') AS horario,
                       a.duracao_minutos_aula, a.vagas_aula
                  FROM aula a JOIN modalidade m ON m.id_modalidade = a.modalidade_id_modalidade
                 WHERE a.funcionario_pessoa_cpf_pessoa = $1
                 ORDER BY a.dia_semana_aula, a.horario_inicio_aula
            `, [cpf]),

            // Próximas reservas confirmadas nas aulas dele
            query(`
                SELECT to_char(r.data_aula_reserva, 'DD/MM/YYYY') AS data,
                       to_char(a.horario_inicio_aula, 'HH24:MI')  AS horario,
                       m.nome_modalidade, p.nome_pessoa
                  FROM reserva r
                  JOIN aula a       ON a.id_aula = r.aula_id_aula
                  JOIN modalidade m ON m.id_modalidade = a.modalidade_id_modalidade
                  JOIN pessoa p     ON p.cpf_pessoa = r.aluno_pessoa_cpf_pessoa
                 WHERE a.funcionario_pessoa_cpf_pessoa = $1
                   AND r.status_reserva = 'CONFIRMADA'
                   AND r.data_aula_reserva >= CURRENT_DATE
                 ORDER BY r.data_aula_reserva, a.horario_inicio_aula
                 LIMIT 8
            `, [cpf]),

            // Fichas ativas sob responsabilidade dele (somente leitura)
            query(`
                SELECT p.nome_pessoa, f.titulo_ficha_treino, f.objetivo_ficha_treino,
                       (SELECT COUNT(*) FROM ficha_exercicio e
                         WHERE e.ficha_treino_id_ficha_treino = f.id_ficha_treino)::int AS exercicios
                  FROM ficha_treino f JOIN pessoa p ON p.cpf_pessoa = f.aluno_pessoa_cpf_pessoa
                 WHERE f.funcionario_pessoa_cpf_pessoa = $1 AND f.ativa_ficha_treino
                 ORDER BY p.nome_pessoa
            `, [cpf])
        ]);

        return res.json({
            sucesso: true,
            totais: totais.rows[0],
            agenda: agenda.rows,
            proximasReservas: reservas.rows,
            fichas: fichas.rows
        });
    } catch (error) {
        console.error('Erro no dashboard do instrutor:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};

// Gera os "avisos importantes" do aluno a partir da matrícula e dos pagamentos.
// Regra de negócio no backend: o frontend só exibe o que recebe.
function montarAvisos(matricula, pendentes) {
    const avisos = [];
    if (!matricula) {
        avisos.push({ tipo: 'warn', texto: 'Você ainda não possui matrícula. Procure a recepção para contratar um plano.' });
    } else if (matricula.situacao === 'VENCIDA') {
        avisos.push({ tipo: 'error', texto: `Sua matrícula venceu em ${matricula.vencimento}. Renove para voltar a reservar aulas.` });
    } else if (matricula.situacao === 'CANCELADA') {
        avisos.push({ tipo: 'error', texto: 'Sua matrícula está cancelada. Procure a recepção.' });
    } else if (matricula.situacao === 'PENDENTE') {
        avisos.push({ tipo: 'warn', texto: 'Sua matrícula aguarda a confirmação do pagamento.' });
    } else if (matricula.dias_restantes <= 7) {
        const quando = matricula.dias_restantes === 0 ? 'hoje' : `em ${matricula.dias_restantes} dia(s)`;
        avisos.push({ tipo: 'warn', texto: `Sua matrícula vence ${quando} (${matricula.vencimento}).` });
    }
    if (pendentes > 0) {
        avisos.push({ tipo: 'warn', texto: `Você tem ${pendentes} pagamento(s) pendente(s).` });
    }
    if (matricula && matricula.situacao === 'ATIVA' && matricula.aulas_semana_plano === 0) {
        avisos.push({ tipo: 'info', texto: 'Seu plano não inclui aulas coletivas, mas a musculação é livre.' });
    }
    if (avisos.length === 0) {
        avisos.push({ tipo: 'success', texto: 'Tudo certo com a sua matrícula. Bons treinos!' });
    }
    return avisos;
}

// GET /dashboard/aluno   (só perfil aluno)
// O CPF vem da sessão: o aluno nunca consegue consultar dados de outro aluno.
exports.dadosAluno = async (req, res) => {
    try {
        const cpf = req.session.usuario.cpf;

        const [matricula, aulas, ficha, pagamentos, pendentes] = await Promise.all([
            // Matrícula mais recente. Se está ATIVA mas a data final passou, mostra VENCIDA.
            query(`
                SELECT pl.nome_plano, pl.valor_plano, pl.duracao_meses_plano, pl.aulas_semana_plano,
                       to_char(m.data_inicio_matricula, 'DD/MM/YYYY') AS inicio,
                       to_char(m.data_fim_matricula, 'DD/MM/YYYY')    AS vencimento,
                       (m.data_fim_matricula - CURRENT_DATE)::int     AS dias_restantes,
                       CASE WHEN m.status_matricula = 'ATIVA' AND m.data_fim_matricula < CURRENT_DATE
                            THEN 'VENCIDA' ELSE m.status_matricula END AS situacao
                  FROM matricula m JOIN plano pl ON pl.id_plano = m.plano_id_plano
                 WHERE m.aluno_pessoa_cpf_pessoa = $1
                 ORDER BY (m.status_matricula = 'ATIVA' AND m.data_inicio_matricula <= CURRENT_DATE
                           AND m.data_fim_matricula >= CURRENT_DATE) DESC,
                          m.data_inicio_matricula DESC, m.id_matricula DESC
                 LIMIT 1
            `, [cpf]),

            // Próximas aulas reservadas, com o nome do instrutor
            query(`
                SELECT to_char(r.data_aula_reserva, 'DD/MM/YYYY') AS data,
                       to_char(a.horario_inicio_aula, 'HH24:MI')  AS horario,
                       m.nome_modalidade, p.nome_pessoa AS instrutor
                  FROM reserva r
                  JOIN aula a       ON a.id_aula = r.aula_id_aula
                  JOIN modalidade m ON m.id_modalidade = a.modalidade_id_modalidade
                  JOIN pessoa p     ON p.cpf_pessoa = a.funcionario_pessoa_cpf_pessoa
                 WHERE r.aluno_pessoa_cpf_pessoa = $1
                   AND r.status_reserva = 'CONFIRMADA'
                   AND r.data_aula_reserva >= CURRENT_DATE
                 ORDER BY r.data_aula_reserva, a.horario_inicio_aula
                 LIMIT 6
            `, [cpf]),

            // Ficha de treino ativa (LEFT JOIN: a ficha pode não ter instrutor definido)
            query(`
                SELECT f.titulo_ficha_treino, f.objetivo_ficha_treino,
                       to_char(f.data_criacao_ficha_treino, 'DD/MM/YYYY') AS criada,
                       p.nome_pessoa AS instrutor,
                       (SELECT COUNT(*) FROM ficha_exercicio e
                         WHERE e.ficha_treino_id_ficha_treino = f.id_ficha_treino)::int AS exercicios
                  FROM ficha_treino f LEFT JOIN pessoa p ON p.cpf_pessoa = f.funcionario_pessoa_cpf_pessoa
                 WHERE f.aluno_pessoa_cpf_pessoa = $1 AND f.ativa_ficha_treino
            `, [cpf]),

            // Últimos pagamentos do aluno (passando pela matrícula)
            query(`
                SELECT pg.valor_pagamento, pg.status_pagamento,
                       to_char(pg.data_pagamento, 'DD/MM/YYYY') AS data
                  FROM pagamento pg JOIN matricula m ON m.id_matricula = pg.matricula_id_matricula
                 WHERE m.aluno_pessoa_cpf_pessoa = $1
                 ORDER BY COALESCE(pg.data_pagamento, '1900-01-01') DESC, pg.id_pagamento DESC
                 LIMIT 4
            `, [cpf]),

            query(`
                SELECT COUNT(*)::int AS total
                  FROM pagamento pg JOIN matricula m ON m.id_matricula = pg.matricula_id_matricula
                 WHERE m.aluno_pessoa_cpf_pessoa = $1 AND pg.status_pagamento = 'PENDENTE'
            `, [cpf])
        ]);

        const mat = matricula.rows[0]
            ? { ...matricula.rows[0], valor_plano: Number(matricula.rows[0].valor_plano) }
            : null;

        return res.json({
            sucesso: true,
            matricula: mat,
            proximasAulas: aulas.rows,
            ficha: ficha.rows[0] || null,
            pagamentos: pagamentos.rows.map((p) => ({ ...p, valor_pagamento: Number(p.valor_pagamento) })),
            pendentes: pendentes.rows[0].total,
            avisos: montarAvisos(mat, pendentes.rows[0].total)
        });
    } catch (error) {
        console.error('Erro no dashboard do aluno:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};