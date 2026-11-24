// pagamentoRoutes.js - URLs de pagamentos (prefixo /pagamento no server.js)
const express = require('express');
const pagamentoController = require('../controllers/pagamentoController');
const { exigirPerfil } = require('../middlewares/auth');

const router = express.Router();
const soGerente = exigirPerfil('gerente');
const ID = ':id(\\d+)';

router.get('/listar', soGerente, pagamentoController.listarPagamentos);
router.get('/matriculas', soGerente, pagamentoController.listarMatriculas);
router.get('/formas', soGerente, pagamentoController.listarFormas);
router.get('/' + ID, soGerente, pagamentoController.obterPagamento);
router.get('/' + ID + '/pix', soGerente, pagamentoController.gerarPix);
router.post('/', soGerente, pagamentoController.criarPagamento);
router.put('/' + ID, soGerente, pagamentoController.atualizarPagamento);
router.patch('/' + ID + '/pagar', soGerente, pagamentoController.marcarPago);
router.patch('/' + ID + '/estornar', soGerente, pagamentoController.estornar);
router.delete('/' + ID, soGerente, pagamentoController.deletarPagamento);

module.exports = router;