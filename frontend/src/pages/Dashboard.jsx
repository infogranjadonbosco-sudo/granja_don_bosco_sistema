import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const navigate = useNavigate();
  const [products, setProducts] = useState(0);
  const [recentOrders, setRecentOrders] = useState([]);
  const [totalOrdersToday, setTotalOrdersToday] = useState(0);
  const [totalSales, setTotalSales] = useState(0);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [perfil, setPerfil] = useState(null);
  const [colaboradores, setColaboradores] = useState([]);
  const [anuncio, setAnuncio] = useState("¡Bienvenido a Granja Don Bosco! 🚜✨");
  const [isEditingAnuncio, setIsEditingAnuncio] = useState(false);
  const [nuevoAnuncio, setNuevoAnuncio] = useState("");
  const [visibilidad, setVisibilidad] = useState("todos"); // todos, colaboradores, solo_yo, personal
  const [usuarioDestino, setUsuarioDestino] = useState("");
  const [listaUsuarios, setListaUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    fetchAnuncio();
    const interval = setInterval(loadData, 30000); // Auto-refrescamos cada 30 segundos
    return () => clearInterval(interval);
  }, []);

  const fetchAnuncio = async () => {
    const { data } = await supabase.from('configuracion').select('valor').eq('id', 'anuncio_dia').maybeSingle();
    if (data && data.valor) {
      try {
        const obj = JSON.parse(data.valor);
        setAnuncio(obj.text);
        setNuevoAnuncio(obj.text);
        setVisibilidad(obj.visibilidad || 'todos');
        setUsuarioDestino(obj.usuarioDestino || '');
      } catch (e) {
        // Si no es JSON, es texto plano de actividad mas previa
        setAnuncio(data.valor);
        setNuevoAnuncio(data.valor);
        setVisibilidad('todos');
      }
    }
  };

  const handleSaveAnuncio = async () => {
    const payload = JSON.stringify({
      text: nuevoAnuncio,
      visibilidad: visibilidad,
      usuarioDestino: usuarioDestino
    });

    const { error } = await supabase.from('configuracion').upsert({ id: 'anuncio_dia', valor: payload });
    if (!error) {
      setAnuncio(nuevoAnuncio);
      setIsEditingAnuncio(false);
      alert("✅ Anuncio actualizado con éxito");
    } else {
      console.error("Error al guardar anuncio:", error);
      alert("❌ Error al guardar: " + error.message);
    }
  };

  const loadData = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: pData } = await supabase.from("usuarios").select("*").eq("id", user.id).maybeSingle();
      setPerfil(pData);
    }

    const { count: productCount } = await supabase.from("products").select("*", { count: "exact", head: true });
    const { count: ordersTodayCount } = await supabase.from("orders").select("*", { count: "exact", head: true }).gte("created_at", todayISO);
    // Consulta simplificada para asegurarnos que los registros aparezcan
    const { data: recentData } = await supabase
      .from("orders")
      .select("*")
      .gte("created_at", todayISO)
      .order("created_at", { ascending: false })
      .limit(10);
    const { data: salesData } = await supabase.from("orders").select("total").gte("created_at", todayISO);

    const totalSum = salesData?.reduce((sum, o) => sum + Number(o.total), 0) || 0;

    const { data: lowStock } = await supabase.from("products").select("name, stock").lt("stock", 10).limit(5);

    // Traemos la lista de colaboradores para mostrar quién está activo
    const { data: users } = await supabase.from("usuarios").select("*").eq("rol", "colaborador");
    const colabsConEstado = await Promise.all((users || []).map(async (u) => {
      const { data: lastJornada } = await supabase
        .from("jornadas")
        .select("tipo, creado_at, tareas(nombre)")
        .eq("usuario_id", u.id)
        .gte("creado_at", todayISO)
        .order("creado_at", { ascending: false })
        .limit(1);

      let estado = "fuera";
      let tareaActual = null;
      if (lastJornada && lastJornada.length > 0) {
        const last = lastJornada[0];
        tareaActual = last.tareas?.nombre || null;
        if (["inicio_jornada", "fin_almuerzo", "fin_receso"].includes(last.tipo)) estado = "trabajando";
        else if (last.tipo === "inicio_almuerzo") estado = "almuerzo";
        else if (last.tipo === "inicio_receso") estado = "receso";
      }
      return { ...u, estado, tareaActual };
    }));

    // Traemos todos los usuarios para la selección de destinatario
    const { data: allUsers } = await supabase.from("usuarios").select("*").order('nombre_completo');
    setListaUsuarios(allUsers || []);

    setProducts(productCount || 0);
    setTotalOrdersToday(ordersTodayCount || 0);
    setRecentOrders(recentData || []);
    setTotalSales(totalSum);
    setLowStockProducts(lowStock || []);

    // Traemos todos los usuarios para monitoreo exhaustivo (incluyendo admins si se desea)
    const { data: allUsersForStatus } = await supabase.from("usuarios").select("*").order('nombre_completo');

    const colabsConEstadoRefined = await Promise.all((allUsersForStatus || []).filter(u => u.rol !== 'cliente').map(async (u) => {
      const { data: lastJornada } = await supabase
        .from("jornadas")
        .select("tipo, creado_at, tareas(nombre)")
        .eq("usuario_id", u.id)
        .gte("creado_at", todayISO)
        .order("creado_at", { ascending: false })
        .limit(1);

      let estado = "fuera";
      let tareaActual = null;
      if (lastJornada && lastJornada.length > 0) {
        const last = lastJornada[0];
        tareaActual = last.tareas?.nombre || null;
        if (["inicio_jornada", "fin_almuerzo", "fin_receso"].includes(last.tipo)) estado = "trabajando";
        else if (last.tipo === "inicio_almuerzo") estado = "almuerzo";
        else if (last.tipo === "inicio_receso") estado = "receso";
      }
      return { ...u, estado, tareaActual };
    }));

    setColaboradores(colabsConEstadoRefined);
    setLoading(false);
  };

  const getEstadoInfo = (estado) => {
    const map = {
      trabajando: { color: '#2e7d32', bg: '#e8f5e9', label: 'En labor' },
      almuerzo: { color: '#f57c00', bg: '#fff3e0', label: 'Almuerzo' },
      receso: { color: '#1976d2', bg: '#e3f2fd', label: 'Receso' },
      fuera: { color: '#666', bg: '#f5f5f5', label: 'Ausente' }
    };
    return map[estado] || map.fuera;
  };

  const trabajando = colaboradores.filter(c => c.estado === 'trabajando').length;

  if (loading) return <div style={{ padding: '50px', textAlign: 'center' }}>Cargando panel...</div>;

  return (
    <div style={{ padding: '30px', backgroundColor: '#fdfbc0', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>

      {/* HEADER */}
      <div style={styles.newHeader}>
        <div>
          <h1 style={{ color: '#1b5e20', margin: 0, fontSize: '1.8rem' }}>📊 Panel Administrativo</h1>
          <p style={{ margin: '5px 0 0 0', color: '#666', fontSize: '0.9rem' }}>
            {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div style={styles.headerActions}>
          <button onClick={() => navigate('/products')} style={styles.primaryBtn}>🛍️ Gestionar Productos</button>
          <button onClick={() => navigate('/personnel')} style={styles.secondaryBtn}>👥 Personal</button>
        </div>
      </div>

      {/* BIENVENIDA Y ANUNCIO */}
      <div style={styles.welcomeRow}>
        <div style={styles.welcomeInfo}>
          <span style={{ fontSize: '1.5rem' }}>👋</span>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', color: '#333' }}>¡Hola, {perfil?.nombre_completo?.split(' ')[0] || 'Admin'}!</h3>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#888' }}>Revisa la actividad de hoy</p>
          </div>
        </div>
        <div style={styles.compactAnnouncement} onClick={() => setIsEditingAnuncio(true)}>
          <span style={{ fontSize: '1.2rem' }}>📢</span>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <p style={styles.announcementText}>
              <b>Aviso del día:</b> {anuncio}
              <span style={{ fontSize: '0.7rem', opacity: 0.7, fontStyle: 'italic', marginLeft: '5px' }}>
                ({visibilidad === 'todos' ? '🌍 Público' : visibilidad === 'colaboradores' ? '👷 Solo Colab.' : visibilidad === 'solo_yo' ? '🔒 Privado' : '👤 Personal'})
              </span>
            </p>
          </div>
          <span style={{ fontSize: '0.65rem', color: '#1b5e20', fontWeight: 'bold' }}>CAMBIAR ✏️</span>
        </div>
      </div>

      {/* LAYOUT PRINCIPAL */}
      <div style={styles.mainLayout}>
        <div style={styles.leftCol}>
          {/* STATS */}
          <div style={styles.statsGrid}>
            <div style={styles.miniCard}>
              <span style={styles.miniIcon}>📦</span>
              <div><p style={styles.miniLabel}>Órdenes Hoy</p><p style={styles.miniValue}>{totalOrdersToday}</p></div>
            </div>
            <div style={styles.miniCard}>
              <span style={styles.miniIcon}>💰</span>
              <div><p style={styles.miniLabel}>Ventas Hoy</p><p style={styles.miniValue}>${totalSales.toFixed(2)}</p></div>
            </div>
            <div style={styles.miniCard}>
              <span style={styles.miniIcon}>👨‍🌾</span>
              <div><p style={styles.miniLabel}>Activos</p><p style={styles.miniValue}>{trabajando}/{colaboradores.length}</p></div>
            </div>
          </div>

          {/* EQUIPO */}
          <div style={styles.sectionCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ color: '#1b5e20', margin: 0, fontSize: '1.1rem' }}>🚜 Monitoreo en Tiempo Real</h2>
              <span style={styles.badge}>{trabajando} TRABAJANDO</span>
            </div>
            <div style={styles.teamGrid}>
              {colaboradores.map(c => {
                const info = getEstadoInfo(c.estado);
                const initials = (c.nombre_completo || '??').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

                // Determinamos si está en línea (actividad en app hace menos de 5 min)
                const isOnline = c.ultima_conexion && (new Date() - new Date(c.ultima_conexion) < 300000);

                return (
                  <div key={c.id} style={{ ...styles.personRow, borderLeft: `3px solid ${info.color}`, position: 'relative' }}>
                    <div style={{ ...styles.avatar, background: info.bg, color: info.color }}>
                      {initials}
                      {isOnline && (
                        <span style={{
                          position: 'absolute',
                          bottom: '5px',
                          left: '35px',
                          width: '10px',
                          height: '10px',
                          backgroundColor: '#4caf50',
                          borderRadius: '50%',
                          border: '2px solid white',
                          boxShadow: '0 0 5px rgba(76, 175, 80, 0.5)'
                        }} title="En línea ahora"></span>
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={styles.personName}>
                        {c.nombre_completo}
                        {c.rol === 'admin' && <span style={{ fontSize: '0.6rem', marginLeft: '5px', opacity: 0.6 }}>👑</span>}
                      </p>
                      <p style={styles.personStatus}>
                        <b style={{ color: info.color }}>{info.label}</b>
                        {c.tareaActual && c.estado === 'trabajando' && ` en ${c.tareaActual}`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div style={styles.rightCol}>
          {/* ALERTAS */}
          {lowStockProducts.length > 0 && (
            <div style={styles.alertCard}>
              <h3 style={{ color: '#d32f2f', margin: '0 0 10px 0', fontSize: '0.85rem' }}>⚠️ ALERTAS DE STOCK</h3>
              {lowStockProducts.map((p, idx) => (
                <div key={idx} style={styles.alertSmall}>
                  <span>{p.name}</span> <b style={{ color: '#d32f2f' }}>{p.stock}</b>
                </div>
              ))}
            </div>
          )}

          {/* ÚLTIMOS PEDIDOS */}
          <div style={styles.sectionCard}>
            <h3 style={{ color: '#1b5e20', margin: '0 0 15px 0', fontSize: '1rem' }}>🕒 Últimos Movimientos</h3>
            {recentOrders.map(o => {
              const dateObj = new Date(o.created_at);
              const formattedDateTime = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              return (
                <div
                  key={o.id}
                  style={{ ...styles.listItem, cursor: 'pointer' }}
                  onClick={() => navigate(`/receipts?id=${o.id}`)}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f9f9f9'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <div>
                    <p style={{ margin: 0, fontWeight: 'bold', fontSize: '0.8rem' }}>#{o.id.toString().slice(0, 5)}</p>
                    <p style={{ margin: 0, fontSize: '0.65rem', color: '#888' }}>{formattedDateTime}</p>
                    {o.usuarios ? (
                      <p style={{ margin: '2px 0 0 0', fontSize: '0.65rem', color: '#1b5e20', fontWeight: 'bold' }}>
                        👤 {o.usuarios.nombre_completo}
                      </p>
                    ) : (
                      <p style={{ margin: '2px 0 0 0', fontSize: '0.65rem', color: o.nombre_cliente ? '#1b5e20' : '#f57c00', fontWeight: 'bold' }}>
                        {o.nombre_cliente ? `👤 ${o.nombre_cliente}` : '🛒 Cliente Visitante'}
                      </p>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ margin: 0, fontWeight: 'bold', color: '#1b5e20', fontSize: '0.85rem' }}>${Number(o.total).toFixed(2)}</p>
                    <p style={{ margin: '2px 0 0 0', fontSize: '0.6rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {o.metodo_pago === 'tarjeta' ? '💳 Tarjeta' : '💵 Efectivo'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* MODO ANUNCIO */}
      {isEditingAnuncio && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h3 style={{ color: '#1b5e20', marginTop: 0 }}>📢 Configurar Anuncio</h3>

            <label style={styles.modalLabel}>Mensaje del Anuncio:</label>
            <textarea
              value={nuevoAnuncio}
              onChange={(e) => setNuevoAnuncio(e.target.value)}
              style={styles.modalTextarea}
              placeholder="Escribe el anuncio aquí..."
            />

            <label style={styles.modalLabel}>¿Quién podrá ver este mensaje?</label>
            <select
              value={visibilidad}
              onChange={(e) => setVisibilidad(e.target.value)}
              style={styles.modalSelect}
            >
              <option value="todos">🌍 Todos los usuarios</option>
              <option value="colaboradores">👷 Solo Colaboradores</option>
              <option value="solo_yo">🔒 Solo yo (Admin)</option>
              <option value="personal">👤 Un usuario en específico</option>
            </select>

            {visibilidad === 'personal' && (
              <div style={{ marginTop: '10px' }}>
                <label style={styles.modalLabel}>Seleccionar Usuario Destino:</label>
                <select
                  value={usuarioDestino}
                  onChange={(e) => setUsuarioDestino(e.target.value)}
                  style={styles.modalSelect}
                >
                  <option value="">-- Seleccionar persona --</option>
                  {listaUsuarios.map(u => (
                    <option key={u.id} value={u.id}>{u.nombre_completo} ({u.rol})</option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button onClick={() => setIsEditingAnuncio(false)} style={styles.modalCancel}>Cancelar</button>
              <button
                onClick={handleSaveAnuncio}
                style={styles.modalSave}
                disabled={visibilidad === 'personal' && !usuarioDestino}
              >
                Guardar y Publicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  newHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' },
  headerActions: { display: 'flex', gap: '10px' },
  primaryBtn: { backgroundColor: '#1b5e20', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '25px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' },
  secondaryBtn: { backgroundColor: 'white', color: '#1b5e20', border: '2px solid #1b5e20', padding: '8px 20px', borderRadius: '25px', fontWeight: 'bold', cursor: 'pointer' },
  welcomeRow: { display: 'flex', gap: '20px', marginBottom: '30px', alignItems: 'center', flexWrap: 'wrap' },
  welcomeInfo: { display: 'flex', alignItems: 'center', gap: '12px', background: 'white', padding: '10px 20px', borderRadius: '15px', border: '1px solid #e0e0e0' },
  compactAnnouncement: { flex: 1, minWidth: '300px', background: 'white', padding: '10px 15px', borderRadius: '15px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', cursor: 'pointer', border: '1px solid #fbc02d' },
  announcementText: { margin: 0, fontSize: '0.85rem', color: '#333', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  mainLayout: { display: 'flex', gap: '25px', flexWrap: 'wrap' },
  leftCol: { flex: 2, minWidth: '280px', display: 'flex', flexDirection: 'column', gap: '25px' },
  rightCol: { flex: 1, minWidth: '280px', display: 'flex', flexDirection: 'column', gap: '25px' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '15px' },
  miniCard: { background: 'white', padding: '15px', borderRadius: '15px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' },
  miniIcon: { fontSize: '1.4rem' },
  miniLabel: { margin: 0, fontSize: '0.65rem', color: '#888', textTransform: 'uppercase' },
  miniValue: { margin: 0, fontSize: '1.2rem', fontWeight: 'bold', color: '#1b5e20' },
  sectionCard: { background: 'white', padding: '20px', borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' },
  badge: { background: '#e8f5e9', color: '#2e7d32', padding: '4px 12px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 'bold' },
  teamGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' },
  personRow: { display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', background: '#f9f9f9', borderRadius: '12px' },
  avatar: { width: '35px', height: '35px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold' },
  personName: { margin: 0, fontSize: '0.8rem', fontWeight: 'bold', color: '#333' },
  personStatus: { fontSize: '0.65rem', color: '#999' },
  alertCard: { background: '#fff5f5', padding: '15px', borderRadius: '15px', border: '1px solid #ffcdd2' },
  alertSmall: { display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', padding: '5px 0' },
  listItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f5f5f5' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, backdropFilter: 'blur(3px)' },
  modal: { background: 'white', padding: '30px', borderRadius: '20px', width: '90%', maxWidth: '500px' },
  modalTextarea: { width: '100%', height: '100px', padding: '12px', borderRadius: '10px', border: '1px solid #ddd', fontSize: '0.95rem', marginBottom: '20px', outline: 'none' },
  modalCancel: { flex: 1, padding: '12px', borderRadius: '10px', border: 'none', background: '#eee', fontWeight: 'bold', cursor: 'pointer' },
  modalSave: { flex: 1, padding: '12px', borderRadius: '10px', border: 'none', background: '#1b5e20', color: 'white', fontWeight: 'bold', cursor: 'pointer' },
  modalLabel: { display: 'block', fontSize: '0.8rem', fontWeight: 'bold', color: '#555', marginBottom: '8px' },
  modalSelect: { width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #ddd', fontSize: '0.95rem', marginBottom: '15px' }
};
