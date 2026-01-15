import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot, 
  updateDoc, 
  doc 
} from 'firebase/firestore';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  signInWithCustomToken 
} from 'firebase/auth';
import { 
  CheckCircle, 
  AlertTriangle, 
  Edit3, 
  Search, 
  Truck, 
  Check,
  User,
  MapPin,
  ClipboardList,
  RefreshCw
} from 'lucide-react';

// Firebase configuration
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'address-fix-pro';

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('admin'); // 'admin', 'customer', 'customer_edit'
  const [verifications, setVerifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [submitted, setSubmitted] = useState(false);

  // Dados capturados da URL para a cliente
  const [customerData, setCustomerData] = useState({
    orderId: '---',
    name: 'Cliente',
    address: 'Endereço não carregado'
  });
  const [newAddress, setNewAddress] = useState('');

  // 1. Lógica de Autenticação e Captura de URL
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) { console.error("Erro Auth:", err); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);

    // Captura parâmetros da URL para identificar a cliente
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'customer') {
      setView('customer');
      setCustomerData({
        orderId: params.get('orderId') || 'S/N',
        name: params.get('name') || 'Cliente',
        address: params.get('address') || 'Confirme seu endereço abaixo'
      });
    }

    return () => unsubscribe();
  }, []);

  // 2. Busca de Dados (Painel Admin)
  useEffect(() => {
    if (!user || view !== 'admin') return;

    const q = collection(db, 'artifacts', appId, 'public', 'data', 'verifications');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setVerifications(data.sort((a, b) => b.createdAt - a.createdAt));
      setLoading(false);
    }, (err) => {
      console.error("Erro Firestore:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, view]);

  // Handler: Cliente envia resposta
  const handleConfirm = async (status, updatedData = null) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'verifications'), {
        orderId: customerData.orderId,
        customerName: customerData.name,
        originalAddress: customerData.address,
        status: status, // 'confirmed' ou 'needs_change'
        updatedAddress: updatedData || '',
        syncedWithCarrier: false,
        createdAt: Date.now()
      });
      setSubmitted(true);
    } catch (err) { console.error("Erro ao enviar:", err); }
  };

  // Handler: Admin marca como atualizado na transportadora
  const markAsSynced = async (docId) => {
    if (!user) return;
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'verifications', docId);
    await updateDoc(docRef, { syncedWithCarrier: true });
  };

  const filteredVerifications = verifications.filter(v => 
    v.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    v.orderId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // TELA DO CLIENTE (O que ela vê no celular)
  if (view === 'customer') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans text-slate-800">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 border border-gray-100">
          {!submitted ? (
            <>
              <div className="text-center mb-8">
                <div className="bg-pink-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-pink-100">
                  <MapPin className="text-pink-500" size={36} />
                </div>
                <h1 className="text-2xl font-black text-slate-800">Tudo certo com a entrega?</h1>
                <p className="text-slate-500 text-sm mt-3 leading-relaxed">
                  Oi, <span className="font-bold text-pink-500">{customerData.name}</span>! Queremos que seu pedido chegue rápido. Por favor, confira seu endereço:
                </p>
              </div>

              <div className="space-y-6">
                <div className="bg-slate-50 p-5 rounded-2xl border-2 border-slate-100 shadow-inner">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Endereço do Pedido {customerData.orderId}</p>
                  <p className="text-slate-700 font-medium leading-relaxed">{customerData.address}</p>
                </div>

                <div className="flex flex-col gap-3">
                  <button 
                    onClick={() => handleConfirm('confirmed')}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-emerald-100 transition-all active:scale-95"
                  >
                    <CheckCircle size={24} /> SIM, ESTÁ CORRETO!
                  </button>
                  <button 
                    onClick={() => setView('customer_edit')}
                    className="w-full bg-white border-2 border-slate-200 text-slate-500 hover:border-pink-500 hover:text-pink-500 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95"
                  >
                    <Edit3 size={18} /> NÃO, PRECISO ALTERAR
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 animate-in fade-in zoom-in duration-500">
              <div className="bg-emerald-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="text-emerald-500" size={48} />
              </div>
              <h2 className="text-2xl font-black text-slate-800">Confirmado!</h2>
              <p className="text-slate-500 mt-4 leading-relaxed">Obrigada! Sua confirmação foi enviada para nosso time de logística. Agora é só aguardar seu pedido! ✨</p>
            </div>
          )}
          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <p className="text-[10px] text-slate-300 font-bold tracking-widest uppercase">Equipe de Logística Fleurity</p>
          </div>
        </div>
      </div>
    );
  }

  // TELA DE EDIÇÃO DO CLIENTE
  if (view === 'customer_edit') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans text-slate-800">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8">
          <div className="mb-6 flex items-center gap-3 text-pink-500">
            <Edit3 size={24} />
            <h2 className="text-xl font-black">Qual o endereço correto?</h2>
          </div>
          <p className="text-sm text-slate-500 mb-4">Por favor, digite o endereço completo, incluindo CEP, número e qualquer ponto de referência.</p>
          <textarea 
            className="w-full border-2 border-slate-100 rounded-2xl p-5 h-40 focus:border-pink-500 focus:ring-4 focus:ring-pink-50 outline-none transition-all text-slate-700 font-medium"
            placeholder="Ex: Rua das Flores, 123, Apto 10, CEP 01234-000, Próximo à padaria..."
            onChange={(e) => setNewAddress(e.target.value)}
          />
          <button 
            disabled={!newAddress || newAddress.length < 10}
            onClick={() => handleConfirm('needs_change', newAddress)}
            className="w-full bg-pink-500 hover:bg-pink-600 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black py-5 rounded-2xl mt-6 shadow-xl shadow-pink-100 transition-all active:scale-95"
          >
            ATUALIZAR ENDEREÇO
          </button>
          <button onClick={() => setView('customer')} className="w-full text-slate-400 mt-6 text-sm font-bold hover:text-slate-600">Voltar para conferência</button>
        </div>
      </div>
    );
  }

  // TELA DO ADMINISTRADOR (O seu Dashboard/Planilha)
  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-10 font-sans text-slate-800">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <div className="flex items-center gap-2 text-pink-500 font-bold mb-2 tracking-tighter uppercase text-sm">
              <Truck size={16} /> Central de Logística
            </div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">Verificação de Entregas</h1>
            <p className="text-slate-500 mt-2 font-medium">Confira as respostas das clientes antes de gerar as etiquetas.</p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => window.location.href = window.location.pathname + '?view=customer&orderId=EX-123&name=Maria&address=Rua Exemplo, 10'}
              className="bg-white border-2 border-slate-200 text-slate-600 px-6 py-3 rounded-2xl font-bold hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm"
            >
              <RefreshCw size={18} /> Testar Link Cliente
            </button>
          </div>
        </header>

        {/* Status Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <p className="text-slate-400 text-xs font-black uppercase mb-1">Total de Respostas</p>
            <p className="text-3xl font-black text-slate-900">{verifications.length}</p>
          </div>
          <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100">
            <p className="text-emerald-600 text-xs font-black uppercase mb-1">Endereços Confirmados</p>
            <p className="text-3xl font-black text-emerald-700">{verifications.filter(v => v.status === 'confirmed').length}</p>
          </div>
          <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100">
            <p className="text-amber-600 text-xs font-black uppercase mb-1">Alterações Solicitadas</p>
            <p className="text-3xl font-black text-amber-700">{verifications.filter(v => v.status === 'needs_change').length}</p>
          </div>
        </div>

        {/* Tabela Principal */}
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center gap-4 bg-slate-50/50">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input 
                type="text" 
                placeholder="Filtrar por nome ou pedido..." 
                className="w-full pl-12 pr-4 py-3 bg-white border-2 border-slate-100 rounded-2xl focus:border-pink-500 outline-none transition-all font-medium"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[11px] font-black text-slate-400 uppercase tracking-widest bg-slate-50">
                  <th className="px-8 py-5">Status Cliente</th>
                  <th className="px-8 py-5">Pedido / Cliente</th>
                  <th className="px-8 py-5">Endereço de Entrega</th>
                  <th className="px-8 py-5 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan="4" className="px-8 py-20 text-center text-slate-400 font-bold">Carregando base de dados...</td></tr>
                ) : filteredVerifications.length === 0 ? (
                  <tr><td colSpan="4" className="px-8 py-20 text-center text-slate-400 font-bold">Nenhuma resposta encontrada.</td></tr>
                ) : filteredVerifications.map((v) => (
                  <tr key={v.id} className={`${v.syncedWithCarrier ? 'opacity-40 grayscale' : ''} hover:bg-slate-50/50 transition-all`}>
                    <td className="px-8 py-6">
                      {v.status === 'confirmed' ? (
                        <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm bg-emerald-50 px-3 py-1.5 rounded-full w-fit">
                          <Check size={14} /> Confirmado
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-amber-600 font-bold text-sm bg-amber-50 px-3 py-1.5 rounded-full w-fit animate-pulse">
                          <AlertTriangle size={14} /> Corrigir Endereço
                        </div>
                      )}
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col">
                        <span className="text-slate-900 font-black text-lg">#{v.orderId}</span>
                        <span className="text-sm text-slate-500 font-bold flex items-center gap-1"><User size={12} /> {v.customerName}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="max-w-md">
                        {v.status === 'needs_change' ? (
                          <div className="bg-red-50 p-3 rounded-xl border border-red-100">
                            <p className="text-[9px] font-black text-red-400 uppercase mb-1">Novo Endereço Solicitado:</p>
                            <p className="text-sm text-red-900 font-bold leading-relaxed underline decoration-red-200">{v.updatedAddress}</p>
                          </div>
                        ) : (
                          <p className="text-sm text-slate-400 italic">Cliente confirmou o endereço original.</p>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-center">
                      {!v.syncedWithCarrier ? (
                        <button 
                          onClick={() => markAsSynced(v.id)}
                          className="bg-white border-2 border-slate-200 hover:border-emerald-500 hover:text-emerald-500 p-3 rounded-2xl transition-all shadow-sm hover:shadow-md"
                          title="Marcar como atualizado no sistema de frete"
                        >
                          <Truck size={24} />
                        </button>
                      ) : (
                        <div className="flex flex-col items-center text-slate-400 text-[10px] font-black italic">
                          <CheckCircle size={24} className="mb-1" /> CONFERIDO
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
