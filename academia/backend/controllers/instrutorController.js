// ============================================================
// instrutorController.js - Área do INSTRUTOR (somente perfil instrutor)
// SÓ DE CONSULTA: o instrutor enxerga seus alunos, as fichas sob sua
// responsabilidade e a sua agenda. Quem cria/edita ficha e aula é o gerente.
// O CPF vem SEMPRE da sessão (req.session.usuario.cpf): um instrutor nunca
// consegue ver aula ou ficha de outro instrutor, mesmo mexendo na URL.
// ============================================================
const { query } = require('../database');

const REGEX_DATA = /^\d{4}-\d{2}-\d{2}$/;
const INT_MAX = 2147483647; // limite do INTEGER do PostgreSQL

// Converte o texto de um id em número seguro (ou null se for inválido)
function lerId(valor) {
    if (!/^\d{1,10}$/.test(String(valor || ''))) return null;
    const n = Number(valor);
    return n >= 1 && n <= INT_MAX ? n : null;
}

// Confere 'AAAA-MM-DD' e rejeita datas que não existem (ex.: 2026-02-31).
// Devolve { texto, diaSemana } (1 = segunda ... 7 = domingo) ou null.
function lerData(valor) {
    const texto = String(valor || '');
    if (!REGEX_DATA.test(texto)) return null;
    const [a, m, d] = texto.split('-').map(Number);
    const data = new Date(Date.UTC(a, m - 1, d));
    if (data.getUTCFullYear() !== a || data.getUTCMonth() !== m - 1 || data.getUTCDate() !== d) return null;
    return { texto, diaSemana: data.getUTCDay() || 7 };
}

function erroInterno(res, contexto, error) {
    console.error(contexto, error);
    return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
}

// ---------- GET /instrutor/alunos ----------
// "Meus alunos" = quem reservou (e não cancelou) aulas minhas OU tem ficha ativa sob minha responsabilidade.
// (mesma regra do dashboard). UNION junta as duas listas e já elimina CPFs repetidos.
exports.listarMeusAlunos = async (req, res) => {
    try {
        const r = await query(`
            WITH meus AS (
                SELECT r.aluno_pessoa_cpf_pessoa AS cpf
                  FROM reserva r JOIN aula a ON a.id_aula = r.aula_id_aula
                 WHERE a.funcionario_pessoa_cpf_pessoa = $1
                   AND r.status_reserva IN ('CONFIRMADA', 'CONCLUIDA')
                UNION
                SELECT aluno_pessoa_cpf_pessoa FROM ficha_treino
                 WHERE funcionario_pessoa_cpf_pessoa = $1 AND ativa_ficha_treino
            )
            SELECT p.nome_pessoa AS nome,
                   al.objetivo_aluno AS objetivo,
                   (SELECT m.status_matricula FROM matricula m
                     WHERE m.aluno_pessoa_cpf_pessoa = meus.cpf
                     ORDER BY (m.status_matricula = 'ATIVA') DESC, m.data_fim_matricula DESC LIMIT 1) AS situacao_plano,
                   (SELECT pl.nome_plano FROM matricula m JOIN plano pl ON pl.id_plano = m.plano_id_plano
                     WHERE m.aluno_pessoa_cpf_pessoa = meus.cpf
                     ORDER BY (m.status_matricula = 'ATIVA') DESC, m.data_fim_matricula DESC LIMIT 1) AS nome_plano,
                   (SELECT CASE WHEN f.funcionario_pessoa_cpf_pessoa = $1 THEN 'MINHA'
                                WHEN f.funcionario_pessoa_cpf_pessoa IS NULL THEN 'SEM_RESPONSAVEL'
                                ELSE 'OUTRO' END
                      FROM ficha_treino f
                     WHERE f.aluno_pessoa_cpf_pessoa = meus.cpf AND f.ativa_ficha_treino) AS ficha,
                   (SELECT COUNT(*) FROM reserva r JOIN aula a ON a.id_aula = r.aula_id_aula
                     WHERE r.aluno_pessoa_cpf_pessoa = meus.cpf AND a.funcionario_pessoa_cpf_pessoa = $1
                       AND r.status_reserva IN ('CONFIRMADA', 'CONCLUIDA'))::int AS aulas_comigo,
                   (SELECT to_char(MIN(r.data_aula_reserva), 'DD/MM/YYYY')
                      FROM reserva r JOIN aula a ON a.id_aula = r.aula_id_aula
                     WHERE r.aluno_pessoa_cpf_pessoa = meus.cpf AND a.funcionario_pessoa_cpf_pessoa = $1
                       AND r.status_reserva = 'CONFIRMADA' AND r.data_aula_reserva >= CURRENT_DATE) AS proxima_aula
              FROM meus
              JOIN pessoa p ON p.cpf_pessoa = meus.cpf
              JOIN aluno al ON al.pessoa_cpf_pessoa = meus.cpf
             ORDER BY p.nome_pessoa
             LIMIT 500`, [req.session.usuario.cpf]);
        return res.json({ sucesso: true, alunos: r.rows });
    } catch (error) {
        return erroInterno(res, 'Erro ao listar alunos do instrutor:', error);
    }
};

