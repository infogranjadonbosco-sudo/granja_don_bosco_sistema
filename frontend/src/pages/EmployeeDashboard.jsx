import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { useNavigate } from "react-router-dom";

export default function EmployeeDashboard() {
  const navigate = useNavigate();
  const [products, setProducts] = useState(0);
  const [ordersToday, setOrdersToday] = useState(0);
  const [totalVentas, setTotalVentas] = useState(0);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Todo lo relacionado con la jornada del colaborador
  const [jornadaStatus, setJornadaStatus] = useState("fuera");
  const [tareaActual, setTareaActual] = useState("");
  const [tareas, setTareas] = useState([]);
  const [user, setUser] = useState(null);
  const [perfil, setPerfil] = useState(null);

  // Para el tracker que cuenta las horas trabajadas en vivo
  const [jornadaInicio, setJornadaInicio] = useState(null);
  const [tiempoTrabajado, setTiempoTrabajado] = useState("00:00:00");

  // Guardamos lo que ha hecho hoy el colaborador
  const [historial, setHistorial] = useState([]);

  // Sección de noticias, notas personales y alertas del día
  const [anuncio, setAnuncio] = useState("¡Bienvenido a Granja Don Bosco! 🚜✨");
  const [notaRapida, setNotaRapida] = useState("");
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [isEditingAnuncio, setIsEditingAnuncio] = useState(false);
  const [nuevoAnuncio, setNuevoAnuncio] = useState("");
  const [visibilidadAnuncio, setVisibilidadAnuncio] = useState("todos");
  const [usuarioDestinoAnuncio, setUsuarioDestinoAnuncio] = useState("");
  const [listaUsuarios, setListaUsuarios] = useState([]);
  const [savingNota, setSavingNota] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);

  // Las notas se guardaran en el navegador para que no se pierdan al recargar
  useEffect(() => {
    if (user?.id) {
      const savedNote = localStorage.getItem(`nota_${user.id}`);
      if (savedNote) setNotaRapida(savedNote);
    }
  }, [user]);

  // Cada vez que el colaborador escribe algo, lo guardamos automáticamente en localStorage
  useEffect(() => {
    if (user?.id) {
      setSavingNota(true);
      localStorage.setItem(`nota_${user.id}`, notaRapida);

      const timer = setTimeout(() => {
        setSavingNota(false);
        setLastSaved(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [notaRapida, user]);

  useEffect(() => {
    fetchEmployeeData();
    fetchTareas();
    checkJornadaStatus();
    loadLowStock();
    fetchAnuncio();
  }, []);

  const fetchAnuncio = async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) return;

    // Traemos el perfil para saber el rol
    const { data: pData } = await supabase.from("usuarios").select("rol").eq("id", currentUser.id).maybeSingle();

    const { data } = await supabase.from('configuracion').select('valor').eq('id', 'anuncio_dia').maybeSingle();

    // Traemos usuarios para el select de personal si es admin
    if (pData?.rol === 'admin') {
      const { data: uData } = await supabase.from('usuarios').select('id, nombre_completo, rol').order('nombre_completo');
      setListaUsuarios(uData || []);
    }

    if (data && data.valor) {
      try {
        const obj = JSON.parse(data.valor);
        const { text, visibilidad, usuarioDestino } = obj;

        setNuevoAnuncio(text);
        setVisibilidadAnuncio(visibilidad || 'todos');
        setUsuarioDestinoAnuncio(usuarioDestino || '');

        let mostrar = false;
        if (visibilidad === 'todos') mostrar = true;
        else if (visibilidad === 'colaboradores' && pData?.rol === 'colaborador') mostrar = true;
        else if (visibilidad === 'solo_yo' && pData?.rol === 'admin') mostrar = true;
        else if (visibilidad === 'personal' && usuarioDestino === currentUser.id) mostrar = true;
        else if (pData?.rol === 'admin') mostrar = true;

        if (mostrar) {
          setAnuncio(text);
        } else {
          setAnuncio('¡Bienvenido a Granja Don Bosco! 🚜✨');
        }
      } catch (e) {
        setAnuncio(data.valor);
        setNuevoAnuncio(data.valor);
        setVisibilidadAnuncio('todos');
      }
    } else {
      setAnuncio('¡Bienvenido a Granja Don Bosco! 🚜✨');
    }
  };

  const handleSaveAnuncio = async () => {
    const payload = JSON.stringify({
      text: nuevoAnuncio,
      visibilidad: visibilidadAnuncio,
      usuarioDestino: usuarioDestinoAnuncio
    });

    const { error } = await supabase.from('configuracion').upsert({ id: 'anuncio_dia', valor: payload });
    if (!error) {
      setAnuncio(nuevoAnuncio);
      setIsEditingAnuncio(false);
      alert("✅ Anuncio actualizado con éxito");
    } else {
      alert("❌ Error al guardar: " + error.message);
    }
  };

  // Lógica para que el contador de tiempo se reinicie correctamente al terminar
  useEffect(() => {
    let interval;
    const estadosActivos = ["trabajando", "almuerzo", "receso"];
    if (jornadaInicio && estadosActivos.includes(jornadaStatus)) {
      interval = setInterval(() => {
        const diff = Date.now() - new Date(jornadaInicio).getTime();
        const hrs = Math.floor(diff / 3600000).toString().padStart(2, '0');
        const mins = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
        const secs = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
        setTiempoTrabajado(`${hrs}:${mins}:${secs}`);
      }, 1000);
    } else {
      setTiempoTrabajado("00:00:00");
    }
    return () => clearInterval(interval);
  }, [jornadaInicio, jornadaStatus]);

  const fetchTareas = async () => {
    const { data, error } = await supabase
      .from("tareas")
      .select("*")
      .eq("activa", true);
    if (error) {
      console.error("❌ Error fetching tasks:", error.message, error.details);
    }
    setTareas(data || []);
  };

  const loadLowStock = async () => {
    const { data } = await supabase
      .from("products")
      .select("*")
      .lt("stock", 10)
      .order('stock', { ascending: true });

    setLowStockProducts(data || []);
    setLoading(false);
  };

  const checkJornadaStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);

    // Traeremos los datos del colaborador desde la base de datos
    const { data: perfilData } = await supabase.from("usuarios").select("*").eq("id", user.id).maybeSingle();
    setPerfil(perfilData);

    // Revisaremos cuál fue la última acción que hizo hoy (si ya inició jornada, almuerzo, etc.)
    const { data: lastJornada } = await supabase
      .from("jornadas")
      .select("*")
      .eq("usuario_id", user.id)
      .order("creado_at", { ascending: false })
      .limit(1);

    if (lastJornada && lastJornada.length > 0) {
      const last = lastJornada[0];
      if (last.tipo === "inicio_jornada" || last.tipo === "fin_almuerzo" || last.tipo === "fin_receso") {
        setJornadaStatus("trabajando");
      } else if (last.tipo === "inicio_almuerzo") {
        setJornadaStatus("almuerzo");
      } else if (last.tipo === "inicio_receso") {
        setJornadaStatus("receso");
      } else {
        setJornadaStatus("fuera");
      }
      setTareaActual(last.tarea_id);
      setJornadaInicio(last.creado_at); // Seteamos el inicio a la última acción para resetear el reloj
    }

    // Cargaremos todo lo que hizo hoy para mostrarlo en el historial
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { data: historialData } = await supabase
      .from("jornadas")
      .select("*, tareas(nombre)")
      .eq("usuario_id", user.id)
      .gte("creado_at", today.toISOString())
      .order("creado_at", { ascending: true });

    setHistorial(historialData || []);
  };

  const fetchEmployeeData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { count: pCount } = await supabase.from("products").select("*", { count: "exact", head: true });

    // Mostramos las ventas del colaborador Y las ventas de clientes invitados (sin usuario_id)
    const { data: oData, count: oCount } = await supabase
      .from("orders")
      .select("*, usuarios(nombre_completo)", { count: "exact" })
      .or(`usuario_id.eq.${user.id},usuario_id.is.null`)
      .gte("created_at", today.toISOString())
      .order('created_at', { ascending: false });

    setProducts(pCount || 0);
    setOrdersToday(oCount || 0);
    setTotalVentas((oData || []).reduce((sum, o) => sum + Number(o.total), 0));
    setRecentOrders(oData || []);
    setLoading(false);
  };

  const registrarAccion = async (tipo) => {
    // Nos aseguramos de que siga el orden lógico (no puede almorzar sin haber iniciado, etc.)
    if (!tareaActual && tipo === "inicio_jornada") {
      alert("Por favor selecciona una tarea primero.");
      return;
    }

    // No puede tomar almuerzo o receso si no está trabajando
    if ((tipo === 'inicio_almuerzo' || tipo === 'inicio_receso') && jornadaStatus !== 'trabajando') {
      alert("Auxiliar no disponible: Debes estar en jornada activa.");
      return;
    }

    // Evitamos que tome dos recesos seguidos sin haber retomado el trabajo
    const ultimaAccion = historial.length > 0 ? historial[historial.length - 1] : null;

    if (tipo === 'inicio_receso' && ultimaAccion?.tipo === 'fin_receso') {
      alert("Auxiliar no disponible en este momento.");
      return;
    }

    if (tipo === 'inicio_almuerzo' && ultimaAccion?.tipo === 'fin_almuerzo') {
      alert("Función no disponible temporalmente.");
      return;
    }

    const { error } = await supabase.from("jornadas").insert([{
      usuario_id: user.id,
      tipo,
      tarea_id: (tipo === 'inicio_jornada') ? (tareaActual || null) :
        (tipo === 'fin_jornada' ? null : (ultimaAccion?.tarea_id || null))
    }]);

    if (!error) {
      if (tipo === 'fin_jornada') {
        setTareaActual("");
        setJornadaInicio(null);
        setTiempoTrabajado("00:00:00");
      }
      checkJornadaStatus();
      const acciones = {
        'inicio_jornada': '¡Jornada iniciada! Buen día de trabajo 💪',
        'inicio_almuerzo': '¡Buen provecho! 🍽️',
        'fin_almuerzo': '¡De vuelta al trabajo! 💪',
        'inicio_receso': '¡Disfruta tu descanso! ☕',
        'fin_receso': '¡Receso terminado, a seguir! 🚀',
        'fin_jornada': '¡Buen trabajo hoy! Descansa bien 🌙'
      };
      alert(acciones[tipo] || 'Acción registrada');
    } else {
      console.error("❌ Error registering action:", error.message);
      alert("Error al registrar: " + error.message);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "¡Buenos días";
    if (hour < 18) return "¡Buenas tardes";
    return "¡Buenas noches";
  };

  const formatTipo = (tipo) => {
    const map = {
      'inicio_jornada': '🟢 Inicio de jornada',
      'inicio_almuerzo': '🍽️ Inicio almuerzo',
      'fin_almuerzo': '🔄 Fin almuerzo',
      'inicio_receso': '☕ Inicio receso',
      'fin_receso': '🔄 Fin receso',
      'fin_jornada': '🔴 Fin de jornada'
    };
    return map[tipo] || tipo;
  };

  if (loading) return <div style={styles.loader}>Cargando panel de control...</div>;

  return (
    <div style={styles.container}>
      {/* SALUDO PERSONALIZADO */}
      <header style={styles.header}>
        <h1 style={styles.title}>
          {getGreeting()}, {perfil?.nombre_completo?.split(' ')[0] || 'Colaborador'}! 👋
        </h1>
        <p style={styles.subtitle}>
          📍 {(() => {
            const name = perfil?.nombre_completo?.toLowerCase().trim();
            if (name?.includes("jose ramirez")) return "Gerente General";
            if (name?.includes("ricardo alas")) return "Subgerente";
            if (name?.includes("roberto medina")) return "Coordinador General";
            if (perfil?.rol === 'colaborador') return "Personal";
            return perfil?.departamento || 'Sin departamento';
          })()} · 📅 {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </header>

      {/* ACCESOS RÁPIDOS (Solo para Admins) */}
      {perfil?.rol === 'admin' && (
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/products')} style={{
            backgroundColor: '#1b5e20', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem'
          }}>
            🛍️ Tienda y Fotos
          </button>
          <button onClick={() => navigate('/dashboard')} style={{
            backgroundColor: 'white', color: '#1b5e20', border: '2px solid #1b5e20', padding: '10px 20px', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem'
          }}>
            📊 Ir a Administración
          </button>
        </div>
      )}

      {/* ANUNCIO DEL DÍA */}
      <div
        style={{
          ...styles.announcement,
          cursor: perfil?.rol === 'admin' ? 'pointer' : 'default',
          border: perfil?.rol === 'admin' ? '2px solid #fbc02d' : '1px solid #fbc02d'
        }}
        onClick={() => { if (perfil?.rol === 'admin') setIsEditingAnuncio(true); }}
      >
        <div style={{ fontSize: '1.2rem' }}>📢</div>
        <div style={{ flex: 1 }}>
          <h4 style={{ margin: 0, fontSize: '0.8rem', color: '#1b5e20', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Anuncio del día {perfil?.rol === 'admin' && <span style={{ fontSize: '0.7rem', color: '#a0a0a0', marginLeft: '5px' }}>(Clic para editar ✏️)</span>}
          </h4>
          <p style={{ margin: '3px 0 0 0', fontSize: '0.95rem', color: '#333', fontWeight: '500' }}>{anuncio}</p>
          {perfil?.rol === 'admin' && (
            <span style={{ fontSize: '0.7rem', color: '#888', fontStyle: 'italic' }}>
              Visibilidad: {visibilidadAnuncio === 'todos' ? '🌍 Todos' : visibilidadAnuncio === 'colaboradores' ? '👷 Colaboradores' : visibilidadAnuncio === 'solo_yo' ? '🔒 Solo Admin' : '👤 Personal'}
            </span>
          )}
        </div>
      </div>

      {/* ALERTAS DE DISPONIBILIDAD */}
      {lowStockProducts.length > 0 && (
        <div style={styles.alertBox}>
          <h2 style={{ color: '#d32f2f', margin: '0 0 10px 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            ⚠️ <span>DISPONIBILIDAD CRÍTICA</span>
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {lowStockProducts.map(p => (
              <div key={p.id} style={{ background: '#ffebee', border: '1px solid #ffcdd2', padding: '6px 12px', borderRadius: '8px', fontSize: '0.85rem' }}>
                <span style={{ fontWeight: 'bold' }}>{p.name}</span>: <span style={{ color: '#d32f2f', fontWeight: 'bold' }}>{p.stock}</span> unidades
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ACCESOS RÁPIDOS */}
      <div style={{ display: 'flex', gap: '15px', marginBottom: '25px', flexWrap: 'wrap' }}>
        <button onClick={() => navigate('/products')} style={{ ...styles.quickBtn, background: '#1b5e20' }}>🛍️ Ver Catálogo</button>
        <button onClick={() => navigate('/cart')} style={{ ...styles.quickBtn, background: '#097912' }}>🛒 Nueva Venta</button>
      </div>

      {/* TRACKING DE JORNADA + CRONÓMETRO */}
      <div style={styles.trackerCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
          <h2 style={styles.trackerTitle}>⏱️ Mi Jornada</h2>
          {jornadaStatus !== "fuera" && (
            <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#1b5e20', fontFamily: 'monospace' }}>
              {tiempoTrabajado}
            </div>
          )}
        </div>
        <div style={styles.statusBadgeLarge(jornadaStatus)}>
          {jornadaStatus === 'trabajando' ? '🟢 TRABAJANDO' :
            jornadaStatus === 'almuerzo' ? '🍽️ EN ALMUERZO' :
              jornadaStatus === 'receso' ? '☕ EN RECESO' : '🔴 SIN ACTIVIDAD'}
        </div>

        <div style={styles.trackerActions}>
          {jornadaStatus === "fuera" && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', maxWidth: '400px' }}>
              <select
                value={tareaActual}
                onChange={(e) => setTareaActual(e.target.value)}
                style={styles.select}
              >
                <option value="">-- Seleccionar Tarea --</option>
                {tareas.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
              <button onClick={() => registrarAccion("inicio_jornada")} style={styles.actionBtn('#2e7d32')}>INICIAR DÍA</button>
            </div>
          )}

          {jornadaStatus === "trabajando" && (
            <div className="responsive-grid" style={{ ...styles.btnGrid, gap: '10px', width: '100%' }}>
              <button onClick={() => registrarAccion("inicio_almuerzo")} style={styles.actionBtn('#f57c00')}>🍽️ ALMUERZO</button>
              <button onClick={() => registrarAccion("inicio_receso")} style={styles.actionBtn('#1976d2')}>☕ RECESO</button>
              <button onClick={() => registrarAccion("fin_jornada")} style={{ ...styles.actionBtn('#d32f2f'), gridColumn: '1 / -1' }}>🔴 TERMINAR DÍA</button>
            </div>
          )}

          {jornadaStatus === "almuerzo" && (
            <button onClick={() => registrarAccion("fin_almuerzo")} style={styles.actionBtn('#2e7d32')}>✅ TERMINAR ALMUERZO</button>
          )}

          {jornadaStatus === "receso" && (
            <button onClick={() => registrarAccion("fin_receso")} style={styles.actionBtn('#2e7d32')}>✅ TERMINAR RECESO</button>
          )}
        </div>
      </div>

      {/* MINI RESUMEN DE VENTAS */}
      <div className="responsive-grid" style={styles.statsRow}>
        <div style={styles.statCard}>
          <span style={styles.statLabel}>PEDIDOS HOY</span>
          <span style={styles.statValue}>{ordersToday}</span>
        </div>
        <div style={styles.statCard}>
          <span style={styles.statLabel}>TOTAL VENTAS</span>
          <span style={{ ...styles.statValue, color: '#097912' }}>${totalVentas.toFixed(2)}</span>
        </div>
      </div>

      <div className="responsive-grid" style={{ ...styles.statsRow, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        {/* MI ACTIVIDAD / NOTAS EN COLUMNAS */}
        <div className="responsive-table-container" style={{ margin: 0 }}>
          <div style={{ padding: '20px' }}>
            <h2 style={styles.tableTitle}>📝 Mis Notas Rápidas</h2>
            <textarea
              placeholder="Escribe aquí pendientes, recordatorios o cosas que falten... (Se guarda solo)"
              value={notaRapida}
              onChange={(e) => setNotaRapida(e.target.value)}
              style={{
                width: '100%',
                height: '120px',
                border: '1px solid #e0e0e0',
                borderRadius: '12px',
                padding: '12px',
                fontSize: '0.9rem',
                fontFamily: 'inherit',
                outline: 'none',
                resize: 'none',
                backgroundColor: '#f9f9f9',
                color: '#333'
              }}
            />
            <p style={{ fontSize: '0.65rem', color: '#aaa', marginTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
              <span>🔒 Solo tú puedes ver esto</span>
              {savingNota ? (
                <span style={{ color: '#2e7d32', fontWeight: 'bold' }}>⏳ Guardando...</span>
              ) : lastSaved ? (
                <span style={{ color: '#888' }}>✅ Guardado {lastSaved}</span>
              ) : null}
            </p>
          </div>
        </div>

        {/* HISTORIAL DE ACTIVIDADES DEL DÍA */}
        {historial.length > 0 && (
          <div className="responsive-table-container" style={{ margin: 0 }}>
            <div style={{ padding: '20px' }}>
              <h2 style={styles.tableTitle}>📋 Mi Actividad de Hoy</h2>
              <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                {historial.slice().reverse().map((h, i) => (
                  <div key={i} style={{ display: 'flex', gap: '15px', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f5f5f5' }}>
                    <span style={{ fontSize: '0.8rem', color: '#999', minWidth: '60px' }}>
                      {new Date(h.creado_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span style={{ fontSize: '0.9rem', color: '#333' }}>{formatTipo(h.tipo)}</span>
                    {h.tareas?.nombre && <span style={{ fontSize: '0.75rem', background: '#e8f5e9', color: '#2e7d32', padding: '2px 8px', borderRadius: '10px' }}>{h.tareas.nombre}</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* TABLA DE VENTAS */}
      <div className="responsive-table-container">
        <div style={{ padding: '20px' }}>
          <h2 style={styles.tableTitle}>🕒 Últimas ventas del turno</h2>
          {recentOrders.length > 0 ? (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Hora</th>
                  <th style={styles.th}>Comprador</th>
                  <th style={styles.th}>Monto</th>
                  <th style={styles.th}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id} style={styles.tr}>
                    <td style={styles.td}>{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td style={styles.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ fontSize: '0.8rem' }}>{order.metodo_pago === 'tarjeta' ? '💳' : '💵'}</span>
                        <span style={{ fontWeight: 'bold', fontSize: '0.8rem' }}>
                          {order.usuarios ? order.usuarios.nombre_completo.split(' ')[0] : (order.nombre_cliente || 'Invitado')}
                        </span>
                      </div>
                    </td>
                    <td style={{ ...styles.td, fontWeight: 'bold', color: '#1b5e20' }}>${Number(order.total).toFixed(2)}</td>
                    <td style={styles.td}><span style={styles.badge}>{order.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ textAlign: 'center', color: '#999', padding: '20px' }}>Nada aún 🚀</p>
          )}
        </div>
      </div>

      {/* MODAL EDICIÓN ANUNCIO (Solo Admin) */}
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
              value={visibilidadAnuncio}
              onChange={(e) => setVisibilidadAnuncio(e.target.value)}
              style={styles.modalSelect}
            >
              <option value="todos">🌍 Todos los usuarios</option>
              <option value="colaboradores">👷 Solo Colaboradores</option>
              <option value="solo_yo">🔒 Solo yo (Admin)</option>
              <option value="personal">👤 Un usuario en específico</option>
            </select>

            {visibilidadAnuncio === 'personal' && (
              <div style={{ marginTop: '10px' }}>
                <label style={styles.modalLabel}>Seleccionar Usuario Destino:</label>
                <select
                  value={usuarioDestinoAnuncio}
                  onChange={(e) => setUsuarioDestinoAnuncio(e.target.value)}
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
                disabled={visibilidadAnuncio === 'personal' && !usuarioDestinoAnuncio}
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
  container: { padding: '20px', backgroundColor: '#fdfbc0', minHeight: '100vh' },
  header: { marginBottom: '25px' },
  title: { color: '#1b5e20', margin: 0, fontSize: '1.6rem' },
  subtitle: { margin: 0, fontSize: '0.9rem', color: '#666' },
  announcement: {
    background: '#fff9c4',
    border: '1px solid #fbc02d',
    borderRadius: '15px',
    padding: '15px 20px',
    marginBottom: '25px',
    display: 'flex',
    gap: '15px',
    alignItems: 'center',
    boxShadow: '0 2px 8px rgba(251, 192, 45, 0.1)'
  },
  quickBtn: { color: 'white', border: 'none', padding: '12px 25px', borderRadius: '25px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.95rem' },

  trackerCard: { background: 'white', padding: '20px', borderRadius: '15px', marginBottom: '25px', boxShadow: '0 4px 10px rgba(0,0,0,0.05)', textAlign: 'center' },
  trackerTitle: { fontSize: '1.2rem', color: '#1b5e20', marginBottom: '15px', margin: 0 },
  statusBadgeLarge: (status) => ({
    display: 'inline-block',
    padding: '8px 20px',
    borderRadius: '20px',
    background: status === 'trabajando' ? '#e8f5e9' : status === 'fuera' ? '#ffebee' : '#fff3e0',
    color: status === 'trabajando' ? '#2e7d32' : status === 'fuera' ? '#c62828' : '#ef6c00',
    fontWeight: 'bold',
    marginBottom: '20px',
    marginTop: '15px'
  }),
  trackerActions: { display: 'flex', justifyContent: 'center', gap: '15px' },
  btnGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', width: '100%' },
  actionBtn: (color) => ({
    padding: '12px',
    background: color,
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    fontWeight: 'bold',
    cursor: 'pointer',
    flex: 1
  }),
  select: { padding: '12px', borderRadius: '10px', border: '1px solid #ddd', width: '100%' },

  statsRow: { display: 'flex', gap: '20px', marginBottom: '25px', flexWrap: 'wrap' },
  statCard: { background: '#fff', flex: 1, padding: '20px', borderRadius: '15px', textAlign: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' },
  statLabel: { display: 'block', fontSize: '0.8rem', color: '#888', fontWeight: 'bold' },
  statValue: { fontSize: '2rem', color: '#1b5e20', fontWeight: 'bold' },

  tableTitle: { fontSize: '1.1rem', color: '#1b5e20', marginBottom: '15px' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '10px', borderBottom: '1px solid #eee', color: '#666' },
  td: { padding: '12px 10px', borderBottom: '1px solid #f9f9f9', fontSize: '0.9rem' },
  badge: { background: '#e8f5e9', color: '#2e7d32', padding: '4px 8px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 'bold' },
  loader: { textAlign: 'center', padding: '50px', color: '#1b5e20' },
  alertBox: {
    backgroundColor: '#fff',
    border: '2px solid #ffcdd2',
    borderLeft: '10px solid #d32f2f',
    padding: '20px',
    borderRadius: '15px',
    marginBottom: '25px',
    boxShadow: "0 4px 15px rgba(211,47,47,0.05)"
  },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, backdropFilter: 'blur(3px)' },
  modal: { background: 'white', padding: '30px', borderRadius: '20px', width: '90%', maxWidth: '500px', textAlign: 'left' },
  modalTextarea: { width: '100%', height: '100px', padding: '12px', borderRadius: '10px', border: '1px solid #ddd', fontSize: '0.95rem', marginBottom: '20px', outline: 'none' },
  modalCancel: { flex: 1, padding: '12px', borderRadius: '10px', border: 'none', background: '#eee', fontWeight: 'bold', cursor: 'pointer' },
  modalSave: { flex: 1, padding: '12px', borderRadius: '10px', border: 'none', background: '#1b5e20', color: 'white', fontWeight: 'bold', cursor: 'pointer' },
  modalLabel: { display: 'block', fontSize: '0.8rem', fontWeight: 'bold', color: '#555', marginBottom: '8px' },
  modalSelect: { width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #ddd', fontSize: '0.95rem', marginBottom: '15px' }
};

