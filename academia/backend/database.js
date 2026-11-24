// ============================================================
// database.js - Conexão com o PostgreSQL
// Todo acesso ao banco passa por aqui. Os models importam
// `query` (consulta simples) ou `transacao` (várias operações
// que precisam dar certo juntas, como reservar uma aula).
// ============================================================
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const { Pool } = require('pg');

// 1) Garante que o .env está completo antes de tentar conectar
const obrigatorias = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const faltando = obrigatorias.filter((nome) => !process.env[nome]);

if (faltando.length > 0) {
    console.error('❌ Variáveis ausentes no backend/.env: ' + faltando.join(', '));
    console.error('   Copie backend/.env.example para backend/.env e preencha.');
    process.exit(1);
}

// 2) Pool = conjunto de conexões reaproveitadas (mais rápido que abrir uma por consulta)
const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    max: 10,                        // máximo de conexões simultâneas
    idleTimeoutMillis: 30000,       // fecha conexões paradas após 30 s
    connectionTimeoutMillis: 5000   // desiste se não conectar em 5 s
});

// Evita que um erro de conexão ociosa derrube o servidor
pool.on('error', (erro) => {
    console.error('Erro inesperado no pool do PostgreSQL:', erro.message);
});

// 3) Consulta simples. Sempre use parâmetros ($1, $2...) para evitar SQL Injection.
//    Exemplo: query('SELECT * FROM pessoa WHERE cpf_pessoa = $1', [cpf])
function query(texto, parametros) {
    return pool.query(texto, parametros);
}

// 4) Transação: executa várias consultas como se fossem uma só.
//    Se qualquer uma falhar, TUDO é desfeito (ROLLBACK).
async function transacao(callback) {
    const cliente = await pool.connect();
    try {
        await cliente.query('BEGIN');
        const resultado = await callback(cliente); // dentro do callback use cliente.query(...)
        await cliente.query('COMMIT');
        return resultado;
    } catch (erro) {
        await cliente.query('ROLLBACK');
        throw erro;
    } finally {
        cliente.release(); // devolve a conexão ao pool
    }
}

// 5) Usada na inicialização para confirmar que o banco responde
async function testarConexao() {
    const resultado = await query('SELECT current_database() AS banco, NOW() AS agora');
    return resultado.rows[0];
}

module.exports = { pool, query, transacao, testarConexao };