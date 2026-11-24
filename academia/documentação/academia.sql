-- =====================================================================
-- ACADEMIA - DDL (estrutura) + carga inicial
--
-- Como usar:
--   1) Crie o banco:   CREATE DATABASE academia;
--   2) Conecte nele e rode este arquivo inteiro.
--
-- Usuários de teste (senha de TODOS: 123456, guardada com hash bcrypt):
--   Admin: admin@academia.com
--   Aluno: lucas.oliveira@email.com
-- =====================================================================

-- pgcrypto fornece crypt() e gen_salt() para guardar senha com hash
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Permite rodar o script várias vezes (apaga na ordem inversa das dependências)
DROP TABLE IF EXISTS reserva CASCADE;
DROP TABLE IF EXISTS pagamento CASCADE;
DROP TABLE IF EXISTS matricula CASCADE;
DROP TABLE IF EXISTS aula CASCADE;
DROP TABLE IF EXISTS aluno CASCADE;
DROP TABLE IF EXISTS funcionario CASCADE;
DROP TABLE IF EXISTS pessoa CASCADE;
DROP TABLE IF EXISTS cargo CASCADE;
DROP TABLE IF EXISTS plano CASCADE;
DROP TABLE IF EXISTS modalidade CASCADE;
DROP TABLE IF EXISTS forma_pagamento CASCADE;

-- =====================================================================
-- 1. TABELAS INDEPENDENTES (não dependem de nenhuma outra)
-- =====================================================================

CREATE TABLE pessoa (
    cpf_pessoa              VARCHAR(14)  PRIMARY KEY,
    nome_pessoa             VARCHAR(80)  NOT NULL,
    data_nascimento_pessoa  DATE,
    endereco_pessoa         VARCHAR(150),
    email_pessoa            VARCHAR(80)  NOT NULL UNIQUE,
    senha_pessoa            VARCHAR(100) NOT NULL   -- hash bcrypt (60 caracteres)
);

CREATE TABLE cargo (
    id_cargo            SERIAL       PRIMARY KEY,
    nome_cargo          VARCHAR(45)  NOT NULL,
    acesso_admin_cargo  BOOLEAN      NOT NULL DEFAULT FALSE  -- TRUE = enxerga a visão administrativa
);

CREATE TABLE plano (
    id_plano             SERIAL         PRIMARY KEY,
    nome_plano           VARCHAR(50)    NOT NULL,
    descricao_plano      VARCHAR(200),
    valor_plano          NUMERIC(10,2)  NOT NULL CHECK (valor_plano >= 0),
    duracao_meses_plano  INTEGER        NOT NULL CHECK (duracao_meses_plano > 0),
    ativo_plano          BOOLEAN        NOT NULL DEFAULT TRUE
);

CREATE TABLE modalidade (
    id_modalidade         SERIAL       PRIMARY KEY,
    nome_modalidade       VARCHAR(40)  NOT NULL,
    descricao_modalidade  VARCHAR(200)
);

CREATE TABLE forma_pagamento (
    id_forma_pagamento    SERIAL       PRIMARY KEY,
    nome_forma_pagamento  VARCHAR(50)  NOT NULL
);

-- =====================================================================
-- 2. RELACIONAMENTOS 1:1  (a chave primária é também chave estrangeira)
-- =====================================================================

CREATE TABLE aluno (
    pessoa_cpf_pessoa    VARCHAR(14)  PRIMARY KEY REFERENCES pessoa(cpf_pessoa) ON DELETE CASCADE,
    data_cadastro_aluno  DATE         NOT NULL DEFAULT CURRENT_DATE,
    objetivo_aluno       VARCHAR(100)
);

-- =====================================================================
-- 3. RELACIONAMENTOS 1:N
-- =====================================================================

-- cargo 1:N funcionario  (e funcionario 1:1 pessoa)
CREATE TABLE funcionario (
    pessoa_cpf_pessoa           VARCHAR(14)   PRIMARY KEY REFERENCES pessoa(cpf_pessoa) ON DELETE CASCADE,
    cargo_id_cargo              INTEGER       NOT NULL REFERENCES cargo(id_cargo),
    salario_funcionario         NUMERIC(10,2) CHECK (salario_funcionario >= 0),
    data_admissao_funcionario   DATE
);

-- modalidade 1:N aula  /  funcionario 1:N aula
-- A aula é um horário semanal fixo (ex.: toda segunda às 07:00)
CREATE TABLE aula (
    id_aula                        SERIAL       PRIMARY KEY,
    modalidade_id_modalidade       INTEGER      NOT NULL REFERENCES modalidade(id_modalidade),
    funcionario_pessoa_cpf_pessoa  VARCHAR(14)  NOT NULL REFERENCES funcionario(pessoa_cpf_pessoa),
    dia_semana_aula                INTEGER      NOT NULL CHECK (dia_semana_aula BETWEEN 1 AND 7), -- 1=segunda ... 7=domingo
    horario_inicio_aula            TIME         NOT NULL,
    duracao_minutos_aula           INTEGER      NOT NULL CHECK (duracao_minutos_aula > 0),
    vagas_aula                     INTEGER      NOT NULL CHECK (vagas_aula > 0)
);

