const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ limit: '15mb', extended: true }));
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Pool de conexão MySQL para Nuvem Aiven
const db = mysql.createPool({
  host: process.env.DB_HOST || 'mysql-22dda56a-arthurcoutooliveira2006-e952.c.aivencloud.com',
  user: process.env.DB_USER || 'avnadmin',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'defaultdb',
  port: Number(process.env.DB_PORT) || 20284,
  ssl: {
    rejectUnauthorized: false
  },
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const SUPER_ADMIN_EMAIL = 'arthurcoutooliveira2006@gmail.com';

// Inicialização e Carga Automática de Dados no Banco Aiven
async function inicializarBanco() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id_usuario INT AUTO_INCREMENT PRIMARY KEY,
        nome VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL UNIQUE,
        senha VARCHAR(255) NOT NULL,
        foto_perfil LONGTEXT NULL,
        heroi_favorito VARCHAR(80) DEFAULT 'Homem-Aranha',
        is_admin TINYINT(1) DEFAULT 0,
        consentimento_lgpd TINYINT(1) DEFAULT 1,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS pontos_coleta (
        id_ponto INT AUTO_INCREMENT PRIMARY KEY,
        nome_local VARCHAR(120) NOT NULL,
        endereco VARCHAR(200) NOT NULL,
        bairro VARCHAR(80) NOT NULL,
        cidade VARCHAR(80) NOT NULL,
        horario VARCHAR(100) NOT NULL,
        contato VARCHAR(50) NOT NULL,
        publico_atendido VARCHAR(100) DEFAULT 'Todos os Públicos',
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS doacoes (
        id_doacao INT AUTO_INCREMENT PRIMARY KEY,
        id_usuario INT NOT NULL,
        id_ponto INT NULL,
        categoria VARCHAR(80) NOT NULL,
        publico_alvo VARCHAR(80) NOT NULL,
        descricao TEXT NOT NULL,
        codigo_protocolo VARCHAR(30) NOT NULL UNIQUE,
        status_doacao VARCHAR(40) DEFAULT 'Registrada / Em Triagem',
        data_doacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
        FOREIGN KEY (id_ponto) REFERENCES pontos_coleta(id_ponto) ON DELETE SET NULL
      ) ENGINE=InnoDB;
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS mensagens_solidarias (
        id_mensagem INT AUTO_INCREMENT PRIMARY KEY,
        id_usuario INT NOT NULL,
        mensagem TEXT NOT NULL,
        data_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS frases_motivacao (
        id_frase INT AUTO_INCREMENT PRIMARY KEY,
        texto TEXT NOT NULL,
        autor VARCHAR(100) NOT NULL,
        categoria VARCHAR(50) NOT NULL
      ) ENGINE=InnoDB;
    `);

    // Carrega pontos caso a tabela esteja vazia
    const [pontos] = await db.query('SELECT COUNT(*) AS total FROM pontos_coleta');
    if (pontos[0].total === 0) {
      await db.query(`
        INSERT INTO pontos_coleta (nome_local, endereco, bairro, cidade, horario, contato, publico_atendido) VALUES
        ('Lar da Criança Esperança', 'Rua das Flores, 100', 'Centro', 'Mesquita', 'Seg a Sex: 08h às 17h', '(21) 98888-1111', 'Crianças e Jovens'),
        ('Abrigo Vovô Feliz', 'Av. Brasil, 500', 'Vila Nova', 'Nova Iguaçu', 'Todos os dias: 09h às 16h', '(21) 97777-2222', 'Idosos em Abrigos'),
        ('Centro Solidário de Acolhimento', 'Rua São Paulo, 42', 'Centro', 'Mesquita', 'Seg a Sab: 07h às 19h', '(21) 96666-3333', 'Pessoas em Situação de Rua'),
        ('Instituto Inclusão Atípica (TEA / PCD)', 'Rua da Igualdade, 250', 'Juscelino', 'Mesquita', 'Seg a Sex: 08h às 18h', '(21) 99999-5555', 'Pessoas Atípicas (TEA / PCD / Inclusão)'),
        ('Ponto Geral dos Amigos', 'Praça da Matriz, 10', 'Centro', 'Rio de Janeiro', 'Seg a Sex: 08h às 18h', '(21) 95555-4444', 'Todos os Públicos');
      `);
    }

    console.log('Banco de dados Aiven conectado e sincronizado com sucesso!');
  } catch (err) {
    console.error('Erro no banco Aiven:', err.message);
  }
}
inicializarBanco();

// 1. Autenticação
app.post('/api/auth', async (req, res) => {
  const { nome, email, senha, consentimento_lgpd } = req.body;
  const emailTratado = (email || '').trim().toLowerCase();

  try {
    const [rows] = await db.query('SELECT * FROM usuarios WHERE LOWER(email) = ?', [emailTratado]);
    
    if (rows.length > 0) {
      const usuario = rows[0];
      const senhaValida = await bcrypt.compare(senha, usuario.senha);
      if (!senhaValida) {
        return res.status(401).json({ error: 'Credenciais inválidas. Verifique sua senha.' });
      }

      const isSuperAdmin = (emailTratado === SUPER_ADMIN_EMAIL.toLowerCase()) ? 1 : 0;
      if (usuario.is_admin !== isSuperAdmin) {
        await db.query('UPDATE usuarios SET is_admin = ? WHERE id_usuario = ?', [isSuperAdmin, usuario.id_usuario]);
      }

      return res.json({ 
        id_usuario: usuario.id_usuario, 
        nome: usuario.nome, 
        email: usuario.email, 
        foto_perfil: usuario.foto_perfil,
        heroi_favorito: usuario.heroi_favorito || 'Homem-Aranha',
        is_admin: isSuperAdmin 
      });
    } else {
      if (!consentimento_lgpd) {
        return res.status(400).json({ error: 'É obrigatório aceitar os termos da LGPD para cadastrar.' });
      }

      const senhaHash = await bcrypt.hash(senha, 12);
      const isSuperAdmin = (emailTratado === SUPER_ADMIN_EMAIL.toLowerCase()) ? 1 : 0;
      
      const [result] = await db.query(
        'INSERT INTO usuarios (nome, email, senha, heroi_favorito, is_admin, consentimento_lgpd) VALUES (?, ?, ?, ?, ?, ?)',
        [nome, emailTratado, senhaHash, 'Homem-Aranha', isSuperAdmin, 1]
      );
      return res.json({ 
        id_usuario: result.insertId, 
        nome, 
        email: emailTratado, 
        foto_perfil: null, 
        heroi_favorito: 'Homem-Aranha', 
        is_admin: isSuperAdmin 
      });
    }
  } catch (error) {
    res.status(500).json({ error: 'Erro de autenticação: ' + error.message });
  }
});

// 2. Mural Público de TODOS os Usuários Cadastrados
app.get('/api/doadores/publico', async (req, res) => {
  try {
    const [doadores] = await db.query(`
      SELECT 
        u.id_usuario, 
        u.nome, 
        u.foto_perfil, 
        u.heroi_favorito, 
        COUNT(d.id_doacao) AS total_doacoes
      FROM usuarios u
      LEFT JOIN doacoes d ON u.id_usuario = d.id_usuario
      GROUP BY u.id_usuario, u.nome, u.foto_perfil, u.heroi_favorito
      ORDER BY total_doacoes DESC, u.id_usuario ASC
    `);
    res.json(doadores);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Impacto Geral
app.get('/api/impacto', async (req, res) => {
  try {
    const [[{ total_doadores }]] = await db.query('SELECT COUNT(*) AS total_doadores FROM usuarios');
    const [[{ total_doacoes }]] = await db.query('SELECT COUNT(*) AS total_doacoes FROM doacoes');
    const [[{ total_pontos }]] = await db.query('SELECT COUNT(*) AS total_pontos FROM pontos_coleta');
    res.json({ total_doadores, total_doacoes, total_pontos });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Pontos de Coleta
app.get('/api/pontos', async (req, res) => {
  try {
    const [pontos] = await db.query('SELECT * FROM pontos_coleta ORDER BY id_ponto ASC');
    res.json(pontos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/pontos', async (req, res) => {
  const { nome_local, endereco, bairro, cidade, horario, contato, publico_atendido } = req.body;
  try {
    await db.query(
      'INSERT INTO pontos_coleta (nome_local, endereco, bairro, cidade, horario, contato, publico_atendido) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [nome_local, endereco, bairro, cidade, horario, contato, publico_atendido || 'Todos os Públicos']
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Doações
app.post('/api/doacoes', async (req, res) => {
  const { id_usuario, id_ponto, categoria, publico_alvo, descricao } = req.body;
  const protocolo = '#HEROI-' + Math.floor(1000 + Math.random() * 9000);

  try {
    await db.query(
      'INSERT INTO doacoes (id_usuario, id_ponto, categoria, publico_alvo, descricao, codigo_protocolo) VALUES (?, ?, ?, ?, ?, ?)',
      [id_usuario, id_ponto, categoria, publico_alvo, descricao, protocolo]
    );

    const [ponto] = await db.query('SELECT * FROM pontos_coleta WHERE id_ponto = ?', [id_ponto]);

    res.json({
      protocolo,
      frase: { texto: "Com grandes poderes vêm grandes responsabilidades.", autor: "Peter Parker (Homem-Aranha)" },
      ponto: ponto[0]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/doacoes/minhas/:id_usuario', async (req, res) => {
  const { id_usuario } = req.params;
  try {
    const [doacoes] = await db.query(`
      SELECT d.*, p.nome_local AS ponto_nome
      FROM doacoes d
      LEFT JOIN pontos_coleta p ON d.id_ponto = p.id_ponto
      WHERE d.id_usuario = ?
      ORDER BY d.id_doacao DESC
    `, [id_usuario]);
    res.json(doacoes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/doacoes', async (req, res) => {
  try {
    const [doacoes] = await db.query(`
      SELECT d.*, u.nome AS doador_nome, u.email AS doador_email, p.nome_local AS ponto_nome 
      FROM doacoes d
      JOIN usuarios u ON d.id_usuario = u.id_usuario
      LEFT JOIN pontos_coleta p ON d.id_ponto = p.id_ponto
      ORDER BY d.id_doacao DESC
    `);
    res.json(doacoes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Perfil & LGPD
app.put('/api/usuario/perfil', async (req, res) => {
  const { id_usuario, nome, email, senha, foto_perfil, heroi_favorito } = req.body;
  const emailTratado = (email || '').trim().toLowerCase();

  try {
    let query = 'UPDATE usuarios SET nome = ?, email = ?, foto_perfil = ?, heroi_favorito = ? WHERE id_usuario = ?';
    let params = [nome, emailTratado, foto_perfil || null, heroi_favorito || 'Homem-Aranha', id_usuario];

    if (senha && senha.trim() !== '') {
      const senhaHash = await bcrypt.hash(senha, 12);
      query = 'UPDATE usuarios SET nome = ?, email = ?, senha = ?, foto_perfil = ?, heroi_favorito = ? WHERE id_usuario = ?';
      params = [nome, emailTratado, senhaHash, foto_perfil || null, heroi_favorito || 'Homem-Aranha', id_usuario];
    }

    await db.query(query, params);
    const isSuperAdmin = (emailTratado === SUPER_ADMIN_EMAIL.toLowerCase()) ? 1 : 0;
    res.json({ 
      success: true, 
      nome, 
      email: emailTratado, 
      foto_perfil, 
      heroi_favorito: heroi_favorito || 'Homem-Aranha', 
      is_admin: isSuperAdmin 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/usuario/excluir/:id_usuario', async (req, res) => {
  const { id_usuario } = req.params;
  try {
    await db.query('DELETE FROM usuarios WHERE id_usuario = ?', [id_usuario]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 7. Mensagens
app.get('/api/mensagens', async (req, res) => {
  try {
    const [mensagens] = await db.query(`
      SELECT m.*, u.nome, u.heroi_favorito
      FROM mensagens_solidarias m
      JOIN usuarios u ON m.id_usuario = u.id_usuario
      ORDER BY m.id_mensagem DESC
    `);
    res.json(mensagens);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/mensagens', async (req, res) => {
  const { id_usuario, mensagem } = req.body;
  try {
    await db.query('INSERT INTO mensagens_solidarias (id_usuario, mensagem) VALUES (?, ?)', [id_usuario, mensagem]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 8. Frases
app.get('/api/frases', async (req, res) => {
  try {
    const [frases] = await db.query('SELECT * FROM frases_motivacao ORDER BY id_frase DESC');
    res.json(frases);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});