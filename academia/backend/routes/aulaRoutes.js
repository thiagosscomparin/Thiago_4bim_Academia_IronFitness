// aulaRoutes.js - URLs do CRUD de aulas (prefixo /aula no server.js)
const express = require('express');
const aulaController = require('../controllers/aulaController');
const { exigirPerfil } = require('../middlewares/auth');

const router = express.Router();
const soGerente = exigirPerfil('gerente');
const ID = ':id(\\d+)';

router.get('/listar', soGerente, aulaController.listarAulas);
router.get('/instrutores', soGerente, aulaController.listarInstrutores);
router.get('/' + ID, soGerente, aulaController.obterAula);
router.post('/', soGerente, aulaController.criarAula);
router.put('/' + ID, soGerente, aulaController.atualizarAula);
router.delete('/' + ID, soGerente, aulaController.deletarAula);

module.exports = router;