-- aluno 1:N matricula  /  plano 1:N matricula
CREATE TABLE matricula (
    id_matricula             SERIAL       PRIMARY KEY,
    aluno_pessoa_cpf_pessoa  VARCHAR(14)  NOT NULL REFERENCES aluno(pessoa_cpf_pessoa),
    plano_id_plano           INTEGER      NOT NULL REFERENCES plano(id_plano),
    data_inicio_matricula    DATE         NOT NULL,
    data_fim_matricula       DATE         NOT NULL,
    status_matricula         VARCHAR(10)  NOT NULL DEFAULT 'PENDENTE'
                             CHECK (status_matricula IN ('PENDENTE', 'ATIVA', 'VENCIDA', 'CANCELADA')),
    CHECK (data_fim_matricula >= data_inicio_matricula)
);

-- matricula 1:N pagamento  /  forma_pagamento 1:N pagamento
-- (a tela de pagamento é simulada: o sistema só registra o pagamento)
CREATE TABLE pagamento (
    id_pagamento                       SERIAL         PRIMARY KEY,
    matricula_id_matricula             INTEGER        NOT NULL REFERENCES matricula(id_matricula),
    forma_pagamento_id_forma_pagamento INTEGER        NOT NULL REFERENCES forma_pagamento(id_forma_pagamento),
    valor_pagamento                    NUMERIC(10,2)  NOT NULL CHECK (valor_pagamento > 0),
    data_pagamento                     TIMESTAMP,     -- NULL enquanto estiver pendente
    status_pagamento                   VARCHAR(10)    NOT NULL DEFAULT 'PENDENTE'
                                       CHECK (status_pagamento IN ('PENDENTE', 'PAGO', 'ESTORNADO'))
);

-- aluno N:N aula (tabela associativa): o aluno reserva uma aula em uma data específica
CREATE TABLE reserva (
    aluno_pessoa_cpf_pessoa  VARCHAR(14)  NOT NULL REFERENCES aluno(pessoa_cpf_pessoa) ON DELETE CASCADE,
    aula_id_aula             INTEGER      NOT NULL REFERENCES aula(id_aula) ON DELETE CASCADE,
    data_aula_reserva        DATE         NOT NULL,
    status_reserva           VARCHAR(10)  NOT NULL DEFAULT 'CONFIRMADA'
                             CHECK (status_reserva IN ('CONFIRMADA', 'CANCELADA', 'CONCLUIDA')),
    PRIMARY KEY (aluno_pessoa_cpf_pessoa, aula_id_aula, data_aula_reserva)
);

-- =====================================================================
-- CARGA INICIAL (mínimo de 10 registros por tabela)
-- Os ids SERIAL são gerados na ordem dos INSERTs (1, 2, 3...)
-- =====================================================================

-- ---------- cargo (10) ----------
INSERT INTO cargo (nome_cargo, acesso_admin_cargo) VALUES
('Gerente',                TRUE),
('Recepcionista',          FALSE),
('Instrutor de Musculação',FALSE),
('Professor de Spinning',  FALSE),
('Personal Trainer',       FALSE),
('Professor de Yoga',      FALSE),
('Professor de Funcional', FALSE),
('Nutricionista',          FALSE),
('Fisioterapeuta',         FALSE),
('Auxiliar de Limpeza',    FALSE);

-- ---------- plano (10) ----------
INSERT INTO plano (nome_plano, descricao_plano, valor_plano, duracao_meses_plano) VALUES
('Básico Mensal',     'Acesso à musculação em horário livre',                    89.90,   1),
('Básico Trimestral', 'Musculação em horário livre por 3 meses',                249.90,   3),
('Básico Anual',      'Musculação em horário livre por 12 meses',               899.00,  12),
('Plus Mensal',       'Musculação + aulas coletivas (até 3 por semana)',        119.90,   1),
('Plus Trimestral',   'Musculação + aulas coletivas por 3 meses',               329.90,   3),
('Plus Anual',        'Musculação + aulas coletivas por 12 meses',             1199.00,  12),
('Premium Mensal',    'Tudo liberado: aulas ilimitadas e avaliação física',     159.90,   1),
('Premium Semestral', 'Tudo liberado por 6 meses',                              849.90,   6),
('Premium Anual',     'Tudo liberado por 12 meses',                            1599.00,  12),
('Estudante Mensal',  'Plano com desconto para estudantes (comprovação)',        69.90,   1);

-- ---------- modalidade (10) ----------
INSERT INTO modalidade (nome_modalidade, descricao_modalidade) VALUES
('Musculação',  'Treino com pesos e máquinas, com orientação de instrutor'),
('Spinning',    'Aula de bicicleta indoor com música e intervalos de intensidade'),
('Funcional',   'Circuito de exercícios com o peso do corpo e acessórios'),
('Yoga',        'Posturas, respiração e relaxamento para corpo e mente'),
('Pilates',     'Fortalecimento do core, postura e mobilidade'),
('Crossfit',    'Treinos de alta intensidade com movimentos variados'),
('Zumba',       'Dança fitness ao som de ritmos latinos'),
('Boxe',        'Técnica de golpes e condicionamento físico'),
('HIIT',        'Treino intervalado de alta intensidade, curto e intenso'),
('Alongamento', 'Ganho de flexibilidade e recuperação muscular');

