import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { requireAdmin } from './auth.js';
import { pool, initDb, testConnection } from './db.js';

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL?.split(',') || true }));
app.use(express.json({ limit: '1mb' }));

const cpfValid = (value='') => {
  const cpf = value.replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  let sum = 0;
  for (let i=0;i<9;i++) sum += Number(cpf[i]) * (10-i);
  let d1 = (sum*10)%11; if (d1===10) d1=0;
  if (d1 !== Number(cpf[9])) return false;
  sum = 0;
  for (let i=0;i<10;i++) sum += Number(cpf[i]) * (11-i);
  let d2 = (sum*10)%11; if (d2===10) d2=0;
  return d2 === Number(cpf[10]);
};

async function sendSms(contractId, text) {
  try {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_FROM) {
      await pool.query('INSERT INTO sms_logs(contract_id,status,message) VALUES($1,$2,$3)',
        [contractId, 'NOT_CONFIGURED', 'Credenciais SMS não configuradas']);
      return;
    }
    const twilio = (await import('twilio')).default;
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    await client.messages.create({ body: text, from: process.env.TWILIO_FROM, to: process.env.ADMIN_PHONE });
    await pool.query('INSERT INTO sms_logs(contract_id,status,message) VALUES($1,$2,$3)',
      [contractId, 'SENT', 'SMS enviado']);
  } catch (e) {
    await pool.query('INSERT INTO sms_logs(contract_id,status,message) VALUES($1,$2,$3)',
      [contractId, 'FAILED', String(e.message).slice(0,250)]);
  }
}

app.get('/api/health', (_req,res)=>res.json({ok:true,service:'nova-madeira-contracts-api'}));

app.post('/api/auth/login', async (req,res) => {
  const { email, password } = req.body || {};
  const result = await pool.query('SELECT * FROM admins WHERE email=$1', [email]);
  const admin = result.rows[0];
  if (!admin || !(await bcrypt.compare(password || '', admin.password_hash)))
    return res.status(401).json({error:'E-mail ou senha incorretos.'});
  const token = jwt.sign({id:admin.id,email:admin.email}, process.env.JWT_SECRET, {expiresIn:'8h'});
  res.json({token, email:admin.email});
});

app.get('/api/contracts', requireAdmin, async (_req,res) => {
  const result = await pool.query(`SELECT id, token, status, data, client_name, response_at, created_at
    FROM contracts ORDER BY created_at DESC`);
  res.json(result.rows);
});
// EXCLUIR CONTRATO
app.delete('/api/contracts/:id', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM contracts WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (!result.rowCount) {
      return res.status(404).json({
        error: 'Contrato não encontrado.'
      });
    }

    res.json({ ok: true, message: 'Contrato excluído com sucesso.' });

  } catch (error) {
    console.error('Erro ao excluir contrato:', error);

    res.status(500).json({
      error: 'Não foi possível excluir o contrato.'
    });
  }
});

app.post('/api/contracts', requireAdmin, async (req,res) => {
  const data = req.body?.data;
  if (!data || !data.contractorName || !data.totalValue)
    return res.status(400).json({error:'Preencha pelo menos os dados do contratado e o valor total.'});
  const id = crypto.randomUUID();
  const token = crypto.randomBytes(32).toString('hex');
  await pool.query('INSERT INTO contracts(id,token,status,data) VALUES($1,$2,$3,$4)',
    [id, token, 'DRAFT', data]);
  res.status(201).json({id, token, status:'DRAFT', url:`${process.env.FRONTEND_URL?.split(',')[0] || ''}/contrato/${token}`});
});

app.put('/api/contracts/:id', requireAdmin, async (req,res) => {
  const result = await pool.query(`UPDATE contracts SET data=$1, updated_at=NOW()
    WHERE id=$2 AND status='DRAFT' RETURNING id`, [req.body?.data || {}, req.params.id]);
  if (!result.rowCount) return res.status(409).json({error:'Contrato não encontrado ou já respondido.'});
  res.json({ok:true});
});

