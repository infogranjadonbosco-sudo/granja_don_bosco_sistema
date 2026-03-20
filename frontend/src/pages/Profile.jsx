import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { uploadBrandLogo, removeBrandLogo } from '../components/BrandLogo';

const Profile = () => {
    const [activeTab, setActiveTab] = useState('perfil'); // 'perfil', 'correo', 'seguridad'
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [perfil, setPerfil] = useState(null);
    const [fotoUrl, setFotoUrl] = useState(null);
    const fileInputRef = useRef(null);
    const [newEmail, setNewEmail] = useState('');
    const [emailLoading, setEmailLoading] = useState(false);
    const [emailMessage, setEmailMessage] = useState({ type: '', text: '' });

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data } = await supabase
                .from("usuarios")
                .select("*")
                .eq("id", user.id)
                .maybeSingle();

            if (data) {
                setPerfil(data);
                setFotoUrl(data?.foto_url || null);
            } else {
                // Si es la primera vez que entra, le armaremos un perfil básico con su correo
                const nombreEmail = user.email.split('@')[0]
                const nombre = nombreEmail.split('.').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
                const perfilBasico = {
                    nombre_completo: nombre,
                    correo: user.email,
                    rol: 'colaborador',
                    departamento: 'Sin asignar'
                };
                setPerfil(perfilBasico);
            }
        }
    };

    const handleUploadPhoto = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setMessage({ type: 'error', text: 'Solo se permiten imágenes (JPG, PNG, etc.)' });
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            setMessage({ type: 'error', text: 'La imagen no puede pesar más de 2MB' });
            return;
        }

        setUploading(true);
        setMessage({ type: '', text: '' });

        const { data: { user } } = await supabase.auth.getUser();
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/avatar.${fileExt}`;

        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(fileName, file, { upsert: true });

        if (uploadError) {
            setMessage({ type: 'error', text: 'Error al subir: ' + uploadError.message });
            setUploading(false);
            return;
        }

        const { data: urlData } = supabase.storage
            .from('avatars')
            .getPublicUrl(fileName);

        const publicUrl = urlData.publicUrl + '?t=' + Date.now();

        const { error: updateError } = await supabase
            .from("usuarios")
            .update({ foto_url: publicUrl })
            .eq("id", user.id);

        if (updateError) {
            setMessage({ type: 'error', text: 'Error al guardar: ' + updateError.message });
        } else {
            setFotoUrl(publicUrl);
            setMessage({ type: 'success', text: '¡Foto actualizada! 📸' });
            setTimeout(() => setMessage({ type: '', text: '' }), 3000);
        }
        setUploading(false);
    };

    const handleRemovePhoto = async () => {
        if (!window.confirm("¿Quieres quitar tu foto de perfil?")) return;
        
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        
        // Simplemente ponemos a null la URL en la BD
        const { error } = await supabase
            .from("usuarios")
            .update({ foto_url: null })
            .eq("id", user.id);
            
        if (error) {
            setMessage({ type: 'error', text: 'Error al quitar foto: ' + error.message });
        } else {
            setFotoUrl(null);
            setMessage({ type: 'success', text: '¡Foto quitada! Se usará el avatar genérico.' });
            setTimeout(() => setMessage({ type: '', text: '' }), 3000);
        }
        setLoading(false);
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            setMessage({ type: 'error', text: 'Las contraseñas no coinciden' });
            return;
        }

        if (newPassword.length < 6) {
            setMessage({ type: 'error', text: 'La contraseña debe tener al menos 6 caracteres' });
            return;
        }

        setLoading(true);
        setMessage({ type: '', text: '' });

        const { error } = await supabase.auth.updateUser({ password: newPassword });

        if (error) {
            setMessage({ type: 'error', text: 'Error: ' + error.message });
        } else {
            setMessage({ type: 'success', text: '¡Contraseña actualizada con éxito!' });
            setNewPassword('');
            setConfirmPassword('');
        }
        setLoading(false);
    };

    const handleChangeEmail = async (e) => {
        e.preventDefault();
        if (!newEmail || !newEmail.includes('@')) {
            setEmailMessage({ type: 'error', text: 'Ingresa un correo válido' });
            return;
        }

        setEmailLoading(true);
        setEmailMessage({ type: '', text: '' });

        const { error } = await supabase.auth.updateUser({ email: newEmail });

        if (error) {
            setEmailMessage({ type: 'error', text: 'Error: ' + error.message });
        } else {
            setEmailMessage({ type: 'success', text: 'Se ha enviado un correo de confirmación a tu nueva dirección.' });
            setNewEmail('');
        }
        setEmailLoading(false);
    };

    const getInitials = (name) => {
        return name?.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() || '??';
    };

    return (
        <div style={styles.container}>
            <div style={styles.card}>

                {/* CABECERA DEL PERFIL (Siempre visible) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '30px' }}>
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        style={styles.avatarContainer(fotoUrl)}
                    >
                        {fotoUrl ? (
                            <img src={fotoUrl} alt="Foto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <span style={{ fontSize: '2rem', color: '#1b5e20' }}>
                                {perfil ? getInitials(perfil.nombre_completo) : '👤'}
                            </span>
                        )}
                        <div style={styles.avatarOverlay}>📷 {uploading ? '...' : ''}</div>
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleUploadPhoto}
                        style={{ display: 'none' }}
                    />
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <h2 style={{ margin: 0, color: '#1b5e20', fontSize: '1.4rem' }}>{perfil?.nombre_completo || 'Cargando...'}</h2>
                                {perfil?.rol === 'admin' && (
                                    <span style={{ backgroundColor: '#c5a059', color: 'white', padding: '3px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 'bold', letterSpacing: '0.5px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                                        🌟 GERENCIA VIP
                                    </span>
                                )}
                            </div>
                            {(() => {
                                const name = perfil?.nombre_completo?.toLowerCase().trim();
                                let title = "";
                                if (name?.includes("jose ramirez")) title = "Gerente General";
                                else if (name?.includes("ricardo alas")) title = "Subgerente";
                                else if (name?.includes("roberto medina")) title = "Coordinador General";

                                if (title) return <span style={{ fontSize: '0.75rem', color: '#1b5e20', fontWeight: 'bold', opacity: 0.8 }}>{title}</span>;
                                return null;
                            })()}
                            <p style={{ margin: '0 0 3px 0', fontSize: '0.85rem', color: '#666', fontWeight: '500' }}>
                                {perfil?.rol === 'admin'
                                    ? `👑 Administrador · ${perfil?.departamento || 'Gerencia'}`
                                    : '👷 Colaborador'}
                            </p>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: '#a0a0a0' }}>{perfil?.correo}</p>
                        </div>
                    </div>
                    {fotoUrl && (
                        <button 
                            onClick={handleRemovePhoto}
                            style={{ 
                                background: '#fff', border: '1.5px solid #d32f2f', padding: '6px 12px', 
                                borderRadius: '20px', fontSize: '0.75rem', color: '#d32f2f', cursor: 'pointer',
                                height: 'fit-content', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px',
                                transition: 'all 0.2s'
                            }}
                            onMouseOver={(e) => { e.target.style.background = '#fff5f5'; }}
                            onMouseOut={(e) => { e.target.style.background = '#fff'; }}
                        >
                            🗑️ Quitar Foto
                        </button>
                    )}
                </div>

                {message.type === 'success' && activeTab === 'perfil' && (
                    <div style={styles.toastSuccess}>{message.text}</div>
                )}

                {/* MENÚ DE PESTAÑAS */}
                <div style={styles.tabsWrapper}>
                    <button style={activeTab === 'perfil' ? styles.activeTab : styles.tab} onClick={() => setActiveTab('perfil')}>
                        👤 Detalles
                    </button>
                    <button style={activeTab === 'correo' ? styles.activeTab : styles.tab} onClick={() => setActiveTab('correo')}>
                        📧 Correo
                    </button>
                    <button style={activeTab === 'seguridad' ? styles.activeTab : styles.tab} onClick={() => setActiveTab('seguridad')}>
                        🔒 Seguridad
                    </button>
                    {perfil?.rol === 'admin' && (
                        <button style={activeTab === 'personalizacion' ? styles.activeTab : styles.tab} onClick={() => setActiveTab('personalizacion')}>
                            ⚙️ Personalización
                        </button>
                    )}
                </div>

                {/* ÁREA DE CONTENIDO */}
                <div style={styles.contentArea}>

                    {/* PESTAÑA: DETALLES */}
                    {activeTab === 'perfil' && (
                        <div style={{ animation: 'fadeIn 0.3s ease', textAlign: 'center', padding: '20px 0' }}>
                            <p style={{ color: '#555', lineHeight: '1.6', margin: 0 }}>
                                ¡Hola, <b>{perfil?.nombre_completo || perfil?.correo?.split('@')[0] || 'Usuario'}</b>! 👋
                                <br /><br />
                                Haz clic en tu foto para cambiarla.<br />
                                Usa las pestañas superiores para editar tus credenciales.
                            </p>
                        </div>
                    )}

                    {/* PESTAÑA: CORREO */}
                    {activeTab === 'correo' && (
                        <div style={{ animation: 'fadeIn 0.3s ease' }}>
                            <h3 style={styles.sectionTitle}>Actualizar Correo</h3>
                            <p style={styles.sectionDesc}>Ingresa tu nueva dirección de correo electrónico.</p>

                            <form onSubmit={handleChangeEmail} style={styles.form}>
                                <div style={styles.inputGroup}>
                                    <label style={styles.label}>Nuevo Correo</label>
                                    <input
                                        type="email"
                                        value={newEmail}
                                        onChange={(e) => setNewEmail(e.target.value)}
                                        placeholder="tucorreo@ejemplo.com"
                                        style={styles.input}
                                        required
                                    />
                                </div>
                                {emailMessage.text && (
                                    <div style={emailMessage.type === 'success' ? styles.toastSuccess : styles.toastError}>
                                        {emailMessage.text}
                                    </div>
                                )}
                                <button type="submit" disabled={emailLoading} style={emailLoading ? styles.buttonDisabled : styles.button}>
                                    {emailLoading ? 'Actualizando...' : 'Cambiar Correo'}
                                </button>
                            </form>
                        </div>
                    )}

                    {/* PESTAÑA: SEGURIDAD */}
                    {activeTab === 'seguridad' && (
                        <div style={{ animation: 'fadeIn 0.3s ease' }}>
                            <h3 style={styles.sectionTitle}>Actualizar Contraseña</h3>
                            <p style={styles.sectionDesc}>Crea una nueva contraseña provisional.</p>

                            <form onSubmit={handleChangePassword} style={styles.form}>
                                <div style={styles.inputGroup}>
                                    <label style={styles.label}>Nueva Contraseña</label>
                                    <input
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="Mínimo 6 caracteres"
                                        style={styles.input}
                                        required
                                    />
                                </div>
                                <div style={styles.inputGroup}>
                                    <label style={styles.label}>Confirmar Contraseña</label>
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Repite tu contraseña"
                                        style={styles.input}
                                        required
                                    />
                                </div>
                                {message.text && (
                                    <div style={message.type === 'success' ? styles.toastSuccess : styles.toastError}>
                                        {message.text}
                                    </div>
                                )}
                                <button type="submit" disabled={loading} style={loading ? styles.buttonDisabled : styles.button}>
                                    {loading ? 'Actualizando...' : 'Actualizar Contraseña'}
                                </button>
                            </form>
                            <div style={styles.infoBox}>
                                <p style={styles.infoText}><b>Nota:</b> Se cerrará la sesión en otros dispositivos por seguridad.</p>
                            </div>
                        </div>
                    )}
                    {activeTab === 'personalizacion' && perfil?.rol === 'admin' && (
                        <div style={{ animation: 'fadeIn 0.3s ease' }}>
                            <h3 style={styles.sectionTitle}>⚙️ Personalización del Sistema</h3>
                            <p style={styles.sectionDesc}>Cambia la apariencia gráfica de Granja Don Bosco.</p>

                            <div style={styles.form}>
                                <div style={styles.inputGroup}>
                                    <label style={styles.label}>Logotipo de la Empresa</label>
                                    <p style={{ fontSize: '0.8rem', color: '#666', margin: '0 0 10px 0' }}>El logo aparecerá en la tienda pública y en la pantalla de inicio de sesión.</p>
                                    <input type="file" id="brandLogoUpload" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
                                        const file = e.target.files[0];
                                        if (file) {
                                            const res = await uploadBrandLogo(file);
                                            if (res.error) alert("Error subiendo el logo: " + res.error.message);
                                            else alert("¡Logo oficial actualizado para toda la app!");
                                        }
                                    }} />
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <button
                                            type="button"
                                            onClick={() => document.getElementById('brandLogoUpload').click()}
                                            style={{ ...styles.button, backgroundColor: '#f57c00', flex: 1 }}
                                        >
                                            🖼️ Subir Nuevo Logo
                                        </button>
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                if (window.confirm("¿Estás seguro de quitar el logo oficial de la granja? Se restablecerá el diseño original.")) {
                                                    const res = await removeBrandLogo();
                                                    if (res.error) alert("Error: " + res.error.message);
                                                    else alert("¡Logo restablecido! Ahora se usa el diseño original (Emoji 🚜).");
                                                }
                                            }}
                                            style={{ 
                                                ...styles.button, 
                                                backgroundColor: '#fff', 
                                                color: '#d32f2f', 
                                                border: '1.5px solid #d32f2f',
                                                flex: 1 
                                            }}
                                        >
                                            ♻️ Restablecer Original
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </div>
            <style>{`
                @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
};