-- ---------- forma_pagamento (10) ----------
INSERT INTO forma_pagamento (nome_forma_pagamento) VALUES
('Pix'),
('Cartão de Crédito à vista'),
('Cartão de Crédito parcelado'),
('Cartão de Débito'),
('Boleto Bancário'),
('Dinheiro'),
('Transferência Bancária'),
('Carteira Digital'),
('Débito Automático'),
('Vale Benefício');

-- ---------- pessoa (20: 10 funcionários + 10 alunos) ----------
-- A senha real é aplicada logo abaixo com hash
INSERT INTO pessoa (cpf_pessoa, nome_pessoa, data_nascimento_pessoa, endereco_pessoa, email_pessoa, senha_pessoa) VALUES
-- funcionários
('111.111.111-01', 'Ricardo Mendes Farias',     '1982-04-17', 'Av. Brasil, 1500',            'admin@academia.com',              'temp'),
('111.111.111-02', 'Camila Duarte Pinto',       '1995-09-03', 'Rua das Acácias, 88',         'recepcao@academia.com',           'temp'),
('111.111.111-03', 'Bruno Albuquerque Reis',    '1990-01-25', 'Rua Sete de Setembro, 410',   'bruno.albuquerque@academia.com',  'temp'),
('111.111.111-04', 'Fernanda Lima Barros',      '1993-06-12', 'Rua Paraná, 233',             'fernanda.lima@academia.com',      'temp'),
('111.111.111-05', 'Rodrigo Tavares Cunha',     '1988-11-30', 'Rua Goiás, 75',               'rodrigo.tavares@academia.com',    'temp'),
('111.111.111-06', 'Joana Prado Medeiros',      '1991-03-08', 'Rua das Hortênsias, 560',     'joana.prado@academia.com',        'temp'),
('111.111.111-07', 'Marcos Vinícius Rocha',     '1996-12-19', 'Rua Minas Gerais, 322',       'marcos.rocha@academia.com',       'temp'),
('111.111.111-08', 'Patrícia Nogueira Alves',   '1985-07-22', 'Av. Tiradentes, 905',         'patricia.nogueira@academia.com',  'temp'),
('111.111.111-09', 'Eduardo Siqueira Moura',    '1987-02-14', 'Rua Bahia, 148',              'eduardo.siqueira@academia.com',   'temp'),
('111.111.111-10', 'Larissa Campos Freitas',    '1999-08-05', 'Rua Amazonas, 61',            'larissa.campos@academia.com',     'temp'),
-- alunos
('222.222.222-01', 'Lucas Oliveira Santos',     '2000-05-11', 'Rua das Palmeiras, 120',      'lucas.oliveira@email.com',        'temp'),
('222.222.222-02', 'Mariana Souza Lima',        '1998-10-27', 'Rua XV de Novembro, 45',      'mariana.souza@email.com',         'temp'),
('222.222.222-03', 'Pedro Henrique Costa',      '2003-02-09', 'Rua Pernambuco, 301',         'pedro.costa@email.com',           'temp'),
('222.222.222-04', 'Ana Clara Ribeiro',         '1994-12-01', 'Av. Mato Grosso, 777',        'ana.ribeiro@email.com',           'temp'),
('222.222.222-05', 'Gabriel Martins Pereira',   '2001-07-16', 'Rua Ceará, 92',               'gabriel.martins@email.com',       'temp'),
('222.222.222-06', 'Beatriz Almeida Rocha',     '1997-04-23', 'Rua Santa Catarina, 18',      'beatriz.almeida@email.com',       'temp'),
('222.222.222-07', 'Felipe Barbosa Nunes',      '2005-09-30', 'Rua Piauí, 254',              'felipe.barbosa@email.com',        'temp'),
('222.222.222-08', 'Isabela Carvalho Dias',     '1992-01-14', 'Av. Rio Branco, 640',         'isabela.carvalho@email.com',      'temp'),
('222.222.222-09', 'Rafael Gomes Teixeira',     '1989-06-06', 'Rua Maranhão, 133',           'rafael.gomes@email.com',          'temp'),
('222.222.222-10', 'Letícia Fernandes Araújo',  '2002-11-18', 'Rua Espírito Santo, 509',     'leticia.fernandes@email.com',     'temp');

-- Troca a senha provisória por hash bcrypt da senha 123456 (um salt diferente por linha)
UPDATE pessoa SET senha_pessoa = crypt('123456', gen_salt('bf'));

