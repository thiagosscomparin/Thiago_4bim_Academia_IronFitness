// ============================================================
// dashboardRoutes.js - URLs dos dados dos dashboards
// O prefixo /dashboard é definido no server.js.
// exigirPerfil('gerente') barra qualquer outro perfil com erro 403.
// ============================================================
const express = require('express');
const dashboardController = require('../controllers/dashboardController');
const { exigirPerfil } = require('../middlewares/auth');

const router = express.Router();

// GET /dashboard/gerente -> totais, receita, matrículas a vencer e últimos pagamentos
router.get('/gerente', exigirPerfil('gerente'), dashboardController.dadosGerente);

// GET /dashboard/instrutor -> agenda, alunos, reservas e fichas (consulta)
router.get('/instrutor', exigirPerfil('instrutor'), dashboardController.dadosInstrutor);

// GET /dashboard/aluno -> plano, situação, próximas aulas, ficha, pagamentos e avisos
router.get('/aluno', exigirPerfil('aluno'), dashboardController.dadosAluno);

module.exports = router;