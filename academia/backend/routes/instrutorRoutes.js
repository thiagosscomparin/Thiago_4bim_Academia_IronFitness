// instrutorRoutes.js - URLs da área do instrutor (prefixo /instrutor no server.js)
// TODAS exigem perfil instrutor e são SÓ DE CONSULTA: gerente e aluno recebem 403.
const express = require('express');
const instrutorController = require('../controllers/instrutorController');
const { exigirPerfil } = require('../middlewares/auth');

const router = express.Router();
const soInstrutor = exigirPerfil('instrutor');

router.get('/alunos', soInstrutor, instrutorController.listarMeusAlunos);
router.get('/fichas', soInstrutor, instrutorController.listarMinhasFichas);
router.get('/fichas/:id(\\d+)', soInstrutor, instrutorController.obterMinhaFicha);
router.get('/agenda', soInstrutor, instrutorController.listarMinhaAgenda);
router.get('/agenda/alunos', soInstrutor, instrutorController.listarAlunosDaAula);

module.exports = router;