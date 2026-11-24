// ============================================================
// limitadorLogin.js - Proteção contra adivinhação de senha
// Depois de 5 erros seguidos (mesmo IP + mesmo e-mail), bloqueia
// novas tentativas por 15 minutos. Os contadores ficam na memória
// do servidor: reiniciar o servidor zera tudo.
// ============================================================

const MAX_TENTATIVAS = 5;
const JANELA_MS = 15 * 60 * 1000; // 15 minutos

// chave "ip|email" -> { contagem, expiraEm }
const falhas = new Map();

function chaveDaRequisicao(req) {
    const email = String((req.body && req.body.email) || '').trim().toLowerCase();
    return req.ip + '|' + email;
}

// Roda ANTES do login: se já estourou o limite, nem deixa tentar.
function limitarLogin(req, res, next) {
    const registro = falhas.get(chaveDaRequisicao(req));

    if (registro && registro.expiraEm > Date.now() && registro.contagem >= MAX_TENTATIVAS) {
        const segundos = Math.ceil((registro.expiraEm - Date.now()) / 1000);
        res.set('Retry-After', String(segundos));
        return res.status(429).json({
            sucesso: false,
            mensagem: 'Muitas tentativas de login. Tente novamente em ' + Math.ceil(segundos / 60) + ' minuto(s).'
        });
    }
    return next();
}

// O controller chama quando e-mail/senha estão errados.
function registrarFalha(req) {
    const chave = chaveDaRequisicao(req);
    const agora = Date.now();
    const registro = falhas.get(chave);

    if (!registro || registro.expiraEm <= agora) {
        falhas.set(chave, { contagem: 1, expiraEm: agora + JANELA_MS });
    } else {
        registro.contagem += 1;
    }
}

// O controller chama quando o login dá certo: zera o contador.
function limparFalhas(req) {
    falhas.delete(chaveDaRequisicao(req));
}

// Limpeza periódica para o Map não crescer para sempre.
// unref() garante que esse timer não impede o servidor de encerrar.
setInterval(() => {
    const agora = Date.now();
    for (const [chave, registro] of falhas) {
        if (registro.expiraEm <= agora) falhas.delete(chave);
    }
}, 5 * 60 * 1000).unref();

module.exports = { limitarLogin, registrarFalha, limparFalhas };