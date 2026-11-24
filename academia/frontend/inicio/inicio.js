// inicio.js - Página inicial pública. Os dados vêm do banco (GET /publico/home).

// >>> PREENCHA os dados reais da academia. O que ficar vazio não aparece na página. <<<
const CONTATO = {
  endereco: '',
  telefone: '',
  whatsapp: '',
  email: '',
  funcionamento: '',   // ex.: Seg a Sex, 6h às 22h
  instagram: ''        // ex.: @ironfitness
};

const DIAS = ['', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function el(tag, classe, texto) {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texto !== undefined) e.textContent = texto;
  return e;
}

function textoAulas(n) {
  if (n === null || n === undefined) return 'Aulas coletivas ilimitadas';
  if (n === 0) return 'Musculação em horário livre (sem aulas coletivas)';
  return 'Até ' + n + ' aulas coletivas por semana';
}

function textoDuracao(meses) { return meses === 1 ? '1 mês' : meses + ' meses'; }

function desenharModalidades(lista) {
  const area = document.getElementById('gradeModalidades');
  area.replaceChildren();
  if (lista.length === 0) { area.append(el('p', 'aviso', 'Em breve, novas modalidades.')); return; }
  lista.forEach((m) => {
    const c = el('div', 'cartao');
    if (m.foto_modalidade) {
      const img = document.createElement('img');
      img.src = m.foto_modalidade; img.alt = m.nome_modalidade; img.loading = 'lazy';
      img.style.cssText = 'width:100%;height:160px;object-fit:cover;border-radius:8px;margin-bottom:12px';
      c.append(img);
    }
    c.append(el('h3', '', m.nome_modalidade));
    if (m.descricao_modalidade) c.append(el('p', '', m.descricao_modalidade));
    area.append(c);
  });
}

function desenharPlanos(lista) {
  const area = document.getElementById('gradePlanos');
  area.replaceChildren();
  if (lista.length === 0) { area.append(el('p', 'aviso', 'Os planos serão divulgados em breve.')); return; }
  lista.forEach((p) => {
    const c = el('div', 'cartao cartao-plano');
    c.append(el('h3', '', p.nome_plano));
    const preco = el('div', 'preco', moeda.format(p.valor_plano));
    const porMes = p.duracao_meses_plano > 1 ? ' · equivale a ' + moeda.format(p.valor_plano / p.duracao_meses_plano) + ' por mês' : '';
    preco.append(el('small', '', 'por ' + textoDuracao(p.duracao_meses_plano) + porMes));
    c.append(preco);
    if (p.descricao_plano) c.append(el('p', '', p.descricao_plano));
    const detalhe = el('div', 'detalhe-plano');
    detalhe.append(el('strong', '', textoAulas(p.aulas_semana_plano)));
    c.append(detalhe);
    if (p.id_plano) {
      // visitante -> cadastro com o plano escolhido (o link é ajustado em ajustarBotoesPlano para quem já está logado)
      const escolher = el('a', 'btn', 'Escolher este plano');
      escolher.href = '/cadastro/?plano=' + p.id_plano;
      escolher.dataset.plano = p.id_plano;
      escolher.style.marginTop = '16px';
      c.append(escolher);
    }
    area.append(c);
  });
}

function desenharGrade(aulas) {
  const area = document.getElementById('gradeSemana');
  area.replaceChildren();
  for (let d = 1; d <= 7; d++) {
    const dia = el('div', 'dia');
    dia.append(el('h3', '', DIAS[d]));
    const doDia = aulas.filter((a) => a.dia_semana_aula === d);
    if (doDia.length === 0) dia.append(el('div', 'sem-aulas', 'Sem aulas'));
    doDia.forEach((a) => {
      const item = el('div', 'aula-item');
      item.append(el('strong', '', a.horario + ' · ' + a.nome_modalidade), el('span', '', a.duracao_minutos_aula + ' min'));
      dia.append(item);
    });
    area.append(dia);
  }
}

// Só mostra o que foi preenchido em CONTATO
function desenharContato() {
  const rotulos = { endereco: 'Endereço', telefone: 'Telefone', whatsapp: 'WhatsApp', email: 'E-mail', funcionamento: 'Funcionamento', instagram: 'Instagram' };
  const preenchidos = Object.keys(rotulos).filter((k) => CONTATO[k]);
  if (preenchidos.length === 0) return;
  const lista = document.getElementById('listaContato');
  preenchidos.forEach((k) => {
    const li = el('li');
    li.append(el('strong', '', rotulos[k] + ':'), document.createTextNode(CONTATO[k]));
    lista.append(li);
  });
  document.getElementById('contato').hidden = false;
  document.getElementById('linkContato').hidden = false;
  document.getElementById('avisoMatricula').textContent = 'Escolha um plano para criar a sua conta e se matricular online, ou fale com a gente pelos contatos abaixo.';
}

// Perfil de quem está logado (null = visitante). Preenchido por ajustarBotaoEntrar.
let perfilAtual = null;

// Quem já está logado vê "Meu painel" no lugar de "Entrar" (fetch simples: um 401 aqui é normal)
async function ajustarBotaoEntrar() {
  try {
    const r = await fetch('/auth/me', { credentials: 'same-origin' });
    if (!r.ok) return;
    const dados = await r.json();
    const areas = { gerente: '/dashboard_gerente/dashboard_gerente.html', instrutor: '/dashboard_instrutor/dashboard_instrutor.html', aluno: '/dashboard_aluno/dashboard_aluno.html' };
    perfilAtual = dados.usuario.perfil;
    const botao = document.getElementById('btnEntrar');
    botao.textContent = 'Meu painel';
    botao.href = areas[dados.usuario.perfil] || '/login/';
  } catch (e) { /* sem sessão: mantém "Entrar" */ }
}

async function carregar() {
  try {
    const r = await fetch('/publico/home');
    const dados = await r.json();
    if (!r.ok) throw new Error(dados.mensagem || 'Erro ao carregar.');
    desenharModalidades(dados.modalidades);
    desenharPlanos(dados.planos);
    desenharGrade(dados.grade);
  } catch (erro) {
    const aviso = document.getElementById('erroPagina');
    aviso.textContent = 'Não foi possível carregar as informações agora. Tente novamente em instantes.';
    aviso.hidden = false;
  }
}

document.getElementById('ano').textContent = new Date().getFullYear();
// a imagem de fundo do hero (imagem7.png) só é aplicada se o arquivo existir
if (typeof usarImagemSeExistir === 'function') {
  document.addEventListener('DOMContentLoaded', () => usarImagemSeExistir('heroInicio', (url) => {
    document.getElementById('hero').style.backgroundImage = `linear-gradient(90deg, #0b0d0fe0 0%, #0b0d0f66 100%), url('${url}')`;
  }));
}
// Aluno já logado vai direto ao "Meu plano" com o plano escolhido; gerente/instrutor não veem o botão
function ajustarBotoesPlano() {
  document.querySelectorAll('a[data-plano]').forEach((a) => {
    if (perfilAtual === 'aluno') a.href = '/aluno_plano/aluno_plano.html?plano=' + a.dataset.plano;
    else if (perfilAtual) a.hidden = true;
  });
}

desenharContato();
Promise.all([carregar(), ajustarBotaoEntrar()]).then(ajustarBotoesPlano);