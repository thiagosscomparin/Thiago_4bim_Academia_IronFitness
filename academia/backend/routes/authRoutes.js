// ============================================================
// authRoutes.js - Liga cada URL de autenticação ao seu controller
// Todas começam com /auth (definido no server.js).
// Na ordem: middlewares (porteiros) primeiro, controller por último.
// ============================================================
const express = require('express');
const authController = require('../controllers/authController');
const { exigirLogin } = require('../middlewares/auth');
const { limitarLogin } = require('../middlewares/limitadorLogin');
const { limitarCadastro } = require('../middlewares/limitadorCadastro');
const cadastroController = require('../controllers/cadastroController');

const router = express.Router();

// Entrar (antes do controller passa pelo limitador de tentativas)
router.post('/login', limitarLogin, authController.login);

// Criar conta de aluno (público, sem login; limitado por IP)
router.post('/cadastro', limitarCadastro, cadastroController.cadastrar);

// Escolher a área, para quem tem mais de um perfil
router.post('/escolher-perfil', authController.escolherPerfil);

// Sair
router.post('/logout', authController.logout);

// Quem está logado? (só responde se houver sessão)
router.get('/me', exigirLogin, authController.me);

module.exports = router;