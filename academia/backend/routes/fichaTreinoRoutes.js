// fichaTreinoRoutes.js - URLs das fichas de treino (prefixo /ficha_treino no server.js)
// Aqui só o gerente cria/edita/exclui. O instrutor e o aluno terão rotas próprias, SÓ de consulta.
const express = require('express');
const fichaTreinoController = require('../controllers/fichaTreinoController');
const { exigirPerfil } = require('../middlewares/auth');

const router = express.Router();
const soGerente = exigirPerfil('gerente');
const ID = ':id(\\d+)';

router.get('/listar', soGerente, fichaTreinoController.listarFichas);
router.get('/' + ID, soGerente, fichaTreinoController.obterFicha);
router.post('/', soGerente, fichaTreinoController.criarFicha);
router.put('/' + ID, soGerente, fichaTreinoController.atualizarFicha);
router.patch('/' + ID + '/ativar', soGerente, fichaTreinoController.ativarFicha);
router.delete('/' + ID, soGerente, fichaTreinoController.deletarFicha);

module.exports = router;