// ============================================================
// fichaTreinoController.js - Fichas de treino (CRUD só do gerente)
// Ficha = aluno + instrutor responsável (opcional) + lista de exercícios.
// Cada aluno tem NO MÁXIMO UMA ficha ativa (o banco garante); as demais formam o histórico.
// Criar uma ficha nova arquiva a ativa anterior. Instrutor e aluno apenas CONSULTAM.
// ============================================================
const { query, transacao } = require('../database');
const { REGEX_CPF } = require('../utils/validacao');

const REGEX_DIVISAO = /^Treino [A-F]$/;
const MAX_EXERCICIOS = 60;

// Valida o cabeçalho da ficha
function lerFicha(d) {
    const erros = [];
    const titulo = String(d.titulo || '').trim();
    const objetivo = String(d.objetivo || '').trim();
    const observacoes = String(d.observacoes || '').trim();
    const instrutorCpf = d.instrutorCpf ? String(d.instrutorCpf) : null;

    if (titulo.length < 2 || titulo.length > 80) erros.push('O título deve ter de 2 a 80 caracteres.');
    if (objetivo.length > 100) erros.push('O objetivo deve ter no máximo 100 caracteres.');
    if (observacoes.length > 300) erros.push('As observações devem ter no máximo 300 caracteres.');
    if (instrutorCpf && !REGEX_CPF.test(instrutorCpf)) erros.push('Instrutor inválido.');
    return { erros, titulo, objetivo: objetivo || null, observacoes: observacoes || null, instrutorCpf };
}

// Valida a lista de exercícios e já atribui a ORDEM (1, 2, 3... dentro de cada divisão)
function lerExercicios(lista) {
    const erros = [];
    if (!Array.isArray(lista) || lista.length === 0) return { erros: ['Adicione pelo menos um exercício.'], itens: [] };
    if (lista.length > MAX_EXERCICIOS) return { erros: [`No máximo ${MAX_EXERCICIOS} exercícios por ficha.`], itens: [] };

    const contador = {};
    const itens = lista.map((e, i) => {
        const n = `Exercício ${i + 1}: `;
        const nome = String(e.nome || '').trim();
        const series = Number(e.series);
        const repeticoes = String(e.repeticoes || '').trim();
        const descanso = (e.descanso === '' || e.descanso === null || e.descanso === undefined) ? null : Number(e.descanso);
        const orientacoes = String(e.orientacoes || '').trim();
        const divisao = String(e.divisao || '');

        if (!REGEX_DIVISAO.test(divisao)) erros.push(n + 'divisão inválida.');
        if (nome.length < 2 || nome.length > 80) erros.push(n + 'o nome deve ter de 2 a 80 caracteres.');
        if (!Number.isInteger(series) || series < 1 || series > 20) erros.push(n + 'séries de 1 a 20.');
        if (repeticoes.length < 1 || repeticoes.length > 20) erros.push(n + 'informe as repetições (até 20 caracteres, ex.: 12 ou 8-10).');
        if (descanso !== null && (!Number.isInteger(descanso) || descanso < 0 || descanso > 600)) erros.push(n + 'descanso de 0 a 600 segundos.');
        if (orientacoes.length > 300) erros.push(n + 'orientações com no máximo 300 caracteres.');

        contador[divisao] = (contador[divisao] || 0) + 1;
        return { divisao, ordem: contador[divisao], nome, series, repeticoes, descanso, orientacoes: orientacoes || null };
    });
    return { erros: erros.slice(0, 5), itens };
}

// Só funcionário com cargo de instrutor pode ser o responsável
async function ehInstrutor(cpf) {
    const r = await query(`SELECT 1 FROM funcionario f JOIN cargo c ON c.id_cargo = f.cargo_id_cargo
                            WHERE f.pessoa_cpf_pessoa = $1 AND c.instrutor_cargo`, [cpf]);
    return r.rows.length > 0;
}

