// contaRoutes.js - Conta do usuário logado (prefixo /conta no server.js). Qualquer perfil logado.
const express = require('express');
const contaController = require('../controllers/contaController');
const { exigirLogin } = require('../middlewares/auth');

const router = express.Router();
router.post('/senha', exigirLogin, contaController.alterarSenha);

module.exports = router;