-- ---------- funcionario (10) ----------
INSERT INTO funcionario (pessoa_cpf_pessoa, cargo_id_cargo, salario_funcionario, data_admissao_funcionario) VALUES
('111.111.111-01',  1, 6500.00, '2019-03-01'),
('111.111.111-02',  2, 2100.00, '2023-02-15'),
('111.111.111-03',  3, 2800.00, '2021-08-02'),
('111.111.111-04',  4, 2600.00, '2022-05-09'),
('111.111.111-05',  5, 3500.00, '2020-01-20'),
('111.111.111-06',  6, 2600.00, '2022-10-03'),
('111.111.111-07',  7, 2700.00, '2024-03-11'),
('111.111.111-08',  8, 3800.00, '2021-06-14'),
('111.111.111-09',  9, 3600.00, '2023-09-04'),
('111.111.111-10', 10, 1800.00, '2025-01-13');

-- ---------- aluno (10) ----------
INSERT INTO aluno (pessoa_cpf_pessoa, data_cadastro_aluno, objetivo_aluno) VALUES
('222.222.222-01', '2026-10-01', 'Ganho de massa muscular'),
('222.222.222-02', '2026-03-10', 'Condicionamento físico'),
('222.222.222-03', '2026-09-05', 'Emagrecimento'),
('222.222.222-04', '2026-06-15', 'Qualidade de vida'),
('222.222.222-05', '2026-08-20', 'Emagrecimento'),
('222.222.222-06', '2026-10-15', 'Flexibilidade e bem-estar'),
('222.222.222-07', '2026-10-20', 'Ganho de massa muscular'),
('222.222.222-08', '2026-05-02', 'Preparação para corrida'),
('222.222.222-09', '2026-01-12', 'Reabilitação'),
('222.222.222-10', '2026-04-01', 'Emagrecimento');

-- ---------- aula (12) ----------
-- (modalidade, instrutor, dia da semana, horário, duração em min, vagas)
INSERT INTO aula (modalidade_id_modalidade, funcionario_pessoa_cpf_pessoa, dia_semana_aula, horario_inicio_aula, duracao_minutos_aula, vagas_aula) VALUES
(2, '111.111.111-04', 1, '07:00', 50, 15),  -- Spinning   seg
(2, '111.111.111-04', 3, '07:00', 50, 15),  -- Spinning   qua
(4, '111.111.111-06', 2, '08:00', 60, 12),  -- Yoga       ter
(4, '111.111.111-06', 4, '08:00', 60, 12),  -- Yoga       qui
(3, '111.111.111-07', 1, '18:30', 45, 20),  -- Funcional  seg
(3, '111.111.111-07', 5, '18:30', 45, 20),  -- Funcional  sex
(1, '111.111.111-03', 2, '19:00', 60, 25),  -- Musculação ter
(9, '111.111.111-05', 3, '19:00', 40, 15),  -- HIIT       qua
(8, '111.111.111-05', 4, '19:00', 60, 12),  -- Boxe       qui
(7, '111.111.111-07', 6, '09:00', 60, 30),  -- Zumba      sáb
(10,'111.111.111-06', 6, '10:30', 40, 20),  -- Alongamento sáb
(6, '111.111.111-05', 6, '08:00', 60, 12);  -- Crossfit   sáb

-- ---------- matricula (10) ----------
-- fim = início + duração do plano - 1 dia
INSERT INTO matricula (aluno_pessoa_cpf_pessoa, plano_id_plano, data_inicio_matricula, data_fim_matricula, status_matricula) VALUES
('222.222.222-01',  4, '2026-10-01', '2026-10-31', 'ATIVA'),
('222.222.222-02',  6, '2026-03-10', '2027-03-09', 'ATIVA'),
('222.222.222-03',  1, '2026-09-05', '2026-10-04', 'VENCIDA'),
('222.222.222-04',  9, '2026-06-15', '2027-06-14', 'ATIVA'),
('222.222.222-05',  2, '2026-08-20', '2026-11-19', 'ATIVA'),
('222.222.222-06',  7, '2026-10-15', '2026-11-14', 'ATIVA'),
('222.222.222-07', 10, '2026-10-20', '2026-11-19', 'PENDENTE'),
('222.222.222-08',  8, '2026-05-02', '2026-11-01', 'ATIVA'),
('222.222.222-09',  3, '2026-01-12', '2027-01-11', 'ATIVA'),
('222.222.222-10',  5, '2026-04-01', '2026-06-30', 'CANCELADA');

-- ---------- pagamento (12) ----------
-- (matrícula, forma de pagamento, valor, data, status)
INSERT INTO pagamento (matricula_id_matricula, forma_pagamento_id_forma_pagamento, valor_pagamento, data_pagamento, status_pagamento) VALUES
(1, 1,  119.90, '2026-10-01 09:15', 'PAGO'),
(2, 3, 1199.00, '2026-03-10 18:40', 'PAGO'),
(3, 5,   89.90, '2026-09-05 10:00', 'PAGO'),
(4, 2, 1599.00, '2026-06-15 11:20', 'PAGO'),
(5, 1,  249.90, '2026-08-20 08:05', 'PAGO'),
(6, 4,  159.90, '2026-10-15 17:30', 'PAGO'),
(7, 5,   69.90, NULL,               'PENDENTE'),
(8, 1,  424.95, '2026-05-02 19:10', 'PAGO'),
(8, 1,  424.95, '2026-06-02 19:12', 'PAGO'),
(9, 9,  449.50, '2026-01-12 12:00', 'PAGO'),
(9, 9,  449.50, '2026-02-12 12:00', 'PAGO'),
(10,6,  329.90, '2026-04-01 16:45', 'ESTORNADO');

