import { useEffect, useState } from 'react';

import {
  Hammer,
  Plus,
  Search,
  Copy,
  LogOut,
  FileText,
  CheckCircle2,
  Clock3,
  XCircle,
  Eye,
  EyeOff,
  Trash2
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

type Contract = {
  id: string;
  token: string;
  status: string;
  data: any;
  client_name?: string;
  created_at: string;
  response_at?: string;
};

const blank = {
  contractorName: 'Nova Madeira',
  contractorDocument: '',
  contractorAddress: '',
  contractorPhone: '',
  clientAddress: '',
  clientPhone: '',
  description: '',
  mdf: '',
  thickness: '',
  finish: '',
  hardware: '',
  totalValue: '',
  entry: '',
  secondPayment: '',
  balance: '',
  deadline: '',
  startDate: '',
  endDate: '',
  city: '',
  date: new Date().toISOString().slice(0, 10),
  extra: ''
};

const fieldLabels: Record<string, string> = {
  contractorName: 'Nome do contratado',
  contractorDocument: 'CPF/CNPJ do contratado',
  contractorAddress: 'Endereço do contratado',
  contractorPhone: 'Telefone do contratado',
  clientAddress: 'Endereço do cliente',
  clientPhone: 'Telefone do cliente',
  description: 'Descrição dos móveis e serviços',
  mdf: 'Material / MDF',
  thickness: 'Espessura',
  finish: 'Cor e acabamento',
  hardware: 'Ferragens',
  totalValue: 'Valor total',
  entry: 'Valor da entrada',
  secondPayment: 'Segunda parcela',
  balance: 'Saldo restante',
  deadline: 'Prazo de entrega',
  startDate: 'Data de início',
  endDate: 'Data de término',
  city: 'Cidade',
  date: 'Data do contrato',
  extra: 'Observações adicionais'
};

async function request(
  path: string,
  opts: any = {},
  token?: string
) {
  const response = await fetch(API + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {})
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Erro na solicitação.');
  }

  return data;
}

