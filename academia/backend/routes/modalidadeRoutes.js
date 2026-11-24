// modalidadeRoutes.js - URLs do CRUD de modalidades (prefixo /modalidade no server.js)
const express = require('express');
const modalidadeController = require('../controllers/modalidadeController');
const { exigirPerfil } = require('../middlewares/auth');

const router = express.Router();
const soGerente = exigirPerfil('gerente');
const ID = ':id(\\d+)';

router.get('/listar', soGerente, modalidadeController.listarModalidades);
router.get('/' + ID, soGerente, modalidadeController.obterModalidade);
router.post('/', soGerente, modalidadeController.criarModalidade);
router.put('/' + ID, soGerente, modalidadeController.atualizarModalidade);
router.delete('/' + ID, soGerente, modalidadeController.deletarModalidade);

module.exports = router;