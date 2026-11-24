// planoRoutes.js - URLs do CRUD de planos (prefixo /plano no server.js)
const express = require('express');
const planoController = require('../controllers/planoController');
const { exigirPerfil } = require('../middlewares/auth');

const router = express.Router();
const soGerente = exigirPerfil('gerente');
const ID = ':id(\\d+)';

router.get('/listar', soGerente, planoController.listarPlanos);
router.get('/' + ID, soGerente, planoController.obterPlano);
router.post('/', soGerente, planoController.criarPlano);
router.put('/' + ID, soGerente, planoController.atualizarPlano);
router.patch('/' + ID + '/ativo', soGerente, planoController.alterarAtivo);
router.delete('/' + ID, soGerente, planoController.deletarPlano);

module.exports = router;