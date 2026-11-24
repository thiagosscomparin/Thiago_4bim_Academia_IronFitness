// modalidade.js - Tela de cadastro de modalidades (conversa com /modalidade/... no servidor)
let idEmEdicao = null; // null = cadastrando
let fotoNova = null;      // data URL da foto escolhida (null = não mexeu)
let removerFoto = false;  // true = usuário clicou em "Remover foto"
const LIMITE_LADO = 900;  // a foto é reduzida no navegador antes de enviar
const $ = (id) => document.getElementById(id);

async function carregarModalidades() {
  try {
    const { modalidades } = await requisicaoAPI('/modalidade/listar');
    preencherTabelaCrud('tbModalidades', modalidades.map((m) => [
      { miniatura: m.foto_modalidade, alt: m.nome_modalidade },
      m.nome_modalidade, m.descricao_modalidade, String(m.aulas),
      { botoes: [
        { texto: 'Editar', classe: 'btn-secondary', aoClicar: () => abrirFormulario('Editar modalidade', m) },
        { texto: 'Excluir', classe: 'btn-danger', aoClicar: () => excluirModalidade(m) }
      ] }
    ]), 5, 'Nenhuma modalidade cadastrada.');
  } catch (erro) { mostrarToast(erro.message, 'error'); }
}

// Mostra/esconde a pré-visualização da foto no formulário
function mostrarPrevia(url) {
  $('fotoPrevia').hidden = !url;
  if (url) $('fotoImg').src = url; else $('fotoImg').removeAttribute('src');
}

// Lê o arquivo, reduz (máx. 900px) e converte para JPEG/PNG em base64
function lerImagem(arquivo) {
  return new Promise((resolve, reject) => {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(arquivo.type)) return reject(new Error('Escolha uma imagem PNG, JPG ou WEBP.'));
    if (arquivo.size > 10 * 1024 * 1024) return reject(new Error('A imagem é grande demais (máx. 10 MB).'));
    const leitor = new FileReader();
    leitor.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    leitor.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('O arquivo não é uma imagem válida.'));
      img.onload = () => {
        const escala = Math.min(1, LIMITE_LADO / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * escala);
        canvas.height = Math.round(img.height * escala);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL(arquivo.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.85));
      };
      img.src = leitor.result;
    };
    leitor.readAsDataURL(arquivo);
  });
}

async function escolherFoto() {
  const arquivo = $('foto').files[0];
  if (!arquivo) return;
  try {
    fotoNova = await lerImagem(arquivo);
    removerFoto = false;
    mostrarPrevia(fotoNova);
    $('erroForm').hidden = true;
  } catch (erro) {
    $('foto').value = '';
    $('erroForm').textContent = erro.message;
    $('erroForm').hidden = false;
  }
}

function tirarFoto() {
  fotoNova = null; removerFoto = true;
  $('foto').value = '';
  mostrarPrevia(null);
}

function abrirFormulario(titulo, m) {
  $('formModalidade').reset();
  fotoNova = null; removerFoto = false;
  mostrarPrevia(m && m.foto_modalidade ? m.foto_modalidade : null);
  $('erroForm').hidden = true;
  $('tituloModal').textContent = titulo;
  idEmEdicao = m ? m.id_modalidade : null;
  if (m) { $('nome').value = m.nome_modalidade; $('descricao').value = m.descricao_modalidade || ''; }
  abrirModal('modalModalidade');
  $('nome').focus();
}

async function salvar(evento) {
  evento.preventDefault();
  const corpo = { nome: $('nome').value.trim(), descricao: $('descricao').value.trim() };
  if (fotoNova) corpo.foto = fotoNova;
  else if (removerFoto) corpo.removerFoto = true;
  $('btnSalvar').disabled = true;
  try {
    const editando = idEmEdicao !== null;
    const dados = await requisicaoAPI(editando ? '/modalidade/' + idEmEdicao : '/modalidade', {
      method: editando ? 'PUT' : 'POST', body: JSON.stringify(corpo)
    });
    fecharModal('modalModalidade');
    mostrarToast(dados.mensagem);
    await carregarModalidades();
  } catch (erro) {
    $('erroForm').textContent = erro.message;
    $('erroForm').hidden = false;
  } finally { $('btnSalvar').disabled = false; }
}

async function excluirModalidade(m) {
  if (!(await confirmarAcao(`Excluir a modalidade "${m.nome_modalidade}"?`, 'Excluir'))) return;
  try {
    const dados = await requisicaoAPI('/modalidade/' + m.id_modalidade, { method: 'DELETE' });
    mostrarToast(dados.mensagem);
    await carregarModalidades();
  } catch (erro) { mostrarToast(erro.message, 'error'); }
}

$('btnNova').addEventListener('click', () => abrirFormulario('Nova modalidade', null));
$('btnCancelar').addEventListener('click', () => fecharModal('modalModalidade'));
$('formModalidade').addEventListener('submit', salvar);
$('foto').addEventListener('change', escolherFoto);
$('btnRemoverFoto').addEventListener('click', tirarFoto);

(async () => {
  const usuario = await exigirSessao(['gerente']);
  if (!usuario) return;
  preencherMenuUsuario(usuario);
  await carregarModalidades();
})();