-- ---------- reserva (12) ----------
INSERT INTO reserva (aluno_pessoa_cpf_pessoa, aula_id_aula, data_aula_reserva, status_reserva) VALUES
('222.222.222-01',  1, '2026-10-19', 'CONCLUIDA'),
('222.222.222-06',  3, '2026-10-20', 'CONCLUIDA'),
('222.222.222-01',  1, '2026-10-26', 'CONFIRMADA'),
('222.222.222-01',  5, '2026-10-26', 'CONFIRMADA'),
('222.222.222-02',  3, '2026-10-27', 'CONFIRMADA'),
('222.222.222-05',  7, '2026-10-27', 'CONFIRMADA'),
('222.222.222-04',  2, '2026-10-28', 'CONFIRMADA'),
('222.222.222-04',  8, '2026-10-28', 'CONFIRMADA'),
('222.222.222-02',  4, '2026-10-29', 'CONFIRMADA'),
('222.222.222-06',  9, '2026-10-29', 'CONFIRMADA'),
('222.222.222-08', 10, '2026-10-31', 'CONFIRMADA'),
('222.222.222-09', 12, '2026-10-31', 'CANCELADA');

-- #####################################################################
-- PARTE 2: AJUSTES DA ETAPA 1 (fichas de treino, colunas novas, correcao de dados)
-- #####################################################################

-- =====================================================================
-- ACADEMIA - AJUSTES (ETAPA 1)
--
-- Rode DEPOIS do siteacademia.sql, no mesmo banco (academia):
--     psql -U postgres -d academia -f academia_ajustes.sql
--
-- Este script NAO recria o banco. Ele apenas:
--   1) adiciona 2 colunas (cargo.instrutor_cargo e plano.aulas_semana_plano)
--   2) cria 2 tabelas novas (ficha_treino e ficha_exercicio)
--   3) cria 2 indices de apoio
--   4) corrige dados de exemplo que ficaram inconsistentes com a data atual
--   5) insere fichas de treino de exemplo
--
-- Pode ser executado mais de uma vez (as fichas sao recriadas do zero).
-- Tudo roda dentro de uma transacao: se algo falhar, nada e aplicado.
-- =====================================================================

BEGIN;

-- =====================================================================
-- 1. COLUNAS NOVAS EM TABELAS EXISTENTES
-- =====================================================================

-- Define quais cargos sao de instrutor (area do instrutor).
-- Gerente = cargo.acesso_admin_cargo | Instrutor = cargo.instrutor_cargo
ALTER TABLE cargo
    ADD COLUMN IF NOT EXISTS instrutor_cargo BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE cargo SET instrutor_cargo = TRUE
WHERE nome_cargo IN (
    'Instrutor de Musculação',
    'Professor de Spinning',
    'Personal Trainer',
    'Professor de Yoga',
    'Professor de Funcional'
);

-- Quantas aulas coletivas por semana o plano permite.
--   0    = nenhuma (so musculacao em horario livre)
--   3    = ate 3 por semana
--   NULL = ilimitado
-- O backend usa esse valor para validar reservas.
ALTER TABLE plano
    ADD COLUMN IF NOT EXISTS aulas_semana_plano INTEGER
    CHECK (aulas_semana_plano IS NULL OR aulas_semana_plano >= 0);

COMMENT ON COLUMN plano.aulas_semana_plano IS
    '0 = sem aulas coletivas; N = ate N por semana; NULL = ilimitado';

UPDATE plano SET aulas_semana_plano = CASE
    WHEN nome_plano LIKE 'Básico%'   THEN 0
    WHEN nome_plano LIKE 'Estudante%' THEN 0
    WHEN nome_plano LIKE 'Plus%'     THEN 3
    ELSE NULL                                   -- Premium: ilimitado
END;

-- =====================================================================
-- 2. TABELAS NOVAS: FICHA DE TREINO
-- =====================================================================

DROP TABLE IF EXISTS ficha_exercicio CASCADE;
DROP TABLE IF EXISTS ficha_treino CASCADE;

-- aluno 1:N ficha_treino   /   funcionario (instrutor responsavel) 1:N ficha_treino
-- Uma ficha ativa por aluno; as inativas formam o historico.
-- Criada e editada somente pelo gerente (regra aplicada no backend).
CREATE TABLE ficha_treino (
    id_ficha_treino                SERIAL        PRIMARY KEY,
    aluno_pessoa_cpf_pessoa        VARCHAR(14)   NOT NULL
                                   REFERENCES aluno(pessoa_cpf_pessoa) ON DELETE CASCADE,
    funcionario_pessoa_cpf_pessoa  VARCHAR(14)
                                   REFERENCES funcionario(pessoa_cpf_pessoa) ON DELETE SET NULL, -- instrutor responsavel (opcional)
    titulo_ficha_treino            VARCHAR(80)   NOT NULL,
    objetivo_ficha_treino          VARCHAR(100),
    observacoes_ficha_treino       VARCHAR(300),
    data_criacao_ficha_treino      DATE          NOT NULL DEFAULT CURRENT_DATE,
    ativa_ficha_treino             BOOLEAN       NOT NULL DEFAULT TRUE
);

