// ============================================================
// cadastro.js - Cadastro público de aluno (conversa com POST /auth/cadastro)
// Se a página foi aberta com ?plano=ID (vindo dos planos da página inicial),
// mostra o plano escolhido e leva a pessoa de volta a ele depois de criar a conta.
// ============================================================
const form = document.getElementById('formCadastro');
const mensagem = document.getElementById('mensagem');
const btn = document.getElementById('btnCadastrar');
const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

// ?plano=ID só vale se for um número inteiro positivo
const lido = Number(new URLSearchParams(window.location.search).get('plano'));
const planoId = Number.isInteger(lido) && lido > 0 ? lido : null;

function exibirMensagem(texto, tipo = 'error') {
  mensagem.replaceChildren();
  const alerta = document.createElement('div');
  alerta.className = `alert alert-${tipo}`;
  alerta.textContent = texto;
  mensagem.appendChild(alerta);
}

// Máscara do CPF: 12345678909 -> 123.456.789-09
document.getElementById('cpf').addEventListener('input', (e) => {
  const n = e.target.value.replace(/\D/g, '').slice(0, 11);
  e.target.value = n.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1-$2');
});

document.getElementById('toggleSenha').addEventListener('click', () => {
  const campo = document.getElementById('senha');
  const visivel = campo.type === 'password';
  campo.type = visivel ? 'text' : 'password';
  document.getElementById('toggleSenha').textContent = visivel ? 'OCULTAR' : 'MOSTRAR';
});

// Mostra qual plano a pessoa escolheu (os planos públicos vêm de /publico/home)
async function mostrarPlanoEscolhido() {
  if (!planoId) return;
  try {
    const dados = await requisicaoAPI('/publico/home');
    const p = dados.planos.find((x) => x.id_plano === planoId);
    if (!p) return;
    const caixa = document.getElementById('planoEscolhido');
    const forte = document.createElement('strong');
    forte.textContent = p.nome_plano;
    const meses = p.duracao_meses_plano === 1 ? '1 mês' : p.duracao_meses_plano + ' meses';
    caixa.replaceChildren(document.createTextNode('Plano escolhido: '), forte,
      document.createTextNode(` · ${moeda.format(p.valor_plano)} por ${meses}. Você confirma na próxima tela.`));
    caixa.hidden = false;
  } catch (e) { /* sem o aviso do plano o cadastro continua funcionando */ }
}

form.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  mensagem.replaceChildren();

  const senha = document.getElementById('senha').value;
  if (senha.length < 6) return exibirMensagem('A senha deve ter no mínimo 6 caracteres.');
  if (senha !== document.getElementById('senha2').value) return exibirMensagem('As senhas não são iguais.');

  btn.disabled = true;
  btn.textContent = 'CRIANDO CONTA...';
  try {
    const dados = await requisicaoAPI('/auth/cadastro', {
      method: 'POST',
      body: JSON.stringify({
        nome: document.getElementById('nome').value.trim(),
        cpf: document.getElementById('cpf').value.trim(),
        email: document.getElementById('email').value.trim(),
        dataNascimento: document.getElementById('nascimento').value || null,
        objetivo: document.getElementById('objetivo').value.trim() || null,
        senha
      })
    });
    // o destino vem do backend; só acrescentamos o plano escolhido
    window.location.assign((dados.redirecionar || '/') + (planoId ? '?plano=' + planoId : ''));
  } catch (erro) {
    exibirMensagem(erro.message || 'Não foi possível criar a conta. Tente novamente.');
    btn.disabled = false;
    btn.innerHTML = 'CRIAR MINHA CONTA <span aria-hidden="true">→</span>';
  }
});

mostrarPlanoEscolhido();