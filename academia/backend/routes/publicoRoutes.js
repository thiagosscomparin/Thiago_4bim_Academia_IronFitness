// publicoRoutes.js - URLs PÚBLICAS (prefixo /publico no server.js). Sem login, só leitura.
const express = require('express');
const publicoController = require('../controllers/publicoController');

const router = express.Router();
router.get('/home', publicoController.dadosInicio);

module.exports = router;