-- Garante no proprio banco: no maximo 1 ficha ATIVA por aluno
CREATE UNIQUE INDEX uq_ficha_treino_ativa_por_aluno
    ON ficha_treino (aluno_pessoa_cpf_pessoa)
    WHERE ativa_ficha_treino;

-- ficha_treino 1:N ficha_exercicio
-- divisao = "Treino A", "Treino B"... ; ordem = posicao dentro da divisao
CREATE TABLE ficha_exercicio (
    id_ficha_exercicio                 SERIAL       PRIMARY KEY,
    ficha_treino_id_ficha_treino       INTEGER      NOT NULL
                                       REFERENCES ficha_treino(id_ficha_treino) ON DELETE CASCADE,
    divisao_ficha_exercicio            VARCHAR(20)  NOT NULL DEFAULT 'Treino A',
    ordem_ficha_exercicio              INTEGER      NOT NULL CHECK (ordem_ficha_exercicio > 0),
    nome_ficha_exercicio               VARCHAR(80)  NOT NULL,
    series_ficha_exercicio             INTEGER      NOT NULL CHECK (series_ficha_exercicio > 0),
    repeticoes_ficha_exercicio         VARCHAR(20)  NOT NULL,   -- texto: '12', '8-10', '30s'
    descanso_segundos_ficha_exercicio  INTEGER      CHECK (descanso_segundos_ficha_exercicio >= 0),
    orientacoes_ficha_exercicio        VARCHAR(300),
    CONSTRAINT uq_ficha_exercicio_ordem
        UNIQUE (ficha_treino_id_ficha_treino, divisao_ficha_exercicio, ordem_ficha_exercicio)
        DEFERRABLE INITIALLY DEFERRED   -- permite reordenar dentro de uma transacao
);

-- =====================================================================
-- 3. INDICES DE APOIO (consultas frequentes do backend)
-- =====================================================================

-- contar vagas ocupadas: reservas CONFIRMADAS de uma aula em uma data
CREATE INDEX IF NOT EXISTS idx_reserva_aula_data_confirmada
    ON reserva (aula_id_aula, data_aula_reserva)
    WHERE status_reserva = 'CONFIRMADA';

-- achar a matricula vigente de um aluno
CREATE INDEX IF NOT EXISTS idx_matricula_aluno_status
    ON matricula (aluno_pessoa_cpf_pessoa, status_matricula);

-- =====================================================================
-- 4. CORRECAO DOS DADOS DE EXEMPLO
-- =====================================================================

-- 4.1 Reserva do aluno 05 (plano Basico = 0 aulas coletivas) violava a regra.
--     Mantemos o historico, mas como CANCELADA.
UPDATE reserva SET status_reserva = 'CANCELADA'
WHERE aluno_pessoa_cpf_pessoa = '222.222.222-05'
  AND aula_id_aula = 7
  AND data_aula_reserva = '2026-10-27'
  AND status_reserva = 'CONFIRMADA';

-- 4.2 Matriculas ATIVAS cuja data final ja passou viram VENCIDA.
--     (Mesma regra que o backend vai aplicar automaticamente.)
UPDATE matricula SET status_matricula = 'VENCIDA'
WHERE status_matricula = 'ATIVA'
  AND data_fim_matricula < CURRENT_DATE;

-- 4.3 Reservas CONFIRMADAS de datas passadas viram CONCLUIDA.
UPDATE reserva SET status_reserva = 'CONCLUIDA'
WHERE status_reserva = 'CONFIRMADA'
  AND data_aula_reserva < CURRENT_DATE;

-- 4.4 Renovacao do Lucas (a matricula dele venceu em 31/10), com pagamento.
--     Sem isso ele ficaria sem matricula ativa e nao poderia demonstrar reservas.
DO $$
DECLARE
    v_id_matricula INTEGER;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM matricula
        WHERE aluno_pessoa_cpf_pessoa = '222.222.222-01'
          AND data_inicio_matricula = '2026-11-01'
    ) THEN
        INSERT INTO matricula
            (aluno_pessoa_cpf_pessoa, plano_id_plano, data_inicio_matricula, data_fim_matricula, status_matricula)
        VALUES
            ('222.222.222-01', 4, '2026-11-01', '2026-11-30', 'ATIVA')
        RETURNING id_matricula INTO v_id_matricula;

        INSERT INTO pagamento
            (matricula_id_matricula, forma_pagamento_id_forma_pagamento, valor_pagamento, data_pagamento, status_pagamento)
        VALUES
            (v_id_matricula, 1, 119.90, '2026-11-01 10:00', 'PAGO');
    END IF;
END $$;