// ---------- GET /instrutor/fichas ----------
// Fichas em que EU sou o instrutor responsável (as ativas primeiro; as inativas formam o histórico).
exports.listarMinhasFichas = async (req, res) => {
    try {
        const r = await query(`
            SELECT f.id_ficha_treino, p.nome_pessoa AS aluno, f.titulo_ficha_treino, f.objetivo_ficha_treino,
                   to_char(f.data_criacao_ficha_treino, 'DD/MM/YYYY') AS criada, f.ativa_ficha_treino AS ativa,
                   (SELECT COUNT(*) FROM ficha_exercicio e
                     WHERE e.ficha_treino_id_ficha_treino = f.id_ficha_treino)::int AS exercicios
              FROM ficha_treino f JOIN pessoa p ON p.cpf_pessoa = f.aluno_pessoa_cpf_pessoa
             WHERE f.funcionario_pessoa_cpf_pessoa = $1
             ORDER BY f.ativa_ficha_treino DESC, p.nome_pessoa, f.data_criacao_ficha_treino DESC
             LIMIT 500`, [req.session.usuario.cpf]);
        return res.json({ sucesso: true, fichas: r.rows });
    } catch (error) {
        return erroInterno(res, 'Erro ao listar fichas do instrutor:', error);
    }
};

// ---------- GET /instrutor/fichas/:id ----------
// Uma ficha completa. Só abre se a ficha for MINHA (senão 404, sem revelar que ela existe).
exports.obterMinhaFicha = async (req, res) => {
    try {
        const id = lerId(req.params.id);
        if (!id) return res.status(404).json({ sucesso: false, mensagem: 'Ficha não encontrada.' });

        const f = await query(`
            SELECT f.id_ficha_treino, p.nome_pessoa AS aluno, f.titulo_ficha_treino, f.objetivo_ficha_treino,
                   f.observacoes_ficha_treino, to_char(f.data_criacao_ficha_treino, 'DD/MM/YYYY') AS criada,
                   f.ativa_ficha_treino AS ativa
              FROM ficha_treino f JOIN pessoa p ON p.cpf_pessoa = f.aluno_pessoa_cpf_pessoa
             WHERE f.id_ficha_treino = $1 AND f.funcionario_pessoa_cpf_pessoa = $2`,
            [id, req.session.usuario.cpf]);
        if (f.rows.length === 0) {
            return res.status(404).json({ sucesso: false, mensagem: 'Ficha não encontrada.' });
        }

        const e = await query(`
            SELECT divisao_ficha_exercicio AS divisao, nome_ficha_exercicio AS nome, series_ficha_exercicio AS series,
                   repeticoes_ficha_exercicio AS repeticoes, descanso_segundos_ficha_exercicio AS descanso,
                   orientacoes_ficha_exercicio AS orientacoes
              FROM ficha_exercicio WHERE ficha_treino_id_ficha_treino = $1
             ORDER BY divisao_ficha_exercicio, ordem_ficha_exercicio`, [id]);
        return res.json({ sucesso: true, ficha: f.rows[0], exercicios: e.rows });
    } catch (error) {
        return erroInterno(res, 'Erro ao obter ficha do instrutor:', error);
    }
};

