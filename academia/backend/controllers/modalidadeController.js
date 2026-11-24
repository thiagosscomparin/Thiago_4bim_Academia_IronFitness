// ============================================================
// modalidadeController.js - CRUD de Modalidades (somente gerente)
// Modalidade com aulas cadastradas não pode ser excluída.
// ============================================================
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { query } = require('../database');

// Fotos ficam em academia/imagens/modalidades/ (servida em /imagens/...)
const PASTA_FOTOS = path.join(__dirname, '../../imagens/modalidades');
const URL_FOTOS = '/imagens/modalidades/';
const TAMANHO_MAX = 2 * 1024 * 1024; // 2 MB

// Confere o tipo REAL do arquivo pelos primeiros bytes (não confia só no que o navegador diz)
function detectarTipo(buf) {
    if (buf.length > 3 && buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'jpg';
    if (buf.length > 8 && buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) return 'png';
    if (buf.length > 12 && buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') return 'webp';
    return null;
}

// Recebe "data:image/...;base64,XXXX", valida e grava no disco. Devolve o caminho público ou lança Error.
async function salvarFoto(dataUrl) {
    const m = /^data:image\/(?:png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
    if (!m) throw new Error('Envie uma imagem PNG, JPG ou WEBP.');
    const buf = Buffer.from(m[1], 'base64');
    if (buf.length > TAMANHO_MAX) throw new Error('A imagem deve ter no máximo 2 MB.');
    const ext = detectarTipo(buf);
    if (!ext) throw new Error('O arquivo enviado não é uma imagem válida (PNG, JPG ou WEBP).');
    await fs.promises.mkdir(PASTA_FOTOS, { recursive: true });
    const nome = 'modalidade-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex') + '.' + ext;
    await fs.promises.writeFile(path.join(PASTA_FOTOS, nome), buf);
    return URL_FOTOS + nome;
}

// Apaga o arquivo antigo do disco (só se estiver dentro da pasta de fotos)
async function apagarFoto(caminho) {
    if (!caminho || !caminho.startsWith(URL_FOTOS)) return;
    const arquivo = path.basename(caminho);
    await fs.promises.unlink(path.join(PASTA_FOTOS, arquivo)).catch(() => {});
}

function lerCampos(d) {
    const erros = [];
    const nome = String(d.nome || '').trim();
    const descricao = String(d.descricao || '').trim();
    if (nome.length < 2 || nome.length > 40) erros.push('O nome deve ter de 2 a 40 caracteres.');
    if (descricao.length > 200) erros.push('A descrição deve ter no máximo 200 caracteres.');
    return { erros, nome, descricao };
}

async function nomeJaExiste(nome, idIgnorar) {
    const r = await query('SELECT 1 FROM modalidade WHERE LOWER(nome_modalidade) = LOWER($1) AND id_modalidade <> $2', [nome, idIgnorar]);
    return r.rows.length > 0;
}

// GET /modalidade/listar
exports.listarModalidades = async (req, res) => {
    try {
        const r = await query(`
            SELECT m.id_modalidade, m.nome_modalidade, m.descricao_modalidade, m.foto_modalidade,
                   (SELECT COUNT(*) FROM aula a WHERE a.modalidade_id_modalidade = m.id_modalidade)::int AS aulas
              FROM modalidade m ORDER BY m.nome_modalidade`);
        return res.json({ sucesso: true, modalidades: r.rows });
    } catch (error) {
        console.error('Erro ao listar modalidades:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};

// GET /modalidade/:id
exports.obterModalidade = async (req, res) => {
    try {
        const r = await query('SELECT id_modalidade, nome_modalidade, descricao_modalidade, foto_modalidade FROM modalidade WHERE id_modalidade = $1', [req.params.id]);
        if (r.rows.length === 0) return res.status(404).json({ sucesso: false, mensagem: 'Modalidade não encontrada.' });
        return res.json({ sucesso: true, modalidade: r.rows[0] });
    } catch (error) {
        console.error('Erro ao obter modalidade:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};

// POST /modalidade   corpo: { nome, descricao, foto? }  (foto = imagem em base64 / data URL)
exports.criarModalidade = async (req, res) => {
    try {
        const c = lerCampos(req.body || {});
        if (c.erros.length) return res.status(400).json({ sucesso: false, mensagem: c.erros.join(' ') });
        if (await nomeJaExiste(c.nome, 0)) return res.status(409).json({ sucesso: false, mensagem: 'Já existe uma modalidade com este nome.' });
        let foto = null;
        if (req.body.foto) {
            try { foto = await salvarFoto(req.body.foto); }
            catch (e) { return res.status(400).json({ sucesso: false, mensagem: e.message }); }
        }
        await query('INSERT INTO modalidade (nome_modalidade, descricao_modalidade, foto_modalidade) VALUES ($1, $2, $3)', [c.nome, c.descricao || null, foto]);
        return res.status(201).json({ sucesso: true, mensagem: 'Modalidade cadastrada com sucesso.' });
    } catch (error) {
        console.error('Erro ao criar modalidade:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};

// PUT /modalidade/:id   corpo: { nome, descricao, foto?, removerFoto? }
exports.atualizarModalidade = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const c = lerCampos(req.body || {});
        if (c.erros.length) return res.status(400).json({ sucesso: false, mensagem: c.erros.join(' ') });
        if (await nomeJaExiste(c.nome, id)) return res.status(409).json({ sucesso: false, mensagem: 'Já existe uma modalidade com este nome.' });
        const atual = await query('SELECT foto_modalidade FROM modalidade WHERE id_modalidade = $1', [id]);
        if (atual.rows.length === 0) return res.status(404).json({ sucesso: false, mensagem: 'Modalidade não encontrada.' });
        const fotoAntiga = atual.rows[0].foto_modalidade;

        let foto = fotoAntiga;                       // padrão: mantém a foto atual
        if (req.body.foto) {                         // nova foto enviada
            try { foto = await salvarFoto(req.body.foto); }
            catch (e) { return res.status(400).json({ sucesso: false, mensagem: e.message }); }
        } else if (req.body.removerFoto) {           // pediu para remover
            foto = null;
        }

        await query('UPDATE modalidade SET nome_modalidade = $2, descricao_modalidade = $3, foto_modalidade = $4 WHERE id_modalidade = $1', [id, c.nome, c.descricao || null, foto]);
        if (foto !== fotoAntiga) await apagarFoto(fotoAntiga);
        return res.json({ sucesso: true, mensagem: 'Modalidade atualizada com sucesso.' });
    } catch (error) {
        console.error('Erro ao atualizar modalidade:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};

// DELETE /modalidade/:id
exports.deletarModalidade = async (req, res) => {
    try {
        const r = await query('DELETE FROM modalidade WHERE id_modalidade = $1 RETURNING foto_modalidade', [req.params.id]);
        if (r.rowCount === 0) return res.status(404).json({ sucesso: false, mensagem: 'Modalidade não encontrada.' });
        await apagarFoto(r.rows[0].foto_modalidade);
        return res.json({ sucesso: true, mensagem: 'Modalidade excluída com sucesso.' });
    } catch (error) {
        if (error.code === '23503') {
            return res.status(409).json({ sucesso: false, mensagem: 'Não é possível excluir: existem aulas cadastradas nesta modalidade.' });
        }
        console.error('Erro ao excluir modalidade:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};