-- 4.5 Reservas futuras para a demonstracao ("proximas aulas" do aluno).
--     Datas conferidas com o dia da semana de cada aula:
--     aula 1/5 = segunda | 2 = quarta | 3 = terca | 9 = quinta
INSERT INTO reserva (aluno_pessoa_cpf_pessoa, aula_id_aula, data_aula_reserva, status_reserva) VALUES
('222.222.222-01', 1, '2026-11-09', 'CONFIRMADA'),  -- Lucas   Spinning   seg
('222.222.222-01', 5, '2026-11-09', 'CONFIRMADA'),  -- Lucas   Funcional  seg
('222.222.222-02', 3, '2026-11-10', 'CONFIRMADA'),  -- Mariana Yoga       ter
('222.222.222-04', 2, '2026-11-04', 'CONFIRMADA'),  -- Ana     Spinning   qua
('222.222.222-06', 9, '2026-11-05', 'CONFIRMADA')   -- Beatriz Boxe       qui
ON CONFLICT DO NOTHING;

-- =====================================================================
-- 5. FICHAS DE TREINO DE EXEMPLO (11 fichas: 10 ativas + 1 historica)
-- Instrutores responsaveis (apenas cargos com instrutor_cargo = TRUE):
--   03 Bruno (musculacao) | 05 Rodrigo (personal) | 06 Joana (yoga) | 07 Marcos (funcional)
-- Os ids sao 1..11 porque a tabela foi recriada acima.
-- =====================================================================

INSERT INTO ficha_treino
    (aluno_pessoa_cpf_pessoa, funcionario_pessoa_cpf_pessoa, titulo_ficha_treino, objetivo_ficha_treino,
     observacoes_ficha_treino, data_criacao_ficha_treino, ativa_ficha_treino) VALUES
-- 1: historico do Lucas (substituida pela ficha 2)
('222.222.222-01', '111.111.111-03', 'Adaptação Full Body',   'Adaptação ao treino',      'Fase inicial, cargas leves.',                 '2026-10-01', FALSE),
-- 2..11: fichas ativas
('222.222.222-01', '111.111.111-03', 'Hipertrofia ABC',       'Ganho de massa muscular',  'Aumentar carga a cada 2 semanas.',            '2026-10-20', TRUE),
('222.222.222-02', '111.111.111-05', 'Condicionamento Geral', 'Condicionamento físico',   'Manter ritmo constante.',                     '2026-03-12', TRUE),
('222.222.222-03', '111.111.111-05', 'Emagrecimento Circuito','Emagrecimento',            'Intercalar com 20 min de esteira.',           '2026-09-07', TRUE),
('222.222.222-04', '111.111.111-07', 'Qualidade de Vida',     'Qualidade de vida',        'Foco em postura e mobilidade.',               '2026-06-17', TRUE),
('222.222.222-05', '111.111.111-05', 'Queima Calórica',       'Emagrecimento',            'Hidratação durante o treino.',                '2026-08-22', TRUE),
('222.222.222-06', '111.111.111-06', 'Mobilidade e Core',     'Flexibilidade e bem-estar','Respirar de forma controlada.',               '2026-10-16', TRUE),
('222.222.222-07', '111.111.111-03', 'Hipertrofia Iniciante', 'Ganho de massa muscular',  'Priorizar a execução correta.',               '2026-10-21', TRUE),
('222.222.222-08', '111.111.111-05', 'Base para Corrida',     'Preparação para corrida',  'Fortalecer pernas e core.',                   '2026-05-04', TRUE),
('222.222.222-09', '111.111.111-03', 'Reabilitação Progressiva','Reabilitação',           'Seguir liberação do fisioterapeuta.',         '2026-01-14', TRUE),
('222.222.222-10', '111.111.111-05', 'Emagrecimento Full Body','Emagrecimento',           'Treino de corpo inteiro 3x por semana.',      '2026-04-03', TRUE);

-- (ficha, divisao, ordem, exercicio, series, repeticoes, descanso_s, orientacoes)
INSERT INTO ficha_exercicio
    (ficha_treino_id_ficha_treino, divisao_ficha_exercicio, ordem_ficha_exercicio, nome_ficha_exercicio,
     series_ficha_exercicio, repeticoes_ficha_exercicio, descanso_segundos_ficha_exercicio, orientacoes_ficha_exercicio) VALUES
