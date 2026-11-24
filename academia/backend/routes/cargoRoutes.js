// cargoRoutes.js - URLs do CRUD de cargos (prefixo /cargo no server.js)
// :id só aceita números, para não confundir com os arquivos da pasta /cargo.
const express = require('express');
const cargoController = require('../controllers/cargoController');
const { exigirPerfil } = require('../middlewares/auth');

const router = express.Router();
const soGerente = exigirPerfil('gerente');
const ID = ':id(\\d+)';

router.get('/listar', soGerente, cargoController.listarCargos);
router.get('/' + ID, soGerente, cargoController.obterCargo);
router.post('/', soGerente, cargoController.criarCargo);
router.put('/' + ID, soGerente, cargoController.atualizarCargo);
router.delete('/' + ID, soGerente, cargoController.deletarCargo);

module.exports = router;