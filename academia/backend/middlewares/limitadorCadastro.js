// ============================================================
// limitadorCadastro.js - Proteção contra criação de contas em massa
// Cada IP pode fazer no máximo 10 tentativas de cadastro por hora.
// Os contadores ficam na memória do servidor: reiniciar o servidor zera tudo.
// ============================================================

const MAX_TENTATIVAS = 10;
const JANELA_MS = 60 * 60 * 1000; // 1 hora

// ip -> { contagem, expiraEm }
const tentativas = new Map();

// Roda ANTES do cadastro: conta a tentativa e, se estourou o limite, nem deixa continuar.
function limitarCadastro(req, res, next) {
    const agora = Date.now();
    let registro = tentativas.get(req.ip);

    if (!registro || registro.expiraEm <= agora) {
        registro = { contagem: 0, expiraEm: agora + JANELA_MS };
        tentativas.set(req.ip, registro);
    }
    registro.contagem += 1;

    if (registro.contagem > MAX_TENTATIVAS) {
        const segundos = Math.ceil((registro.expiraEm - agora) / 1000);
        res.set('Retry-After', String(segundos));
        return res.status(429).json({
            sucesso: false,
            mensagem: 'Muitas tentativas de cadastro. Tente novamente em ' + Math.ceil(segundos / 60) + ' minuto(s).'
        });
    }
    return next();
}

// Limpeza periódica para o Map não crescer para sempre (unref: não impede o servidor de encerrar)
setInterval(() => {
    const agora = Date.now();
    for (const [ip, registro] of tentativas) {
        if (registro.expiraEm <= agora) tentativas.delete(ip);
    }
}, 10 * 60 * 1000).unref();

module.exports = { limitarCadastro };