-- ficha 1 (historica)
(1, 'Treino A', 1, 'Leg press 45°',        3, '15',   60, 'Carga leve, amplitude completa.'),
(1, 'Treino A', 2, 'Supino máquina',       3, '15',   60, 'Cotovelos a 45° do tronco.'),
(1, 'Treino A', 3, 'Puxada frontal',       3, '15',   60, 'Evitar balançar o tronco.'),
-- ficha 2 (Lucas - ABC)
(2, 'Treino A', 1, 'Supino reto',          4, '8-10', 90, 'Descer a barra até o peito, sem quicar.'),
(2, 'Treino A', 2, 'Tríceps testa',        3, '12',   60, 'Manter cotovelos fixos.'),
(2, 'Treino B', 1, 'Remada curvada',       4, '8-10', 90, 'Coluna neutra durante todo o movimento.'),
(2, 'Treino B', 2, 'Rosca direta',         3, '12',   60, 'Sem impulso do quadril.'),
(2, 'Treino C', 1, 'Agachamento livre',    4, '8-10', 120,'Joelhos alinhados com a ponta dos pés.'),
(2, 'Treino C', 2, 'Cadeira extensora',    3, '12',   60, 'Contrair no topo por 1 segundo.'),
-- ficha 3 (Mariana)
(3, 'Treino A', 1, 'Esteira (caminhada)',  1, '15 min', 0, 'Ritmo moderado para aquecer.'),
(3, 'Treino A', 2, 'Afundo',               3, '12',   45, 'Passo largo, tronco ereto.'),
(3, 'Treino A', 3, 'Prancha',              3, '30s',  30, 'Abdômen contraído, quadril alinhado.'),
-- ficha 4 (Pedro)
(4, 'Treino A', 1, 'Burpee',               3, '10',   45, 'Ritmo constante, sem pressa.'),
(4, 'Treino A', 2, 'Agachamento com salto',3, '12',   45, 'Aterrissar suavemente.'),
(4, 'Treino A', 3, 'Corda naval',          3, '30s',  30, 'Ondas alternadas.'),
-- ficha 5 (Ana)
(5, 'Treino A', 1, 'Agachamento com bola', 3, '12',   45, 'Costas apoiadas na parede.'),
(5, 'Treino A', 2, 'Remada elástica',      3, '15',   45, 'Escápulas juntas no final.'),
(5, 'Treino A', 3, 'Elevação pélvica',     3, '15',   45, 'Contrair glúteos no topo.'),
-- ficha 6 (Gabriel)
(6, 'Treino A', 1, 'Bicicleta ergométrica',1, '20 min', 0, 'Intensidade moderada a alta.'),
(6, 'Treino A', 2, 'Mountain climber',     3, '30s',  30, 'Quadril baixo.'),
(6, 'Treino A', 3, 'Kettlebell swing',     3, '15',   45, 'Movimento vem do quadril.'),
-- ficha 7 (Beatriz)
(7, 'Treino A', 1, 'Ponte de glúteos',     3, '15',   30, 'Subir devagar, descer controlando.'),
(7, 'Treino A', 2, 'Prancha lateral',      3, '20s',  30, 'Trocar de lado entre as séries.'),
(7, 'Treino A', 3, 'Gato-camelo',          2, '10',   20, 'Sincronizar com a respiração.'),
-- ficha 8 (Felipe)
(8, 'Treino A', 1, 'Leg press 45°',        3, '12',   60, 'Não travar os joelhos no final.'),
(8, 'Treino A', 2, 'Supino inclinado halteres', 3, '10', 60, 'Controlar a descida.'),
(8, 'Treino A', 3, 'Puxada alta',          3, '12',   60, 'Puxar até a altura do queixo.'),
-- ficha 9 (Isabela)
(9, 'Treino A', 1, 'Agachamento búlgaro',  3, '10',   60, 'Joelho da frente alinhado.'),
(9, 'Treino A', 2, 'Panturrilha em pé',    4, '15',   30, 'Amplitude máxima.'),
(9, 'Treino A', 3, 'Prancha com toque no ombro', 3, '20', 30, 'Evitar girar o quadril.'),
-- ficha 10 (Rafael)
(10,'Treino A', 1, 'Bicicleta estacionária',1,'10 min', 0, 'Sem carga, aquecimento articular.'),
(10,'Treino A', 2, 'Leg press (amplitude parcial)', 3, '15', 60, 'Respeitar limite de dor.'),
(10,'Treino A', 3, 'Remada baixa',        3, '12',   60, 'Postura ereta.'),
-- ficha 11 (Letícia)
(11,'Treino A', 1, 'Agachamento livre',    3, '15',   45, 'Peso do corpo ou barra leve.'),
(11,'Treino A', 2, 'Flexão de braço (joelhos)', 3, '10', 45, 'Corpo alinhado.'),
(11,'Treino A', 3, 'Remada unilateral',    3, '12',   45, 'Costas retas.');

COMMIT;

-- =====================================================================
-- CONFERENCIA (rode e compare)
-- =====================================================================

-- Esperado: 5 cargos de instrutor (Musculacao, Spinning, Personal, Yoga, Funcional)
SELECT id_cargo, nome_cargo, acesso_admin_cargo, instrutor_cargo FROM cargo ORDER BY id_cargo;

-- Esperado: Basico/Estudante = 0, Plus = 3, Premium = NULL
SELECT id_plano, nome_plano, aulas_semana_plano FROM plano ORDER BY id_plano;

-- Esperado: 11 fichas, 10 ativas
SELECT COUNT(*) AS total_fichas, COUNT(*) FILTER (WHERE ativa_ficha_treino) AS ativas FROM ficha_treino;

-- Esperado: 36 exercicios
SELECT COUNT(*) AS total_exercicios FROM ficha_exercicio;

-- Esperado: matriculas 1 e 8 VENCIDA; nova matricula do Lucas ATIVA
SELECT id_matricula, aluno_pessoa_cpf_pessoa, plano_id_plano, data_fim_matricula, status_matricula
FROM matricula ORDER BY id_matricula;