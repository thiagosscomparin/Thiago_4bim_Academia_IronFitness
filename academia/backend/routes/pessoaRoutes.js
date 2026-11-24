// ============================================================
// pessoaRoutes.js - URLs do CRUD de pessoas (prefixo /pessoa no server.js)
// O porteiro é colocado em CADA rota (e não no router inteiro) para não
// interferir com as páginas da pasta /pessoa, que são protegidas à parte.
// O padrão do :cpf só aceita 000.000.000-00; assim "pessoa.html" não é confundido com um CPF.
// ============================================================
const express = require('express');
const pessoaController = require('../controllers/pessoaController');
const { exigirPerfil } = require('../middlewares/auth');

const router = express.Router();
const soGerente = exigirPerfil('gerente');
const CPF = ':cpf(\\d{3}\\.\\d{3}\\.\\d{3}-\\d{2})';

router.get('/listar', soGerente, pessoaController.listarPessoas);
router.get('/' + CPF, soGerente, pessoaController.obterPessoa);
router.post('/', soGerente, pessoaController.criarPessoa);
router.put('/' + CPF, soGerente, pessoaController.atualizarPessoa);
router.delete('/' + CPF, soGerente, pessoaController.deletarPessoa);

module.exports = router;