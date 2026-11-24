// funcionarioRoutes.js - URLs do CRUD de funcionários (prefixo /funcionario no server.js)
const express = require('express');
const funcionarioController = require('../controllers/funcionarioController');
const { exigirPerfil } = require('../middlewares/auth');

const router = express.Router();
const soGerente = exigirPerfil('gerente');
const CPF = ':cpf(\\d{3}\\.\\d{3}\\.\\d{3}-\\d{2})';

router.get('/listar', soGerente, funcionarioController.listarFuncionarios);
router.get('/disponiveis', soGerente, funcionarioController.listarDisponiveis);
router.get('/' + CPF, soGerente, funcionarioController.obterFuncionario);
router.post('/', soGerente, funcionarioController.criarFuncionario);
router.put('/' + CPF, soGerente, funcionarioController.atualizarFuncionario);
router.delete('/' + CPF, soGerente, funcionarioController.deletarFuncionario);

module.exports = router;