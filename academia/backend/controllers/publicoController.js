const { query } = require('../database');

// GET /publico/home
exports.dadosInicio = async (req, res) => {
    try {
        const [planos, modalidades, grade] = await Promise.all([
            query(`SELECT id_plano, nome_plano, descricao_plano, valor_plano, duracao_meses_plano, aulas_semana_plano
                     FROM plano WHERE ativo_plano ORDER BY valor_plano, nome_plano`),
            query('SELECT * FROM modalidade ORDER BY nome_modalidade'),
            query(`SELECT a.dia_semana_aula, to_char(a.horario_inicio_aula, 'HH24:MI') AS horario,
                          a.duracao_minutos_aula, m.nome_modalidade
                     FROM aula a JOIN modalidade m ON m.id_modalidade = a.modalidade_id_modalidade
                    ORDER BY a.dia_semana_aula, a.horario_inicio_aula`)
        ]);
        return res.json({
            sucesso: true,
            planos: planos.rows.map((p) => ({ ...p, valor_plano: Number(p.valor_plano) })),
            modalidades: modalidades.rows,
            grade: grade.rows
        });
    } catch (error) {
        console.error('Erro ao carregar a página inicial:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Não foi possível carregar as informações agora.' });
    }
};