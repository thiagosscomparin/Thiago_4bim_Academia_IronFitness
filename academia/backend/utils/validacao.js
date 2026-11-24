// validacao.js - Validações no BACKEND (o frontend não basta: qualquer um pode
// chamar a API direto). Devolve uma lista de mensagens de erro (vazia = tudo certo).
const REGEX_CPF = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validarPessoa(d, { criando }) {
    const erros = [];
    const nome = String(d.nome || '').trim();
    const email = String(d.email || '').trim();
    const senha = String(d.senha || '');

    if (!REGEX_CPF.test(String(d.cpf || ''))) erros.push('CPF inválido. Use o formato 000.000.000-00.');
    if (nome.length < 3 || nome.length > 80) erros.push('O nome deve ter de 3 a 80 caracteres.');
    if (!REGEX_EMAIL.test(email) || email.length > 80) erros.push('E-mail inválido.');
    if (d.dataNascimento) {
        const data = new Date(d.dataNascimento);
        if (isNaN(data) || data > new Date()) erros.push('Data de nascimento inválida.');
    }
    if (String(d.endereco || '').length > 150) erros.push('Endereço muito longo (máximo 150).');
    if (String(d.objetivo || '').length > 100) erros.push('Objetivo muito longo (máximo 100).');
    // Na criação a senha é obrigatória; na edição só é validada se for informada
    if ((criando || senha) && (senha.length < 6 || senha.length > 72)) {
        erros.push('A senha deve ter de 6 a 72 caracteres.');
    }
    return erros;
}

module.exports = { REGEX_CPF, validarPessoa };