// ---------- GET /instrutor/agenda ----------
// semana  = a grade fixa das minhas aulas (dia 1 = segunda ... 7 = domingo)
// proximas = cada ocorrência das minhas aulas nos próximos 14 dias, com vagas ocupadas
exports.listarMinhaAgenda = async (req, res) => {
    try {
        const cpf = req.session.usuario.cpf;
        const [semana, proximas] = await Promise.all([
            query(`
                SELECT a.id_aula, m.nome_modalidade, a.dia_semana_aula,
                       to_char(a.horario_inicio_aula, 'HH24:MI') AS horario,
                       a.duracao_minutos_aula, a.vagas_aula
                  FROM aula a JOIN modalidade m ON m.id_modalidade = a.modalidade_id_modalidade
                 WHERE a.funcionario_pessoa_cpf_pessoa = $1
                 ORDER BY a.dia_semana_aula, a.horario_inicio_aula`, [cpf]),
            query(`
                SELECT a.id_aula, to_char(d, 'YYYY-MM-DD') AS data_iso, to_char(d, 'DD/MM') AS data,
                       a.dia_semana_aula, to_char(a.horario_inicio_aula, 'HH24:MI') AS horario,
                       a.duracao_minutos_aula, m.nome_modalidade, a.vagas_aula,
                       (d::date = CURRENT_DATE) AS hoje,
                       (d::date + a.horario_inicio_aula) < LOCALTIMESTAMP AS ja_passou,
                       (SELECT COUNT(*) FROM reserva r WHERE r.aula_id_aula = a.id_aula
                           AND r.data_aula_reserva = d::date AND r.status_reserva = 'CONFIRMADA')::int AS ocupadas
                  FROM generate_series(CURRENT_DATE::timestamp, (CURRENT_DATE + 13)::timestamp, interval '1 day') AS d
                  JOIN aula a       ON a.dia_semana_aula = EXTRACT(ISODOW FROM d)::int
                  JOIN modalidade m ON m.id_modalidade = a.modalidade_id_modalidade
                 WHERE a.funcionario_pessoa_cpf_pessoa = $1
                 ORDER BY d, a.horario_inicio_aula`, [cpf])
        ]);
        return res.json({ sucesso: true, semana: semana.rows, proximas: proximas.rows });
    } catch (error) {
        return erroInterno(res, 'Erro ao listar agenda do instrutor:', error);
    }
};

// ---------- GET /instrutor/agenda/alunos?aulaId=12&data=2026-11-25 ----------
// Alunos de UMA ocorrência de aula (aula + data). A aula precisa ser minha.
exports.listarAlunosDaAula = async (req, res) => {
    try {
        const aulaId = lerId(req.query.aulaId);
        const data = lerData(req.query.data);
        if (!aulaId || !data) {
            return res.status(400).json({ sucesso: false, mensagem: 'Informe a aula e a data (AAAA-MM-DD).' });
        }

        const aula = await query(`
            SELECT a.id_aula, a.dia_semana_aula, a.vagas_aula, m.nome_modalidade,
                   to_char(a.horario_inicio_aula, 'HH24:MI') AS horario
              FROM aula a JOIN modalidade m ON m.id_modalidade = a.modalidade_id_modalidade
             WHERE a.id_aula = $1 AND a.funcionario_pessoa_cpf_pessoa = $2`,
            [aulaId, req.session.usuario.cpf]);
        if (aula.rows.length === 0) {
            return res.status(404).json({ sucesso: false, mensagem: 'Aula não encontrada.' });
        }
        if (aula.rows[0].dia_semana_aula !== data.diaSemana) {
            return res.status(400).json({ sucesso: false, mensagem: 'Essa aula não acontece nesta data.' });
        }

        // Cancelados não aparecem: aqui interessa quem vai (ou foi) à aula
        const alunos = await query(`
            SELECT p.nome_pessoa AS nome, al.objetivo_aluno AS objetivo, r.status_reserva
              FROM reserva r
              JOIN aluno al ON al.pessoa_cpf_pessoa = r.aluno_pessoa_cpf_pessoa
              JOIN pessoa p ON p.cpf_pessoa = r.aluno_pessoa_cpf_pessoa
             WHERE r.aula_id_aula = $1 AND r.data_aula_reserva = $2
               AND r.status_reserva IN ('CONFIRMADA', 'CONCLUIDA')
             ORDER BY p.nome_pessoa`, [aulaId, data.texto]);

        return res.json({
            sucesso: true,
            aula: { modalidade: aula.rows[0].nome_modalidade, horario: aula.rows[0].horario, vagas: aula.rows[0].vagas_aula },
            alunos: alunos.rows
        });
    } catch (error) {
        return erroInterno(res, 'Erro ao listar alunos da aula:', error);
    }
};