async function inserirExercicios(cliente, fichaId, itens) {
    for (const e of itens) {
        await cliente.query(
            `INSERT INTO ficha_exercicio (ficha_treino_id_ficha_treino, divisao_ficha_exercicio, ordem_ficha_exercicio, nome_ficha_exercicio,
                                          series_ficha_exercicio, repeticoes_ficha_exercicio, descanso_segundos_ficha_exercicio, orientacoes_ficha_exercicio)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [fichaId, e.divisao, e.ordem, e.nome, e.series, e.repeticoes, e.descanso, e.orientacoes]);
    }
}

// GET /ficha_treino/listar?busca=&situacao=ativa|historico
exports.listarFichas = async (req, res) => {
    try {
        const busca = String(req.query.busca || '').trim();
        const situacao = ['ativa', 'historico'].includes(req.query.situacao) ? req.query.situacao : '';
        const r = await query(`
            SELECT f.id_ficha_treino, p.nome_pessoa AS aluno, f.titulo_ficha_treino, f.objetivo_ficha_treino,
                   i.nome_pessoa AS instrutor, to_char(f.data_criacao_ficha_treino, 'DD/MM/YYYY') AS criada,
                   f.ativa_ficha_treino,
                   (SELECT COUNT(*) FROM ficha_exercicio e WHERE e.ficha_treino_id_ficha_treino = f.id_ficha_treino)::int AS exercicios
              FROM ficha_treino f
              JOIN pessoa p      ON p.cpf_pessoa = f.aluno_pessoa_cpf_pessoa
              LEFT JOIN pessoa i ON i.cpf_pessoa = f.funcionario_pessoa_cpf_pessoa
             WHERE ($1 = '' OR p.nome_pessoa ILIKE '%' || $1 || '%' OR p.cpf_pessoa LIKE '%' || $1 || '%')
               AND ($2 = '' OR ($2 = 'ativa' AND f.ativa_ficha_treino) OR ($2 = 'historico' AND NOT f.ativa_ficha_treino))
             ORDER BY p.nome_pessoa, f.ativa_ficha_treino DESC, f.data_criacao_ficha_treino DESC, f.id_ficha_treino DESC`,
            [busca, situacao]);
        return res.json({ sucesso: true, fichas: r.rows });
    } catch (error) {
        console.error('Erro ao listar fichas:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};

// GET /ficha_treino/:id  -> ficha + exercícios
exports.obterFicha = async (req, res) => {
    try {
        const f = await query(`
            SELECT f.id_ficha_treino, f.aluno_pessoa_cpf_pessoa AS aluno_cpf, p.nome_pessoa AS aluno,
                   f.funcionario_pessoa_cpf_pessoa AS instrutor_cpf, f.titulo_ficha_treino, f.objetivo_ficha_treino,
                   f.observacoes_ficha_treino, f.ativa_ficha_treino
              FROM ficha_treino f JOIN pessoa p ON p.cpf_pessoa = f.aluno_pessoa_cpf_pessoa
             WHERE f.id_ficha_treino = $1`, [req.params.id]);
        if (f.rows.length === 0) return res.status(404).json({ sucesso: false, mensagem: 'Ficha não encontrada.' });

        const e = await query(`
            SELECT divisao_ficha_exercicio AS divisao, nome_ficha_exercicio AS nome, series_ficha_exercicio AS series,
                   repeticoes_ficha_exercicio AS repeticoes, descanso_segundos_ficha_exercicio AS descanso,
                   orientacoes_ficha_exercicio AS orientacoes
              FROM ficha_exercicio WHERE ficha_treino_id_ficha_treino = $1
             ORDER BY divisao_ficha_exercicio, ordem_ficha_exercicio`, [req.params.id]);
        return res.json({ sucesso: true, ficha: f.rows[0], exercicios: e.rows });
    } catch (error) {
        console.error('Erro ao obter ficha:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};

// POST /ficha_treino   corpo: { alunoCpf, instrutorCpf, titulo, objetivo, observacoes, exercicios: [...] }
// A ficha nova vira a ATIVA do aluno; a anterior vai para o histórico (mesma transação).
exports.criarFicha = async (req, res) => {
    try {
        const d = req.body || {};
        const ficha = lerFicha(d);
        const ex = lerExercicios(d.exercicios);
        if (!REGEX_CPF.test(String(d.alunoCpf || ''))) ficha.erros.push('Selecione o aluno.');
        const erros = [...ficha.erros, ...ex.erros];
        if (erros.length) return res.status(400).json({ sucesso: false, mensagem: erros.join(' ') });
        if (ficha.instrutorCpf && !(await ehInstrutor(ficha.instrutorCpf))) {
            return res.status(409).json({ sucesso: false, mensagem: 'O responsável selecionado não tem cargo de instrutor.' });
        }

        await transacao(async (cliente) => {
            await cliente.query('UPDATE ficha_treino SET ativa_ficha_treino = FALSE WHERE aluno_pessoa_cpf_pessoa = $1 AND ativa_ficha_treino', [d.alunoCpf]);
            const r = await cliente.query(
                `INSERT INTO ficha_treino (aluno_pessoa_cpf_pessoa, funcionario_pessoa_cpf_pessoa, titulo_ficha_treino, objetivo_ficha_treino, observacoes_ficha_treino)
                 VALUES ($1, $2, $3, $4, $5) RETURNING id_ficha_treino`,
                [d.alunoCpf, ficha.instrutorCpf, ficha.titulo, ficha.objetivo, ficha.observacoes]);
            await inserirExercicios(cliente, r.rows[0].id_ficha_treino, ex.itens);
        });
        return res.status(201).json({ sucesso: true, mensagem: 'Ficha cadastrada. A ficha anterior do aluno (se havia) foi para o histórico.' });
    } catch (error) {
        if (error.code === '23503') return res.status(400).json({ sucesso: false, mensagem: 'Aluno ou instrutor inexistente.' });
        console.error('Erro ao criar ficha:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};

// PUT /ficha_treino/:id  (o aluno não muda; os exercícios são SUBSTITUÍDOS pela lista enviada)
exports.atualizarFicha = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const d = req.body || {};
        const ficha = lerFicha(d);
        const ex = lerExercicios(d.exercicios);
        const erros = [...ficha.erros, ...ex.erros];
        if (erros.length) return res.status(400).json({ sucesso: false, mensagem: erros.join(' ') });
        if (ficha.instrutorCpf && !(await ehInstrutor(ficha.instrutorCpf))) {
            return res.status(409).json({ sucesso: false, mensagem: 'O responsável selecionado não tem cargo de instrutor.' });
        }

        const existe = await transacao(async (cliente) => {
            const r = await cliente.query(
                `UPDATE ficha_treino SET funcionario_pessoa_cpf_pessoa = $2, titulo_ficha_treino = $3,
                        objetivo_ficha_treino = $4, observacoes_ficha_treino = $5 WHERE id_ficha_treino = $1`,
                [id, ficha.instrutorCpf, ficha.titulo, ficha.objetivo, ficha.observacoes]);
            if (r.rowCount === 0) return false;
            await cliente.query('DELETE FROM ficha_exercicio WHERE ficha_treino_id_ficha_treino = $1', [id]);
            await inserirExercicios(cliente, id, ex.itens);
            return true;
        });
        if (!existe) return res.status(404).json({ sucesso: false, mensagem: 'Ficha não encontrada.' });
        return res.json({ sucesso: true, mensagem: 'Ficha atualizada com sucesso.' });
    } catch (error) {
        if (error.code === '23503') return res.status(400).json({ sucesso: false, mensagem: 'Instrutor inexistente.' });
        console.error('Erro ao atualizar ficha:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};

// PATCH /ficha_treino/:id/ativar  -> traz uma ficha do histórico de volta (e arquiva a ativa atual)
exports.ativarFicha = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const atual = await query('SELECT aluno_pessoa_cpf_pessoa AS cpf, ativa_ficha_treino FROM ficha_treino WHERE id_ficha_treino = $1', [id]);
        if (atual.rows.length === 0) return res.status(404).json({ sucesso: false, mensagem: 'Ficha não encontrada.' });
        if (atual.rows[0].ativa_ficha_treino) return res.status(409).json({ sucesso: false, mensagem: 'Esta ficha já é a ficha ativa do aluno.' });

        await transacao(async (cliente) => {
            await cliente.query('UPDATE ficha_treino SET ativa_ficha_treino = FALSE WHERE aluno_pessoa_cpf_pessoa = $1 AND ativa_ficha_treino', [atual.rows[0].cpf]);
            await cliente.query('UPDATE ficha_treino SET ativa_ficha_treino = TRUE WHERE id_ficha_treino = $1', [id]);
        });
        return res.json({ sucesso: true, mensagem: 'Ficha reativada. A anterior foi para o histórico.' });
    } catch (error) {
        console.error('Erro ao ativar ficha:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};

// DELETE /ficha_treino/:id  (os exercícios saem junto, em cascata)
exports.deletarFicha = async (req, res) => {
    try {
        const r = await query('DELETE FROM ficha_treino WHERE id_ficha_treino = $1', [req.params.id]);
        if (r.rowCount === 0) return res.status(404).json({ sucesso: false, mensagem: 'Ficha não encontrada.' });
        return res.json({ sucesso: true, mensagem: 'Ficha excluída com sucesso.' });
    } catch (error) {
        console.error('Erro ao excluir ficha:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};