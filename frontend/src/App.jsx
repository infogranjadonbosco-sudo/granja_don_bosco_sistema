import { Routes, Route, Link, Navigate } from "react-router-dom"
import { useEffect, useState } from "react"
import { supabase } from "./supabase"
import { useCart } from "./context/CartContext"
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import ProductDetail from "./pages/ProductDetail";
import Checkout from "./pages/Checkout";
import Cart from "./pages/Cart";
import Profile from "./pages/Profile";
import PersonnelManagement from "./pages/PersonnelManagement";
import InventoryAlerts from "./pages/InventoryAlerts";
import EmployeeDashboard from "./pages/EmployeeDashboard";
import PublicLanding from "./pages/PublicLanding";
import TeamChat from "./pages/TeamChat";
import Receipts from "./pages/Receipts";
import GlobalSearch from "./components/GlobalSearch";

export default function App() {
  const [session, setSession] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [stockAlerts, setStockAlerts] = useState(0);
  const [chatAlerts, setChatAlerts] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const { cart } = useCart()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) {
        fetchPerfil(session.user.id)
      } else {
        setLoadingInitial(false)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        if (session) fetchPerfil(session.user.id)
        else {
          setPerfil(null)
          setLoadingInitial(false)
        }
      }
    )

    return () => listener.subscription.unsubscribe()
  }, [])

  const fetchPerfil = async (userId) => {
    try {
      const { data, error } = await supabase
        .from("usuarios")
        .select("*")
        .eq("id", userId)
        .maybeSingle()

      if (data) {
        setPerfil(data)
      } else {
        // Si el usuario no tiene perfil todavía, le armamos uno con su correo como CLIENTE por seguridad
        const email = session?.user?.email || ''
        const nombreEmail = email.split('@')[0]
        const nombre = nombreEmail.split('.').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
        setPerfil({ rol: 'cliente', nombre_completo: nombre, correo: email, departamento: 'Cliente Externo' })
      }
    } catch (err) {
      console.error("Error fetching profile:", err)
    } finally {
      setLoadingInitial(false)
    }
  }

  const fetchAlerts = async () => {
    if (!session?.user?.id) return;
    
    // 1. Alertas de Stock (Para todos)
    const { count: stockCount } = await supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .lt("stock", 10)
      .eq("deleted", false);
    setStockAlerts(stockCount || 0);

    // 2. Alertas de Chat (Para todos)
    try {
      const { data: myGroups } = await supabase.from('grupos_chat').select('id');
      const groupIds = myGroups?.map(g => g.id) || [];
      
      let query = supabase
        .from("mensajes_chat")
        .select("*", { count: "exact", head: true })
        .eq("leido", false)
        .neq("usuario_id", session.user.id);
      
      if (groupIds.length > 0) {
        query = query.or(`grupo_id.is.null,grupo_id.in.(${groupIds.join(',')})`);
      } else {
        query = query.is("grupo_id", null);
      }

      const { count: chatCount } = await query;
      setChatAlerts(chatCount || 0);
    } catch (err) {
      console.error("Error fetching chat alerts:", err);
    }
  };

  useEffect(() => {
    if (perfil) {
      fetchAlerts();
      const interval = setInterval(fetchAlerts, 30000); // Cada 30 seg
      return () => clearInterval(interval);
    }
  }, [perfil, session]);

  // Actualizar última conexión cada 2 minutos
  useEffect(() => {
    if (session?.user?.id) {
      const updateConnection = async () => {
        await supabase
          .from("usuarios")
          .update({ ultima_conexion: new Date().toISOString() })
          .eq("id", session.user.id);
      };
      updateConnection();
      const interval = setInterval(updateConnection, 120000);
      return () => clearInterval(interval);
    }
  }, [session]);

  const logout = () => {
    if (!window.confirm("¿Estás seguro de que deseas cerrar sesión?")) return;
    
    // Obtenemos el ID antes de que limpien la sesión
    const userId = session?.user?.id;
    
    const finalizeLogout = () => {
      supabase.auth.signOut().then(() => {
        window.location.href = "/";
      });
    };

    if (userId) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Intentamos cerrar la jornada pero no esperamos a que termine si tarda mucho
      supabase.from("jornadas")
        .select("tipo")
        .eq("usuario_id", userId)
        .gte("creado_at", today.toISOString())
        .order("creado_at", { ascending: false })
        .limit(1)
        .then(({ data }) => {
          if (data && data.length > 0 && data[0].tipo !== 'fin_jornada') {
            supabase.from("jornadas").insert([{
              usuario_id: userId,
              tipo: 'fin_jornada',
              tarea_id: null
            }]).finally(finalizeLogout);
          } else {
            finalizeLogout();
          }
        })
        .catch(finalizeLogout);
      
      // Si la base de datos tarda más de 2 segundos, forzamos la salida
      setTimeout(finalizeLogout, 2000);
    } else {
      finalizeLogout();
    }
  };

  // Lógica de Roles REAL
  const isAdmin = perfil?.rol === 'admin';

  if (loadingInitial) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#fdfbc0',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <div className="spinner"></div>
        <p style={{ color: '#1b5e20', fontWeight: 'bold' }}>Cargando Tienda Granja Don Bosco...</p>
      </div>
    )
  }

  if (!session) {
    return (
      <Routes>
        <Route path="/" element={<PublicLanding />} />
        <Route path="/login" element={<Login />} />
        <Route path="/product/:id" element={<ProductDetail />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    )
  }

  const styles = {
    navLink: {
      color: 'white',
      textDecoration: 'none',
      fontWeight: 'bold',
      fontSize: '1rem',
      padding: '5px 10px',
      borderRadius: '5px',
      transition: 'background-color 0.3s ease',
      '&:hover': {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
      }
    }
  };

  return (
    <div className="main-app-layout" style={{ minHeight: '100vh', backgroundColor: '#fdfbc0' }}>
      <nav className="navbar-fixed">
        <div className="navbar-links-group">
          {isAdmin && (
            <Link to="/dashboard" className="nav-item">📊 Administración</Link>
          )}
          <Link to="/employee-dashboard" className="nav-item">🏠 Gestión</Link>
          {isAdmin && (
            <Link to="/personnel" className="nav-item">👥 Personal</Link>
          )}
          <Link to="/products" className="nav-item">🛍️ Tienda</Link>
          <Link to="/cart" className="nav-item">🛒 Carrito ({cart.length})</Link>
          {(isAdmin || perfil?.rol === 'colaborador') && (
            <Link to="/receipts" className="nav-item">🧾 Recibos</Link>
          )}
          <Link to="/chat" className="nav-item">💬 Chat</Link>
        </div>

        <div className="navbar-user-group" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <GlobalSearch />

          <div style={{ position: 'relative' }}>
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="nav-item" 
              style={{ background: 'none', border: 'none', position: 'relative', fontSize: '1.4rem', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              title="Notificaciones"
            >
              🔔
              {(stockAlerts + chatAlerts) > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-5px',
                  right: '-5px',
                  backgroundColor: '#d32f2f',
                  color: 'white',
                  fontSize: '0.65rem',
                  padding: '2px 6px',
                  borderRadius: '10px',
                  border: '1px solid white',
                  fontWeight: 'bold'
                }}>
                  {stockAlerts + chatAlerts}
                </span>
              )}
            </button>

            {showNotifications && (
              <div style={{
                position: 'absolute',
                top: '40px',
                right: '0',
                width: '250px',
                background: 'white',
                borderRadius: '15px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                zIndex: 1000,
                padding: '10px 0',
                border: '1px solid #eee'
              }}>
                <div style={{ padding: '10px 15px', borderBottom: '1px solid #eee', fontSize: '0.9rem', fontWeight: 'bold', color: '#1b5e20' }}>
                  Centro de Notificaciones
                </div>
                
                {chatAlerts > 0 && (
                  <Link 
                    to="/chat" 
                    onClick={() => setShowNotifications(false)}
                    style={{ 
                      display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 15px', 
                      textDecoration: 'none', color: '#333', fontSize: '0.85rem', transition: 'background 0.2s' 
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <span>💬</span>
                    <div>
                      <p style={{ margin: 0, fontWeight: 'bold' }}>{chatAlerts} Mensajes nuevos</p>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: '#888' }}>Revisa tus últimos chats</p>
                    </div>
                  </Link>
                )}

                {stockAlerts > 0 && (
                  <Link 
                    to="/alerts" 
                    onClick={() => setShowNotifications(false)}
                    style={{ 
                      display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 15px', 
                      textDecoration: 'none', color: '#333', fontSize: '0.85rem', transition: 'background 0.2s' 
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <span>⚠️</span>
                    <div>
                      <p style={{ margin: 0, fontWeight: 'bold' }}>{stockAlerts} Alertas de stock</p>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: '#888' }}>{isAdmin ? 'Gestionar inventario' : 'Notificar al administrador'}</p>
                    </div>
                  </Link>
                )}

                {chatAlerts === 0 && (!isAdmin || stockAlerts === 0) && (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#999', fontSize: '0.85rem' }}>
                    No hay notificaciones nuevas
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="user-profile-mini">
            <span style={{ fontSize: '1.2rem' }}>{isAdmin ? '👑' : '👤'}</span>
            <Link to="/profile" className="user-profile-name">
              Mi Perfil
            </Link>
          </div>
          <button onClick={() => logout()} className="logout-btn-nav">Salir</button>
        </div>
      </nav>

      <div className="app-content-area">
        <Routes>
          <Route path="/" element={<Navigate to={isAdmin ? "/dashboard" : "/employee-dashboard"} />} />
          <Route path="/store" element={<PublicLanding />} />
          {isAdmin && (
            <>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/personnel" element={<PersonnelManagement />} />
            </>
          )}
          {(isAdmin || perfil?.rol === 'colaborador') && (
            <>
              <Route path="/employee-dashboard" element={<EmployeeDashboard />} />
              <Route path="/receipts" element={<Receipts />} />
              <Route path="/chat" element={<TeamChat />} />
              <Route path="/alerts" element={<InventoryAlerts />} />
            </>
          )}
          <Route path="/products" element={<Products />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </div>
  )
}
 
