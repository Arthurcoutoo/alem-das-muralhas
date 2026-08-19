CREATE DATABASE IF NOT EXISTS rede_solidaria CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE rede_solidaria;

CREATE TABLE IF NOT EXISTS usuarios (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    senha VARCHAR(255) NOT NULL,
    data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pontos_coleta (
    id_ponto INT AUTO_INCREMENT PRIMARY KEY,
    nome_local VARCHAR(120) NOT NULL,
    endereco VARCHAR(255) NOT NULL,
    bairro VARCHAR(80) NOT NULL,
    cidade VARCHAR(80) NOT NULL,
    horario VARCHAR(100) NOT NULL,
    contato VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS doacoes (
    id_doacao INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NOT NULL,
    id_ponto INT NOT NULL,
    categoria VARCHAR(50) NOT NULL,
    publico_alvo VARCHAR(50) NOT NULL,
    descricao TEXT NOT NULL,
    codigo_protocolo VARCHAR(20) NOT NULL,
    status_doacao VARCHAR(30) DEFAULT 'Pendente',
    data_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    FOREIGN KEY (id_ponto) REFERENCES pontos_coleta(id_ponto)
);

CREATE TABLE IF NOT EXISTS mensagens_solidarias (
    id_mensagem INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NOT NULL,
    mensagem TEXT NOT NULL,
    data_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS frases_motivacao (
    id_frase INT AUTO_INCREMENT PRIMARY KEY,
    texto TEXT NOT NULL,
    autor VARCHAR(100) NOT NULL,
    categoria VARCHAR(50) NOT NULL
);

-- Dados Iniciais
INSERT INTO pontos_coleta (nome_local, endereco, bairro, cidade, horario, contato) VALUES
('Ponto Central - Paróquia Santa Luzia', 'Rua Esperança, 120', 'Centro', 'Mesquita', 'Seg a Sex: 08h às 17h', '(21) 98765-4321'),
('Associação Amigos do Bairro', 'Av. Brasil, 450', 'Vila Nova', 'Nova Iguaçu', 'Ter a Sáb: 09h às 16h', '(21) 99876-5432'),
('Espaço Solidário Acolher', 'Rua das Flores, 88', 'Jardim América', 'Rio de Janeiro', 'Todos os dias: 09h às 18h', '(21) 97654-3210');

INSERT INTO frases_motivacao (texto, autor, categoria) VALUES
('Com grandes poderes vêm grandes responsabilidades.', 'Peter Parker / Tio Ben (Homem-Aranha)', 'Herois'),
('Se você não lutar, você não pode vencer!', 'Eren Yeager (Attack on Titan)', 'Anime'),
('Eu sei que fomos derrotados, mas não vamos desistir. Custe o que custar.', 'Steve Rogers (Vingadores: Ultimato)', 'Herois'),
('Tudo posso naquele que me fortalece.', 'Filipenses 4:13', 'Bíblica'),
('Não nos cansemos de fazer o bem, pois no tempo próprio colheremos, se não desanimarmos.', 'Gálatas 6:9', 'Bíblica');