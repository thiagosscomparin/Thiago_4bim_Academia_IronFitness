// ============================================================
// imagens.js - Central das imagens do sistema
// Coloque os arquivos na pasta  academia/imagens/  com os nomes
// abaixo. Se um arquivo não existir, o site continua normal
// (o visual padrão é mantido). Para trocar uma imagem, basta
// mudar o nome do arquivo aqui.
// ============================================================
const IMAGENS = {
  logo:            '',                  // deixamos vazio para usar o logo estilizado IRON FITNESS (sem dar 404)
  favicon:         '',                  // deixamos vazio para não dar 404
  fundoLogin:      'fundo-login.jpg',   // lado esquerdo da tela de login e cadastro
  bannerGerente:   'banner-gerente.jpg',   // topo do dashboard do gerente
  bannerInstrutor: 'banner-instrutor.jpg', // topo do dashboard do instrutor
  bannerAluno:     'banner-aluno.jpg',     // topo do dashboard do aluno
  heroInicio:      'hero-inicio.jpg'       // fundo da página inicial
};

const PASTA_IMAGENS = '/imagens/';

// Tenta carregar a imagem; só chama a função se ela realmente existir.
function usarImagemSeExistir(chave, aoExistir) {
  const arquivo = IMAGENS[chave];
  if (!arquivo) return;
  const url = PASTA_IMAGENS + arquivo;
  const teste = new Image();
  teste.onload = () => aoExistir(url);
  teste.src = url;
}

document.addEventListener('DOMContentLoaded', () => {
  // 1) Ícone da aba
  usarImagemSeExistir('favicon', (url) => {
    let link = document.querySelector('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = url;
  });

  // 2) Logo: substitui o quadradinho "I" + nome em todos os lugares com .brand
  usarImagemSeExistir('logo', (url) => {
    document.querySelectorAll('.brand, .topo-logo').forEach((marca) => {
      const img = document.createElement('img');
      img.className = 'brand-logo';
      img.src = url;
      img.alt = 'IRON FITNESS';
      marca.replaceChildren(img);
    });
  });

  // 3) Fundo da tela de login
  const visualLogin = document.querySelector('.login-visual');
  if (visualLogin) {
    usarImagemSeExistir('fundoLogin', (url) => {
      visualLogin.style.backgroundImage =
        `linear-gradient(90deg, #080a0ce8 0%, #080a0c55 100%), url('${url}')`;
      visualLogin.style.backgroundSize = 'cover';
      visualLogin.style.backgroundPosition = 'center';
    });
  }

  // 4) Banner do dashboard (o HTML indica qual imagem usar em data-banner)
  const banner = document.querySelector('.banner-dashboard');
  if (banner) {
    usarImagemSeExistir(banner.dataset.banner, (url) => {
      banner.style.backgroundImage = `url('${url}')`;
      banner.classList.add('ativo');
    });
  }
});