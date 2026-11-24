// matriculaRoutes.js - URLs do CRUD de matrículas (prefixo /matricula no server.js)
const express = require('express');
const matriculaController = require('../controllers/matriculaController');
const { exigirPerfil } = require('../middlewares/auth');

const router = express.Router();
const soGerente = exigirPerfil('gerente');
const ID = ':id(\\d+)';

router.get('/listar', soGerente, matriculaController.listarMatriculas);
router.get('/alunos', soGerente, matriculaController.listarAlunos);
router.get('/planos', soGerente, matriculaController.listarPlanosAtivos);
router.get('/' + ID, soGerente, matriculaController.obterMatricula);
router.post('/', soGerente, matriculaController.criarMatricula);
router.put('/' + ID, soGerente, matriculaController.atualizarMatricula);
router.patch('/' + ID + '/cancelar', soGerente, matriculaController.cancelarMatricula);
router.delete('/' + ID, soGerente, matriculaController.deletarMatricula);

module.exports = router;