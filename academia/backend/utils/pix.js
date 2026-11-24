// ============================================================
// pix.js - Gera o código "Pix copia e cola" (BR Code do Banco Central) e o QR Code.
// Não existe integração com banco: o código só leva o aluno ao app do banco com
// chave, nome e valor preenchidos. QUEM CONFIRMA O PAGAMENTO É O GERENTE.
// Configuração no backend/.env: PIX_CHAVE, PIX_NOME, PIX_CIDADE
// ============================================================

// CRC16-CCITT (polinômio 0x1021, início 0xFFFF): o "dígito verificador" que os bancos exigem
function crc16(texto) {
    let crc = 0xFFFF;
    for (let i = 0; i < texto.length; i++) {
        crc ^= texto.charCodeAt(i) << 8;
        for (let b = 0; b < 8; b++) {
            crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
            crc &= 0xFFFF;
        }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
}

// Cada campo do BR Code é: ID (2 dígitos) + tamanho (2 dígitos) + valor
function campo(id, valor) {
    return id + String(valor.length).padStart(2, '0') + valor;
}

// O padrão aceita só ASCII sem acento: "São Paulo" vira "SAO PAULO"
function limpar(texto, maximo) {
    return String(texto || '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toUpperCase().replace(/[^A-Z0-9 ]/g, '').trim().slice(0, maximo);
}

function pixConfigurado() {
    return Boolean(process.env.PIX_CHAVE && process.env.PIX_NOME && process.env.PIX_CIDADE);
}

// valor em reais (número); identificador: letras/números (até 25), ex.: "PAG12"
function gerarPayload({ chave, nome, cidade, valor, identificador }) {
    const txid = String(identificador || '***').replace(/[^A-Za-z0-9*]/g, '').slice(0, 25) || '***';
    const semCrc =
        campo('00', '01') +
        campo('01', '11') +
        campo('26', campo('00', 'br.gov.bcb.pix') + campo('01', String(chave).trim())) +
        campo('52', '0000') +
        campo('53', '986') +
        campo('54', Number(valor).toFixed(2)) +
        campo('58', 'BR') +
        campo('59', limpar(nome, 25)) +
        campo('60', limpar(cidade, 15)) +
        campo('62', campo('05', txid)) +
        '6304';
    return semCrc + crc16(semCrc);
}

// Monta o payload usando os dados do .env
function gerarPayloadDoEnv(valor, identificador) {
    return gerarPayload({
        chave: process.env.PIX_CHAVE, nome: process.env.PIX_NOME, cidade: process.env.PIX_CIDADE, valor, identificador
    });
}

// Imagem do QR Code como "data URL" (o navegador mostra direto em <img src="...">)
async function gerarQrCode(payload) {
    const QRCode = require('qrcode'); // carregado só quando necessário
    return QRCode.toDataURL(payload, { errorCorrectionLevel: 'M', margin: 2, width: 320 });
}

module.exports = { crc16, gerarPayload, gerarPayloadDoEnv, gerarQrCode, pixConfigurado };