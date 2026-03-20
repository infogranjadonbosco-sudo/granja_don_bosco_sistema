import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { createClient } from '@supabase/supabase-js';

export default function PersonnelManagement() {
    const [colaboradores, setColaboradores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lastActions, setLastActions] = useState({});
    const [editingUser, setEditingUser] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isAddingUser, setIsAddingUser] = useState(false);
    const [newUser, setNewUser] = useState({
        nombre_completo: '',
        correo: '',
        password: '',
        rol: 'colaborador',
        departamento: ''
    });

    const [selectedUserTimeline, setSelectedUserTimeline] = useState(null);
    const [dailyActions, setDailyActions] = useState({});
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

    // Función para crear un usuario sin cerrar la sesión actual
    const handleCreateUser = async (e) => {
        e.preventDefault();
        if (!newUser.nombre_completo || !newUser.correo || !newUser.password) {
            alert("Por favor completa los campos obligatorios (Nombre, Correo y Contraseña)");
            return;
        }
        if (newUser.password.length < 6) {
            alert("La contraseña debe tener al menos 6 caracteres");
            return;
        }

        setIsSaving(true);
        try {
            // Usamos la función de BD para crear el usuario directamente
            const { data, error } = await supabase.rpc('crear_colaborador', {
                p_email: newUser.correo,
                p_password: newUser.password,
                p_nombre: newUser.nombre_completo,
                p_departamento: newUser.departamento || 'Colaboradores',
                p_rol: newUser.rol
            });

            if (error) throw error;

            alert("✅ Colaborador creado con éxito.\n\nCorreo: " + newUser.correo + "\nContraseña: (la que ingresaste)");
            setIsAddingUser(false);
            setNewUser({ nombre_completo: '', correo: '', password: '', rol: 'colaborador', departamento: '' });
            loadData();
        } catch (err) {
            alert("Error al crear usuario: " + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteUser = async (id) => {
        if (window.confirm("¿Estás seguro de que deseas eliminar a este colaborador? Esta acción no se puede deshacer y perderá su historial.")) {
            const { error } = await supabase
                .from("usuarios")
                .delete()
                .eq("id", id);
            
            if (error) {
                alert("Error al eliminar: " + error.message);
            } else {
                loadData();
            }
        }
    };

    useEffect(() => {
        loadData();
        // Solo auto-actualizar si estamos viendo el día de hoy
        const isToday = selectedDate === new Date().toISOString().split('T')[0];
        let interval;
        if (isToday) {
            interval = setInterval(loadData, 15000);
        }
        return () => { if (interval) clearInterval(interval); };
    }, [selectedDate]);

    const loadData = async () => {
        const startOfDay = new Date(selectedDate + 'T00:00:00');
        const endOfDay = new Date(selectedDate + 'T23:59:59');

        const { data: users } = await supabase
            .from("usuarios")
            .select("*")
            .order('rol', { ascending: true });

        const { data: actions } = await supabase
            .from("jornadas")
            .select("*, tareas(nombre)")
            .gte('creado_at', startOfDay.toISOString())
            .lte('creado_at', endOfDay.toISOString())
            .order('creado_at', { ascending: false });

        const actionMap = {};
        const timelineMap = {};
        
        if (actions) {
            actions.forEach(act => {
                // Última acción para el estado del día
                if (!actionMap[act.usuario_id]) {
                    actionMap[act.usuario_id] = act;
                }
                // Historial agrupado por usuario
                if (!timelineMap[act.usuario_id]) {
                    timelineMap[act.usuario_id] = [];
                }
                timelineMap[act.usuario_id].push(act);
            });
        }

        setColaboradores(users || []);
        setLastActions(actionMap);
        setDailyActions(timelineMap);
        setLoading(false);
    };

    const getStatusLabel = (action) => {
        if (!action) return { text: '💤 SIN ACTIVIDAD', color: '#9e9e9e', emoji: '💤' };

        switch (action.tipo) {
            case 'inicio_jornada': return { text: '🟢 TRABAJANDO', color: '#2e7d32', emoji: '🟢' };
            case 'fin_almuerzo': return { text: '🟢 TRABAJANDO', color: '#2e7d32', emoji: '🏠' };
            case 'fin_receso': return { text: '🟢 TRABAJANDO', color: '#2e7d32', emoji: '🏠' };
            case 'inicio_almuerzo': return { text: '🍱 ALMORZANDO', color: '#f57c00', emoji: '🍱' };
            case 'inicio_receso': return { text: '☕ EN RECESO', color: '#1976d2', emoji: '☕' };
            case 'fin_jornada': return { text: '🏠 FUERA', color: '#d32f2f', emoji: '🏠' };
            default: return { text: 'DESCONOCIDO', color: '#757575', emoji: '❓' };
        }
    };

    const formatActionType = (tipo) => {
        const map = {
            'inicio_jornada': 'Inició jornada',
            'inicio_almuerzo': 'Salió a almorzar',
            'fin_almuerzo': 'Regresó de almuerzo',
            'inicio_receso': 'Salió a receso',
            'fin_receso': 'Regresó de receso',
            'fin_jornada': 'Terminó jornada'
        };
        return map[tipo] || tipo;
    };

    const togglePermiso = async (id, campo, valorActual) => {
        const { error } = await supabase
            .from("usuarios")
            .update({ [campo]: !valorActual })
            .eq("id", id);
        if (!error) loadData();
    };

    const handleSaveUser = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        const { error } = await supabase
            .from("usuarios")
            .update({
                nombre_completo: editingUser.nombre_completo,
                rol: editingUser.rol,
                departamento: editingUser.departamento,
                puede_editar: editingUser.puede_editar,
                puede_eliminar: editingUser.puede_eliminar || false,
                puede_agregar: editingUser.puede_agregar || false,
                puede_inventario: editingUser.puede_inventario || false
            })
            .eq("id", editingUser.id);
        
        setIsSaving(false);
        if (!error) {
            setEditingUser(null);
            loadData();
        } else {
            alert("Error al guardar: " + error.message);
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.headerRow}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <h1 style={styles.mainTitle}>👥 Panel de Actividad</h1>
                        <button 
                            onClick={() => setIsAddingUser(true)}
                            style={styles.addUserBtn}
                        >
                            ➕ Nuevo Colaborador
                        </button>
                    </div>
                    <p style={styles.subtitle}>
                        {selectedDate === new Date().toISOString().split('T')[0] 
                            ? "Supervisando actividad en tiempo real hoy" 
                            : `Consultando actividad registrada el ${new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`}
                    </p>
                </div>
                <div style={styles.filterBox}>
                    <label style={styles.dateLabel}>🗓️ Cambiar fecha:</label>
                    <input 
                        type="date" 
                        value={selectedDate} 
                        onChange={(e) => setSelectedDate(e.target.value)}
                        style={styles.dateInput}
                        max={new Date().toISOString().split('T')[0]} // No permitir fechas futuras
                    />
                </div>
            </div>

            {/* MODAL DE AGREGAR COLABORADOR */}
            {isAddingUser && (
                <div style={styles.modalOverlay} onClick={() => setIsAddingUser(false)}>
                    <div style={styles.modal} onClick={e => e.stopPropagation()}>
                        <h2 style={{ color: '#1b5e20', marginTop: 0 }}>➕ Registrar Nuevo Colaborador</h2>
                        <form onSubmit={handleCreateUser}>
                            <div style={styles.field}>
                                <label style={styles.label}>Nombre Completo *</label>
                                <input 
                                    style={styles.input}
                                    placeholder="Nombre y Apellido"
                                    value={newUser.nombre_completo}
                                    onChange={(e) => setNewUser({...newUser, nombre_completo: e.target.value})}
                                    required
                                />
                            </div>

                            <div style={styles.field}>
                                <label style={styles.label}>Correo Electrónico (será su usuario) *</label>
                                <input 
                                    style={styles.input}
                                    type="email"
                                    placeholder="ejemplo@granjadonbosco.com"
                                    value={newUser.correo}
                                    onChange={(e) => setNewUser({...newUser, correo: e.target.value})}
                                    required
                                />
                            </div>

                            <div style={styles.field}>
                                <label style={styles.label}>Contraseña Inicial *</label>
                                <input 
                                    style={styles.input}
                                    type="password"
                                    placeholder="Mínimo 6 caracteres"
                                    value={newUser.password}
                                    onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                                    required
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '15px' }}>
                                <div style={{ ...styles.field, flex: 1 }}>
                                    <label style={styles.label}>Rol</label>
                                    <select 
                                        style={styles.input}
                                        value={newUser.rol}
                                        onChange={(e) => setNewUser({...newUser, rol: e.target.value})}
                                    >
                                        <option value="colaborador">Colaborador</option>
                                        <option value="admin">Administrador</option>
                                    </select>
                                </div>
                                <div style={{ ...styles.field, flex: 1 }}>
                                    <label style={styles.label}>Departamento</label>
                                    <input 
                                        style={styles.input}
                                        value={newUser.departamento}
                                        onChange={(e) => setNewUser({...newUser, departamento: e.target.value})}
                                        placeholder="Ej: Ventas"
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '10px', marginTop: '30px' }}>
                                <button 
                                    type="button" 
                                    onClick={() => setIsAddingUser(false)} 
                                    style={{ ...styles.btn, background: '#f5f5f5', color: '#666' }}
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={isSaving}
                                    style={{ ...styles.btn, background: '#1b5e20', color: 'white', flex: 1 }}
                                >
                                    {isSaving ? 'Creando...' : 'Crear Cuenta'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {loading ? (
                <p style={{ textAlign: 'center', marginTop: '50px' }}>Consultando base de datos...</p>
            ) : (
                <div className="responsive-table-container" style={styles.tableCard}>
                    <table style={styles.table}>
                        <thead>
                            <tr style={styles.tableHeader}>
                                <th style={styles.th}>Nombre</th>
                                <th style={styles.th}>Balance del Día</th>
                                <th style={styles.th}>Última Actividad</th>
                                <th style={styles.th}>Detalle Cronológico</th>
                                <th style={styles.th}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {colaboradores.map((c) => (
                                <tr key={c.id} style={styles.tableRow}>
                                    <td style={styles.td}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{
                                                width: '32px', height: '32px', borderRadius: '50%',
                                                background: c.rol === 'admin' ? '#1b5e20' : '#FADADD',
                                                color: c.rol === 'admin' ? 'white' : '#333',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '0.7rem', fontWeight: 'bold'
                                            }}>
                                                {c.nombre_completo ? c.nombre_completo.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase() : '??'}
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <div>
                                                    <b>{c.nombre_completo}</b> {c.rol === 'admin' && <span title="Administrador">⭐</span>}
                                                </div>
                                                <span style={{ fontSize: '0.7rem', color: '#666' }}>{c.rol === 'admin' ? 'Administrador' : (c.departamento || 'Personal')}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={styles.td}>
                                        <span style={{
                                            ...styles.statusBadge,
                                            backgroundColor: getStatusLabel(lastActions[c.id]).color
                                        }}>
                                            {getStatusLabel(lastActions[c.id]).text}
                                        </span>
                                    </td>
                                    <td style={styles.td}>
                                        <div style={{ fontSize: '0.85rem' }}>
                                            {lastActions[c.id] ? (
                                                lastActions[c.id].tipo === 'fin_jornada' ? (
                                                    <div>
                                                        <span style={{ color: '#d32f2f', fontWeight: 'bold' }}>🏁 Turno terminado</span>
                                                        <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '3px' }}>
                                                            Salió a las {new Date(lastActions[c.id].creado_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div>
                                                        <span style={{ fontWeight: '600' }}>{formatActionType(lastActions[c.id].tipo)}</span>
                                                        {lastActions[c.id].tareas?.nombre && (
                                                            <div style={{ fontSize: '0.78rem', color: '#1b5e20', marginTop: '2px', fontStyle: 'italic' }}>
                                                                📋 {lastActions[c.id].tareas.nombre}
                                                            </div>
                                                        )}
                                                        <div style={{ fontSize: '0.72rem', color: '#999', marginTop: '2px' }}>
                                                            🕐 {new Date(lastActions[c.id].creado_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    </div>
                                                )
                                            ) : (
                                                <span style={{ color: '#ccc' }}>Sin registros</span>
                                            )}
                                        </div>
                                    </td>
                                    <td style={styles.td}>
                                        {dailyActions[c.id] && dailyActions[c.id].length > 0 ? (
                                            <button 
                                                onClick={() => setSelectedUserTimeline(c)}
                                                style={styles.timelineBtn}
                                            >
                                                🕒 Ver {dailyActions[c.id].length} eventos
                                            </button>
                                        ) : (
                                            <span style={{ color: '#ccc', fontSize: '0.8rem' }}>Sin actividad hoy</span>
                                        )}
                                    </td>
                                    <td style={styles.td}>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button onClick={() => setEditingUser(c)} style={styles.editBtn}>⚙️ Configurar</button>
                                            {c.rol !== 'admin' && (
                                                <button 
                                                    onClick={() => handleDeleteUser(c.id)} 
                                                    style={{ ...styles.editBtn, backgroundColor: '#ffebee', color: '#c62828' }}
                                                >
                                                    🗑️ Eliminar
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* MODAL DE HISTORIAL DEL DÍA */}
            {selectedUserTimeline && (
                <div style={styles.modalOverlay} onClick={() => setSelectedUserTimeline(null)}>
                    <div style={styles.modal} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ color: '#1b5e20', margin: 0 }}>📋 Actividad de Hoy</h2>
                            <button onClick={() => setSelectedUserTimeline(null)} style={styles.closeBtn}>✕</button>
                        </div>
                        
                        <div style={{ borderLeft: '2px solid #e8f5e9', marginLeft: '10px', paddingLeft: '20px' }}>
                            <p style={{ fontWeight: 'bold', marginBottom: '15px', color: '#333' }}>{selectedUserTimeline.nombre_completo}</p>
                            <div style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '10px' }}>
                                {dailyActions[selectedUserTimeline.id]?.slice().reverse().map((act, idx) => (
                                    <div key={act.id} style={{ marginBottom: '15px', position: 'relative' }}>
                                        <div style={{
                                            position: 'absolute', left: '-26px', top: '4px',
                                            width: '10px', height: '10px', borderRadius: '50%',
                                            backgroundColor: getStatusLabel(act).color,
                                            border: '2px solid white',
                                            boxShadow: '0 0 5px rgba(0,0,0,0.1)'
                                        }}></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.9rem', fontWeight: '600' }}>{formatActionType(act.tipo)}</span>
                                            <span style={{ fontSize: '0.75rem', color: '#999' }}>{new Date(act.creado_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                        {act.tareas?.nombre && (
                                            <div style={{ fontSize: '0.8rem', color: '#1b5e20', marginTop: '2px', fontStyle: 'italic', background: '#f1f8e9', padding: '2px 8px', borderRadius: '4px', display: 'inline-block' }}>
                                                Tarea: {act.tareas.nombre}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE EDICIÓN DE PERMISOS */}
            {editingUser && (
                <div style={styles.modalOverlay} onClick={() => setEditingUser(null)}>
                    <div style={styles.modal} onClick={e => e.stopPropagation()}>
                        <h2 style={{ color: '#1b5e20', marginTop: 0 }}>⚙️ Configurar Colaborador</h2>
                        <form onSubmit={handleSaveUser}>
                            <div style={styles.field}>
                                <label style={styles.label}>Nombre Completo</label>
                                <input 
                                    style={styles.input}
                                    value={editingUser.nombre_completo}
                                    onChange={(e) => setEditingUser({...editingUser, nombre_completo: e.target.value})}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '15px' }}>
                                <div style={{ ...styles.field, flex: 1 }}>
                                    <label style={styles.label}>Rol</label>
                                    <select 
                                        style={styles.input}
                                        value={editingUser.rol}
                                        onChange={(e) => setEditingUser({...editingUser, rol: e.target.value})}
                                    >
                                        <option value="colaborador">Colaborador</option>
                                        <option value="admin">Administrador</option>
                                    </select>
                                </div>
                                <div style={{ ...styles.field, flex: 1 }}>
                                    <label style={styles.label}>Departamento</label>
                                    <input 
                                        style={styles.input}
                                        value={editingUser.departamento || ''}
                                        onChange={(e) => setEditingUser({...editingUser, departamento: e.target.value})}
                                        placeholder="Ej: Ventas, Operaciones"
                                    />
                                </div>
                            </div>

                            <h4 style={{ margin: '20px 0 10px 0', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>Permisos de Control</h4>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div style={styles.checkboxLine}>
                                    <input type="checkbox" checked={editingUser.puede_editar} onChange={(e) => setEditingUser({...editingUser, puede_editar: e.target.checked})} id="p_edit" />
                                    <label htmlFor="p_edit" style={{ cursor: 'pointer' }}>Editar Precios</label>
                                </div>
                                <div style={styles.checkboxLine}>
                                    <input type="checkbox" checked={editingUser.puede_agregar} onChange={(e) => setEditingUser({...editingUser, puede_agregar: e.target.checked})} id="p_add" />
                                    <label htmlFor="p_add" style={{ cursor: 'pointer' }}>Agregar Catálogo</label>
                                </div>
                                <div style={styles.checkboxLine}>
                                    <input type="checkbox" checked={editingUser.puede_inventario} onChange={(e) => setEditingUser({...editingUser, puede_inventario: e.target.checked})} id="p_inv" />
                                    <label htmlFor="p_inv" style={{ cursor: 'pointer' }}>Actualizar Stock</label>
                                </div>
                                <div style={styles.checkboxLine}>
                                    <input type="checkbox" checked={editingUser.puede_eliminar} onChange={(e) => setEditingUser({...editingUser, puede_eliminar: e.target.checked})} id="p_del" />
                                    <label htmlFor="p_del" style={{ cursor: 'pointer' }}>Eliminar Registros</label>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '10px', marginTop: '30px' }}>
                                <button 
                                    type="button" 
                                    onClick={() => setEditingUser(null)} 
                                    style={{ ...styles.btn, background: '#f5f5f5', color: '#666' }}
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={isSaving}
                                    style={{ ...styles.btn, background: '#1b5e20', color: 'white', flex: 1 }}
                                >
                                    {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

const styles = {
    container: {
        padding: '40px 30px',
        backgroundColor: '#fdfbc0',
        minHeight: '100vh'
    },
    headerRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '40px',
        flexWrap: 'wrap',
        gap: '20px'
    },
    filterBox: {
        background: 'white',
        padding: '15px 20px',
        borderRadius: '15px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
    },
    dateLabel: {
        fontSize: '0.8rem',
        fontWeight: 'bold',
        color: '#1b5e20'
    },
    dateInput: {
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '8px 12px',
        fontSize: '0.9rem',
        outline: 'none',
        color: '#333',
        cursor: 'pointer'
    },
    addUserBtn: {
        backgroundColor: '#1b5e20',
        color: 'white',
        border: 'none',
        padding: '8px 15px',
        borderRadius: '20px',
        cursor: 'pointer',
        fontSize: '0.8rem',
        fontWeight: 'bold',
        transition: 'transform 0.2s',
        boxShadow: '0 4px 10px rgba(27, 94, 32, 0.2)'
    },
    mainTitle: {
        color: '#1b5e20',
        margin: '0 0 10px 0'
    },
    subtitle: {
        color: '#666',
        marginBottom: '40px'
    },
    tableCard: {
        background: 'white',
        padding: '25px',
        borderRadius: '20px',
        boxShadow: "0 4px 25px rgba(0,0,0,0.06)",
        overflowX: 'auto'
    },
    table: {
        width: '100%',
        borderCollapse: 'collapse'
    },
    tableHeader: {
        borderBottom: '2px solid #fdfbc0',
        textAlign: 'left'
    },
    th: {
        padding: '15px',
        color: '#666',
        fontSize: '0.9rem',
        fontWeight: '600'
    },
    td: {
        padding: '18px 15px',
        borderBottom: '1px solid #f8f8f8',
        color: '#333',
        fontSize: '0.95rem'
    },
    editBtn: {
        background: '#e8f5e9',
        border: 'none',
        padding: '6px 15px',
        borderRadius: '20px',
        cursor: 'pointer',
        color: '#1b5e20',
        fontWeight: 'bold',
        fontSize: '0.85rem'
    },
    statusBadge: {
        color: 'white',
        padding: '5px 12px',
        borderRadius: '15px',
        fontSize: '0.75rem',
        fontWeight: 'bold',
        display: 'inline-block'
    },
    timelineBtn: {
        background: 'none',
        border: '1px solid #1b5e20',
        color: '#1b5e20',
        padding: '5px 12px',
        borderRadius: '15px',
        fontSize: '0.8rem',
        cursor: 'pointer',
        fontWeight: '600',
        transition: 'all 0.2s'
    },
    modalOverlay: {
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        backdropFilter: 'blur(3px)'
    },
    modal: {
        background: 'white',
        padding: '30px',
        borderRadius: '20px',
        width: '90%',
        maxWidth: '500px',
        boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
        maxHeight: '90vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
    },
    closeBtn: {
        background: 'none',
        border: 'none',
        fontSize: '1.2rem',
        cursor: 'pointer',
        color: '#999'
    },
    field: { marginBottom: '15px' },
    label: { display: 'block', fontSize: '0.8rem', color: '#666', marginBottom: '5px', fontWeight: 'bold' },
    input: {
        width: '100%',
        padding: '10px',
        borderRadius: '10px',
        border: '1px solid #ddd',
        fontSize: '0.9rem',
        boxSizing: 'border-box',
        outline: 'none'
    },
    checkboxLine: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '10px',
        fontSize: '0.9rem',
        color: '#444'
    },
    btn: {
        padding: '12px 20px',
        borderRadius: '10px',
        border: 'none',
        fontWeight: 'bold',
        cursor: 'pointer',
        fontSize: '0.9rem',
        transition: 'opacity 0.2s'
    }
};