export default function App() {

  const [auth, setAuth] = useState(
    localStorage.getItem('nm-token') || ''
  );

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [query, setQuery] = useState('');

  const [form, setForm] = useState<any>(blank);
  const [editing, setEditing] = useState(false);

  const [link, setLink] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [publicContract, setPublicContract] = useState<any>(null);
  const [clientName, setClientName] = useState('');
  const [cpf, setCpf] = useState('');

  const token = location.pathname.startsWith('/contrato/')
    ? location.pathname.split('/')[2]
    : '';

  // CARREGAR CONTRATOS

  async function load() {
    if (!auth) return;

    try {
      const data = await request('/api/contracts', {}, auth);
      setContracts(data);
      setError('');
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function deleteContract(id: string) {
  const confirmed = window.confirm(
    'Tem certeza que deseja excluir este contrato?'
  );

  if (!confirmed) return;

  try {
    await request(`/api/contracts/${id}`, {
      method: 'DELETE'
    }, auth);

    setContracts(prev =>
      prev.filter(contract => contract.id !== id)
    );

    setError('');
  } catch (e: any) {
    setError(e.message);
  }
}

  useEffect(() => {
    load();
  }, [auth]);

  // CARREGAR CONTRATO PÚBLICO

  useEffect(() => {
    if (!token) return;

    request('/api/public/contracts/' + token)
      .then(setPublicContract)
      .catch((e: any) => setError(e.message));

  }, [token]);

  // LOGIN

  async function login(e: any) {
    e.preventDefault();

    setLoading(true);
    setError('');

    try {
      const data = await request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });

      localStorage.setItem('nm-token', data.token);
      setAuth(data.token);

    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // CRIAR CONTRATO

  async function create(e: any) {
    e.preventDefault();

    setLoading(true);
    setError('');

    try {
      const data = await request(
        '/api/contracts',
        {
          method: 'POST',
          body: JSON.stringify({ data: form })
        },
        auth
      );

      await request(
        `/api/contracts/${data.id}/publish`,
        {
          method: 'POST',
          body: '{}'
        },
        auth
      );

      setLink(`${location.origin}/contrato/${data.token}`);
      setEditing(false);

      setForm({ ...blank });
      await load();

    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // RESPONDER CONTRATO

  async function respond(decision: string) {
    setLoading(true);
    setError('');

    try {
      await request(
        '/api/public/contracts/' + token + '/respond',
        {
          method: 'POST',
          body: JSON.stringify({
            decision,
            name: clientName,
            cpf
          })
        }
      );

      const data = await request(
        '/api/public/contracts/' + token
      );

      setPublicContract(data);

    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // CONTRATO PÚBLICO

  if (token) {
    return (
      <main className="public">
        <article className="paper">

          <img className="logo" src="/logo.png" alt="Nova Madeira" />

          <h1>
            CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE MARCENARIA
          </h1>

          {publicContract ? (
            <>
              <p>
                <b>CONTRATANTE:</b>{' '}
                {publicContract.client_name || 'A ser preenchido pelo cliente'}
              </p>

              <p>
                <b>CONTRATADO:</b>{' '}
                {publicContract.data.contractorName}
              </p>

              {[
                ['Descrição dos móveis e serviços', publicContract.data.description],
                ['Material / MDF', publicContract.data.mdf],
                ['Espessura', publicContract.data.thickness],
                ['Cor e acabamento', publicContract.data.finish],
                ['Ferragens', publicContract.data.hardware],
                ['Valor total', publicContract.data.totalValue],
                ['Entrada', publicContract.data.entry],
                ['Segunda parcela', publicContract.data.secondPayment],
                ['Saldo restante', publicContract.data.balance],
                ['Prazo de entrega', publicContract.data.deadline],
                ['Endereço de instalação', publicContract.data.clientAddress],
                ['Observações adicionais', publicContract.data.extra]
              ].map(([label, value]) => (
                <p key={label}>
                  <b>{label}:</b> {value || '—'}
                </p>
              ))}

              <h3>CONDIÇÕES DO CONTRATO</h3>

              <p>
                O serviço será executado conforme as especificações
                e condições apresentadas. Alterações deverão ser
                previamente aprovadas pelas partes.
              </p>

              <p className="status">
                SITUAÇÃO:{' '}
                {publicContract.status === 'PENDING'
                  ? 'AGUARDANDO CONFIRMAÇÃO'
                  : publicContract.status === 'CONFIRMED'
                  ? 'CONTRATO CONFIRMADO'
                  : publicContract.status === 'REJECTED'
                  ? 'CONTRATO RECUSADO'
                  : 'RASCUNHO'}
              </p>

              {publicContract.status === 'PENDING' && (
                <>
                  <h3>IDENTIFICAÇÃO DO CONTRATANTE</h3>

                  <input
                    placeholder="Nome completo"
                    value={clientName}
                    onChange={e => setClientName(e.target.value)}
                  />

                  <input
                    placeholder="CPF"
                    value={cpf}
                    onChange={e => setCpf(e.target.value)}
                  />

                  <button
                    className="green"
                    disabled={loading}
                    onClick={() => respond('CONFIRMED')}
                  >
                    {loading ? 'AGUARDE...' : 'CONFIRMAR CONTRATO'}
                  </button>

                  <button
                    className="muted"
                    disabled={loading}
                    onClick={() => respond('REJECTED')}
                  >
                    NÃO CONFIRMAR
                  </button>

                  <small>
                    Ao confirmar, você declara que leu e concorda
                    com as condições apresentadas.
                  </small>
                </>
              )}
            </>
          ) : (
            <p>Carregando contrato...</p>
          )}

        </article>

        {error && <p className="error">{error}</p>}
      </main>
    );
  }

  // LOGIN ADMINISTRATIVO

  if (!auth) {
    return (
      <main className="login">

        <form onSubmit={login}>

          <img src="/logo.png" alt="Nova Madeira" />

          <h1>Área administrativa</h1>

          <input
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />

          <div className="password-field">

            <input
              type={mostrarSenha ? 'text' : 'password'}
              placeholder="Senha"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />

            <button
              type="button"
              className="password-toggle"
              onClick={() => setMostrarSenha(!mostrarSenha)}
              aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
            >
              {mostrarSenha
                ? <EyeOff size={20} />
                : <Eye size={20} />
              }
            </button>

          </div>

          <button type="submit" disabled={loading}>
            {loading ? 'ENTRANDO...' : 'ENTRAR'}
          </button>

          {error && <p className="error">{error}</p>}

        </form>

      </main>
    );
  }

  // PAINEL ADMINISTRATIVO

  return (
    <main className="admin">

      <header>

        <div className="brand">
          <img src="/logo.png" alt="Nova Madeira" />
          <span>CONTRATOS</span>
        </div>

        <button
          className="outline"
          onClick={() => {
            localStorage.removeItem('nm-token');
            setAuth('');
          }}
        >
          <LogOut size={16} /> Sair
        </button>

      </header>

      <section className="toolbar">

        <div>
          <h1>Contratos</h1>
          <p>Gerencie seus contratos de marcenaria.</p>
        </div>

        <button
          onClick={() => {
            setForm({ ...blank });
            setEditing(true);
            setError('');
          }}
        >
          <Plus size={18} /> NOVO CONTRATO
        </button>

      </section>

      <section className="stats">

        <div>
          <Clock3 />
          <b>{contracts.filter(c => c.status === 'PENDING').length}</b>
          <span>Aguardando</span>
        </div>

        <div>
          <CheckCircle2 />
          <b>{contracts.filter(c => c.status === 'CONFIRMED').length}</b>
          <span>Confirmados</span>
        </div>

        <div>
          <XCircle />
          <b>{contracts.filter(c => c.status === 'REJECTED').length}</b>
          <span>Recusados</span>
        </div>

      </section>

      {link && (
        <div className="linkbox">

          <span>Link do contrato criado:</span>

          <a href={link} target="_blank" rel="noreferrer">
            {link}
          </a>

          <button
            onClick={() => navigator.clipboard.writeText(link)}
          >
            <Copy size={16} /> Copiar
          </button>

        </div>
      )}

      {editing ? (

        <form className="editor" onSubmit={create}>

          <h2>Novo contrato</h2>

          <div className="fields">

            {Object.entries(form).map(([key, value]) => (
              <label key={key}>

                {fieldLabels[key] || key}

                <input
                  type={key === 'date' || key === 'startDate' || key === 'endDate'
                    ? 'date'
                    : 'text'}
                  value={String(value)}
                  onChange={e =>
                    setForm({
                      ...form,
                      [key]: e.target.value
                    })
                  }
                />

              </label>
            ))}

          </div>

          <p className="hint">
            O nome completo e o CPF do contratante serão
            preenchidos pelo cliente ao acessar o link individual.
          </p>

          <button type="submit" disabled={loading}>
            {loading ? 'GERANDO...' : 'GERAR CONTRATO E LINK'}
          </button>

          <button
            type="button"
            className="muted"
            onClick={() => {
              setEditing(false);
              setError('');
            }}
          >
            CANCELAR
          </button>

        </form>

      ) : (

        <>

          <div className="search">

            <Search />

            <input
              placeholder="Pesquisar cliente ou contratado..."
              value={query}
              onChange={e => setQuery(e.target.value)}
            />

          </div>

          <div className="list">

            {contracts
              .filter(c =>
                JSON.stringify(c.data)
                  .toLowerCase()
                  .includes(query.toLowerCase()) ||
                (c.client_name || '')
                  .toLowerCase()
                  .includes(query.toLowerCase())
              )
              .map(c => (

                <div className="contract" key={c.id}>

                  <FileText />

                  <div>
                    <b>
                      {c.client_name ||
                        c.data.contractorName ||
                        'Novo contrato'}
                    </b>

                    <small>
                      {new Date(c.created_at).toLocaleDateString('pt-BR')}
                    </small>
                  </div>

                  <span className={'badge ' + c.status}>
                    {c.status === 'PENDING'
                      ? 'PENDENTE'
                      : c.status === 'CONFIRMED'
                      ? 'CONFIRMADO'
                      : c.status === 'REJECTED'
                      ? 'RECUSADO'
                      : 'RASCUNHO'}
                  </span>

                  <button
                    className="outline"
                    onClick={() =>
                      navigator.clipboard.writeText(
                        `${location.origin}/contrato/${c.token}`
                      )
                    }
                  >
                    <Copy size={15} /> Link
                  </button>
                  <button
  type="button"
  className="delete-button"
  title="Excluir contrato"
  onClick={() => deleteContract(c.id)}
>
  <Trash2 size={17} />
</button>
                </div>

              ))}

            {contracts.length === 0 && (
              <p>Nenhum contrato cadastrado ainda.</p>
            )}

          </div>

        </>

      )}

      {error && <p className="error">{error}</p>}

    </main>
  );
}