const styles = {
    container: { padding: '40px 20px', backgroundColor: '#fdfbc0', minHeight: '80vh', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' },
    card: { backgroundColor: 'white', padding: '40px', borderRadius: '16px', boxShadow: '0 8px 30px rgba(0,0,0,0.08)', width: '100%', maxWidth: '600px' },
    avatarContainer: (fotoUrl) => ({
        width: '90px', height: '90px', borderRadius: '50%', cursor: 'pointer', position: 'relative', overflow: 'hidden',
        border: '3px solid #1b5e20', background: fotoUrl ? 'transparent' : '#e8f5e9',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
    }),
    avatarOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.5)', color: 'white', padding: '3px', fontSize: '0.65rem', textAlign: 'center' },
    tabsWrapper: { display: 'flex', gap: '10px', borderBottom: '2px solid #eee', marginBottom: '20px' },
    tab: { background: 'none', border: 'none', padding: '10px 20px', fontSize: '0.9rem', color: '#888', cursor: 'pointer', fontWeight: 'bold', borderBottom: '3px solid transparent', transition: 'all 0.2s' },
    activeTab: { background: 'none', border: 'none', padding: '10px 20px', fontSize: '0.9rem', color: '#1b5e20', cursor: 'pointer', fontWeight: 'bold', borderBottom: '3px solid #1b5e20', transition: 'all 0.2s' },
    contentArea: { minHeight: '250px' },
    sectionTitle: { color: '#1b5e20', margin: '0 0 5px 0', fontSize: '1.2rem' },
    sectionDesc: { color: '#666', marginBottom: '20px', fontSize: '0.85rem' },
    form: { display: 'flex', flexDirection: 'column', gap: '15px' },
    inputGroup: { display: 'flex', flexDirection: 'column', gap: '5px' },
    label: { fontSize: '0.8rem', fontWeight: 'bold', color: '#555' },
    input: { padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '0.95rem', outline: 'none' },
    button: { backgroundColor: '#1b5e20', color: 'white', padding: '12px', borderRadius: '8px', border: 'none', fontWeight: 'bold', fontSize: '0.95rem', marginTop: '10px', cursor: 'pointer', transition: 'background 0.2s' },
    buttonDisabled: { backgroundColor: '#acc5ae', color: 'white', padding: '12px', borderRadius: '8px', border: 'none', fontWeight: 'bold', fontSize: '0.95rem', marginTop: '10px', cursor: 'not-allowed' },
    toastSuccess: { padding: '10px', borderRadius: '8px', fontSize: '0.8rem', textAlign: 'center', backgroundColor: '#e8f5e9', color: '#2e7d32', border: '1px solid #a5d6a7' },
    toastError: { padding: '10px', borderRadius: '8px', fontSize: '0.8rem', textAlign: 'center', backgroundColor: '#ffebee', color: '#c62828', border: '1px solid #ef9a9a' },
    infoBox: { marginTop: '20px', padding: '12px', backgroundColor: '#f9f9f9', borderRadius: '8px', borderLeft: '3px solid #1b5e20' },
    infoText: { margin: 0, fontSize: '0.75rem', color: '#666' }
};

export default Profile;
