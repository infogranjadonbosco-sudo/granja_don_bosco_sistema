import { useEffect, useState, useRef } from "react";
import { supabase } from "../supabase";

export default function TeamChat() {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [user, setUser] = useState(null);
    const [perfil, setPerfil] = useState(null);
    const [usuarios, setUsuarios] = useState({});
    const [teamList, setTeamList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showTeam, setShowTeam] = useState(false);
    const messagesEndRef = useRef(null);

    // Datos de los grupos de chat
    const [grupos, setGrupos] = useState([]);
    const [activeGroup, setActiveGroup] = useState(null); // null = chat general
    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const [newGroupName, setNewGroupName] = useState("");
    const [selectedMembers, setSelectedMembers] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        initChat();
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Marcar mensajes como leídos cuando cambiamos de grupo o llegan mensajes nuevos
    useEffect(() => {
        if (!loading && user && messages.length > 0) {
            marcarComoLeidos();
        }
    }, [activeGroup, messages.length]);

    const marcarComoLeidos = async () => {
        const unreadIds = messages
            .filter(m => !m.leido && m.usuario_id !== user.id)
            .map(m => m.id);

        if (unreadIds.length > 0) {
            await supabase
                .from("mensajes_chat")
                .update({ leido: true })
                .in("id", unreadIds);
        }
    };

    // Cuando cambiamos de grupo, volvemos a traer los mensajes de ese grupo
    useEffect(() => {
        if (!loading && user) {
            loadMessages();
        }
    }, [activeGroup]);

    const getOnlineStatus = (lastSeen) => {
        if (!lastSeen) return { label: "Sin conexión", color: "#999", dot: "⚪" };
        const diff = (Date.now() - new Date(lastSeen).getTime()) / 60000;
        if (diff < 5) return { label: "En línea", color: "#2e7d32", dot: "🟢" };
        if (diff < 30) return { label: "Ausente", color: "#f57c00", dot: "🟡" };
        return { label: formatLastSeen(lastSeen), color: "#999", dot: "🔴" };
    };

    const formatLastSeen = (dateStr) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        const hrs = Math.floor(diff / 3600000);
        if (mins < 60) return `hace ${mins} min`;
        if (hrs < 24) return `hace ${hrs}h`;
        return new Date(dateStr).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    };

    const initChat = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);

        const { data: perfilData } = await supabase.from("usuarios").select("*").eq("id", user.id).maybeSingle();
        setPerfil(perfilData);

        const { data: allUsers } = await supabase.from("usuarios").select("id, nombre_completo, rol, departamento, ultima_conexion");
        const usersMap = {};
        (allUsers || []).forEach(u => { usersMap[u.id] = u; });
        setUsuarios(usersMap);
        setTeamList(allUsers || []);

        // Traemos los grupos donde participa este usuario
        const { data: gruposData } = await supabase.from("grupos_chat").select("*");
        setGrupos(gruposData || []);

        // Traemos los últimos mensajes del chat general
        const { data: msgs } = await supabase
            .from("mensajes_chat")
            .select("*")
            .is("grupo_id", null)
            .order("creado_at", { ascending: true })
            .limit(50);
        setMessages(msgs || []);
        setLoading(false);

        // Esto hace que los mensajes nuevos aparezcan al instante sin recargar
        supabase
            .channel('chat-room')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'mensajes_chat' }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    const msg = payload.new;
                    setMessages(prev => {
                        if (prev.some(m => m.id === msg.id)) return prev;
                        return [...prev, msg];
                    });
                } else if (payload.eventType === 'UPDATE') {
                    const updatedMsg = payload.new;
                    setMessages(prev => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
                }
            })
            .subscribe();
    };

    const loadMessages = async () => {
        let query = supabase
            .from("mensajes_chat")
            .select("*")
            .order("creado_at", { ascending: true })
            .limit(50);

        if (activeGroup) {
            query = query.eq("grupo_id", activeGroup);
        } else {
            query = query.is("grupo_id", null);
        }

        const { data } = await query;
        setMessages(data || []);
    };

    const sendMessage = async (e) => {
        if (e) e.preventDefault();
        if (!newMessage.trim()) return;

        const { error } = await supabase.from("mensajes_chat").insert([{
            usuario_id: user.id,
            nombre_usuario: perfil?.nombre_completo || user.email,
            mensaje: newMessage.trim(),
            rol_usuario: perfil?.rol || 'colaborador',
            grupo_id: activeGroup || null
        }]);

        if (!error) {
            setNewMessage("");
            loadMessages();
        } else {
            alert("Error al enviar: " + error.message);
        }
    };

    const deleteMessage = async (msgId) => {
        if (!window.confirm("¿Eliminar este mensaje?")) return;
        const { error } = await supabase
            .from("mensajes_chat")
            .update({ mensaje: "🚫 Este mensaje fue eliminado", eliminado: true })
            .eq("id", msgId);
        if (error) console.error(error);
    };

    const editMessage = async (msgId, oldText) => {
        const nuevoTexto = prompt("Editar mensaje:", oldText);
        if (nuevoTexto && nuevoTexto.trim() !== "" && nuevoTexto !== oldText) {
            const { error } = await supabase
                .from("mensajes_chat")
                .update({ mensaje: nuevoTexto.trim(), editado: true })
                .eq("id", msgId);
            if (error) console.error(error);
        }
    };

    const addEmoji = (emoji) => {
        setNewMessage(prev => prev + emoji);
    };

    const createGroup = async () => {
        if (!newGroupName.trim() || selectedMembers.length === 0) {
            alert("Necesitas un nombre y al menos 1 miembro.");
            return;
        }

        const allMembers = [...selectedMembers, user.id]; // Incluir al creador
        const { error } = await supabase.from("grupos_chat").insert([{
            nombre: newGroupName.trim(),
            creador_id: user.id,
            miembros: allMembers
        }]);

        if (!error) {
            alert("¡Grupo creado! 🎉");
            setNewGroupName("");
            setSelectedMembers([]);
            setShowCreateGroup(false);
            // Actualizamos la lista de grupos después de crear uno nuevo
            const { data } = await supabase.from("grupos_chat").select("*");
            setGrupos(data || []);
        } else {
            alert("Error: " + error.message);
        }
    };

    const toggleMember = (id) => {
        setSelectedMembers(prev =>
            prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
        );
    };

    const escribirPrivado = async (member) => {
        if (!member) return;

        // Si el usuario se manda mensaje a sí mismo, buscamos su chat de "Mis Notas"
        const isSelf = member.id === user.id;

        // Primero revisamos si ya existe una conversación privada entre estos dos
        const myPrivates = grupos.filter(g => {
            if (isSelf) {
                return g.miembros?.length === 1 && g.miembros.includes(user.id) && g.nombre.includes("Notas");
            }
            return g.miembros?.length === 2 && 
                   g.miembros.includes(user.id) && 
                   g.miembros.includes(member.id);
        });

        if (myPrivates.length > 0) {
            setActiveGroup(myPrivates[0].id);
        } else {
            // Si no existía, creamos la conversación privada automáticamente
            const { data, error } = await supabase.from("grupos_chat").insert([{
                nombre: isSelf ? "💬 Auto-mensajearte" : `Chat con ${member.nombre_completo.split(' ')[0]}`,
                creador_id: user.id,
                miembros: isSelf ? [user.id] : [user.id, member.id]
            }]).select();

            if (!error && data) {
                setGrupos(prev => [...prev, data[0]]);
                setActiveGroup(data[0].id);
            }
        }
    };

    const formatTime = (dateStr) => new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const getInitials = (name) => name ? name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() : '??';

    const onlineCount = teamList.filter(u => {
        if (!u.ultima_conexion) return false;
        return (Date.now() - new Date(u.ultima_conexion).getTime()) / 60000 < 5;
    }).length;

    const activeGroupData = grupos.find(g => g.id === activeGroup);

    if (loading) return <div style={{ textAlign: 'center', padding: '50px', color: '#1b5e20' }}>Cargando chat...</div>;

    return (
        <div className="chat-container-responsive" style={{ height: 'calc(100vh - 85px)', maxWidth: '1200px', margin: '0 auto', backgroundColor: '#fdfbc0' }}>

            {/* SIDEBAR: Canales y Grupos */}
            <div className="chat-sidebar-responsive" style={{
                width: '230px', background: 'white', borderRadius: '15px 0 0 15px',
                padding: '15px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', overflowY: 'auto', flexShrink: 0
            }}>
                <h3 style={{ margin: '0 0 15px 0', color: '#1b5e20', fontSize: '1rem' }}>📢 Canales</h3>

                {/* Chat General */}
                <div
                    onClick={() => setActiveGroup(null)}
                    style={{
                        padding: '10px 12px', borderRadius: '10px', cursor: 'pointer', marginBottom: '5px',
                        background: activeGroup === null ? '#e8f5e9' : 'transparent',
                        fontWeight: activeGroup === null ? 'bold' : 'normal',
                        color: '#333', fontSize: '0.85rem'
                    }}
                >
                    🌐 Chat General
                </div>


                {/* Grupos y Conversaciones */}
                <h4 style={{ margin: '20px 0 10px 0', color: '#888', fontSize: '0.75rem', textTransform: 'uppercase' }}>Mensajes</h4>
                {grupos.filter(g => g.miembros?.length > 1).length === 0 && <p style={{ fontSize: '0.75rem', color: '#bbb', padding: '0 12px' }}>Sin mensajes aún</p>}
                
                {/* Listado de chats grupales y privados */}
                {grupos
                    .filter(g => g.miembros?.length > 1) 
                    .map(g => (
                    <div
                        key={g.id}
                        onClick={() => setActiveGroup(g.id)}
                        style={{
                            padding: '10px 12px', borderRadius: '10px', cursor: 'pointer', marginBottom: '5px',
                            background: activeGroup === g.id ? '#e8f5e9' : 'transparent',
                            fontWeight: activeGroup === g.id ? 'bold' : 'normal',
                            color: '#333', fontSize: '0.85rem'
                        }}
                    >
                        👥 {g.nombre}
                        <span style={{ display: 'block', fontSize: '0.65rem', color: '#aaa' }}>
                            {g.miembros?.length || 0} miembros
                        </span>
                    </div>
                ))}

                {/* Auto-mensajearte: Siempre al final del listado */}
                {grupos
                    .filter(g => g.miembros?.length === 1 && g.miembros.includes(user.id))
                    .map(g => (
                    <div
                        key={g.id}
                        onClick={() => setActiveGroup(g.id)}
                        style={{
                            padding: '10px 12px', borderRadius: '10px', cursor: 'pointer', marginTop: '10px',
                            background: activeGroup === g.id ? '#e8f5e9' : 'transparent',
                            fontWeight: activeGroup === g.id ? 'bold' : 'normal',
                            color: '#333', fontSize: '0.85rem',
                            borderTop: '1px solid #eee'
                        }}
                    >
                        💬 {g.nombre}
                        <span style={{ display: 'block', fontSize: '0.65rem', color: '#aaa' }}>
                            Tus notas personales
                        </span>
                    </div>
                ))}

                {/* Botón crear grupo */}
                <button
                    onClick={() => setShowCreateGroup(!showCreateGroup)}
                    style={{
                        width: '100%', marginTop: '10px', padding: '10px',
                        background: 'none', border: '2px dashed #ccc', borderRadius: '10px',
                        color: '#888', cursor: 'pointer', fontSize: '0.8rem'
                    }}
                >
                    + Crear Grupo
                </button>

                {/* Form crear grupo */}
                {showCreateGroup && (
                    <div style={{ marginTop: '15px', padding: '10px', background: '#f9f9f9', borderRadius: '10px' }}>
                        <input
                            type="text"
                            value={newGroupName}
                            onChange={(e) => setNewGroupName(e.target.value)}
                            placeholder="Nombre del grupo"
                            style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '8px', fontSize: '0.8rem', boxSizing: 'border-box' }}
                        />
                        <p style={{ fontSize: '0.7rem', color: '#666', margin: '5px 0' }}>Seleccionar miembros:</p>
                        <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                            {teamList.filter(t => t.id !== user.id).map(t => (
                                <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 0', fontSize: '0.75rem', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={selectedMembers.includes(t.id)}
                                        onChange={() => toggleMember(t.id)}
                                    />
                                    {t.nombre_completo}
                                    {t.rol === 'admin' && ' 👑'}
                                </label>
                            ))}
                        </div>
                        <button
                            onClick={createGroup}
                            style={{ width: '100%', marginTop: '8px', padding: '8px', background: '#1b5e20', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
                        >
                            Crear
                        </button>
                    </div>
                )}
            </div>

            {/* COLUMNA PRINCIPAL: CHAT */}
            <div className="chat-content-responsive" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'white' }}>
                {/* Header */}
                <div style={{
                    background: 'white', padding: '15px 20px',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                    <div>
                        <h2 style={{ margin: 0, color: '#1b5e20', fontSize: '1.2rem' }}>
                            {activeGroup ? `👥 ${activeGroupData?.nombre || 'Grupo'}` : '🌐 Chat General'}
                        </h2>
                        <p style={{ margin: 0, color: '#888', fontSize: '0.75rem' }}>
                            {activeGroup ? `${activeGroupData?.miembros?.length || 0} miembros` : 'Todo el equipo · Granja Don Bosco'}
                        </p>
                    </div>
                    <button
                        onClick={() => setShowTeam(!showTeam)}
                        style={{
                            background: '#e8f5e9', border: 'none', padding: '8px 15px', borderRadius: '20px',
                            fontSize: '0.8rem', color: '#2e7d32', fontWeight: 'bold', cursor: 'pointer'
                        }}
                    >
                        👥 {onlineCount}/{teamList.length}
                    </button>
                </div>

                {/* Mensajes */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px', background: '#f5f5dc', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {messages.length === 0 && (
                        <div style={{ textAlign: 'center', color: '#999', padding: '40px' }}>
                            <p style={{ fontSize: '2rem' }}>💬</p>
                            <p>{activeGroup ? '¡Inicia la conversación del grupo!' : '¡Sé el primero en enviar un mensaje!'}</p>
                        </div>
                    )}

                    {messages.map((msg, i) => {
                        const isOwn = msg.usuario_id === user?.id;
                        const isAdmin = msg.rol_usuario === 'admin';
                        const senderStatus = usuarios[msg.usuario_id] ? getOnlineStatus(usuarios[msg.usuario_id].ultima_conexion) : null;

                        return (
                            <div key={msg.id || i} style={{ display: 'flex', justifyContent: isOwn ? 'flex-end' : 'flex-start', gap: '8px', alignItems: 'flex-end' }}>
                                {!isOwn && (
                                    <div style={{ position: 'relative' }}>
                                        <div style={{
                                            width: '35px', height: '35px', borderRadius: '50%',
                                            background: isAdmin ? '#1b5e20' : '#FADADD',
                                            color: isAdmin ? 'white' : '#333',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '0.7rem', fontWeight: 'bold', flexShrink: 0
                                        }}>
                                            {isAdmin ? '👑' : getInitials(msg.nombre_usuario)}
                                        </div>
                                        {senderStatus && (
                                            <span style={{ position: 'absolute', bottom: '-2px', right: '-2px', fontSize: '0.5rem' }}>{senderStatus.dot}</span>
                                        )}
                                    </div>
                                )}

                                <div style={{
                                    maxWidth: '70%', padding: '10px 15px',
                                    borderRadius: isOwn ? '15px 15px 0 15px' : '15px 15px 15px 0',
                                    background: isOwn ? '#1b5e20' : 'white',
                                    color: isOwn ? 'white' : '#333',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                    position: 'relative',
                                    group: 'true' // Para simular hover si es necesario
                                }}>
                                    {!isOwn && (
                                        <p style={{ margin: '0 0 4px 0', fontSize: '0.7rem', fontWeight: 'bold', color: isAdmin ? '#1b5e20' : '#f57c00' }}>
                                            {msg.nombre_usuario} {isAdmin ? '👑' : ''}
                                        </p>
                                    )}
                                    <p style={{ 
                                        margin: 0, 
                                        fontSize: '0.9rem', 
                                        wordBreak: 'break-word',
                                        fontStyle: msg.eliminado ? 'italic' : 'normal',
                                        opacity: msg.eliminado ? 0.6 : 1
                                    }}>
                                        {msg.mensaje}
                                    </p>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            {msg.editado && !msg.eliminado && <span style={{ fontSize: '0.6rem', opacity: 0.5, fontStyle: 'italic' }}>(editado)</span>}
                                            {isOwn && !msg.eliminado && (
                                                <div className="message-actions" style={{ 
                                                    display: 'flex', 
                                                    gap: '10px', 
                                                    marginLeft: '5px',
                                                    borderLeft: '1px solid rgba(255,255,255,0.2)',
                                                    paddingLeft: '10px'
                                                }}>
                                                    <button 
                                                        onClick={() => editMessage(msg.id, msg.mensaje)} 
                                                        title="Editar mensaje"
                                                        style={{ 
                                                            background: 'none', border: 'none', cursor: 'pointer', 
                                                            fontSize: '0.8rem', opacity: 0.6, padding: 0,
                                                            transition: 'opacity 0.2s', color: isOwn ? 'white' : '#666'
                                                        }}
                                                    >
                                                        ✎
                                                    </button>
                                                    <button 
                                                        onClick={() => deleteMessage(msg.id)} 
                                                        title="Eliminar mensaje"
                                                        style={{ 
                                                            background: 'none', border: 'none', cursor: 'pointer', 
                                                            fontSize: '0.8rem', opacity: 0.6, padding: 0,
                                                            transition: 'opacity 0.2s', color: isOwn ? 'white' : '#666'
                                                        }}
                                                    >
                                                        🗑
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        <p style={{ margin: 0, fontSize: '0.65rem', opacity: 0.7 }}>{formatTime(msg.creado_at)}</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input y Emojis */}
                <div style={{ background: 'white', padding: '10px 20px', borderTop: '1px solid #eee' }}>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', overflowX: 'auto', paddingBottom: '5px' }}>
                        {["😊", "👍", "❤️", "😂", "🐄", "🐖", "🐓", "🐤", "🥚", "🥛", "🧀", "🌾", "🚜", "🚛", "👩‍🌾", "👨‍🌾"].map(e => (
                            <button key={e} onClick={() => addEmoji(e)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: '2px' }}>{e}</button>
                        ))}
                    </div>
                    <form onSubmit={sendMessage} style={{ display: 'flex', gap: '10px' }}>
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Escribe un mensaje..."
                            style={{
                                flex: 1, padding: '12px 15px', borderRadius: '25px', border: '1px solid #ddd',
                                outline: 'none', fontSize: '0.9rem'
                            }}
                        />
                        <button
                            type="submit"
                            style={{
                                background: '#1b5e20', color: 'white', border: 'none', width: '45px', height: '45px',
                                borderRadius: '50%', cursor: 'pointer', fontSize: '1.2rem', display: 'flex',
                                alignItems: 'center', justifyContent: 'center'
                            }}
                        >
                            ✈️
                        </button>
                    </form>
                </div>
            </div>

            {/* PANEL LATERAL: Estado del equipo */}
            {showTeam && (
                <div className="chat-sidebar-responsive" style={{
                    width: '230px', background: 'white', borderRadius: '0 15px 15px 0', padding: '15px',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.05)', overflowY: 'auto', flexShrink: 0
                }}>
                    <h3 style={{ margin: '0 0 10px 0', color: '#1b5e20', fontSize: '0.95rem' }}>👥 Mi Equipo</h3>
                    
                    {/* BUSCADOR DE PERSONAL */}
                    <input 
                        type="text" 
                        placeholder="🔍 Buscar persona..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '10px',
                            border: '1px solid #eee',
                            fontSize: '0.75rem',
                            marginBottom: '15px',
                            outline: 'none',
                            backgroundColor: '#f9f9f9'
                        }}
                    />

                    {teamList
                        .filter(m => m.nombre_completo?.toLowerCase().includes(searchTerm.toLowerCase()))
                        .sort((a, b) => {
                            const order = { "🟢": 0, "🟡": 1, "🔴": 2, "⚪": 3 };
                            return (order[getOnlineStatus(a.ultima_conexion).dot] || 3) - (order[getOnlineStatus(b.ultima_conexion).dot] || 3);
                        })
                        .map((member) => {
                            const status = getOnlineStatus(member.ultima_conexion);
                            const isSelf = member.id === user.id;
                            return (
                                <div 
                                    key={member.id} 
                                    onClick={() => escribirPrivado(member)}
                                    style={{ 
                                        display: 'flex', alignItems: 'center', gap: '8px', 
                                        padding: '8px', borderBottom: '1px solid #f5f5f5',
                                        cursor: 'pointer',
                                        borderRadius: '8px',
                                        transition: 'background 0.2s',
                                        background: isSelf ? '#fff9c433' : 'transparent'
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f9f9f9')}
                                    onMouseLeave={(e) => (e.currentTarget.style.background = isSelf ? '#fff9c433' : 'transparent')}
                                >
                                    <div style={{ position: 'relative' }}>
                                        <div style={{
                                            width: '30px', height: '30px', borderRadius: '50%',
                                            background: isSelf ? '#1b5e20' : (member.rol === 'admin' ? '#1b5e20' : '#FADADD'),
                                            color: 'white',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '0.6rem', fontWeight: 'bold'
                                        }}>
                                            {isSelf ? '💬' : (member.rol === 'admin' ? '👑' : getInitials(member.nombre_completo))}
                                        </div>
                                        {!isSelf && (
                                            <span style={{ position: 'absolute', bottom: '-2px', right: '-2px', fontSize: '0.45rem' }}>{status.dot}</span>
                                        )}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 'bold', color: '#333', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {isSelf ? 'Auto-mensajearte (Tú)' : member.nombre_completo}
                                        </p>
                                        <p style={{ margin: 0, fontSize: '0.6rem', color: isSelf ? '#2e7d32' : status.color }}>
                                            {isSelf ? 'Guarda tus mensajes aquí' : status.label}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                </div>
            )}
        </div>
    );
}

const styles = {
    announcement: {
        background: '#fff9c4',
        border: '1px solid #fbc02d',
        borderRadius: '15px',
        padding: '10px 15px',
        margin: '15px 0',
        display: 'flex',
        gap: '10px',
        alignItems: 'center',
        boxShadow: '0 2px 8px rgba(251, 192, 45, 0.1)',
        overflow: 'hidden'
    }
};
