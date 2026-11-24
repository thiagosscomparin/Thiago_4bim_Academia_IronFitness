// alunoRoutes.js - URLs da área do aluno (prefixo /aluno no server.js)
// TODAS exigem perfil aluno: gerente e instrutor recebem 403.
const express = require('express');
const alunoController = require('../controllers/alunoController');
const { exigirPerfil } = require('../middlewares/auth');

const router = express.Router();
const soAluno = exigirPerfil('aluno');
const ID = ':id(\\d+)';

// aulas e reservas
router.get('/aulas', soAluno, alunoController.listarAulasDisponiveis);
router.get('/reservas', soAluno, alunoController.listarMinhasReservas);
router.post('/reservas', soAluno, alunoController.reservarAula);
router.patch('/reservas/cancelar', soAluno, alunoController.cancelarReserva);

// ficha (somente leitura)
router.get('/ficha', soAluno, alunoController.obterMinhaFicha);

// plano
router.get('/plano', soAluno, alunoController.obterMeuPlano);
router.post('/plano/contratar', soAluno, alunoController.contratarPlano);

// pagamentos e Pix
router.get('/pagamentos', soAluno, alunoController.listarMeusPagamentos);
router.get('/pagamentos/' + ID + '/pix', soAluno, alunoController.gerarMeuPix);

// perfil
router.get('/perfil', soAluno, alunoController.obterMeuPerfil);
router.put('/perfil', soAluno, alunoController.atualizarMeuPerfil);

module.exports = router;