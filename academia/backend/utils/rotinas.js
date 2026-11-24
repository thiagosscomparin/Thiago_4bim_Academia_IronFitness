// ============================================================
// rotinas.js - Atualização AUTOMÁTICA de status (regra de negócio do prompt)
// Roda ao iniciar o servidor e depois a cada hora.
//  - matrícula ATIVA com data final no passado  -> VENCIDA
//  - reserva CONFIRMADA de data no passado      -> CONCLUIDA
// ============================================================
const { query } = require('../database');

async function atualizarStatusAutomatico() {
    try {
        const m = await query(`UPDATE matricula SET status_matricula = 'VENCIDA'
                                WHERE status_matricula = 'ATIVA' AND data_fim_matricula < CURRENT_DATE`);
        const r = await query(`UPDATE reserva SET status_reserva = 'CONCLUIDA'
                                WHERE status_reserva = 'CONFIRMADA' AND data_aula_reserva < CURRENT_DATE`);
        if (m.rowCount || r.rowCount) {
            console.log(`🔄 Status atualizados: ${m.rowCount} matrícula(s) vencida(s), ${r.rowCount} reserva(s) concluída(s).`);
        }
    } catch (error) {
        console.error('Erro na rotina de status:', error.message);
    }
}

// Executa agora e agenda para repetir a cada hora (unref: não impede o servidor de encerrar)
function iniciarRotinas() {
    atualizarStatusAutomatico();
    setInterval(atualizarStatusAutomatico, 60 * 60 * 1000).unref();
}

module.exports = { atualizarStatusAutomatico, iniciarRotinas };