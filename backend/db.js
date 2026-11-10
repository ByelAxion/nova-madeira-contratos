import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

// ======================================
// CONFIGURAÇÃO DO POSTGRESQL
// ======================================

const databaseConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DB_SSL === 'true'
        ? { rejectUnauthorized: false }
        : false
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 5432),
      database: process.env.DB_NAME || 'nova_madeira',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      ssl: process.env.DB_SSL === 'true'
        ? { rejectUnauthorized: false }
        : false
    };

export const pool = new Pool({
  ...databaseConfig,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

// ======================================
// MONITORAMENTO DA CONEXÃO
// ======================================

pool.on('connect', () => {
  console.log('Nova conexão com PostgreSQL estabelecida.');
});

pool.on('error', (error) => {
  console.error('Erro inesperado no PostgreSQL:', error.message);
});

// ======================================
// TESTAR CONEXÃO
// ======================================

export async function testConnection() {
  try {
    const result = await pool.query(`
      SELECT
        current_database() AS database,
        current_user AS usuario,
        NOW() AS horario
    `);

    console.log('================================');
    console.log('POSTGRESQL CONECTADO COM SUCESSO!');
    console.log('Banco:', result.rows[0].database);
    console.log('Usuário:', result.rows[0].usuario);
    console.log('Horário:', result.rows[0].horario);
    console.log('================================');

    return true;

  } catch (error) {
    console.error('FALHA NA CONEXÃO COM POSTGRESQL:');
    console.error(error.message);

    throw error;
  }
}

// ======================================
// CRIAÇÃO DAS TABELAS
// ======================================

export async function initDb() {
  try {
    console.log('Inicializando banco de dados...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS contracts (
        id UUID PRIMARY KEY,
        token TEXT UNIQUE NOT NULL,

        status TEXT NOT NULL DEFAULT 'DRAFT'
          CHECK (
            status IN (
              'DRAFT',
              'PENDING',
              'CONFIRMED',
              'REJECTED'
            )
          ),

        data JSONB NOT NULL,

        client_name TEXT,

        client_cpf_encrypted TEXT,

        response_at TIMESTAMPTZ,

        accepted_snapshot JSONB,

        created_at TIMESTAMPTZ DEFAULT NOW(),

        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS sms_logs (
        id SERIAL PRIMARY KEY,

        contract_id UUID REFERENCES contracts(id)
          ON DELETE CASCADE,

        status TEXT NOT NULL,

        message TEXT,

        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_contracts_token
        ON contracts(token);

      CREATE INDEX IF NOT EXISTS idx_contracts_status
        ON contracts(status);

      CREATE INDEX IF NOT EXISTS idx_contracts_created
        ON contracts(created_at DESC);

    `);

    console.log('Tabelas criadas/verificadas com sucesso!');

  } catch (error) {
    console.error('ERRO AO INICIALIZAR AS TABELAS:');
    console.error(error.message);

    throw error;
  }
}