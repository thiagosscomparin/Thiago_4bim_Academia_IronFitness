# 🏋️ IRON FITNESS — Sistema de Gestão para Academia

Sistema web completo para uma academia, com **três áreas independentes** (gerente, instrutor e aluno), página inicial pública e cadastro de novos alunos. Todas as informações vêm do **PostgreSQL** — não há dados fictícios no frontend.

> Projeto acadêmico. Autor(es): _preencher_ · Disciplina/Professor: _preencher_ · Ano: 2026

---

## 📌 Sumário

1. [Funcionalidades](#-funcionalidades)
2. [Tecnologias](#-tecnologias)
3. [Arquitetura](#-arquitetura)
4. [Estrutura de pastas](#-estrutura-de-pastas)
5. [Como executar](#-como-executar)
6. [Usuários de teste](#-usuários-de-teste)
7. [Banco de dados](#-banco-de-dados)
8. [Segurança](#-segurança)
9. [Regras de negócio](#-regras-de-negócio)
10. [Rotas da API](#-rotas-da-api)
11. [Pix](#-pix-qr-code)
12. [Limitações conhecidas](#-limitações-conhecidas)

---

## ✨ Funcionalidades

### 🌐 Público (sem login)
- **Página inicial** com modalidades, planos (valor, duração e aulas incluídas) e grade de horários — tudo lido do banco, mostrando só planos ativos.
- **Login** e **cadastro de novo aluno**.

### 👔 Gerente
| Módulo | O que faz |
|---|---|
| Dashboard | Totais (alunos, funcionários, matrículas ativas, planos, aulas, pagamentos), receita do mês, matrículas a vencer e últimos pagamentos |
| Pessoas | Cadastrar, buscar, editar e excluir; vínculo de aluno |
| Funcionários e Cargos | Pessoa + cargo + salário; o **cargo define as permissões** (gerente ou instrutor) |
| Planos | Valor, duração, aulas por semana, ativar/desativar |
| Modalidades e Aulas | Grade semanal com instrutor, horário, duração e vagas |
| Matrículas | Aluno + plano + período; situação ativa, pendente, vencida ou cancelada |
| Pagamentos | Registrar, confirmar, estornar; **QR Code Pix** |
| Fichas de treino | Ficha com vários exercícios (Treino A–F), histórico e reativação |

### 🧑‍🏫 Instrutor (somente consulta)
Dashboard, **meus alunos**, **fichas** dos alunos sob sua responsabilidade (sem editar) e **agenda** de aulas.

### 🧑 Aluno
| Tela | O que faz |
|---|---|
| Dashboard | Plano atual, situação, vencimento, próximas aulas e avisos |
| Meu plano | Ver o plano, **contratar ou renovar** |
| Aulas e reservas | Reservar e cancelar aulas dos próximos 14 dias |
| Minha ficha | Ver o treino (somente leitura) |
| Pagamentos | Histórico e **pagar com Pix** |
| Meu perfil | Atualizar dados e **trocar a senha** |

---

## 🛠 Tecnologias

- **Frontend:** HTML5 semântico, CSS3 externo, JavaScript (sem frameworks)
- **Backend:** Node.js + Express
- **Banco:** PostgreSQL (extensão `pgcrypto` no script de carga)
- **Autenticação:** sessões com cookie (`express-session`), senhas com `bcryptjs`
- **Segurança HTTP:** `helmet`
- **Pix:** biblioteca `qrcode`
- **Configuração:** variáveis de ambiente com `dotenv`

---

## 🏛 Arquitetura

Cliente-servidor, seguindo o **padrão MVC** e a organização do projeto CandyShop original:

| Camada | Onde fica | Papel |
|---|---|---|
| **Model** | `database.js` + consultas SQL dentro dos controllers | Acesso ao PostgreSQL (consultas parametrizadas) |
| **View** | `frontend/<tela>/<tela>.html/.css/.js` | O que o usuário vê (uma pasta por tela) |
| **Controller** | `backend/controllers/` | Regras de negócio e validações |
| **Rotas** | `backend/routes/` | URLs da API, ligadas aos controllers |
| **Middlewares** | `backend/middlewares/` | “Porteiros”: login, perfil e limite de tentativas |

O **Express serve o frontend e a API na mesma origem**. Assim o cookie de sessão funciona sem CORS e o servidor consegue **bloquear páginas** por perfil.

```
Navegador ──► Express ──► middleware (login/perfil) ──► controller ──► PostgreSQL
   ▲                                                         │
   └──────────────────────── JSON / HTML ◄───────────────────┘
```

---

## 📁 Estrutura de pastas

```
academia/
├── package.json
├── README.md
├── .gitignore
├── backend/
│   ├── server.js              # liga tudo: sessão, segurança, rotas e páginas
│   ├── database.js            # conexão com o PostgreSQL (pool + transações)
│   ├── .env.example           # modelo de configuração
│   ├── controllers/           # regras de negócio (auth, pessoa, aula, aluno, ...)
│   ├── routes/                # URLs da API (uma por módulo)
│   ├── middlewares/           # auth.js, limitadorLogin.js, limitadorCadastro.js
│   └── utils/                 # validacao.js, pix.js, rotinas.js
├── frontend/
│   ├── comum/                 # CSS/JS compartilhados (estilo, menu, crud, sessão)
│   ├── inicio/  login/  cadastro/            # telas públicas
│   ├── dashboard_gerente/ pessoa/ funcionario/ cargo/ plano/ modalidade/
│   │   aula/ matricula/ pagamento/ ficha_treino/        # gerente
│   ├── dashboard_instrutor/ instrutor_alunos/ instrutor_fichas/ instrutor_agenda/
│   └── dashboard_aluno/ aluno_plano/ aluno_aulas/ aluno_ficha/ aluno_pagamentos/ aluno_perfil/
├── imagens/                   # logo, banners e fundos
└── documentação/
    ├── academia.sql           # estrutura + dados iniciais
    └── Diagrama_Site_Academia.png
```

---

## 🚀 Como executar

### Pré-requisitos
- [Node.js](https://nodejs.org) 18 ou superior
- [PostgreSQL](https://www.postgresql.org) (com o pgAdmin ou o `psql`)

### Passo a passo

**1. Instale as dependências** (na pasta `academia`, onde está o `package.json`):
```bash
npm install
```

**2. Crie o banco e carregue os dados.** No pgAdmin ou no `psql`:
```sql
CREATE DATABASE academia;
```
Conecte-se ao banco `academia` e execute o arquivo inteiro `documentação/academia.sql`. Pelo terminal:
```bash
psql -U postgres -d academia -f "documentação/academia.sql"
```
> ⚠️ O script **apaga e recria** as tabelas (`DROP TABLE ... CASCADE`). Rodar de novo zera os dados. Ele usa a extensão `pgcrypto`, que o PostgreSQL já traz; se der erro de permissão, execute como o usuário `postgres`.

**3. Configure o ambiente.** Copie o modelo e preencha:
```bash
cp backend/.env.example backend/.env
```
Edite o `backend/.env`: a senha do seu PostgreSQL (`DB_PASSWORD`), o nome do banco (`DB_NAME=academia`) e o `SESSION_SECRET`. Para gerar o segredo:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**4. Inicie o servidor:**
```bash
npm run dev      # reinicia sozinho ao salvar arquivos (nodemon)
# ou
npm start        # execução simples
```
No terminal devem aparecer a porta e a mensagem **“Banco de Dados ... conectado com sucesso!”**.

**5. Abra no navegador:** <http://localhost:3000> (ou a porta do seu `.env`).

> O `nodemon` **não relê o `.env`**: se alterar esse arquivo, pare o servidor (`Ctrl + C`) e inicie de novo.

### Problemas comuns
| Mensagem | Causa e solução |
|---|---|
| `EADDRINUSE ... 3000` | Já há um servidor rodando. Feche o outro terminal (`Ctrl + C`) ou mude `PORT` |
| `password authentication failed` | `DB_PASSWORD` incorreta no `.env` |
| `database "..." does not exist` | O banco não foi criado, ou `DB_NAME` não confere |
| `Could not read package.json` | O terminal não está na pasta `academia` |
| `SESSION_SECRET ausente` | Falta preencher o `SESSION_SECRET` no `.env` |

---

## 👤 Usuários de teste

A senha de **todos** é **`123456`** (guardada com hash bcrypt).

| Perfil | E-mail |
|---|---|
| Gerente | `admin@academia.com` |
| Instrutor | `bruno.albuquerque@academia.com` |
| Aluno | `lucas.oliveira@email.com` |

O banco traz 20 pessoas (10 alunos e 10 funcionários), 10 planos, 12 aulas, matrículas, pagamentos e fichas de exemplo. Os demais e-mails estão no `academia.sql`.

---

## 🗄 Banco de dados

13 tabelas, ligadas por chaves primárias e estrangeiras. O diagrama está em `documentação/Diagrama_Site_Academia.png`.

| Tabela | Papel |
|---|---|
| `pessoa` | Entidade principal: dados pessoais, e-mail e senha (hash) |
| `aluno` / `funcionario` | Vínculos de uma pessoa (uma pessoa pode ter os dois) |
| `cargo` | Cargos e permissões (`acesso_admin_cargo`, `instrutor_cargo`) |
| `plano` | Planos (valor, duração, aulas por semana, ativo) |
| `modalidade` / `aula` | Tipos de aula e a grade semanal |
| `matricula` | Aluno + plano + período + situação |
| `pagamento` / `forma_pagamento` | Pagamentos de cada matrícula |
| `reserva` | Reservas de aula (chave: aluno + aula + data) |
| `ficha_treino` / `ficha_exercicio` | Fichas de treino e seus exercícios |

---

## 🔐 Segurança

- **Sessão com cookie** `academia.sid`: `httpOnly`, `sameSite=lax`, `secure` em produção, duração de 2 horas renovada a cada uso. O cookie guarda **só um identificador**; os dados do usuário ficam no servidor.
- **Senhas com bcrypt**; o ID da sessão é trocado no login e no cadastro (evita fixação de sessão).
- **Permissões no backend:** cada rota exige login e perfil; cada pasta de páginas é protegida por perfil. Esconder botões no frontend nunca é a única proteção.
- **Escopo por sessão:** o CPF vem sempre da sessão, então aluno e instrutor só acessam os **próprios** dados.
- **Limite de tentativas** no login (por IP + e-mail) e no cadastro (por IP).
- **SQL parametrizado** (sem concatenar valores) e **transações** nas operações compostas.
- **Validações no servidor** (CPF, e-mail, senha, datas, valores), cabeçalhos do `helmet`; no **login**, a mesma mensagem para e-mail inexistente e senha errada (não revela quais e-mails existem).
- O `.env` está no `.gitignore` e **não deve ser compartilhado**.

---

## 📋 Regras de negócio

- Só o **gerente** cria e edita cadastros, planos, aulas, matrículas, pagamentos e fichas. O **instrutor** e o **aluno** apenas consultam as fichas.
- O **cargo** define o perfil: com acesso administrativo = gerente; cargo de instrutor = instrutor; vínculo de aluno = aluno.
- Matrícula **ativa** com data final no passado vira **vencida** automaticamente (rotina ao iniciar e a cada hora); reservas passadas viram **concluídas**.
- **Reservas:** só aulas dos próximos 14 dias, exige matrícula ativa, respeita o **limite semanal do plano** (0 = sem aulas coletivas, N = até N, vazio = ilimitado), as **vagas**, não permite a mesma aula duas vezes na data nem duas aulas no mesmo horário. A consulta trava a aula para impedir vagas estouradas.
- **Cancelamento** de reserva até **2 horas** antes; a vaga é liberada automaticamente.
- **Plano inativo** não recebe matrículas; plano com matrículas não é excluído (desative).
- Um aluno não tem duas matrículas vigentes sobrepostas; **cancelar a matrícula cancela as reservas futuras**.
- O total de pagamentos de uma matrícula **não passa do valor do plano**; pagamento confirmado não se edita nem exclui (usa-se o **estorno**). Confirmar o pagamento **ativa** a matrícula pendente.
- Um aluno tem **uma ficha ativa**; criar outra arquiva a anterior no histórico.
- O gerente não pode excluir a si mesmo nem remover o próprio acesso administrativo.
- Instrutor só ministra aula se tiver cargo de instrutor; o mesmo instrutor não tem aulas sobrepostas.

---

## 🔌 Rotas da API

| Prefixo | Quem acessa | Conteúdo |
|---|---|---|
| `/publico` | Todos | Dados da página inicial (somente leitura) |
| `/auth` | Todos | Login, cadastro, escolher perfil, logout, `me` |
| `/conta` | Logado | Troca de senha |
| `/dashboard` | Cada perfil o seu | Dados dos dashboards |
| `/pessoa` `/funcionario` `/cargo` `/plano` `/modalidade` `/aula` `/matricula` `/pagamento` `/ficha_treino` | Gerente | CRUDs (`GET /listar`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id`, além de ações como ativar, cancelar, pagar e estornar) |
| `/instrutor` | Instrutor | Alunos, fichas e agenda (apenas `GET`) |
| `/aluno` | Aluno | Aulas, reservas, plano, ficha, pagamentos, Pix e perfil |

---

## 💳 Pix (QR Code)

O sistema gera o código **“Pix copia e cola”** (BR Code) e o QR Code com a chave configurada no `.env` (`PIX_CHAVE`, `PIX_NOME`, `PIX_CIDADE`) e o valor do pagamento.

- **Não há integração bancária.** O sistema não detecta sozinho que o Pix foi pago: o **gerente confirma** o recebimento em *Pagamentos → Marcar como pago*, e então a matrícula é ativada.
- Para testar, use um valor baixo e a sua própria chave.

---

## ⚠️ Limitações conhecidas

- As **sessões ficam na memória do servidor**: reiniciar o servidor desloga todos. Em produção, o ideal é guardá-las no banco.
- **Não há recuperação de senha por e-mail** (o gerente redefine a senha editando a pessoa).
- O Pix não tem confirmação automática (veja acima).
- Não há testes automatizados; a verificação é manual.
- Para hospedagem, use HTTPS e `NODE_ENV=production`.