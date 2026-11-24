// ============================================================
// contaController.js - Conta do usuário LOGADO (qualquer perfil): troca de senha
// ============================================================
const bcrypt = require('bcryptjs');
const { query } = require('../database');

// POST /conta/senha   corpo: { senhaAtual, novaSenha }
exports.alterarSenha = async (req, res) => {
    try {
        const d = req.body || {};
        const atual = String(d.senhaAtual || '');
        const nova = String(d.novaSenha || '');
        if (!atual) return res.status(400).json({ sucesso: false, mensagem: 'Informe a senha atual.' });
        if (nova.length < 6 || nova.length > 72) return res.status(400).json({ sucesso: false, mensagem: 'A nova senha deve ter de 6 a 72 caracteres.' });
        if (nova === atual) return res.status(400).json({ sucesso: false, mensagem: 'A nova senha deve ser diferente da atual.' });

        const cpf = req.session.usuario.cpf;
        const r = await query('SELECT senha_pessoa FROM pessoa WHERE cpf_pessoa = $1', [cpf]);
        if (r.rows.length === 0) return res.status(404).json({ sucesso: false, mensagem: 'Usuário não encontrado.' });

        if (!(await bcrypt.compare(atual, r.rows[0].senha_pessoa))) {
            return res.status(401).json({ sucesso: false, mensagem: 'A senha atual está incorreta.' });
        }
        await query('UPDATE pessoa SET senha_pessoa = $2 WHERE cpf_pessoa = $1', [cpf, await bcrypt.hash(nova, 10)]);
        return res.json({ sucesso: true, mensagem: 'Senha alterada com sucesso.' });
    } catch (error) {
        console.error('Erro ao alterar senha:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
    }
};