// aluno_ficha.js - Ficha de treino do aluno, SOMENTE LEITURA (conversa com /aluno/ficha)
function elemento(tag, classe, texto) {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texto !== undefined) e.textContent = texto;
  return e;
}

function painelResumo(f) {
  const p = elemento('div', 'panel');
  p.append(elemento('h3', '', f.titulo_ficha_treino));
  [['Objetivo', f.objetivo_ficha_treino], ['Instrutor responsável', f.instrutor], ['Criada em', f.criada], ['Observações', f.observacoes_ficha_treino]]
    .forEach(([rotulo, valor]) => {
      if (!valor) return;
      const linha = elemento('p', '');
      linha.append(elemento('strong', '', rotulo + ': '), document.createTextNode(valor));
      p.append(linha);
    });
  return p;
}

// Um painel por divisão (Treino A, B, C...), com a tabela de exercícios
function painelDivisao(nome, exercicios, indice) {
  const p = elemento('div', 'panel');
  p.style.marginTop = '16px';
  p.append(elemento('h3', '', nome));
  const envolve = elemento('div', 'table-wrap');
  const tabela = elemento('table');
  const cab = elemento('thead');
  const trCab = elemento('tr');
  ['Exercício', 'Séries', 'Repetições', 'Descanso', 'Orientações'].forEach((c) => trCab.append(elemento('th', '', c)));
  cab.append(trCab);
  const corpo = elemento('tbody');
  corpo.id = 'tbDivisao' + indice;
  tabela.append(cab, corpo);
  envolve.append(tabela);
  p.append(envolve);
  return { painel: p, idCorpo: corpo.id };
}

async function carregar() {
  const area = document.getElementById('conteudo');
  try {
    const { ficha, exercicios } = await requisicaoAPI('/aluno/ficha');
    area.replaceChildren();
    if (!ficha) {
      const vazio = elemento('div', 'panel');
      vazio.append(elemento('p', 'empty-state', 'Você ainda não tem uma ficha de treino. Fale com a academia para receber a sua.'));
      area.append(vazio);
      return;
    }
    area.append(painelResumo(ficha));

    const grupos = {};
    exercicios.forEach((e) => { (grupos[e.divisao] = grupos[e.divisao] || []).push(e); });
    Object.keys(grupos).sort().forEach((nome, i) => {
      const { painel, idCorpo } = painelDivisao(nome, grupos[nome], i);
      area.append(painel); // precisa estar na página antes de preencher a tabela
      preencherTabelaCrud(idCorpo, grupos[nome].map((e) => [
        { texto: e.nome, classe: 'valor' }, String(e.series), e.repeticoes,
        e.descanso === null ? '—' : e.descanso + ' s', e.orientacoes
      ]), 5, 'Sem exercícios.');
    });
  } catch (erro) { mostrarToast(erro.message, 'error'); }
}

(async () => {
  const usuario = await exigirSessao(['aluno']);
  if (!usuario) return;
  preencherMenuUsuario(usuario);
  await carregar();
})();