app.post('/api/contracts/:id/publish', requireAdmin, async (req,res) => {
  const result = await pool.query(`UPDATE contracts SET status='PENDING', updated_at=NOW()
    WHERE id=$1 AND status='DRAFT' RETURNING token`, [req.params.id]);
  if (!result.rowCount) return res.status(409).json({error:'Não foi possível publicar este contrato.'});
  res.json({url:`${process.env.FRONTEND_URL?.split(',')[0] || ''}/contrato/${result.rows[0].token}`});
});

app.get('/api/public/contracts/:token', async (req,res) => {
  const result = await pool.query(`SELECT status,data,client_name,response_at
    FROM contracts WHERE token=$1`, [req.params.token]);
  if (!result.rowCount) return res.status(404).json({error:'Contrato não encontrado.'});
  res.json(result.rows[0]);
});

app.post('/api/public/contracts/:token/respond', async (req,res) => {
  const { decision, name, cpf } = req.body || {};
  if (!['CONFIRMED','REJECTED'].includes(decision))
    return res.status(400).json({error:'Resposta inválida.'});
  if (decision === 'CONFIRMED') {
    if (!name || name.trim().split(/\s+/).length < 2)
      return res.status(400).json({error:'Informe seu nome completo.'});
    if (!cpfValid(cpf)) return res.status(400).json({error:'CPF inválido.'});
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const found = await client.query('SELECT * FROM contracts WHERE token=$1 FOR UPDATE', [req.params.token]);
    if (!found.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({error:'Contrato não encontrado.'}); }
    const contract = found.rows[0];
    if (contract.status !== 'PENDING') {
      await client.query('ROLLBACK');
      return res.status(409).json({error:'Este contrato já recebeu uma resposta.'});
    }
    const responseAt = new Date();
    const snapshot = {...contract.data, clientName: decision === 'CONFIRMED' ? name.trim() : null,
      clientCpf: decision === 'CONFIRMED' ? cpf.replace(/\D/g,'') : null,
      status:decision, responseAt:responseAt.toISOString()};
    // CPF não é devolvido pela rota pública. Em produção, configure criptografia em repouso/chave externa.
    await client.query(`UPDATE contracts SET status=$1, client_name=$2, client_cpf_encrypted=$3,
      response_at=$4, accepted_snapshot=$5, updated_at=NOW() WHERE id=$6`,
      [decision, decision==='CONFIRMED'?name.trim():null,
       decision==='CONFIRMED'?cpf.replace(/\D/g,''):null, responseAt, snapshot, contract.id]);
    await client.query('COMMIT');
    const message = decision === 'CONFIRMED'
      ? `CONTRATO CONFIRMADO! Cliente: ${name.trim()}. Status: CONFIRMADO. Link: ${process.env.FRONTEND_URL}/contrato/${req.params.token}`
      : `CONTRATO NÃO CONFIRMADO! Cliente: ${contract.client_name || 'Não informado'}. Status: RECUSADO. Link: ${process.env.FRONTEND_URL}/contrato/${req.params.token}`;
    await sendSms(contract.id, message);
    res.json({status:decision,responseAt});
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({error:'Não foi possível registrar a resposta.'});
  } finally { client.release(); }
});

app.get('/api/contracts/:id/sms', requireAdmin, async (req,res) => {
  const result = await pool.query('SELECT status,message,created_at FROM sms_logs WHERE contract_id=$1 ORDER BY created_at DESC',[req.params.id]);
  res.json(result.rows);
});

const port = process.env.PORT || 3001;

await initDb();

await testConnection();

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;

if (email && password) {
  const exists = await pool.query(
    'SELECT id FROM admins WHERE email=$1',
    [email]
  );

  if (!exists.rowCount) {
    const hash = await bcrypt.hash(password, 12);

    await pool.query(
      'INSERT INTO admins(email,password_hash) VALUES($1,$2)',
      [email, hash]
    );

    console.log('Administrador criado com sucesso!');
  }
}

app.listen(port, () => {
  console.log(`API disponível em http://localhost:${port}`);
});